import fs from 'node:fs/promises';
import path from 'node:path';
import { getEnv } from '$lib/server/env';

export function uploadRelativePath(userId: string, sha256: string, ext: string): string {
	return path.posix.join('uploads', userId, `${sha256}.${ext}`);
}

export function streamRelativePath(activityId: string): string {
	return path.posix.join('streams', `${activityId}.json.gz`);
}

export async function writeUploadFile(input: {
	userId: string;
	sha256: string;
	ext: string;
	bytes: Uint8Array;
}): Promise<{ relativePath: string; sizeBytes: number }> {
	const env = getEnv();
	const relativePath = uploadRelativePath(input.userId, input.sha256, input.ext);
	const absolutePath = path.join(env.OPENIBEX_DATA_DIR, relativePath);

	await fs.mkdir(path.dirname(absolutePath), { recursive: true });
	await fs.writeFile(absolutePath, input.bytes, { flag: 'wx' });
	return { relativePath, sizeBytes: input.bytes.byteLength };
}

export async function writeStreamBlob(input: {
	activityId: string;
	gzipBytes: Uint8Array;
}): Promise<{ relativePath: string }> {
	const env = getEnv();
	const relativePath = streamRelativePath(input.activityId);
	const absolutePath = path.join(env.OPENIBEX_DATA_DIR, relativePath);
	await fs.mkdir(path.dirname(absolutePath), { recursive: true });
	await fs.writeFile(absolutePath, input.gzipBytes);
	return { relativePath };
}

export async function readUploadFile(relativePath: string): Promise<Uint8Array> {
	const env = getEnv();
	const absolutePath = path.join(env.OPENIBEX_DATA_DIR, relativePath);
	return fs.readFile(absolutePath);
}

