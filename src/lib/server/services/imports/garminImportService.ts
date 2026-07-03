import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createImportBatch, updateImportBatchProgress } from '$lib/server/repositories/importBatchesRepository';
import { createImportItem, updateImportItem } from '$lib/server/repositories/importItemsRepository';
import { getUserByEmail } from '$lib/server/repositories/usersRepository';
import { writeImportOriginal } from '$lib/server/services/fileStorageService';
import { ingestFitActivity } from '$lib/server/services/ingestService';
import {
	discoverCandidateFiles,
	expandZipsToTemp,
	findGarminUploadedFilesRoot,
	type DiscoveredFile
} from '$lib/server/services/imports/discovery';
import { loadGarminMetadata } from '$lib/server/services/imports/garminMetadata';

export type GarminImportSummary = {
	batchId: string;
	userId: string;
	totalFiles: number;
	processedFiles: number;
	importedCount: number;
	duplicateCount: number;
	failedCount: number;
};

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function extFromFormat(fmt: string): string {
	switch (fmt) {
		case 'fit':
			return 'fit';
		case 'tcx':
			return 'tcx';
		case 'gpx':
			return 'gpx';
		default:
			return 'bin';
	}
}

async function sha256HexOfFile(absPath: string): Promise<string> {
	const hash = crypto.createHash('sha256');
	const fh = await fs.open(absPath, 'r');
	try {
		const buf = Buffer.alloc(1024 * 1024);
		while (true) {
			const { bytesRead } = await fh.read(buf, 0, buf.length, null);
			if (bytesRead <= 0) break;
			hash.update(buf.subarray(0, bytesRead));
		}
		return hash.digest('hex');
	} finally {
		await fh.close();
	}
}

function maybeExtractGarminActivityId(originalFilename: string): string | null {
	const base = path.basename(originalFilename, path.extname(originalFilename));
	return /^[0-9]+$/.test(base) ? base : null;
}

type Candidate = DiscoveredFile & {
	sha256: string;
	sourceActivityId: string | null;
};

export async function importGarminHistoricalExport(input: {
	userEmail: string;
	path: string;
	/**
	 * Reuse an existing batch row instead of creating a new one. The web
	 * bulk-import pre-creates the batch (so the request can redirect to the log
	 * immediately) and then runs this in the background; the CLI omits it and a
	 * fresh batch is created here. Everything else — discovery, dedup, parsing,
	 * per-item logging — is identical regardless of caller.
	 */
	batchId?: string;
}): Promise<GarminImportSummary> {
	const userEmail = normalizeEmail(input.userEmail);
	const user = await getUserByEmail(userEmail);
	if (!user) {
		throw new Error(`User not found: ${userEmail}`);
	}

	const batchId = input.batchId ?? crypto.randomUUID();
	const now = new Date();

	if (!input.batchId) {
		await createImportBatch({
			id: batchId,
			userId: user.id,
			source: 'garmin-export',
			originalName: path.basename(input.path),
			status: 'processing',
			startedAt: now
		});
	}

	let totalFiles = 0;
	let processedFiles = 0;
	let importedCount = 0;
	let duplicateCount = 0;
	let failedCount = 0;

	try {
		const uploadedRoot = await findGarminUploadedFilesRoot(input.path);
		const metadataLookup = await loadGarminMetadata(input.path);
		const discovered = await discoverCandidateFiles(uploadedRoot);
		const expanded = await expandZipsToTemp(discovered, batchId);

		totalFiles = expanded.files.length + expanded.zipFailures.length;
		await updateImportBatchProgress({
			id: batchId,
			userId: user.id,
			status: 'processing',
			totalFiles,
			processedFiles: 0,
			importedCount: 0,
			duplicateCount: 0,
			failedCount: 0
		});

		for (const z of expanded.zipFailures) {
			processedFiles += 1;
			failedCount += 1;

			const sha256 = await sha256HexOfFile(z.zip.absPath);
			const itemId = crypto.randomUUID();
			await createImportItem({
				id: itemId,
				batchId,
				userId: user.id,
				sourcePath: z.zip.sourcePath,
				originalFilename: z.zip.originalFilename,
				detectedFormat: 'zip',
				fileSizeBytes: z.zip.sizeBytes,
				sha256,
				status: 'failed',
				errorMessage: z.errorMessage
			});
			await updateImportBatchProgress({ id: batchId, userId: user.id, processedFiles, importedCount, duplicateCount, failedCount });
		}

		for (const base of expanded.files) {
			processedFiles += 1;
			const c: Candidate = {
				...base,
				sha256: await sha256HexOfFile(base.absPath),
				sourceActivityId: maybeExtractGarminActivityId(base.originalFilename)
			};

			const itemId = crypto.randomUUID();
			await createImportItem({
				id: itemId,
				batchId,
				userId: user.id,
				sourcePath: c.sourcePath,
				originalFilename: c.originalFilename,
				detectedFormat: c.detectedFormat,
				fileSizeBytes: c.sizeBytes,
				sha256: c.sha256,
				status: 'discovered'
			});

			await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'processing' });

			try {
				if (c.detectedFormat !== 'fit') {
					// TCX/GPX only supported if parsers exist; currently not implemented.
					// Archive the original with the batch anyway (EEXIST = already there).
					try {
						await writeImportOriginal({
							batchId,
							sha256: c.sha256,
							ext: extFromFormat(c.detectedFormat),
							bytes: await fs.readFile(c.absPath)
						});
					} catch (e) {
						if ((e as NodeJS.ErrnoException)?.code !== 'EEXIST') throw e;
					}
					await updateImportItem({
						id: itemId,
						batchId,
						userId: user.id,
						status: 'unsupported',
						errorMessage: `Unsupported format: ${c.detectedFormat}`
					});
					await updateImportBatchProgress({ id: batchId, userId: user.id, processedFiles, importedCount, duplicateCount, failedCount });
					continue;
				}

				// The dedup + parse + store pipeline lives in ingestService; this loop
				// only owns discovery and the per-item batch bookkeeping.
				const outcome = await ingestFitActivity({
					userId: user.id,
					bytes: await fs.readFile(c.absPath),
					filename: c.originalFilename,
					provenance: { source: 'garmin-export', sourceActivityId: c.sourceActivityId },
					originalDest: { kind: 'import-batch', batchId },
					titleMetadata: metadataLookup
				});

				if (outcome.kind === 'imported') {
					importedCount += 1;
					await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'imported', activityId: outcome.activityId });
				} else if (outcome.kind === 'duplicate') {
					duplicateCount += 1;
					await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'duplicate', activityId: outcome.activityId });
				} else {
					await updateImportItem({
						id: itemId,
						batchId,
						userId: user.id,
						status: 'unsupported',
						errorMessage: outcome.reason
					});
				}
			} catch (e) {
				failedCount += 1;
				const msg = e instanceof Error ? e.message : 'Import failed.';
				await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'failed', errorMessage: msg });
			}

			await updateImportBatchProgress({ id: batchId, userId: user.id, processedFiles, importedCount, duplicateCount, failedCount });
		}

		await updateImportBatchProgress({
			id: batchId,
			userId: user.id,
			status: 'completed',
			processedFiles,
			importedCount,
			duplicateCount,
			failedCount,
			completedAt: new Date()
		});

		return { batchId, userId: user.id, totalFiles, processedFiles, importedCount, duplicateCount, failedCount };
	} catch (e) {
		await updateImportBatchProgress({
			id: batchId,
			userId: user.id,
			status: 'failed',
			totalFiles,
			processedFiles,
			importedCount,
			duplicateCount,
			failedCount,
			completedAt: new Date()
		});
		throw e;
	}
}
