import { describe, expect, it } from 'vitest';

import { reconcileEvent, type ReconcileInput } from './calendarReconcile';

// Pure decision tests — one per row of the reconciliation table in the plan.
// H = the baseline hash we last wrote; HE = a user-edited hash; H2/H3 = changed
// upstream hashes.

function link(overrides: Partial<NonNullable<ReconcileInput['link']>> = {}): ReconcileInput['link'] {
	return {
		state: 'synced',
		syncedHash: 'H',
		conflictHash: null,
		hasPlannedWorkout: true,
		...overrides
	};
}

describe('reconcileEvent', () => {
	it('creates a workout for a never-seen event that is in the feed', () => {
		expect(reconcileEvent({ link: null, upstreamPresent: true, upstreamHash: 'H', currentHash: null })).toBe('create');
	});

	it('does nothing for an unknown event that is not in the feed', () => {
		expect(reconcileEvent({ link: null, upstreamPresent: false, upstreamHash: null, currentHash: null })).toBe('noop');
	});

	it('never recreates a tombstoned (user-deleted) workout', () => {
		const tomb = link({ hasPlannedWorkout: false });
		expect(reconcileEvent({ link: tomb, upstreamPresent: true, upstreamHash: 'H', currentHash: null })).toBe('skip');
		expect(reconcileEvent({ link: tomb, upstreamPresent: false, upstreamHash: null, currentHash: null })).toBe('skip');
	});

	it('is a no-op when neither side changed', () => {
		expect(reconcileEvent({ link: link(), upstreamPresent: true, upstreamHash: 'H', currentHash: 'H' })).toBe('noop');
	});

	it('auto-updates an untouched workout when upstream changed', () => {
		expect(reconcileEvent({ link: link(), upstreamPresent: true, upstreamHash: 'H2', currentHash: 'H' })).toBe('update');
	});

	it('preserves a user-edited workout when upstream is unchanged', () => {
		expect(reconcileEvent({ link: link(), upstreamPresent: true, upstreamHash: 'H', currentHash: 'HE' })).toBe('preserve');
	});

	it('only marks user_modified once (then no-ops)', () => {
		const ulink = link({ state: 'user_modified' });
		expect(reconcileEvent({ link: ulink, upstreamPresent: true, upstreamHash: 'H', currentHash: 'HE' })).toBe('noop');
	});

	it('flags a conflict when BOTH the user and upstream changed', () => {
		expect(reconcileEvent({ link: link(), upstreamPresent: true, upstreamHash: 'H2', currentHash: 'HE' })).toBe('conflict');
	});

	it('does not re-surface a conflict that already reflects the current upstream', () => {
		const clink = link({ state: 'conflict', conflictHash: 'H2' });
		expect(reconcileEvent({ link: clink, upstreamPresent: true, upstreamHash: 'H2', currentHash: 'HE' })).toBe('skip');
	});

	it('refreshes a conflict when the coach edits again on top of the conflict', () => {
		const clink = link({ state: 'conflict', conflictHash: 'H2' });
		expect(reconcileEvent({ link: clink, upstreamPresent: true, upstreamHash: 'H3', currentHash: 'HE' })).toBe('conflict-refresh');
	});

	it('deletes an untouched workout removed from the feed', () => {
		expect(reconcileEvent({ link: link(), upstreamPresent: false, upstreamHash: null, currentHash: 'H' })).toBe('delete');
	});

	it('keeps + flags a customized workout removed from the feed', () => {
		expect(reconcileEvent({ link: link(), upstreamPresent: false, upstreamHash: null, currentHash: 'HE' })).toBe('flag-cancelled');
	});

	it('does not re-flag an already-cancelled customized workout', () => {
		const clink = link({ state: 'cancelled' });
		expect(reconcileEvent({ link: clink, upstreamPresent: false, upstreamHash: null, currentHash: 'HE' })).toBe('noop');
	});
});
