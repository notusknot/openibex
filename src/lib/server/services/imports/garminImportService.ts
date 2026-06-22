import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

import { getEnv } from '$lib/server/env';
import { parseFit } from '$lib/server/parsers/fit/fitParser';
import { createActivity, getActivityByFingerprintForUser, getActivityBySourceActivityIdForUser, getActivityBySourceFileShaForUser } from '$lib/server/repositories/activitiesRepository';
import { createActivityFile, getActivityFileByShaForUser } from '$lib/server/repositories/activityFilesRepository';
import { createImportBatch, updateImportBatchProgress } from '$lib/server/repositories/importBatchesRepository';
import { createImportItem, updateImportItem } from '$lib/server/repositories/importItemsRepository';
import { getUserByEmail } from '$lib/server/repositories/usersRepository';
import { writeStreamBlob } from '$lib/server/services/fileStorageService';
import {
	discoverCandidateFiles,
	expandZipsToTemp,
	findGarminUploadedFilesRoot,
	type DiscoveredFile
} from '$lib/server/services/imports/discovery';

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

function importOriginalRelativePath(batchId: string, sha256: string, ext: string): string {
	return path.posix.join('imports', batchId, 'originals', `${sha256}.${ext}`);
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
}): Promise<GarminImportSummary> {
	const userEmail = normalizeEmail(input.userEmail);
	const user = await getUserByEmail(userEmail);
	if (!user) {
		throw new Error(`User not found: ${userEmail}`);
	}

	const batchId = crypto.randomUUID();
	const now = new Date();

	await createImportBatch({
		id: batchId,
		userId: user.id,
		source: 'garmin-export',
		originalName: path.basename(input.path),
		status: 'processing',
		startedAt: now
	});

	let totalFiles = 0;
	let processedFiles = 0;
	let importedCount = 0;
	let duplicateCount = 0;
	let failedCount = 0;

	try {
		const uploadedRoot = await findGarminUploadedFilesRoot(input.path);
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
				// Dedup 1: exact file SHA (across any previous Garmin imports).
				const existingBySha = await getActivityBySourceFileShaForUser({ userId: user.id, sha256: c.sha256 });
				if (existingBySha) {
					duplicateCount += 1;
					await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'duplicate', activityId: existingBySha.id });
					await updateImportBatchProgress({ id: batchId, userId: user.id, processedFiles, importedCount, duplicateCount, failedCount });
					continue;
				}

				// Also dedupe against previously uploaded files (Milestone 3 uploads).
				const existingFile = await getActivityFileByShaForUser(c.sha256, user.id);
				if (existingFile) {
					duplicateCount += 1;
					await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'duplicate' });
					await updateImportBatchProgress({ id: batchId, userId: user.id, processedFiles, importedCount, duplicateCount, failedCount });
					continue;
				}

				// Dedup 2: Garmin activity id (best-effort from filename).
				if (c.sourceActivityId) {
					const existingBySourceId = await getActivityBySourceActivityIdForUser({
						userId: user.id,
						source: 'garmin-export',
						sourceActivityId: c.sourceActivityId
					});
					if (existingBySourceId) {
						duplicateCount += 1;
						await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'duplicate', activityId: existingBySourceId.id });
						await updateImportBatchProgress({ id: batchId, userId: user.id, processedFiles, importedCount, duplicateCount, failedCount });
						continue;
					}
				}

				if (c.detectedFormat !== 'fit') {
					// TCX/GPX only supported if parsers exist; currently not implemented.
					const ext = extFromFormat(c.detectedFormat);
					const relOriginal = importOriginalRelativePath(batchId, c.sha256, ext);
					const absOriginal = path.join(getEnv().OPENIBEX_DATA_DIR, relOriginal);
					await fs.mkdir(path.dirname(absOriginal), { recursive: true });
					try {
						const bytes = await fs.readFile(c.absPath);
						await fs.writeFile(absOriginal, bytes, { flag: 'wx' });
					} catch (e: any) {
						if (e?.code !== 'EEXIST') throw e;
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

				const ext = extFromFormat(c.detectedFormat);
				const relOriginal = importOriginalRelativePath(batchId, c.sha256, ext);
				const bytes = await fs.readFile(c.absPath);

				const absOriginal = path.join(getEnv().OPENIBEX_DATA_DIR, relOriginal);
				await fs.mkdir(path.dirname(absOriginal), { recursive: true });
				try {
					await fs.writeFile(absOriginal, bytes, { flag: 'wx' });
				} catch (e: any) {
					if (e?.code !== 'EEXIST') throw e;
				}

				const parsed = await parseFit(bytes, c.originalFilename);

				// Dedup 3: fallback fingerprint (only after parsing).
				const existingByFingerprint = await getActivityByFingerprintForUser({
					userId: user.id,
					sport: parsed.summary.sport,
					startTime: parsed.summary.startTime,
					durationSec: parsed.summary.durationSec ?? null,
					distanceM: parsed.summary.distanceM ?? null
				});
				if (existingByFingerprint) {
					duplicateCount += 1;
					await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'duplicate', activityId: existingByFingerprint.id });
					await updateImportBatchProgress({ id: batchId, userId: user.id, processedFiles, importedCount, duplicateCount, failedCount });
					continue;
				}

				const activityFileId = crypto.randomUUID();
				await createActivityFile({
					id: activityFileId,
					userId: user.id,
					originalFilename: c.originalFilename,
					filePath: relOriginal,
					fileType: 'fit',
					sha256: c.sha256,
					sizeBytes: c.sizeBytes,
					uploadedAt: new Date()
				});

				const activityId = crypto.randomUUID();
				const gzipBytes = zlib.gzipSync(JSON.stringify(parsed.stream));
				const stream = await writeStreamBlob({ activityId, gzipBytes });

				await createActivity({
					id: activityId,
					userId: user.id,
					activityFileId,
					source: 'garmin-export',
					sourceActivityId: c.sourceActivityId,
					sourceFileSha256: c.sha256,
					sourceFilename: c.originalFilename,
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

				importedCount += 1;
				await updateImportItem({ id: itemId, batchId, userId: user.id, status: 'imported', activityId });
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
