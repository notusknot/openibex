import { afterEach, describe, expect, it } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

import { extractZipToDir } from '$lib/server/services/imports/zipExtract';

const tmpDirs: string[] = [];
async function workspace(): Promise<string> {
	const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'openibex-zip-test-'));
	tmpDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tmpDirs.splice(0).map((d) => fsp.rm(d, { recursive: true, force: true })));
});

describe('extractZipToDir', () => {
	it('extracts normal entries to disk', async () => {
		const ws = await workspace();
		const zip = new JSZip();
		zip.file('a.txt', 'hello');
		zip.file('nested/b.txt', 'world');
		const zipPath = path.join(ws, 'in.zip');
		await fsp.writeFile(zipPath, await zip.generateAsync({ type: 'nodebuffer' }));

		const outDir = path.join(ws, 'out');
		await extractZipToDir(zipPath, outDir);

		expect(await fsp.readFile(path.join(outDir, 'a.txt'), 'utf-8')).toBe('hello');
		expect(await fsp.readFile(path.join(outDir, 'nested', 'b.txt'), 'utf-8')).toBe('world');
	});

	it('aborts when an entry inflates past the per-entry cap (zip bomb guard)', async () => {
		const ws = await workspace();
		const zip = new JSZip();
		// Highly compressible payload: tiny compressed, large inflated.
		zip.file('bomb.txt', 'A'.repeat(100_000));
		const zipPath = path.join(ws, 'bomb.zip');
		await fsp.writeFile(zipPath, await zip.generateAsync({ type: 'nodebuffer' }));

		await expect(
			extractZipToDir(zipPath, path.join(ws, 'out'), { maxEntryBytes: 1000 })
		).rejects.toThrow(/too large|zip bomb/i);
	});

	it('rejects path-traversal entries', async () => {
		const ws = await workspace();
		const zip = new JSZip();
		zip.file('../escape.txt', 'nope');
		const zipPath = path.join(ws, 'evil.zip');
		await fsp.writeFile(zipPath, await zip.generateAsync({ type: 'nodebuffer' }));

		await expect(extractZipToDir(zipPath, path.join(ws, 'out'))).rejects.toThrow(/unsafe/i);
	});
});
