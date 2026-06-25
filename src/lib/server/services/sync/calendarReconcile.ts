import type { CalendarSyncedWorkoutState } from '$lib/server/db/schema';

// The reconciliation decision, isolated as a pure function so every branch is
// unit-testable without a DB. The caller computes three hashes and hands them in;
// this returns WHAT to do, and the repository applies it transactionally.
//
//   syncedHash  — hash of the mapped fields we last wrote (stored on the link)
//   currentHash — hash of the planned workout as it is NOW (null if the user
//                 deleted it, i.e. the link's planned_workout_id is null)
//   upstreamHash — hash of the event as it is in the feed now (null if the event
//                 is gone / cancelled upstream)
//
//   userEdited     = currentHash !== syncedHash
//   upstreamChanged = upstreamHash !== syncedHash

export type ReconcileActionKind =
	| 'create' // first time we've seen this event → make the workout + link
	| 'noop' // nothing to do
	| 'update' // untouched + upstream changed → auto-update to upstream
	| 'preserve' // user edited + upstream unchanged → keep user's, mark user_modified
	| 'conflict' // user edited + upstream changed → flag for review, keep user's
	| 'conflict-refresh' // already in conflict, but upstream advanced again → re-capture
	| 'delete' // untouched + gone upstream → remove the workout + link
	| 'flag-cancelled' // user edited + gone upstream → keep but flag
	| 'skip'; // tombstoned (user-deleted) or conflict already surfaced → leave alone

export type ReconcileInput = {
	link: {
		state: CalendarSyncedWorkoutState;
		syncedHash: string;
		conflictHash: string | null;
		/** null ⇒ the user deleted the planned workout (durable tombstone). */
		hasPlannedWorkout: boolean;
	} | null;
	/** Present (and non-cancelled) in the feed this poll. */
	upstreamPresent: boolean;
	upstreamHash: string | null;
	/** Hash of the current planned workout; null when there is none. */
	currentHash: string | null;
};

export function reconcileEvent(input: ReconcileInput): ReconcileActionKind {
	const { link, upstreamPresent, upstreamHash, currentHash } = input;

	// Never seen before: only act if it's actually in the feed.
	if (!link) {
		return upstreamPresent ? 'create' : 'noop';
	}

	// Durable tombstone: the user deleted the workout. Never recreate it — and
	// keep the row forever so the deletion stays durable even if the coach later
	// removes and re-adds the same UID.
	if (!link.hasPlannedWorkout) {
		return 'skip';
	}

	const userEdited = currentHash !== link.syncedHash;

	// Event removed from the feed (or cancelled upstream).
	if (!upstreamPresent) {
		if (!userEdited) return 'delete'; // untouched → remove
		// Customized → keep, but flag once (don't re-flag every poll).
		return link.state === 'cancelled' ? 'noop' : 'flag-cancelled';
	}

	const upstreamChanged = upstreamHash !== link.syncedHash;

	// Already flagged as a conflict: don't re-surface the same one each poll. Only
	// re-capture if the coach has edited again since we recorded the conflict.
	if (link.state === 'conflict') {
		return upstreamHash !== link.conflictHash ? 'conflict-refresh' : 'skip';
	}

	if (!userEdited && !upstreamChanged) return 'noop';
	if (!userEdited && upstreamChanged) return 'update';
	if (userEdited && !upstreamChanged) {
		// Preserve the user's version. Mark user_modified the first time we notice;
		// after that it's a no-op (also clears a stale 'cancelled' flag if the event
		// came back unchanged).
		return link.state === 'user_modified' ? 'noop' : 'preserve';
	}
	// userEdited && upstreamChanged → genuine conflict.
	return 'conflict';
}
