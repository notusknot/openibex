import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getLogger } from '$lib/server/logger';
import {
	createImportBatch,
	updateImportBatchProgress
} from '$lib/server/repositories/importBatchesRepository';
import {
	importGarminHistoricalExport,
	type GarminImportSummary
} from '$lib/server/services/imports/garminImportService';
import { extractZipToDir } from '$lib/server/services/imports/zipExtract';

// In-app guard, mirroring zipExtract's MAX_ZIP_BYTES. Note: adapter-node also
// caps request bodies at BODY_SIZE_LIMIT (512 KB by default), so a real export
// upload requires raising that env var — this cap only bounds what we accept
// once the body has already been read.
export const GARMIN_WEB_IMPORT_MAX_BYTES = 1024 * 1024 * 1024; // 1 GiB

/**
 * Extract an uploaded Garmin export zip into a scratch workspace and run the
 * exact same historical import the CLI uses against the extracted tree. The
 * batch row is expected to already exist (created by `startGarminExportImport`)
 * so the web request can redirect to the import log before this finishes.
 *
 * Extracting the top-level zip first — rather than pointing the importer at the
 * raw zip — lets `loadGarminMetadata` / `findGarminUploadedFilesRoot` walk the
 * real folder structure, so smart titles and dedup behave identically to the
 * CLI flow (where the user unzips before passing `--path`). Nested per-activity
 * zips inside the export are then expanded by the importer itself.
 *
 * Awaitable on purpose: tests drive it directly, and the background wrapper
 * attaches its own failure handler.
 */
export async function processGarminExportZip(input: {
	userEmail: string;
	batchId: string;
	workDir: string;
	zipPath: string;
}): Promise<GarminImportSummary> {
	try {
		const extractedDir = path.join(input.workDir, 'extracted');
		await extractZipToDir(input.zipPath, extractedDir);
		// The zip's contents are on disk now; drop the original to halve peak
		// scratch usage for large exports.
		await fs.rm(input.zipPath, { force: true });
		return await importGarminHistoricalExport({
			userEmail: input.userEmail,
			path: extractedDir,
			batchId: input.batchId
		});
	} finally {
		await fs.rm(input.workDir, { recursive: true, force: true }).catch(() => {});
	}
}

/**
 * Entry point for the Settings bulk-import action. Persists the uploaded bytes
 * to a scratch zip, creates the batch row, then kicks off extraction + import
 * in the background and returns the batch id immediately so the caller can
 * redirect to `/imports/{batchId}` to watch progress.
 *
 * The heavy work is intentionally not awaited — a full export can take minutes
 * and would otherwise block the request past typical proxy timeouts. There is
 * no background worker; like Garmin sync, this rides the request that started
 * it (Node keeps the event loop alive until the promise settles, and graceful
 * shutdown drains in-flight DB writes).
 */
export async function startGarminExportImport(input: {
	userId: string;
	userEmail: string;
	originalName: string;
	zipBytes: Uint8Array;
}): Promise<{ batchId: string }> {
	const batchId = crypto.randomUUID();
	const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `openibex-webimport-${batchId}-`));
	const zipPath = path.join(workDir, 'export.zip');
	// Persist to disk in the foreground so the in-memory upload buffer can be
	// released as soon as this returns — the background task reads from `zipPath`.
	await fs.writeFile(zipPath, input.zipBytes);

	await createImportBatch({
		id: batchId,
		userId: input.userId,
		source: 'garmin-export',
		originalName: input.originalName,
		status: 'processing',
		startedAt: new Date()
	});

	void processGarminExportZip({
		userEmail: input.userEmail,
		batchId,
		workDir,
		zipPath
	}).catch(async (err) => {
		getLogger().error(
			{ batchId, detail: err instanceof Error ? err.message : 'unknown error' },
			'web garmin bulk import failed'
		);
		// `importGarminHistoricalExport` marks the batch failed on errors it
		// reaches, but a failure before that (e.g. a corrupt zip) wouldn't — so
		// flag it here too. Double-marking is an idempotent no-op.
		try {
			await updateImportBatchProgress({
				id: batchId,
				userId: input.userId,
				status: 'failed',
				completedAt: new Date()
			});
		} catch {
			/* best effort */
		}
	});

	return { batchId };
}
