import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

import { validateDisplayName } from '$lib/validation/displayName';
import { updateProfileDisplayName } from '$lib/server/services/authService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return { user: locals.user };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const displayName = String(form.get('displayName') ?? '');
		const check = validateDisplayName(displayName);
		if (!check.ok) {
			return fail(400, { error: check.message });
		}

		try {
			await updateProfileDisplayName(locals.user.id, check.value ?? '');
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Update failed.';
			return fail(400, { error: message });
		}

		locals.user.displayName = check.value;
		return { success: true };
	}
};
