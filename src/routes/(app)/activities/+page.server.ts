import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { getActivitiesList } from '$lib/server/services/activitiesListService';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const limitRaw = Number(url.searchParams.get('limit') ?? '');
	const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.trunc(limitRaw)) : 50;

	const data = await getActivitiesList({ userId: locals.user.id, limit });
	return { activities: data };
};
