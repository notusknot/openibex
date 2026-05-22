import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';

import path from 'node:path';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { getEnv } from '$lib/server/env';
import { getActivityFileByIdForUser } from '$lib/server/repositories/activityFilesRepository';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const file = await getActivityFileByIdForUser(params.id, locals.user.id);
	if (!file) throw error(404, 'Not found');

	const absPath = path.join(getEnv().OPENIBEX_DATA_DIR, file.filePath);
	const nodeStream = createReadStream(absPath);
	const body = Readable.toWeb(nodeStream) as unknown as ReadableStream;

	return new Response(body, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-disposition': `attachment; filename="${file.originalFilename.replaceAll('"', '')}"`
		}
	});
};

