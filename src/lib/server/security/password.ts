import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}

export type PasswordHash = string;

export async function hashPassword(password: string): Promise<PasswordHash> {
	if (password.length < 8) {
		throw new Error('Password must be at least 8 characters.');
	}

	const salt = crypto.randomBytes(16);
	const N = 16384;
	const r = 8;
	const p = 1;

	const key = await new Promise<Buffer>((resolve, reject) => {
		crypto.scrypt(password, salt, SCRYPT_KEYLEN, { N, r, p }, (err, derivedKey) => {
			if (err) reject(err);
			else resolve(derivedKey as Buffer);
		});
	});

	return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
	const parts = stored.split('$');
	if (parts.length !== 6) return false;
	const [scheme, nRaw, rRaw, pRaw, saltB64, keyB64] = parts;
	if (scheme !== 'scrypt') return false;
	if (!saltB64 || !keyB64) return false;

	const N = Number(nRaw);
	const r = Number(rRaw);
	const p = Number(pRaw);
	if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

	const salt = Buffer.from(saltB64, 'base64');
	const expected = Buffer.from(keyB64, 'base64');

	const actual = await new Promise<Buffer>((resolve, reject) => {
		crypto.scrypt(password, salt, expected.length, { N, r, p }, (err, derivedKey) => {
			if (err) reject(err);
			else resolve(derivedKey as Buffer);
		});
	});

	return timingSafeEqual(actual, expected);
}
