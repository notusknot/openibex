import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listImportsForUser } from '$lib/server/services/importsService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const batches = await listImportsForUser(locals.user.id);
	return { batches };
};

