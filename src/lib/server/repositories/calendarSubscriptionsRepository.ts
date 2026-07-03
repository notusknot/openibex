import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '$lib/server/db/client';
import { getEnv } from '$lib/server/env';
import { calendarSubscriptions } from '$lib/server/db/schema';
import {
	isJobLockLive,
	releaseJobLock,
	tryAcquireJobLock,
	type JobLockRelease,
	type JobLockState
} from '$lib/server/repositories/jobLock';

export type DbCalendarSubscription = typeof calendarSubscriptions.$inferSelect;

export async function createCalendarSubscription(input: {
	id: string;
	userId: string;
	url: string;
	label: string;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.insert(calendarSubscriptions)
		.values({
			id: input.id,
			userId: input.userId,
			url: input.url,
			label: input.label,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

export async function listCalendarSubscriptionsForUser(userId: string): Promise<DbCalendarSubscription[]> {
	const db = getDb();
	return db
		.select()
		.from(calendarSubscriptions)
		.where(eq(calendarSubscriptions.userId, userId))
		.orderBy(asc(calendarSubscriptions.createdAt))
		.all();
}

export async function listEnabledCalendarSubscriptionsForUser(
	userId: string
): Promise<DbCalendarSubscription[]> {
	const db = getDb();
	return db
		.select()
		.from(calendarSubscriptions)
		.where(and(eq(calendarSubscriptions.userId, userId), eq(calendarSubscriptions.enabled, true)))
		.orderBy(asc(calendarSubscriptions.createdAt))
		.all();
}

export async function getCalendarSubscriptionForUser(
	id: string,
	userId: string
): Promise<DbCalendarSubscription | undefined> {
	const db = getDb();
	return db
		.select()
		.from(calendarSubscriptions)
		.where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)))
		.get();
}

export function getCalendarSubscriptionById(id: string): DbCalendarSubscription | undefined {
	const db = getDb();
	return db.select().from(calendarSubscriptions).where(eq(calendarSubscriptions.id, id)).get();
}

export async function setCalendarSubscriptionEnabled(
	id: string,
	userId: string,
	enabled: boolean
): Promise<void> {
	const db = getDb();
	db.update(calendarSubscriptions)
		.set({ enabled, updatedAt: new Date() })
		.where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)))
		.run();
}

export async function deleteCalendarSubscriptionForUser(id: string, userId: string): Promise<void> {
	const db = getDb();
	db.delete(calendarSubscriptions)
		.where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)))
		.run();
}

/** Record conditional-fetch state + last event count after a successful poll. */
export async function updateCalendarConditional(input: {
	id: string;
	etag: string | null;
	lastModified: string | null;
	lastEventCount: number;
}): Promise<void> {
	const db = getDb();
	db.update(calendarSubscriptions)
		.set({
			etag: input.etag,
			lastModified: input.lastModified,
			lastEventCount: input.lastEventCount,
			updatedAt: new Date()
		})
		.where(eq(calendarSubscriptions.id, input.id))
		.run();
}

export type CalendarAcquireOptions = {
	ignoreThrottle?: boolean;
	now?: number;
	throttleMs?: number;
	lockTtlMs?: number;
};

function lockStateOf(row: DbCalendarSubscription): JobLockState {
	return {
		status: row.status,
		lockedAt: row.lockedAt,
		lockedBy: row.lockedBy,
		lastAt: row.lastPolledAt,
		lastStatus: row.lastStatus,
		consecutiveFailures: row.consecutiveFailures,
		cooldownUntil: row.cooldownUntil
	};
}

/**
 * Atomically claim the poll lock for one subscription — the shared jobLock
 * coordination lock, per-subscription (a user may have several feeds, each
 * polled on its own clock) and mapped onto the subscription row's own
 * lock/throttle/breaker columns. A missing or disabled subscription is never
 * claimed. Returns true iff this caller should poll.
 */
export function tryAcquireCalendarSync(subscriptionId: string, opts: CalendarAcquireOptions = {}): boolean {
	return tryAcquireJobLock({
		read: (tx) => {
			const row = tx
				.select()
				.from(calendarSubscriptions)
				.where(eq(calendarSubscriptions.id, subscriptionId))
				.get();
			return row && row.enabled ? lockStateOf(row) : undefined;
		},
		claim: (tx, lockedAt, lockedBy) => {
			tx.update(calendarSubscriptions)
				.set({ status: 'running', lockedAt, lockedBy, updatedAt: lockedAt })
				.where(eq(calendarSubscriptions.id, subscriptionId))
				.run();
		},
		ignoreThrottle: opts.ignoreThrottle,
		now: opts.now,
		throttleMs: opts.throttleMs ?? getEnv().CALENDAR_SYNC_THROTTLE_MS,
		lockTtlMs: opts.lockTtlMs
	});
}

export type CalendarSyncRelease = JobLockRelease;

/** Release the lock and record the run. Success resets the breaker; failure
 * increments it and opens an escalating cool-down. Ownership-guarded by
 * jobLock: a stale poll reclaimed by a newer one can't clobber its state. */
export function releaseCalendarSync(
	subscriptionId: string,
	result: CalendarSyncRelease,
	now: number = Date.now()
): void {
	releaseJobLock({
		read: (tx) =>
			tx.select().from(calendarSubscriptions).where(eq(calendarSubscriptions.id, subscriptionId)).get(),
		write: (tx, next, owner) => {
			tx.update(calendarSubscriptions)
				.set({
					status: next.status,
					lockedAt: null,
					lockedBy: null,
					lastPolledAt: next.lastAt,
					lastStatus: next.lastStatus,
					lastError: next.lastError,
					consecutiveFailures: next.consecutiveFailures,
					cooldownUntil: next.cooldownUntil,
					updatedAt: next.lastAt
				})
				.where(and(eq(calendarSubscriptions.id, subscriptionId), eq(calendarSubscriptions.lockedBy, owner)))
				.run();
		},
		result,
		now
	});
}

export function isCalendarSyncRunning(
	row: Pick<DbCalendarSubscription, 'status' | 'lockedAt'>,
	now: number = Date.now(),
	lockTtlMs?: number
): boolean {
	return isJobLockLive(row, now, lockTtlMs);
}
