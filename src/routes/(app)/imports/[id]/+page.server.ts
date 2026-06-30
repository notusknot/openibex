import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

import { getImportDetailForUser } from '$lib/server/services/importsService';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const detail = await getImportDetailForUser(locals.user.id, params.id);
	if (!detail) throw error(404, 'Not found');

	return detail;
};

