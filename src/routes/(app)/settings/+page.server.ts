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
import {
	getCalendarSyncSummaryForUser,
	syncCalendarSubscriptionNow,
	type CalendarSyncResult
} from '$lib/server/services/sync/calendarSyncService';
import {
	createCalendarSubscription,
	deleteCalendarSubscriptionForUser,
	setCalendarSubscriptionEnabled
} from '$lib/server/repositories/calendarSubscriptionsRepository';
import { parseCalendarSubscriptionForm } from '$lib/validation/calendarSubscription';
import {
	GARMIN_WEB_IMPORT_MAX_BYTES,
	startGarminExportImport
} from '$lib/server/services/imports/garminWebImportService';
import { getLogger } from '$lib/server/logger';

/** A short human notice for a calendar sync result, e.g. "3 added · 1 updated". */
function calendarNotice(result: CalendarSyncResult): string {
	if (result.outcome === 'not_modified') return 'Already up to date.';
	const bits: string[] = [];
	if (result.created) bits.push(`${result.created} added`);
	if (result.updated) bits.push(`${result.updated} updated`);
	if (result.conflicts) bits.push(`${result.conflicts} need review`);
	if (result.removed) bits.push(`${result.removed} removed`);
	if (result.cancelled) bits.push(`${result.cancelled} cancelled upstream`);
	if (result.failed) bits.push(`${result.failed} skipped`);
	return bits.length > 0 ? bits.join(' · ') : 'Already up to date.';
}

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
		garmin: await loadGarminStatus(locals.user.id),
		calendar: await getCalendarSyncSummaryForUser(locals.user.id)
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
			getLogger().error({ detail }, 'garmin connect failed');
			return fail(400, { garminError: `Could not connect: ${detail}` });
		}
		return { garminConnected: true };
	},

	disconnectGarmin: async ({ locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		await deleteGarminCredentialForUser(locals.user.id);
		return { garminDisconnected: true };
	},

	// Manual "Sync now" — runs synchronously and reports a summary. Bypasses the
	// throttle window (still respects the lock, so it won't collide with an
	// in-flight auto-sync).
	syncNow: async ({ locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const result = await syncForUser(locals.user.id, { ignoreThrottle: true });
		if (result.outcome === 'auth_failed') {
			return fail(400, { garminError: 'Garmin session expired or is invalid. Reconnect your account.' });
		}
		if (result.outcome === 'rate_limited') {
			return fail(429, {
				garminError: 'Garmin is rate-limiting requests — sync is cooling down. Try again later.'
			});
		}
		if (result.outcome === 'skipped') {
			return fail(409, {
				garminError: 'A sync is already running or cooling down — try again shortly.'
			});
		}
		if (result.outcome === 'error') {
			return fail(400, { garminError: `Sync failed: ${result.error ?? 'unknown error'}` });
		}
		return { garminSync: { imported: result.imported, duplicate: result.duplicate, unsupported: result.unsupported, failed: result.failed } };
	},

	// Bulk-import a full Garmin "Export Your Data" archive (the same job the
	// `pnpm import:garmin` CLI runs). Accepts the export .zip, kicks the import
	// off in the background, and redirects to the batch's import log.
	importGarminExport: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File)) {
			return fail(400, { importError: 'Choose your Garmin export .zip file.' });
		}

		const name = file.name || 'garmin-export.zip';
		if (!name.toLowerCase().endsWith('.zip')) {
			return fail(400, {
				importError: 'Upload the .zip you downloaded from Garmin (Account → Export Your Data).'
			});
		}
		if (file.size <= 0) {
			return fail(400, { importError: 'That file is empty.' });
		}
		if (file.size > GARMIN_WEB_IMPORT_MAX_BYTES) {
			return fail(400, {
				importError: `That file is too large (max ${Math.round(GARMIN_WEB_IMPORT_MAX_BYTES / (1024 * 1024))} MB).`
			});
		}

		const bytes = new Uint8Array(await file.arrayBuffer());

		let batchId: string;
		try {
			({ batchId } = await startGarminExportImport({
				userId: locals.user.id,
				userEmail: locals.user.email,
				originalName: name,
				zipBytes: bytes
			}));
		} catch (err) {
			getLogger().error(
				{ detail: err instanceof Error ? err.message : 'unknown error' },
				'failed to start garmin bulk import'
			);
			return fail(400, { importError: 'Could not start the import. Please try again.' });
		}

		// Land on the batch's log so progress (parsed / imported / duplicate /
		// failed) streams in as the background job runs.
		throw redirect(303, `/imports/${batchId}`);
	},

	// ── Experimental calendar (ICS) subscriptions ────────────────────────────
	addCalendar: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const parsed = parseCalendarSubscriptionForm(form);
		if (!parsed.ok) return fail(400, { calendarError: parsed.message });

		const id = crypto.randomUUID();
		try {
			await createCalendarSubscription({ id, userId: locals.user.id, url: parsed.value.url, label: parsed.value.label });
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			if (/UNIQUE/i.test(msg)) return fail(400, { calendarError: 'You already subscribe to that feed.' });
			getLogger().error({ detail: 'add calendar failed' }, 'calendar add failed');
			return fail(400, { calendarError: 'Could not add that calendar.' });
		}

		// Pull it immediately so the user sees their workouts right away.
		const result = await syncCalendarSubscriptionNow(id, locals.user.id);
		if (!result) return { calendarNotice: 'Calendar added.' };
		if (['unreachable', 'parse_error', 'error', 'rate_limited'].includes(result.outcome)) {
			return { calendarNotice: 'Calendar added, but the first sync failed — double-check the URL. It will retry automatically.' };
		}
		return { calendarNotice: `Calendar added — ${calendarNotice(result)}` };
	},

	removeCalendar: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		// Cascades the sync link rows but leaves already-created planned workouts
		// in place — unsubscribing stops syncing, it doesn't wipe your training.
		await deleteCalendarSubscriptionForUser(id, locals.user.id);
		return { calendarNotice: 'Calendar removed. Existing planned workouts were kept.' };
	},

	toggleCalendar: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const enabled = String(form.get('enabled') ?? '') === 'true';
		await setCalendarSubscriptionEnabled(id, locals.user.id, enabled);
		return { calendarNotice: enabled ? 'Calendar resumed.' : 'Calendar paused.' };
	},

	syncCalendar: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const result = await syncCalendarSubscriptionNow(id, locals.user.id);
		if (!result) return fail(404, { calendarError: 'Calendar not found.' });
		switch (result.outcome) {
			case 'rate_limited':
				return fail(429, { calendarError: 'The calendar host is rate-limiting — cooling down. Try again later.' });
			case 'unreachable':
				return fail(400, { calendarError: 'Could not reach the calendar feed. Check the URL.' });
			case 'parse_error':
				return fail(400, { calendarError: 'That feed could not be read as a calendar.' });
			case 'error':
				return fail(400, { calendarError: `Sync failed: ${result.error ?? 'unknown error'}` });
			case 'skipped':
				return fail(409, { calendarError: 'A sync is already running — try again shortly.' });
			case 'disabled':
				return fail(400, { calendarError: 'This calendar is paused. Resume it first.' });
			default:
				return { calendarNotice: calendarNotice(result) };
		}
	}
};
