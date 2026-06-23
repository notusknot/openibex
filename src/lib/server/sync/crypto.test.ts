import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { seal, sealJson, unseal, unsealJson } from '$lib/server/sync/crypto';

const KEY = crypto.randomBytes(32).toString('base64');

describe('sync/crypto', () => {
	let prevKey: string | undefined;

	beforeEach(() => {
		prevKey = process.env.SYNC_ENCRYPTION_KEY;
		process.env.SYNC_ENCRYPTION_KEY = KEY;
	});

	afterEach(() => {
		if (prevKey === undefined) delete process.env.SYNC_ENCRYPTION_KEY;
		else process.env.SYNC_ENCRYPTION_KEY = prevKey;
	});

	it('round-trips a string', () => {
		const blob = seal('hello garmin');
		expect(blob).not.toContain('hello garmin');
		expect(unseal(blob)).toBe('hello garmin');
	});

	it('round-trips JSON tokens', () => {
		const tokens = { oauth1: 'abc', oauth2: { access: 'xyz', expiresAt: 123 } };
		const blob = sealJson(tokens);
		expect(unsealJson(blob)).toEqual(tokens);
	});

	it('produces a fresh IV each call (ciphertext differs for same plaintext)', () => {
		expect(seal('same')).not.toBe(seal('same'));
	});

	it('rejects a tampered ciphertext (GCM auth tag)', () => {
		const blob = seal('secret');
		const [iv, tag, data] = blob.split('.');
		const flipped = Buffer.from(data!, 'base64');
		flipped[0] = (flipped[0] ?? 0) ^ 0xff;
		const tampered = `${iv}.${tag}.${flipped.toString('base64')}`;
		expect(() => unseal(tampered)).toThrow();
	});

	it('throws a clear error when the key is missing', () => {
		delete process.env.SYNC_ENCRYPTION_KEY;
		expect(() => seal('x')).toThrow(/SYNC_ENCRYPTION_KEY is not set/);
	});

	it('throws when the key is the wrong length', () => {
		process.env.SYNC_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
		expect(() => seal('x')).toThrow(/must decode to 32 bytes/);
	});
});
