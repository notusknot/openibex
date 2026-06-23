import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

import { updateProfileDisplayName } from '$lib/server/services/authService';
import { updateUserPreferences } from '$lib/server/repositories/usersRepository';
import { validateDisplayName } from '$lib/validation/displayName';
import { parseUserPreferencesForm } from '$lib/validation/userPreferences';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return { user: locals.user, userPrefs: locals.userPrefs };
};

export const actions: Actions = {
	save: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();

		// Display name (existing).
		const displayName = String(form.get('displayName') ?? '');
		const displayCheck = validateDisplayName(displayName);
		if (!displayCheck.ok) return fail(400, { error: displayCheck.message });

		// Preferences. The form's "thresholdPace" field is interpreted in the
		// units the user has currently selected on the form (sec/km vs sec/mi),
		// then converted to internal sec/km for storage.
		const currentDisplayUnits = locals.userPrefs?.units ?? 'imperial';
		const prefsCheck = parseUserPreferencesForm(form, currentDisplayUnits);
		if (!prefsCheck.ok) return fail(400, { error: prefsCheck.message });

		try {
			await updateProfileDisplayName(locals.user.id, displayCheck.value ?? '');
			await updateUserPreferences(locals.user.id, prefsCheck.value);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Update failed.';
			return fail(400, { error: message });
		}

		locals.user.displayName = displayCheck.value;
		// Sync locals so subsequent loads in this request reflect the change.
		if (locals.userPrefs) {
			Object.assign(locals.userPrefs, prefsCheck.value);
		}
		return { success: true };
	}
};
