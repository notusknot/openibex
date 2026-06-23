import fs from 'node:fs/promises';

import type { Sport } from '$lib/server/db/schema';
import { walkFiles } from '$lib/server/services/imports/fsWalk';

export type GarminActivityMeta = {
	activityId: string;
	name: string;
	sportType: string; // raw Garmin sportType, e.g. "RUNNING"
	startTimeGmtMs: number;
};

export type GarminMetadataLookup = {
	totalActivities: number;
	byActivityId: Map<string, GarminActivityMeta>;
	byStartMinute: Map<number, GarminActivityMeta[]>;
};

const SPORT_KEYWORDS: Record<Sport, string[]> = {
	Run: ['RUN'],
	Bike: ['CYCLING', 'BIKING', 'BIKE'],
	Swim: ['SWIM'],
	Strength: ['STRENGTH', 'CARDIO'],
	Other: []
};

function emptyLookup(): GarminMetadataLookup {
	return { totalActivities: 0, byActivityId: new Map(), byStartMinute: new Map() };
}

function extractEntries(data: unknown): unknown[] {
	if (!data) return [];
	const wrappers = Array.isArray(data) ? data : [data];
	const out: unknown[] = [];
	for (const w of wrappers) {
		if (!w || typeof w !== 'object') continue;
		const rec = w as Record<string, unknown>;
		const list =
			(Array.isArray(rec['summarizedActivitiesExport']) && rec['summarizedActivitiesExport']) ||
			(Array.isArray(rec['summarizedActivities']) && rec['summarizedActivities']) ||
			(Array.isArray(rec['activities']) && rec['activities']) ||
			null;
		if (list) out.push(...(list as unknown[]));
	}
	// Some exports are a flat array of activity objects already.
	if (out.length === 0 && Array.isArray(data)) {
		for (const item of data as unknown[]) {
			if (item && typeof item === 'object' && 'activityId' in (item as object)) out.push(item);
		}
	}
	return out;
}

function roundToMinute(ms: number): number {
	return Math.round(ms / 60000) * 60000;
}

export async function loadGarminMetadata(rootPath: string): Promise<GarminMetadataLookup> {
	const lookup = emptyLookup();
	const seen = new Set<string>();

	for await (const file of walkFiles(rootPath)) {
		if (!/summarizedActivities[^/]*\.json$/i.test(file)) continue;
		if (seen.has(file)) continue;
		seen.add(file);
		let raw: string;
		try {
			raw = await fs.readFile(file, 'utf-8');
		} catch {
			continue;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			continue;
		}
		for (const entry of extractEntries(parsed)) {
			if (!entry || typeof entry !== 'object') continue;
			const rec = entry as Record<string, unknown>;
			const activityIdRaw = rec['activityId'];
			const name = typeof rec['name'] === 'string' ? (rec['name'] as string).trim() : '';
			if (!name) continue;
			const activityId = activityIdRaw != null ? String(activityIdRaw) : '';
			const sportType = typeof rec['sportType'] === 'string' ? (rec['sportType'] as string) : '';

			let startTimeGmtMs = 0;
			const start = rec['startTimeGmt'];
			if (typeof start === 'number' && Number.isFinite(start)) startTimeGmtMs = start;
			else if (typeof start === 'string') {
				const t = Date.parse(start);
				if (Number.isFinite(t)) startTimeGmtMs = t;
			}

			if (!startTimeGmtMs && !activityId) continue;

			const meta: GarminActivityMeta = { activityId, name, sportType, startTimeGmtMs };
			if (activityId) lookup.byActivityId.set(activityId, meta);
			if (startTimeGmtMs) {
				const minute = roundToMinute(startTimeGmtMs);
				const list = lookup.byStartMinute.get(minute) ?? [];
				list.push(meta);
				lookup.byStartMinute.set(minute, list);
			}
			lookup.totalActivities += 1;
		}
	}

	return lookup;
}

function sportMatches(meta: GarminActivityMeta, sport: Sport): boolean {
	const keywords = SPORT_KEYWORDS[sport];
	if (keywords.length === 0) return true;
	const upper = meta.sportType.toUpperCase();
	return keywords.some((k) => upper.includes(k));
}

export function resolveNameByFingerprint(
	lookup: GarminMetadataLookup,
	input: { sport: Sport; startTime: Date }
): string | null {
	if (lookup.totalActivities === 0) return null;
	const startMs = input.startTime.getTime();
	if (!Number.isFinite(startMs)) return null;

	// Allow a small ± slop in case the FIT timer time and Garmin GMT start drift by a minute.
	for (const delta of [0, -60000, 60000]) {
		const minute = roundToMinute(startMs + delta);
		const candidates = lookup.byStartMinute.get(minute);
		if (!candidates) continue;
		const sportHit = candidates.find((c) => sportMatches(c, input.sport));
		if (sportHit) return sportHit.name;
		// If no sport match but exactly one candidate at this minute, take it.
		if (candidates.length === 1) return candidates[0]!.name;
	}
	return null;
}
