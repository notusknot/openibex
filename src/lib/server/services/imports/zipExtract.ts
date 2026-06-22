import fsp from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const MAX_ZIP_BYTES = 1024 * 1024 * 1024; // 1 GiB safety cap

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

export async function extractZipToDir(zipPath: string, outDir: string): Promise<void> {
	await fsp.mkdir(outDir, { recursive: true });

	const stat = await fsp.stat(zipPath);
	if (stat.size > MAX_ZIP_BYTES) {
		throw new Error(`Zip file too large (${stat.size} bytes).`);
	}

	const bytes = await fsp.readFile(zipPath);
	const zip = await JSZip.loadAsync(bytes);

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
		const data = await entry.async('nodebuffer');
		await fsp.writeFile(dest, data, { flag: 'wx' });
	}
}

