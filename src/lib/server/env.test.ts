import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateConfigOrThrow } from '$lib/server/env';

// validateConfigOrThrow reads process.env live (getEnv has no cache), so each
// test sets exactly the vars it needs over a clean baseline and restores after.
const KEYS = ['NODE_ENV', 'OPENIBEX_ENV', 'SESSION_SECRET', 'ORIGIN', 'SYNC_ENCRYPTION_KEY', 'SESSION_TTL_DAYS'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
	saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
	for (const k of KEYS) delete process.env[k];
	process.env.SESSION_TTL_DAYS = '30';
});

afterEach(() => {
	for (const k of KEYS) {
		if (saved[k] === undefined) delete process.env[k];
		else process.env[k] = saved[k];
	}
});

describe('validateConfigOrThrow', () => {
	it('passes in development with minimal config', () => {
		process.env.NODE_ENV = 'development';
		expect(() => validateConfigOrThrow()).not.toThrow();
	});

	it('throws in production without a strong SESSION_SECRET', () => {
		process.env.NODE_ENV = 'production';
		process.env.ORIGIN = 'https://openibex.example.com';
		expect(() => validateConfigOrThrow()).toThrow(/SESSION_SECRET/);
		process.env.SESSION_SECRET = 'short';
		expect(() => validateConfigOrThrow()).toThrow(/SESSION_SECRET/);
	});

	it('throws in production without ORIGIN', () => {
		process.env.NODE_ENV = 'production';
		process.env.SESSION_SECRET = 'a-sufficiently-long-secret';
		expect(() => validateConfigOrThrow()).toThrow(/ORIGIN/);
	});

	it('passes in production with strong secret + origin', () => {
		process.env.NODE_ENV = 'production';
		process.env.SESSION_SECRET = 'a-sufficiently-long-secret';
		process.env.ORIGIN = 'https://openibex.example.com';
		expect(() => validateConfigOrThrow()).not.toThrow();
	});

	it('rejects a malformed SYNC_ENCRYPTION_KEY but accepts a valid 32-byte one', () => {
		process.env.NODE_ENV = 'development';
		process.env.SYNC_ENCRYPTION_KEY = 'not-32-bytes';
		expect(() => validateConfigOrThrow()).toThrow(/SYNC_ENCRYPTION_KEY/);

		process.env.SYNC_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
		expect(() => validateConfigOrThrow()).not.toThrow();
	});
});
