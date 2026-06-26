import { getLogger } from '$lib/server/logger';
import { getAnyGarminCredential } from '$lib/server/repositories/garminCredentialsRepository';
import { unsealJson } from '$lib/server/sync/crypto';

/**
 * Boot-time guard for the experimental Garmin sync key.
 *
 * The failure this prevents: a self-hoster connects Garmin (storing AES-256-GCM
 * sealed tokens), then later restarts with SYNC_ENCRYPTION_KEY missing, changed,
 * or rotated. Without this, the only symptom is sync silently dropping into a
 * perpetual `failing` backoff — every stored credential is now undecryptable but
 * nothing says so. env.ts already validates the key *format* at boot; this adds
 * the *can it actually decrypt the stored data* check.
 *
 * Deliberately LOG-only, never throws: sync is experimental, so a key problem
 * must not take down the whole app (and lock the operator out of their training
 * data). It surfaces an unmissable error log instead. Safe to call fire-and-forget.
 */
export async function warnIfSyncKeyMisconfigured(): Promise<void> {
	try {
		const cred = await getAnyGarminCredential();
		if (!cred) return; // no sync users — the key isn't needed yet

		try {
			// A successful unseal proves the current key matches what sealed the
			// stored tokens. This catches both a missing key and a rotated/wrong
			// one (the format check in env.ts cannot).
			unsealJson(cred.encryptedBlob);
		} catch {
			getLogger().error(
				'SYNC_ENCRYPTION_KEY is missing, invalid, or rotated: stored Garmin sync credentials ' +
					'cannot be decrypted, so sync will keep failing. Restore the original key, or set a new ' +
					'key and reconnect Garmin from Settings. (Generate a key: openssl rand -base64 32)'
			);
		}
	} catch {
		// Never let an experimental-feature check disrupt boot.
	}
}
