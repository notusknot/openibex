import fsp from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import JSZip from 'jszip';

const MAX_ZIP_BYTES = 1024 * 1024 * 1024; // 1 GiB cap on the COMPRESSED archive
// Bound the DECOMPRESSED output too: the compressed cap says nothing about how
// much a crafted archive inflates to (a zip bomb is ~1000x). These are generous
// vs a real Garmin export (FIT files are KB–MB; years of data total a few GiB)
// but stop a bomb from OOM-ing / filling the disk on a small self-hosted box.
const MAX_TOTAL_DECOMPRESSED_BYTES = 8 * 1024 * 1024 * 1024; // 8 GiB whole archive
const MAX_ENTRY_DECOMPRESSED_BYTES = 1024 * 1024 * 1024; // 1 GiB per entry

function isUnsafeZipPath(name: string): boolean {
	if (!name) return true;
	if (path.isAbsolute(name)) return true;
	if (/^[a-zA-Z]:[\\/]/.test(name)) return true;
	const normalized = path.posix.normalize(name.replaceAll('\\', '/'));
	if (normalized.startsWith('../') || normalized === '..') return true;
	return false;
}

function ensureWithin(root: string, target: string): string {
	const resolvedRoot = path.resolve(root);
	const resolvedTarget = path.resolve(target);
	if (!resolvedTarget.startsWith(resolvedRoot + path.sep) && resolvedTarget !== resolvedRoot) {
		throw new Error('Unsafe zip entry path.');
	}
	return resolvedTarget;
}

export async function extractZipToDir(
	zipPath: string,
	outDir: string,
	opts: { maxEntryBytes?: number; maxTotalBytes?: number } = {}
): Promise<void> {
	const maxEntryBytes = opts.maxEntryBytes ?? MAX_ENTRY_DECOMPRESSED_BYTES;
	const maxTotalBytes = opts.maxTotalBytes ?? MAX_TOTAL_DECOMPRESSED_BYTES;
	await fsp.mkdir(outDir, { recursive: true });

	const stat = await fsp.stat(zipPath);
	if (stat.size > MAX_ZIP_BYTES) {
		throw new Error(`Zip file too large (${stat.size} bytes).`);
	}

	const bytes = await fsp.readFile(zipPath);
	const zip = await JSZip.loadAsync(bytes);

	let totalDecompressed = 0;

	for (const [name, entry] of Object.entries(zip.files)) {
		if (isUnsafeZipPath(name)) {
			throw new Error('Unsafe zip entry path.');
		}

		const rel = name.replaceAll('\\', '/');
		const dest = ensureWithin(outDir, path.join(outDir, rel));

		if (entry.dir) {
			await fsp.mkdir(dest, { recursive: true });
			continue;
		}

		await fsp.mkdir(path.dirname(dest), { recursive: true });

		// Stream the entry to disk (never buffer a whole entry in memory like the
		// old `entry.async('nodebuffer')`) and abort the moment it inflates past a
		// cap, so a zip bomb can't exhaust RAM or disk before we notice.
		let entryDecompressed = 0;
		await pipeline(
			entry.nodeStream('nodebuffer') as NodeJS.ReadableStream,
			async function* (source: AsyncIterable<Buffer>) {
				for await (const chunk of source) {
					entryDecompressed += chunk.length;
					totalDecompressed += chunk.length;
					if (entryDecompressed > maxEntryBytes || totalDecompressed > maxTotalBytes) {
						throw new Error('Zip expands too large (possible zip bomb).');
					}
					yield chunk;
				}
			},
			createWriteStream(dest, { flags: 'wx' })
		);
	}
}

