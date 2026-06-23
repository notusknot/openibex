import crypto from 'node:crypto';
import { getEnv } from '$lib/server/env';

// AES-256-GCM sealing for stored provider session tokens. The serialized blob
// is `base64(iv).base64(authTag).base64(ciphertext)` so a single text column
// holds everything needed to decrypt. The key comes from SYNC_ENCRYPTION_KEY
// (base64 of 32 random bytes — generate with `openssl rand -base64 32`).

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const KEY_BYTES = 32;

function loadKey(): Buffer {
	const raw = getEnv().SYNC_ENCRYPTION_KEY;
	if (!raw) {
		throw new Error(
			'SYNC_ENCRYPTION_KEY is not set — required to encrypt/decrypt Garmin sync credentials. Generate one with: openssl rand -base64 32'
		);
	}
	const key = Buffer.from(raw, 'base64');
	if (key.length !== KEY_BYTES) {
		throw new Error(
			`SYNC_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). Generate one with: openssl rand -base64 32`
		);
	}
	return key;
}

export function seal(plaintext: string): string {
	const key = loadKey();
	const iv = crypto.randomBytes(IV_BYTES);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function unseal(blob: string): string {
	const key = loadKey();
	const parts = blob.split('.');
	if (parts.length !== 3) {
		throw new Error('Malformed sealed blob (expected iv.tag.ciphertext).');
	}
	const [ivB64, tagB64, dataB64] = parts as [string, string, string];
	const iv = Buffer.from(ivB64, 'base64');
	const authTag = Buffer.from(tagB64, 'base64');
	const ciphertext = Buffer.from(dataB64, 'base64');
	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function sealJson(value: unknown): string {
	return seal(JSON.stringify(value));
}

export function unsealJson<T>(blob: string): T {
	return JSON.parse(unseal(blob)) as T;
}
