import { describe, expect, it } from 'vitest';

import {
	beginCriticalWork,
	endCriticalWork,
	criticalWorkCount,
	isShuttingDown
} from '$lib/server/shutdown';

describe('shutdown in-flight tracking', () => {
	it('starts idle and not shutting down', () => {
		expect(criticalWorkCount()).toBe(0);
		expect(isShuttingDown()).toBe(false);
	});

	it('counts begin/end of critical work', () => {
		beginCriticalWork();
		beginCriticalWork();
		expect(criticalWorkCount()).toBe(2);
		endCriticalWork();
		expect(criticalWorkCount()).toBe(1);
		endCriticalWork();
		expect(criticalWorkCount()).toBe(0);
	});

	it('floors the counter at zero on an unbalanced release', () => {
		// An over-release must not underflow — a negative count would make the
		// drain loop believe work is in flight and stall the full timeout (or,
		// worse, skip draining a real write).
		endCriticalWork();
		endCriticalWork();
		expect(criticalWorkCount()).toBe(0);
		beginCriticalWork();
		expect(criticalWorkCount()).toBe(1);
		endCriticalWork();
		expect(criticalWorkCount()).toBe(0);
	});
});
