import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import { Readable } from 'node:stream';
import type { LookupFunction } from 'node:net';

import ICAL from 'ical.js';

import { getEnv } from '$lib/server/env';

// Thin adapter for read-only ICS calendar feeds — the ONLY module that touches
// the `ical.js` parser and that performs the outbound feed fetch. Everything
// else (calendarSyncService) depends on the small surface below, mirroring the
// garmin.ts seam, so the fetch/parse can be swapped or injected in tests.
//
// SECURITY:
//  - The feed URL is user-supplied and fetched server-side, so it's an SSRF
//    vector. `assertSafePublicUrl` requires https and rejects loopback/private/
//    link-local/metadata addresses, re-checking on every redirect hop.
//  - A Google ICS "secret address" embeds a private token in its path, so the
//    URL is sensitive. We never put it in an error/log; `redactFeedError` scrubs
//    it defensively.

type ICALTime = InstanceType<typeof ICAL.Time>;
type ICALEvent = InstanceType<typeof ICAL.Event>;

/** One materializable event-instance, normalized out of the feed. */
export type ParsedIcsEvent = {
	uid: string;
	/** '' for non-recurring events; the RECURRENCE-ID slot for recurring ones. */
	recurrenceId: string;
	summary: string;
	description: string | null;
	scheduledDate: string; // YYYY-MM-DD (the event's own local date)
	durationSec: number | null;
	sequence: number | null;
	lastModified: string | null; // ISO
	/** STATUS:CANCELLED — treated as "absent from the feed" by reconciliation. */
	cancelled: boolean;
};

export type ParsedIcs = {
	calendarName: string | null;
	events: ParsedIcsEvent[];
	/** Count of events we couldn't parse — surfaced as `failed` in the run. */
	failed: number;
};

export type ConditionalHeaders = { etag?: string | null; lastModified?: string | null };

export type IcsFetchResult =
	| { status: 'changed'; raw: string; etag: string | null; lastModified: string | null }
	| { status: 'not_modified' };

/** Fetch a feed honoring conditional headers. Injectable for tests. Throws on
 * network/HTTP/safety/size failures (the caller classifies the outcome). */
export type FetchIcs = (url: string, conditional: ConditionalHeaders) => Promise<IcsFetchResult>;

// ── SSRF guard ──────────────────────────────────────────────────────────────

function ipv4IsPrivate(ip: string): boolean {
	const parts = ip.split('.').map(Number);
	if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
	const [a, b] = parts as [number, number, number, number];
	if (a === 0 || a === 127) return true; // this-host, loopback
	if (a === 10) return true; // private
	if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
	if (a === 169 && b === 254) return true; // link-local + cloud metadata
	if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16/12
	if (a === 192 && b === 168) return true; // private
	if (a === 192 && b === 0) return true; // 192.0.0/24, 192.0.2/24
	if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18/15
	if (a >= 224) return true; // multicast + reserved + broadcast
	return false;
}

function ipIsPrivateOrReserved(ip: string): boolean {
	const v = net.isIP(ip);
	if (v === 4) return ipv4IsPrivate(ip);
	if (v === 6) {
		const lower = ip.toLowerCase();
		if (lower === '::1' || lower === '::') return true; // loopback / unspecified
		if (lower.startsWith('::ffff:')) {
			// IPv4-mapped — validate the embedded v4 address.
			const tail = lower.slice('::ffff:'.length);
			return net.isIP(tail) === 4 ? ipv4IsPrivate(tail) : true;
		}
		if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
		if (/^f[cd]/.test(lower)) return true; // unique-local fc00::/7
		if (lower.startsWith('ff')) return true; // multicast
		if (lower.startsWith('2001:db8')) return true; // documentation
		return false;
	}
	return true; // not a recognizable IP → reject
}

/** Validate a user-supplied feed URL AND return the validated IP(s) so the
 * connection can be pinned to them. Requires https and rejects any host that
 * resolves to a private/reserved address. */
export async function resolveSafeFeedTarget(raw: string): Promise<{ url: URL; addresses: string[] }> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error('Enter a valid feed URL.');
	}
	if (url.protocol !== 'https:') {
		throw new Error('Calendar feed URL must use https.');
	}
	const host = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
	if (/^localhost$/i.test(host) || /\.local$/i.test(host)) {
		throw new Error('Calendar feed host is not allowed.');
	}
	if (net.isIP(host)) {
		if (ipIsPrivateOrReserved(host)) throw new Error('Calendar feed host is not allowed.');
		return { url, addresses: [host] };
	}
	let resolved: { address: string }[];
	try {
		resolved = await dns.lookup(host, { all: true });
	} catch {
		throw new Error('Could not resolve the calendar feed host.');
	}
	if (resolved.length === 0 || resolved.some((r) => ipIsPrivateOrReserved(r.address))) {
		throw new Error('Calendar feed host is not allowed.');
	}
	return { url, addresses: resolved.map((r) => r.address) };
}

/** Validate a user-supplied feed URL before fetching it. Returns the parsed URL.
 * The fetcher uses `resolveSafeFeedTarget` to also PIN the socket to the
 * validated IP (closing the rebinding window); this thin wrapper exists for
 * call sites that only need to validate. Re-checked per redirect hop. */
export async function assertSafePublicUrl(raw: string): Promise<URL> {
	return (await resolveSafeFeedTarget(raw)).url;
}

// Pin a fetch to a set of already-validated IPs: ignore the system resolver and
// connect only to an address resolveSafeFeedTarget approved. This closes the
// TOCTOU/DNS-rebinding gap where the guard resolves one (public) IP and the
// kernel later re-resolves to a private one. TLS SNI + cert validation still use
// the real hostname, so https feeds keep verifying correctly.
function pinnedLookup(addresses: string[]): LookupFunction {
	return ((_hostname: string, options: { all?: boolean }, callback: (...a: unknown[]) => void) => {
		const entries = addresses.map((address) => ({ address, family: net.isIP(address) }));
		if (options && options.all) callback(null, entries);
		else callback(null, entries[0]!.address, entries[0]!.family);
	}) as unknown as LookupFunction;
}

/** Single GET (no auto-redirect) over node:https with the socket pinned to
 * `addresses`. Returns a web `Response` so the caller treats it like `fetch`. */
function pinnedHttpsGet(
	urlStr: string,
	opts: { headers: Record<string, string>; signal: AbortSignal; addresses: string[] }
): Promise<Response> {
	return new Promise((resolve, reject) => {
		const u = new URL(urlStr);
		const req = https.request(
			{
				hostname: u.hostname,
				servername: u.hostname,
				port: u.port || 443,
				path: `${u.pathname}${u.search}`,
				method: 'GET',
				headers: opts.headers,
				lookup: pinnedLookup(opts.addresses),
				signal: opts.signal
			},
			(res) => {
				const status = res.statusCode ?? 0;
				const headers = new Headers();
				for (const [k, v] of Object.entries(res.headers)) {
					if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
					else if (typeof v === 'string') headers.set(k, v);
				}
				// 204/205/304 must carry a null body per the Response contract.
				if (status === 204 || status === 205 || status === 304) {
					res.resume();
					resolve(new Response(null, { status, headers }));
					return;
				}
				resolve(new Response(Readable.toWeb(res) as unknown as ReadableStream, { status, headers }));
			}
		);
		req.on('error', reject);
		req.end();
	});
}

// ── Fetch ─────────────────────────────────────────────────────────────────

async function readCapped(res: Response, maxBytes: number): Promise<string> {
	const declared = Number(res.headers.get('content-length') ?? '');
	if (Number.isFinite(declared) && declared > maxBytes) {
		throw new Error('Calendar feed is too large.');
	}
	if (!res.body) return '';
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) {
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel().catch(() => {});
				throw new Error('Calendar feed is too large.');
			}
			chunks.push(value);
		}
	}
	return Buffer.concat(chunks).toString('utf-8');
}

/** Default fetcher: manual redirects with a per-hop SSRF check, conditional
 * headers, an abort timeout, and a size cap. */
export const defaultFetchIcs: FetchIcs = async (rawUrl, conditional) => {
	const env = getEnv();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), env.CALENDAR_FETCH_TIMEOUT_MS);
	try {
		let current = rawUrl;
		for (let hop = 0; hop < 6; hop++) {
			// Validate AND pin: connect only to the IP we just approved, so a
			// rebinding flip between check and connect can't reach an internal host.
			const target = await resolveSafeFeedTarget(current);
			const headers: Record<string, string> = {
				accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5',
				'user-agent': 'OpenIbex-Calendar-Sync/1'
			};
			if (conditional.etag) headers['if-none-match'] = conditional.etag;
			if (conditional.lastModified) headers['if-modified-since'] = conditional.lastModified;

			const res = await pinnedHttpsGet(target.url.toString(), {
				headers,
				signal: controller.signal,
				addresses: target.addresses
			});

			if (res.status === 304) return { status: 'not_modified' };
			if (res.status >= 300 && res.status < 400) {
				const location = res.headers.get('location');
				if (!location) throw new Error(`Calendar feed redirect (${res.status}) had no location.`);
				current = new URL(location, current).toString();
				continue;
			}
			if (!res.ok) throw new Error(`Calendar feed responded with ${res.status}.`);

			const raw = await readCapped(res, env.CALENDAR_MAX_FEED_BYTES);
			return {
				status: 'changed',
				raw,
				etag: res.headers.get('etag'),
				lastModified: res.headers.get('last-modified')
			};
		}
		throw new Error('Calendar feed had too many redirects.');
	} finally {
		clearTimeout(timer);
	}
};

// ── Parse + expand ────────────────────────────────────────────────────────

function localDateOf(t: ICALTime): string {
	const y = String(t.year).padStart(4, '0');
	const m = String(t.month).padStart(2, '0');
	const d = String(t.day).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function durationOf(start: ICALTime, end: ICALTime): number | null {
	if (start.isDate) return null; // all-day → no meaningful workout duration
	const ms = end.toJSDate().getTime() - start.toJSDate().getTime();
	if (!Number.isFinite(ms) || ms <= 0) return null;
	return Math.round(ms / 1000);
}

function extractEvent(
	ev: ICALEvent,
	start: ICALTime,
	end: ICALTime,
	recurrenceId: string
): ParsedIcsEvent | null {
	const uid = ev.uid;
	if (!uid) return null;
	const status = String(ev.component.getFirstPropertyValue('status') ?? '').toUpperCase();
	const lm = ev.component.getFirstPropertyValue('last-modified') as ICALTime | null;
	let sequence: number | null = null;
	try {
		const s = ev.sequence;
		sequence = typeof s === 'number' && Number.isFinite(s) ? s : null;
	} catch {
		sequence = null;
	}
	return {
		uid,
		recurrenceId,
		summary: ev.summary ?? '',
		description: ev.description ?? null,
		scheduledDate: localDateOf(start),
		durationSec: durationOf(start, end),
		sequence,
		lastModified: lm && typeof lm.toJSDate === 'function' ? lm.toJSDate().toISOString() : null,
		cancelled: status === 'CANCELLED'
	};
}

export type ParseOptions = {
	windowStartMs: number;
	windowEndMs: number;
	maxOccurrences: number;
};

// Backstop on the recurrence iterator so a malformed/unbounded RRULE can't spin
// forever before reaching (or while inside) the window.
const HARD_ITER_CAP = 20_000;

/** Parse an ICS document into materializable event-instances within the window.
 * Recurring series are expanded (RRULE/RECURRENCE-ID/EXDATE honored by ical.js).
 * One malformed event is counted and skipped — it never sinks the whole feed.
 * Throws only if the document itself is fundamentally unparseable. */
export function parseIcsEvents(raw: string, opts: ParseOptions): ParsedIcs {
	const comp = new ICAL.Component(ICAL.parse(raw));
	const calRaw = comp.getFirstPropertyValue('x-wr-calname');
	const calendarName = typeof calRaw === 'string' && calRaw.length > 0 ? calRaw : null;

	const events: ParsedIcsEvent[] = [];
	let failed = 0;

	const vevents = comp.getAllSubcomponents('vevent');
	for (const ve of vevents) {
		let ev: ICALEvent;
		try {
			ev = new ICAL.Event(ve);
		} catch {
			failed++;
			continue;
		}
		// Recurrence exceptions are folded into their master automatically by
		// ical.js (getOccurrenceDetails), so skip them as standalone events.
		if (ev.isRecurrenceException()) continue;

		try {
			if (!ev.isRecurring()) {
				const startMs = ev.startDate.toJSDate().getTime();
				if (startMs < opts.windowStartMs || startMs > opts.windowEndMs) continue;
				const parsed = extractEvent(ev, ev.startDate, ev.endDate, '');
				if (parsed) events.push(parsed);
				continue;
			}

			const iter = ev.iterator();
			let emitted = 0;
			let iterations = 0;
			let next: ICALTime | null;
			while ((next = iter.next())) {
				if (++iterations > HARD_ITER_CAP) break;
				const nextMs = next.toJSDate().getTime();
				if (nextMs > opts.windowEndMs) break;
				if (nextMs < opts.windowStartMs) continue;
				let det;
				try {
					det = ev.getOccurrenceDetails(next);
				} catch {
					failed++;
					continue;
				}
				const parsed = extractEvent(det.item, det.startDate, det.endDate, det.recurrenceId.toString());
				if (parsed) {
					events.push(parsed);
					if (++emitted >= opts.maxOccurrences) break;
				}
			}
		} catch {
			failed++;
		}
	}

	return { calendarName, events, failed };
}

// ── Redaction ───────────────────────────────────────────────────────────────

/** Scrub the (secret-bearing) feed URL out of an error message before it's
 * logged or stored, and truncate. Defense-in-depth — our own messages don't
 * include the URL, but a thrown fetch/DNS error might. */
export function redactFeedError(err: unknown, url?: string): string {
	let msg = err instanceof Error ? err.message : String(err);
	if (url) {
		const safe = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		msg = msg.replace(new RegExp(safe, 'g'), '[feed-url]');
		try {
			const origin = new URL(url).origin;
			const safeOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			msg = msg.replace(new RegExp(`${safeOrigin}\\S*`, 'g'), '[feed-url]');
		} catch {
			/* ignore */
		}
	}
	return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}
