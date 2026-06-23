import crypto from 'node:crypto';
import zlib from 'node:zlib';

import { unsealJson, sealJson } from '$lib/server/sync/crypto';
import {
	GarminNoFitError,
	openGarminSession,
	redactGarminError,
	type GarminActivityRef,
	type GarminTokens,
	type OpenGarminSession
} from '$lib/server/sync/garmin';
import { FitNotAnActivityError, parseFit } from '$lib/server/parsers/fit/fitParser';
import {
	createActivity,
	getActivityByFingerprintForUser,
	getActivityBySourceActivityIdForUser,
	getActivityBySourceFileShaForUser
} from '$lib/server/repositories/activitiesRepository';
import { createActivityFile, getActivityFileByShaForUser } from '$lib/server/repositories/activityFilesRepository';
import {
	getGarminCredentialForUser,
	updateGarminSyncStatus,
	updateGarminTokens
} from '$lib/server/repositories/garminCredentialsRepository';
import { createImportBatch, updateImportBatchProgress } from '$lib/server/repositories/importBatchesRepository';
import { createImportItem, updateImportItem } from '$lib/server/repositories/importItemsRepository';
import { writeStreamBlob, writeUploadFile } from '$lib/server/services/fileStorageService';
import { composeSmartTitle } from '$lib/server/services/imports/titleStrategy';
import { beginCriticalWork, endCriticalWork, isShuttingDown } from '$lib/server/shutdown';
import {
	isSyncJobRunning,
	releaseSyncJob,
	tryAcquireSyncJob,
	type SyncJobRelease
} from '$lib/server/repositories/syncJobsRepository';

export const GARMIN_SYNC_SOURCE = 'garmin-sync';

// How many activities to pull on the very first sync (no prior cursor). Full
// history belongs to the bulk Garmin-export CLI; sync just keeps you current.
const INITIAL_LIMIT = 30;
const PAGE_SIZE = 20;
const MAX_PAGES = 10; // hard safety cap: at most 200 activities enumerated per run

export type SyncOutcome =
	| 'ok'
	| 'auth_failed'
	| 'rate_limited'
	| 'error'
	| 'skipped'
	| 'disabled'
	| 'no_credential';

export type SyncResult = {
	outcome: SyncOutcome;
	imported: number;
	duplicate: number;
	unsupported: number;
	failed: number;
	batchId?: string;
	error?: string;
};

export type SyncOptions = {
	/** Injectable for tests. Defaults to the real garmin-connect session. */
	openSession?: OpenGarminSession;
	/** Manual "Sync now": bypass the throttle window (still honors the lock). */
	ignoreThrottle?: boolean;
};

// The throttle + concurrency lock now live in the `sync_jobs` table
// (syncJobsRepository), so they survive restarts and coordinate across tabs and
// processes — unlike the old in-memory Set/Map. `lastSyncAt` on the credential
// is still the import *cursor* (newest imported activity), kept separate from
// the sync_jobs throttle timestamp.
export function isUserSyncing(userId: string): boolean {
	return isSyncJobRunning(userId);
}

/** Fire-and-forget auto-sync, throttled to once per AUTO_SYNC_INTERVAL_MS per
 * user. Returns immediately; the actual sync runs detached (safe on the
 * long-lived adapter-node server). Never throws — safe to `void` from a load. */
export async function maybeTriggerAutoSync(userId: string, opts: SyncOptions = {}): Promise<void> {
	try {
		if (isShuttingDown()) return; // don't start new work while draining for shutdown

		// Cheap eligibility gate before touching the lock: skip users with no
		// credential or sync disabled, and don't hammer Garmin after an auth
		// failure (that needs a manual reconnect to clear). The durable throttle
		// + lock then lives in sync_jobs, claimed inside syncForUser.
		const cred = await getGarminCredentialForUser(userId);
		if (!cred || !cred.syncEnabled) return;
		if (cred.lastSyncStatus === 'auth_failed') return;

		// Fire-and-forget; do NOT await (keep the page load non-blocking).
		void syncForUser(userId, opts).catch(() => {});
	} catch {
		// Auto-sync is best-effort; never let it disrupt a page load.
	}
}

/** Pure selection: given newest-first activity refs, the prior cursor, and the
 * first-run cap, return the refs to import in OLDEST-first order. Exported for
 * unit testing the paging/cursor logic without a live Garmin session. */
export function selectActivitiesToImport(
	newestFirst: GarminActivityRef[],
	sinceMs: number | null,
	initialLimit: number
): GarminActivityRef[] {
	let selected: GarminActivityRef[];
	if (sinceMs === null) {
		selected = newestFirst.slice(0, initialLimit);
	} else {
		selected = newestFirst.filter((a) => a.startTimeMs > sinceMs);
	}
	// Oldest-first so the cursor advances monotonically as we go.
	return [...selected].sort((a, b) => a.startTimeMs - b.startTimeMs);
}

function isAuthError(message: string): boolean {
	return /\b401\b|unauthor|forbidden|invalid.?token|login|ticket|expired/i.test(message);
}

function isRateLimitError(message: string): boolean {
	return /\b429\b|too many requests|rate.?limit/i.test(message);
}

function sha256Hex(bytes: Uint8Array): string {
	return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

export async function syncForUser(userId: string, opts: SyncOptions = {}): Promise<SyncResult> {
	const empty = { imported: 0, duplicate: 0, unsupported: 0, failed: 0 } as const;

	if (isShuttingDown()) return { outcome: 'skipped', ...empty };

	const cred = await getGarminCredentialForUser(userId);
	if (!cred) return { outcome: 'no_credential', ...empty };
	if (!cred.syncEnabled) return { outcome: 'disabled', ...empty };

	// Durable, atomic throttle + lock (survives restarts; safe across tabs and
	// processes). Auto-sync honors the 15-min throttle; manual "Sync now" passes
	// ignoreThrottle but still can't collide with an in-flight sync.
	if (!tryAcquireSyncJob(userId, { ignoreThrottle: opts.ignoreThrottle })) {
		return { outcome: 'skipped', ...empty };
	}

	beginCriticalWork(); // graceful shutdown drains this before checkpoint + close
	let release: SyncJobRelease = { ok: false, status: 'error', error: null };
	const openSession = opts.openSession ?? openGarminSession;

	const batchId = crypto.randomUUID();
	let imported = 0;
	let duplicate = 0;
	let unsupported = 0;
	let failed = 0;
	let processed = 0;

	try {
		const tokens = unsealJson<GarminTokens>(cred.encryptedBlob);
		const session = await openSession(tokens);

		const sinceMs = cred.lastSyncAt ? cred.lastSyncAt.getTime() : null;

		// Enumerate newest-first pages until we pass the cursor or hit the cap.
		const collected: GarminActivityRef[] = [];
		for (let page = 0; page < MAX_PAGES; page++) {
			const refs = await session.listActivities(page * PAGE_SIZE, PAGE_SIZE);
			collected.push(...refs);
			const reachedCursor = sinceMs !== null && refs.some((a) => a.startTimeMs <= sinceMs);
			const firstRunSatisfied = sinceMs === null && collected.length >= INITIAL_LIMIT;
			if (refs.length < PAGE_SIZE || reachedCursor || firstRunSatisfied) break;
		}

		const toImport = selectActivitiesToImport(collected, sinceMs, INITIAL_LIMIT);

		await createImportBatch({
			id: batchId,
			userId,
			source: GARMIN_SYNC_SOURCE,
			originalName: 'Garmin Connect sync',
			status: 'processing',
			startedAt: new Date()
		});
		await updateImportBatchProgress({ id: batchId, userId, status: 'processing', totalFiles: toImport.length });

		// Cursor advances through contiguous non-failed items (oldest-first). A
		// transient failure stops advancement so it's retried next run; dedupe
		// keeps already-imported newer items from being re-added regardless.
		let cursorMs = sinceMs ?? 0;
		let cursorStuck = false;

		for (const ref of toImport) {
			processed++;
			const sourceActivityId = String(ref.activityId);
			const filename = `${ref.activityId}.fit`;
			const itemId = crypto.randomUUID();
			await createImportItem({
				id: itemId,
				batchId,
				userId,
				sourcePath: `garmin:${sourceActivityId}`,
				originalFilename: filename,
				detectedFormat: 'fit',
				fileSizeBytes: 0,
				sha256: '',
				status: 'processing'
			});

			try {
				// Dedup 1: Garmin activity id (cheap, no download).
				const bySourceId = await getActivityBySourceActivityIdForUser({
					userId,
					source: GARMIN_SYNC_SOURCE,
					sourceActivityId
				});
				if (bySourceId) {
					duplicate++;
					if (!cursorStuck) cursorMs = ref.startTimeMs;
					await updateImportItem({ id: itemId, batchId, userId, status: 'duplicate', activityId: bySourceId.id });
					await updateImportBatchProgress({ id: batchId, userId, processedFiles: processed, importedCount: imported, duplicateCount: duplicate, failedCount: failed });
					continue;
				}

				let fitBytes: Uint8Array;
				try {
					fitBytes = await session.downloadFitBytes(ref.activityId);
				} catch (err) {
					if (err instanceof GarminNoFitError) {
						unsupported++;
						if (!cursorStuck) cursorMs = ref.startTimeMs;
						await updateImportItem({ id: itemId, batchId, userId, status: 'unsupported', errorMessage: err.message });
						await updateImportBatchProgress({ id: batchId, userId, processedFiles: processed, importedCount: imported, duplicateCount: duplicate, failedCount: failed });
						continue;
					}
					throw err;
				}

				const sha256 = sha256Hex(fitBytes);

				// Dedup 2: exact FIT bytes (across sync, upload, and export paths).
				const bySha = await getActivityBySourceFileShaForUser({ userId, sha256 });
				const fileBySha = bySha ? null : await getActivityFileByShaForUser(sha256, userId);
				if (bySha || fileBySha) {
					duplicate++;
					if (!cursorStuck) cursorMs = ref.startTimeMs;
					await updateImportItem({ id: itemId, batchId, userId, status: 'duplicate', sha256, activityId: bySha?.id ?? null });
					await updateImportBatchProgress({ id: batchId, userId, processedFiles: processed, importedCount: imported, duplicateCount: duplicate, failedCount: failed });
					continue;
				}

				let parsed;
				try {
					parsed = await parseFit(fitBytes, filename);
				} catch (err) {
					if (err instanceof FitNotAnActivityError) {
						unsupported++;
						if (!cursorStuck) cursorMs = ref.startTimeMs;
						await updateImportItem({ id: itemId, batchId, userId, status: 'unsupported', sha256, errorMessage: err.message });
						await updateImportBatchProgress({ id: batchId, userId, processedFiles: processed, importedCount: imported, duplicateCount: duplicate, failedCount: failed });
						continue;
					}
					throw err;
				}

				parsed.summary.title = composeSmartTitle({
					metadataLookup: null,
					sport: parsed.summary.sport,
					startTime: parsed.summary.startTime
				});

				// Dedup 3: fingerprint (sport + start + duration + distance).
				const byFingerprint = await getActivityByFingerprintForUser({
					userId,
					sport: parsed.summary.sport,
					startTime: parsed.summary.startTime,
					durationSec: parsed.summary.durationSec ?? null,
					distanceM: parsed.summary.distanceM ?? null
				});
				if (byFingerprint) {
					duplicate++;
					if (!cursorStuck) cursorMs = ref.startTimeMs;
					await updateImportItem({ id: itemId, batchId, userId, status: 'duplicate', sha256, activityId: byFingerprint.id });
					await updateImportBatchProgress({ id: batchId, userId, processedFiles: processed, importedCount: imported, duplicateCount: duplicate, failedCount: failed });
					continue;
				}

				// Store original FIT (tolerate an orphaned file from a prior crash).
				let stored: { relativePath: string; sizeBytes: number };
				try {
					stored = await writeUploadFile({ userId, sha256, ext: 'fit', bytes: fitBytes });
				} catch (e) {
					if ((e as NodeJS.ErrnoException)?.code === 'EEXIST') {
						stored = { relativePath: `uploads/${userId}/${sha256}.fit`, sizeBytes: fitBytes.byteLength };
					} else throw e;
				}

				const activityFileId = crypto.randomUUID();
				await createActivityFile({
					id: activityFileId,
					userId,
					originalFilename: filename,
					filePath: stored.relativePath,
					fileType: 'fit',
					sha256,
					sizeBytes: stored.sizeBytes,
					uploadedAt: new Date()
				});

				const activityId = crypto.randomUUID();
				const gzipBytes = zlib.gzipSync(JSON.stringify(parsed.stream));
				const stream = await writeStreamBlob({ activityId, gzipBytes });

				await createActivity({
					id: activityId,
					userId,
					activityFileId,
					source: GARMIN_SYNC_SOURCE,
					sourceActivityId,
					sourceFileSha256: sha256,
					sourceFilename: filename,
					importedAt: new Date(),
					sport: parsed.summary.sport,
					title: parsed.summary.title,
					startTime: parsed.summary.startTime,
					durationSec: parsed.summary.durationSec,
					movingTimeSec: parsed.summary.movingTimeSec,
					distanceM: parsed.summary.distanceM,
					elevationGainM: parsed.summary.elevationGainM,
					avgHr: parsed.summary.avgHr,
					maxHr: parsed.summary.maxHr,
					avgPowerW: parsed.summary.avgPowerW,
					maxPowerW: parsed.summary.maxPowerW,
					avgCadence: parsed.summary.avgCadence,
					calories: parsed.summary.calories,
					streamPath: stream.relativePath,
					parserVersion: parsed.parserVersion
				});

				imported++;
				if (!cursorStuck) cursorMs = ref.startTimeMs;
				await updateImportItem({ id: itemId, batchId, userId, status: 'imported', sha256, activityId });
			} catch (err) {
				failed++;
				cursorStuck = true; // don't advance the cursor past a transient failure
				await updateImportItem({ id: itemId, batchId, userId, status: 'failed', errorMessage: redactGarminError(err) });
			}
			await updateImportBatchProgress({ id: batchId, userId, processedFiles: processed, importedCount: imported, duplicateCount: duplicate, failedCount: failed });
		}

		await updateImportBatchProgress({
			id: batchId,
			userId,
			status: 'completed',
			processedFiles: processed,
			importedCount: imported,
			duplicateCount: duplicate,
			failedCount: failed,
			completedAt: new Date()
		});

		// Persist any refreshed tokens, then the new cursor + status.
		try {
			await updateGarminTokens({ userId, encryptedBlob: sealJson(session.currentTokens()) });
		} catch {
			// Non-fatal: a token re-seal failure shouldn't fail the whole sync.
		}
		// Only advance the cursor when we actually accounted for newer activities.
		// Passing undefined leaves lastSyncAt unchanged, so a fruitless or
		// all-failed run doesn't reset it (notably not to epoch on a first run).
		const advancedAt = cursorMs > (sinceMs ?? 0) ? new Date(cursorMs) : undefined;
		await updateGarminSyncStatus({ userId, lastSyncAt: advancedAt, lastSyncStatus: 'ok', lastSyncError: null });

		release = { ok: true, status: 'ok' };
		return { outcome: 'ok', imported, duplicate, unsupported, failed, batchId };
	} catch (err) {
		const message = redactGarminError(err);
		const outcome: SyncOutcome = isAuthError(message)
			? 'auth_failed'
			: isRateLimitError(message)
				? 'rate_limited'
				: 'error';
		// garmin_credentials.lastSyncStatus is a 3-value enum (ok|auth_failed|
		// error); fold rate_limited into 'error' there. The sync_jobs row keeps
		// the precise status — it drives the breaker's hard vs soft cool-down.
		const credStatus = outcome === 'auth_failed' ? 'auth_failed' : 'error';
		await updateGarminSyncStatus({ userId, lastSyncStatus: credStatus, lastSyncError: message });
		await updateImportBatchProgress({ id: batchId, userId, status: 'failed', completedAt: new Date() }).catch(() => {});
		release = { ok: false, status: outcome, error: message };
		return { outcome, imported, duplicate, unsupported, failed, batchId, error: message };
	} finally {
		releaseSyncJob(userId, release);
		endCriticalWork();
	}
}
