import { describe, expect, it } from 'vitest';

import { parseFit } from '$lib/server/parsers/fit/fitParser';

// No module mock here: exercise the REAL fit-file-parser to prove parseFit
// rejects malformed input cleanly (a Promise rejection) — never hanging the
// event loop or throwing uncaught. Real activity FIT files are the user's
// private health data and are intentionally NOT committed as fixtures, so we
// only assert graceful rejection of synthetic bad input here.
describe('parseFit — real parser, malformed input rejects cleanly', () => {
	it('rejects an empty buffer', async () => {
		await expect(parseFit(new Uint8Array(0), 'empty.fit')).rejects.toBeTruthy();
	});

	it('rejects random garbage bytes', async () => {
		const garbage = new Uint8Array(64);
		for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37 + 11) & 0xff;
		await expect(parseFit(garbage, 'garbage.fit')).rejects.toBeTruthy();
	});

	it('rejects a too-short header', async () => {
		await expect(parseFit(new Uint8Array([0x0e, 0x10, 0x94, 0x08]), 'short.fit')).rejects.toBeTruthy();
	});
});
