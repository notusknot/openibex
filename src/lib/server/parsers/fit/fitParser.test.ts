import { describe, expect, it, vi } from 'vitest';

// Mock the underlying library to return a pathologically large records array
// without needing a real multi-hour FIT file. vi.mock is isolated to this test
// file, so it doesn't affect other suites.
vi.mock('fit-file-parser', () => {
	class FitParser {
		constructor(_opts: unknown) {}
		parse(_buffer: Uint8Array, cb: (err: Error | null, data: unknown) => void) {
			cb(null, {
				sessions: [{ sport: 'running', start_time: new Date('2026-01-01T07:00:00') }],
				records: new Array(250_001).fill({ t: 0 }),
				laps: []
			});
		}
	}
	return { default: FitParser };
});

import { parseFit, FitStreamTooLargeError } from '$lib/server/parsers/fit/fitParser';

describe('parseFit stream bound', () => {
	it('rejects a FIT whose record count exceeds the cap', async () => {
		await expect(parseFit(new Uint8Array([1, 2, 3]), 'big.fit')).rejects.toBeInstanceOf(
			FitStreamTooLargeError
		);
	});
});
