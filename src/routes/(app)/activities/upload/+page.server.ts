import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

import { importFitUpload, DuplicateUploadError } from '$lib/server/services/fitImportService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File)) {
			return fail(400, { error: 'File is required.' });
		}

		const name = file.name || 'activity.fit';
		if (!name.toLowerCase().endsWith('.fit')) {
			return fail(400, { error: 'Only .fit files are supported in Milestone 3.' });
		}

		if (file.size <= 0) {
			return fail(400, { error: 'File is empty.' });
		}
		if (file.size > 50 * 1024 * 1024) {
			return fail(400, { error: 'File is too large (max 50MB).' });
		}

		const bytes = new Uint8Array(await file.arrayBuffer());

		try {
			const result = await importFitUpload({
				userId: locals.user.id,
				originalFilename: name,
				bytes
			});
			throw redirect(303, `/activities/${result.activityId}`);
		} catch (err) {
			if (err instanceof DuplicateUploadError) {
				return fail(400, { error: 'This activity is already in your library.' });
			}
			const message = err instanceof Error ? err.message : 'Import failed.';
			return fail(400, { error: message });
		}
	}
};

