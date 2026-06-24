import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { getEnv } from '$lib/server/env';

const gunzip = promisify(zlib.gunzip);

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

/** Best-effort delete of a stored file by its data-dir-relative path. Missing files are ignored. */
export async function removeFile(relativePath: string): Promise<void> {
	const env = getEnv();
	const absolutePath = path.join(env.OPENIBEX_DATA_DIR, relativePath);
	try {
		await fs.unlink(absolutePath);
	} catch (err) {
		const code = (err as NodeJS.ErrnoException)?.code;
		if (code !== 'ENOENT') throw err;
	}
}

/** Best-effort delete of an activity's parsed stream blob. */
export async function removeStreamBlob(activityId: string): Promise<void> {
	await removeFile(streamRelativePath(activityId));
}

export async function readStreamBlob(activityId: string): Promise<unknown | null> {
	const env = getEnv();
	const absolutePath = path.join(env.OPENIBEX_DATA_DIR, streamRelativePath(activityId));
	let gzipped: Buffer;
	try {
		gzipped = await fs.readFile(absolutePath);
	} catch (err) {
		const code = (err as NodeJS.ErrnoException)?.code;
		if (code === 'ENOENT') return null;
		throw err;
	}
	const raw = await gunzip(gzipped);
	try {
		return JSON.parse(raw.toString('utf-8'));
	} catch {
		return null;
	}
}

