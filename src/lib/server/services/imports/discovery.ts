import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import { walkFiles } from '$lib/server/services/imports/fsWalk';
import { extractZipToDir } from '$lib/server/services/imports/zipExtract';

export type DetectedFormat = 'fit' | 'tcx' | 'gpx' | 'zip' | 'unknown';

export type DiscoveredFile = {
	absPath: string;
	sourcePath: string;
	originalFilename: string;
	detectedFormat: DetectedFormat;
	sizeBytes: number;
};

function extToFormat(ext: string): DetectedFormat {
	switch (ext.toLowerCase()) {
		case '.fit':
			return 'fit';
		case '.tcx':
			return 'tcx';
		case '.gpx':
			return 'gpx';
		case '.zip':
			return 'zip';
		default:
			return 'unknown';
	}
}

// Garmin has used both `DI-Connect-Fitness-Uploaded-Files` (older exports) and
// `DI-Connect-Uploaded-Files` (recent exports) as the activity-archive folder.
const UPLOADED_FILES_NEEDLES = [
	'di_connect/di-connect-fitness-uploaded-files',
	'di_connect/di-connect-uploaded-files'
];

export async function findGarminUploadedFilesRoot(inputPath: string): Promise<string> {
	// If the user already points to the uploaded-files folder, keep it.
	const normalized = inputPath.toLowerCase().replaceAll('\\', '/');
	for (const needle of UPLOADED_FILES_NEEDLES) {
		if (normalized.includes(needle)) return inputPath;
	}

	// Try to locate either uploaded-files folder within the provided directory tree.
	for await (const file of walkFiles(inputPath)) {
		const lower = file.toLowerCase().replaceAll('\\', '/');
		for (const needle of UPLOADED_FILES_NEEDLES) {
			const idx = lower.indexOf(`${needle}/`);
			if (idx !== -1) {
				return file.slice(0, idx + needle.length);
			}
		}
	}
	return inputPath;
}

export async function discoverCandidateFiles(inputRoot: string): Promise<DiscoveredFile[]> {
	const out: DiscoveredFile[] = [];
	for await (const absPath of walkFiles(inputRoot)) {
		const format = extToFormat(path.extname(absPath));
		if (format === 'unknown') continue;
		const stat = await fs.stat(absPath);
		out.push({
			absPath,
			sourcePath: absPath,
			originalFilename: path.basename(absPath),
			detectedFormat: format,
			sizeBytes: stat.size
		});
	}
	return out;
}

export type ZipFailure = { zip: DiscoveredFile; errorMessage: string };

export async function expandZipsToTemp(
	inputFiles: DiscoveredFile[],
	batchId: string
): Promise<{ files: DiscoveredFile[]; zipFailures: ZipFailure[] }> {
	const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), `openibex-garmin-${batchId}-`));
	const queue: DiscoveredFile[] = [...inputFiles];
	const results: DiscoveredFile[] = [];
	const zipFailures: ZipFailure[] = [];

	let zipIndex = 0;
	while (queue.length > 0) {
		const file = queue.shift()!;
		if (file.detectedFormat !== 'zip') {
			results.push(file);
			continue;
		}

		const outDir = path.join(tmpRoot, `zip-${zipIndex++}`);
		try {
			await extractZipToDir(file.absPath, outDir);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Zip extraction failed.';
			zipFailures.push({ zip: file, errorMessage: msg });
			continue;
		}

		for await (const extractedPath of walkFiles(outDir)) {
			const fmt = extToFormat(path.extname(extractedPath));
			if (fmt === 'unknown') continue;
			const stat = await fs.stat(extractedPath);
			queue.push({
				absPath: extractedPath,
				sourcePath: `${file.sourcePath}::${path.relative(outDir, extractedPath)}`,
				originalFilename: path.basename(extractedPath),
				detectedFormat: fmt,
				sizeBytes: stat.size
			});
		}
	}

	return { files: results, zipFailures };
}
