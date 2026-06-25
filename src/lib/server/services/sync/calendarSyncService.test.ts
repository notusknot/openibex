import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import {
	createCalendarSubscription,
	getCalendarSubscriptionById
} from '$lib/server/repositories/calendarSubscriptionsRepository';
import { listSyncedWorkoutsForSubscription } from '$lib/server/repositories/calendarSyncedWorkoutsRepository';
import { getPlannedWorkoutByIdForUser } from '$lib/server/repositories/plannedWorkoutsRepository';
import {
	deletePlannedWorkoutForUserService,
	updatePlannedWorkoutForUserService
} from '$lib/server/services/plannedWorkoutsService';
import { syncCalendarSubscription } from '$lib/server/services/sync/calendarSyncService';
import type { FetchIcs } from '$lib/server/sync/ics';

function setTestEnv(dataDir: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.OPEN_REGISTRATION = 'true';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = dataDir;
	process.env.OPENIBEX_UPLOAD_DIR = path.join(dataDir, 'uploads');
	process.env.OPENIBEX_STREAM_DIR = path.join(dataDir, 'streams');
	process.env.OPENIBEX_EXPORT_DIR = path.join(dataDir, 'exports');
	process.env.OPENIBEX_IMPORT_DIR = path.join(dataDir, 'imports');
	process.env.DATABASE_URL = `file:${path.join(dataDir, 'openibex.db')}`;
}

// Fixed clock so the materialization window is deterministic. Events live in the
// days just after NOW (well inside the 60-day horizon).
const NOW = Date.UTC(2026, 5, 8); // 2026-06-08

const pad = (n: number) => String(n).padStart(2, '0');

function vevent(
	uid: string,
	ymd: string,
	summary: string,
	durMin: number,
	opts: { rrule?: string; description?: string } = {}
): string {
	const endMin = 17 * 60 + durMin;
	const end = `${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
	return [
		'BEGIN:VEVENT',
		`UID:${uid}`,
		'DTSTAMP:20260101T000000Z',
		`DTSTART:${ymd}T170000Z`,
		`DTEND:${ymd}T${end}Z`,
		`SUMMARY:${summary}`,
		opts.rrule ? `RRULE:${opts.rrule}` : null,
		opts.description ? `DESCRIPTION:${opts.description}` : null,
		'END:VEVENT'
	]
		.filter(Boolean)
		.join('\n');
}

function ics(vevents: string[]): string {
	return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...vevents, 'END:VCALENDAR'].join('\n');
}

const fetchStub =
	(raw: string): FetchIcs =>
	async () => ({ status: 'changed', raw, etag: null, lastModified: null });

describe('calendarSyncService reconciliation (integration)', () => {
	let userId: string;
	let subId: string;

	async function sync(raw: string) {
		return syncCalendarSubscription(subId, { fetchIcs: fetchStub(raw), ignoreThrottle: true, now: NOW });
	}
	async function links() {
		return listSyncedWorkoutsForSubscription(subId);
	}
	async function linkFor(uid: string) {
		return (await links()).find((l) => l.link.icalUid === uid);
	}
	async function workoutFor(uid: string) {
		const l = await linkFor(uid);
		if (!l || !l.link.plannedWorkoutId) return null;
		return (await getPlannedWorkoutByIdForUser(l.link.plannedWorkoutId, userId)) ?? null;
	}

	beforeEach(async () => {
		const dataDir = `/tmp/openibex-calsync-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		userId = user.id;
		subId = crypto.randomUUID();
		await createCalendarSubscription({ id: subId, userId, url: 'https://example.com/team.ics', label: 'Team' });
	});

	it('materializes feed events as analyzed planned workouts on first sync', async () => {
		const r = await sync(ics([vevent('a@t', '20260610', 'Easy run', 60), vevent('b@t', '20260612', 'Bike intervals', 90)]));
		expect(r.outcome).toBe('ok');
		expect(r.created).toBe(2);

		const wa = await workoutFor('a@t');
		expect(wa?.title).toBe('Easy run');
		expect(wa?.sport).toBe('Run'); // inferred
		expect(wa?.plannedDurationSec).toBe(3600);
		expect(wa?.plannedLoad).toBe(70); // fallbackLoadScore reused
		expect((await linkFor('a@t'))?.link.state).toBe('synced');

		// The subscription's conditional-fetch state advanced.
		expect(getCalendarSubscriptionById(subId)?.lastEventCount).toBe(2);
	});

	it('auto-updates an untouched workout when upstream changes', async () => {
		await sync(ics([vevent('a@t', '20260610', 'Easy run', 60)]));
		const r = await sync(ics([vevent('a@t', '20260610', 'Easy run EXTENDED', 75)]));
		expect(r.updated).toBe(1);

		const wa = await workoutFor('a@t');
		expect(wa?.title).toBe('Easy run EXTENDED');
		expect(wa?.plannedDurationSec).toBe(75 * 60);
	});

	it('does nothing on an unchanged re-sync', async () => {
		const feed = ics([vevent('a@t', '20260610', 'Easy run', 60)]);
		await sync(feed);
		const r = await sync(feed);
		expect(r.created + r.updated).toBe(0);
		expect(r.unchanged).toBe(1);
	});

	it('preserves a user edit, then conflicts when upstream also changes', async () => {
		await sync(ics([vevent('a@t', '20260610', 'Easy run', 60)]));
		const w = (await workoutFor('a@t'))!;
		await updatePlannedWorkoutForUserService({
			userId,
			id: w.id,
			sport: 'Run',
			scheduledDate: w.scheduledDate,
			title: 'MY easy run',
			description: null,
			plannedDurationSec: w.plannedDurationSec,
			plannedDistanceM: null,
			plannedLoad: w.plannedLoad
		});

		// Same upstream → keep the user's version, mark it user_modified.
		const rp = await sync(ics([vevent('a@t', '20260610', 'Easy run', 60)]));
		expect(rp.preserved).toBe(1);
		expect((await workoutFor('a@t'))?.title).toBe('MY easy run');
		expect((await linkFor('a@t'))?.link.state).toBe('user_modified');

		// Now upstream ALSO changes → conflict, user's version still kept.
		const rc = await sync(ics([vevent('a@t', '20260610', 'Coach changed run', 80)]));
		expect(rc.conflicts).toBe(1);
		const lc = await linkFor('a@t');
		expect(lc?.link.state).toBe('conflict');
		expect(lc?.link.conflictJson).toBeTruthy();
		expect((await workoutFor('a@t'))?.title).toBe('MY easy run');

		// Re-syncing the same conflicting feed does not re-flag (de-spam).
		const rc2 = await sync(ics([vevent('a@t', '20260610', 'Coach changed run', 80)]));
		expect(rc2.conflicts).toBe(0);
	});

	it('keeps a user deletion durable against re-sync (tombstone)', async () => {
		await sync(ics([vevent('a@t', '20260610', 'Easy run', 60)]));
		const w = (await workoutFor('a@t'))!;
		await deletePlannedWorkoutForUserService({ userId, id: w.id });

		// FK set-null leaves the link as a tombstone.
		expect((await linkFor('a@t'))?.link.plannedWorkoutId).toBeNull();

		// The event is still in the feed, but it must NOT come back.
		const r = await sync(ics([vevent('a@t', '20260610', 'Easy run', 60)]));
		expect(r.created).toBe(0);
		expect(await workoutFor('a@t')).toBeNull();
	});

	it('removes an untouched workout dropped from the feed, but keeps + flags a customized one', async () => {
		await sync(ics([vevent('a@t', '20260610', 'Easy run', 60), vevent('b@t', '20260612', 'Bike', 90)]));
		const wb = (await workoutFor('b@t'))!;
		await updatePlannedWorkoutForUserService({
			userId,
			id: wb.id,
			sport: 'Bike',
			scheduledDate: wb.scheduledDate,
			title: 'MY bike',
			description: null,
			plannedDurationSec: wb.plannedDurationSec,
			plannedDistanceM: null,
			plannedLoad: wb.plannedLoad
		});

		const r = await sync(ics([])); // both gone upstream
		expect(r.removed).toBe(1); // a (untouched) deleted
		expect(r.cancelled).toBe(1); // b (customized) flagged

		expect(await workoutFor('a@t')).toBeNull();
		expect((await linkFor('b@t'))?.link.state).toBe('cancelled');
		expect((await workoutFor('b@t'))?.title).toBe('MY bike');
	});

	it('materializes one workout per occurrence of a recurring event', async () => {
		const r = await sync(ics([vevent('w@t', '20260609', 'Weekly intervals', 60, { rrule: 'FREQ=WEEKLY;COUNT=2' })]));
		expect(r.created).toBe(2);
		const series = (await links()).filter((l) => l.link.icalUid === 'w@t');
		expect(series).toHaveLength(2);
		expect(series.every((l) => l.link.recurrenceId !== '')).toBe(true);
		const dates = (await Promise.all(series.map((l) => workoutFor('w@t')))).filter(Boolean);
		expect(dates.length).toBeGreaterThan(0);
	});

	it('is a cheap no-op when the feed is unchanged (304)', async () => {
		const notModified: FetchIcs = async () => ({ status: 'not_modified' });
		const r = await syncCalendarSubscription(subId, { fetchIcs: notModified, ignoreThrottle: true, now: NOW });
		expect(r.outcome).toBe('not_modified');
		expect(r.created).toBe(0);
	});
});
