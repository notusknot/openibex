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

export async function findGarminUploadedFilesRoot(inputPath: string): Promise<string> {
	// If the user already points to the uploaded-files folder, keep it.
	const normalized = inputPath.replaceAll('\\', '/');
	if (normalized.toLowerCase().includes('di_connect/di-connect-fitness-uploaded-files'.toLowerCase())) {
		return inputPath;
	}

	// Try to locate DI_CONNECT/DI-Connect-Fitness-Uploaded-Files within the provided directory tree.
	for await (const file of walkFiles(inputPath)) {
		// We only need directory hits; avoid scanning everything by checking path segments.
		// This heuristic is fast enough for typical exports.
		const lower = file.toLowerCase().replaceAll('\\', '/');
		const idx = lower.indexOf('di_connect/di-connect-fitness-uploaded-files/');
		if (idx !== -1) {
			return file.slice(0, idx + 'di_connect/di-connect-fitness-uploaded-files'.length);
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
