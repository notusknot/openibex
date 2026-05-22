import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';

import { readExportManifest, readExportZipBytes } from '$lib/server/services/exportService';
import { Buffer } from 'node:buffer';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const manifest = await readExportManifest(params.id);
	if (!manifest) throw error(404, 'Not found');
	if (manifest.userId !== locals.user.id) throw error(403, 'Forbidden');

	const bytes = await readExportZipBytes(params.id, manifest.filename);
	if (!bytes) throw error(404, 'Not found');

	const buf = Buffer.from(bytes);
	return new Response(new Blob([buf], { type: 'application/zip' }), {
		headers: {
			'content-disposition': `attachment; filename="${manifest.filename}"`
		}
	});
};
