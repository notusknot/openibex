import crypto from 'node:crypto';

export function generateSessionToken(): string {
	return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

