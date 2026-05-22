import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { listRecentActivitiesForUser } from '$lib/server/repositories/activitiesRepository';
import { listRecentImportJobsForUser } from '$lib/server/repositories/importJobsRepository';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const [activities, importJobs] = await Promise.all([
		listRecentActivitiesForUser(locals.user.id, 50),
		listRecentImportJobsForUser(locals.user.id, 20)
	]);

	return { activities, importJobs };
};

