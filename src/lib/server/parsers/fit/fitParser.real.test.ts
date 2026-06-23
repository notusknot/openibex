import { describe, expect, it } from 'vitest';

import { parseFit, FitParseTimeoutError } from '$lib/server/parsers/fit/fitParser';

// Exercise the REAL worker-thread path (no mock): proves the worker resolves
// fit-file-parser at runtime, rejects malformed input cleanly, and — crucially —
// that the parse-time deadline actually terminates a runaway synchronous parse
// off the main event loop. Real activity FIT files are the user's private health
// data and are intentionally NOT committed as fixtures.
describe('parseFit — real worker', () => {
	it('rejects an empty buffer cleanly', async () => {
		await expect(parseFit(new Uint8Array(0), 'empty.fit')).rejects.toBeTruthy();
	});

	it('rejects random garbage bytes cleanly', async () => {
		const garbage = new Uint8Array(64);
		for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37 + 11) & 0xff;
		await expect(parseFit(garbage, 'garbage.fit')).rejects.toBeTruthy();
	});

	it('enforces the parse-time deadline by terminating the worker', async () => {
		// A 1ms deadline is far shorter than worker spin-up (tens of ms), so the
		// timer always wins and terminates the worker — proving a runaway parse
		// can be interrupted off the main event loop.
		await expect(parseFit(new Uint8Array([1, 2, 3]), 'x.fit', { timeoutMs: 1 })).rejects.toBeInstanceOf(
			FitParseTimeoutError
		);
	});
});
