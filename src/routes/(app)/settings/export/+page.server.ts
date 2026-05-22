import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';

import { writeUserExportToDisk } from '$lib/server/services/exportService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		try {
			const exp = await writeUserExportToDisk(locals.user.id);
			throw redirect(303, `/exports/${exp.exportId}/download`);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Export failed.';
			return fail(500, { error: message });
		}
	}
};
