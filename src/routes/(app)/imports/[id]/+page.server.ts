import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

import { getImportBatchForUser } from '$lib/server/repositories/importBatchesRepository';
import { listImportItemsForBatchUser, listProblemImportItemsForBatchUser } from '$lib/server/repositories/importItemsRepository';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const batch = await getImportBatchForUser(params.id, locals.user.id);
	if (!batch) throw error(404, 'Not found');

	const [items, problemItems] = await Promise.all([
		listImportItemsForBatchUser({ batchId: batch.id, userId: locals.user.id, limit: 500 }),
		listProblemImportItemsForBatchUser({ batchId: batch.id, userId: locals.user.id, limit: 200 })
	]);

	return { batch, items, problemItems };
};

