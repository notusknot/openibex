export type CalendarSubscriptionInput = { url: string; label: string };

// Validates a user-supplied ICS feed URL at the form boundary. The deeper
// SSRF/host checks (private IPs, redirects) live in sync/ics.ts at fetch time;
// here we only enforce shape: https (webcal is normalized to https) + a label.
export function parseCalendarSubscriptionForm(
	form: FormData
): { ok: true; value: CalendarSubscriptionInput } | { ok: false; message: string } {
	const raw = String(form.get('url') ?? '').trim();
	if (raw.length === 0) return { ok: false, message: 'Enter a calendar feed URL.' };
	if (raw.length > 2048) return { ok: false, message: 'That URL is too long.' };

	let url = raw;
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, message: 'Enter a valid URL.' };
	}
	// Calendar apps often hand out webcal:// links — same feed over https.
	if (parsed.protocol === 'webcal:') {
		url = `https:${url.slice(parsed.protocol.length)}`;
		try {
			parsed = new URL(url);
		} catch {
			return { ok: false, message: 'Enter a valid URL.' };
		}
	}
	if (parsed.protocol !== 'https:') {
		return { ok: false, message: 'Calendar feed URL must use https.' };
	}

	const labelRaw = String(form.get('label') ?? '').trim();
	const label = (labelRaw.length > 0 ? labelRaw : parsed.host).slice(0, 120);

	return { ok: true, value: { url, label } };
}
