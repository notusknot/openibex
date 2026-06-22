import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listImportBatchesForUser } from '$lib/server/repositories/importBatchesRepository';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const batches = await listImportBatchesForUser(locals.user.id, 100);
	return { batches };
};

