import { checkpointAndCloseDb } from '$lib/server/db/client';

// Docker sends SIGTERM on every deploy, restart, and `docker stop`, then
// SIGKILLs after a grace period. If the process dies mid-write we risk a
// truncated transaction or an un-checkpointed WAL. This module drains in-flight
// critical writes, checkpoints, and closes the DB cleanly before exiting.
// See docs/stability-hardening-spec.md §2.

let shuttingDown = false;
let inFlight = 0;

/** Mark the start of a critical write (e.g. a Garmin sync) so a graceful
 * shutdown waits for it to finish before checkpointing and closing. */
export function beginCriticalWork(): void {
	inFlight++;
}

/** Mark a critical write complete. Floored at zero so an unbalanced release
 * can't underflow and make the drain loop wait forever. */
export function endCriticalWork(): void {
	inFlight = Math.max(0, inFlight - 1);
}

/** Number of critical writes currently in flight (diagnostics / health). */
export function criticalWorkCount(): number {
	return inFlight;
}

/** True once a termination signal has been received. New work should bail. */
export function isShuttingDown(): boolean {
	return shuttingDown;
}

async function drain(timeoutMs = 10_000): Promise<void> {
	const start = Date.now();
	while (inFlight > 0 && Date.now() - start < timeoutMs) {
		await new Promise((r) => setTimeout(r, 100));
	}
}

async function shutdown(signal: string): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log(`[shutdown] ${signal} received, draining ${inFlight} in-flight write(s)…`);
	try {
		await drain();
		checkpointAndCloseDb();
		console.log('[shutdown] db checkpointed and closed cleanly');
		process.exit(0);
	} catch (err) {
		console.error('[shutdown] error during shutdown', err);
		process.exit(1);
	}
}

let registered = false;

/** Register SIGTERM/SIGINT handlers exactly once. Call from the server entry
 * (hooks.server.ts) so it runs at startup. Safe to call repeatedly. */
export function registerShutdownHandlers(): void {
	if (registered) return;
	registered = true;
	for (const sig of ['SIGTERM', 'SIGINT'] as const) {
		process.on(sig, () => void shutdown(sig));
	}
}
