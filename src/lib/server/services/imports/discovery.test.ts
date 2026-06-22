import { describe, expect, it } from 'vitest';

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';

import { discoverCandidateFiles, expandZipsToTemp } from '$lib/server/services/imports/discovery';

async function mkTmpDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), `openibex-imports-test-`));
}

describe('imports discovery', () => {
	it('recursively discovers FIT files', async () => {
		const dir = await mkTmpDir();
		await fs.mkdir(path.join(dir, 'a', 'b'), { recursive: true });
		await fs.writeFile(path.join(dir, 'a.fit'), new Uint8Array([1]));
		await fs.writeFile(path.join(dir, 'a', 'b', 'c.FIT'), new Uint8Array([2]));
		await fs.writeFile(path.join(dir, 'ignore.txt'), 'nope');

		const found = await discoverCandidateFiles(dir);
		const exts = found.map((f) => path.extname(f.absPath).toLowerCase()).sort();
		expect(exts).toEqual(['.fit', '.fit']);
	});

	it('extracts nested zip files and discovers FITs', async () => {
		const dir = await mkTmpDir();

		const inner = new JSZip();
		inner.file('nested/activity.fit', new Uint8Array([1, 2, 3]));
		const innerBytes = await inner.generateAsync({ type: 'uint8array' });

		const outer = new JSZip();
		outer.file('inner.zip', innerBytes);
		const outerBytes = await outer.generateAsync({ type: 'uint8array' });

		await fs.writeFile(path.join(dir, 'outer.zip'), outerBytes);

		const discovered = await discoverCandidateFiles(dir);
		const expanded = await expandZipsToTemp(discovered, `test-${Date.now()}`);
		const fits = expanded.files.filter((f) => f.detectedFormat === 'fit');
		expect(fits.length).toBe(1);
		expect(fits[0]!.sourcePath.toLowerCase()).toContain('outer.zip');
		expect(fits[0]!.sourcePath.toLowerCase()).toContain('inner.zip');
		expect(fits[0]!.sourcePath.toLowerCase()).toContain('activity.fit');
	});

	it('rejects zip-slip paths', async () => {
		const dir = await mkTmpDir();
		const zip = new JSZip();
		zip.file('../evil.fit', new Uint8Array([9]));
		const bytes = await zip.generateAsync({ type: 'uint8array' });
		await fs.writeFile(path.join(dir, 'bad.zip'), bytes);

		const discovered = await discoverCandidateFiles(dir);
		const expanded = await expandZipsToTemp(discovered, `test-${Date.now()}`);
		expect(expanded.files.length).toBe(0);
		expect(expanded.zipFailures.length).toBe(1);
		expect(expanded.zipFailures[0]!.errorMessage.toLowerCase()).toContain('unsafe');
	});
});

