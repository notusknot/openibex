import crypto from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

import { updateProfileDisplayName } from '$lib/server/services/authService';
import { updateUserPreferences } from '$lib/server/repositories/usersRepository';
import { validateDisplayName } from '$lib/validation/displayName';
import { parseUserPreferencesForm } from '$lib/validation/userPreferences';
import {
	deleteGarminCredentialForUser,
	getGarminCredentialForUser,
	saveGarminCredential
} from '$lib/server/repositories/garminCredentialsRepository';
import { GarminAuthError, GarminMfaUnsupportedError, login, redactGarminError } from '$lib/server/sync/garmin';
import { sealJson } from '$lib/server/sync/crypto';
import { isUserSyncing, syncForUser } from '$lib/server/services/sync/syncService';

// Sanitized view of the Garmin credential for the page — never exposes the
// encrypted token blob to the client.
async function loadGarminStatus(userId: string) {
	const cred = await getGarminCredentialForUser(userId);
	if (!cred) return { connected: false as const };
	return {
		connected: true as const,
		syncEnabled: cred.syncEnabled,
		lastSyncAt: cred.lastSyncAt ? cred.lastSyncAt.getTime() : null,
		lastSyncStatus: cred.lastSyncStatus,
		lastSyncError: cred.lastSyncError,
		syncing: isUserSyncing(userId)
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {
		user: locals.user,
		userPrefs: locals.userPrefs,
		garmin: await loadGarminStatus(locals.user.id)
	};
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
	},

	// Experimental Garmin sync — connect with email + password, store only the
	// encrypted session tokens (never the password).
	connectGarmin: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const email = String(form.get('garminEmail') ?? '').trim();
		const password = String(form.get('garminPassword') ?? '');
		if (!email || !password) {
			return fail(400, { garminError: 'Enter your Garmin Connect email and password.' });
		}

		try {
			const tokens = await login(email, password);
			await saveGarminCredential({
				id: crypto.randomUUID(),
				userId: locals.user.id,
				encryptedBlob: sealJson(tokens)
			});
		} catch (err) {
			if (err instanceof GarminMfaUnsupportedError || err instanceof GarminAuthError) {
				return fail(400, { garminError: err.message });
			}
			// Non-login failure (e.g. missing SYNC_ENCRYPTION_KEY, storage error).
			// login() only throws the typed errors above and never leaks the raw
			// library message, so the remaining errors here are safe to redact +
			// surface. Log too, so it's visible in server output.
			const detail = redactGarminError(err);
			console.error('[garmin] connect failed:', detail);
			return fail(400, { garminError: `Could not connect: ${detail}` });
		}
		return { garminConnected: true };
	},

	disconnectGarmin: async ({ locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		await deleteGarminCredentialForUser(locals.user.id);
		return { garminDisconnected: true };
	},

	// Manual "Sync now" — runs synchronously and reports a summary.
	syncNow: async ({ locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const result = await syncForUser(locals.user.id);
		if (result.outcome === 'auth_failed') {
			return fail(400, { garminError: 'Garmin session expired or is invalid. Reconnect your account.' });
		}
		if (result.outcome === 'error') {
			return fail(400, { garminError: `Sync failed: ${result.error ?? 'unknown error'}` });
		}
		return { garminSync: { imported: result.imported, duplicate: result.duplicate, unsupported: result.unsupported, failed: result.failed } };
	}
};
