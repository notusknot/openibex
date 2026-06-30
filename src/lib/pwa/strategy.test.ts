import { describe, expect, it } from 'vitest';
import { routeStrategy } from './strategy';

const ORIGIN = 'https://openibex.example.ts.net';
const url = (path: string) => new URL(path, ORIGIN);

// A representative precache set: one hashed build chunk + a couple of static
// files. Mirrors what [...build, ...files] produces at build time.
const precached = new Set<string>([
	'/_app/immutable/entry/start.abc123.js',
	'/_app/immutable/assets/app.def456.css',
	'/manifest.webmanifest',
	'/icon.svg',
	'/offline.html'
]);

describe('routeStrategy', () => {
	it('serves precached build chunks and static files cache-first', () => {
		expect(routeStrategy(url('/_app/immutable/entry/start.abc123.js'), precached)).toBe('cache-first');
		expect(routeStrategy(url('/_app/immutable/assets/app.def456.css'), precached)).toBe('cache-first');
		expect(routeStrategy(url('/manifest.webmanifest'), precached)).toBe('cache-first');
		expect(routeStrategy(url('/icon.svg'), precached)).toBe('cache-first');
		expect(routeStrategy(url('/offline.html'), precached)).toBe('cache-first');
	});

	it('treats /api/* as network-only (never cached, no offline fallback)', () => {
		expect(routeStrategy(url('/api/health'), precached)).toBe('network-only');
		expect(routeStrategy(url('/api/activities/123'), precached)).toBe('network-only');
	});

	it('treats authenticated navigations as network-first so data is never stale', () => {
		expect(routeStrategy(url('/dashboard'), precached)).toBe('network-first');
		expect(routeStrategy(url('/activities'), precached)).toBe('network-first');
		expect(routeStrategy(url('/activities/abc-123'), precached)).toBe('network-first');
		expect(routeStrategy(url('/calendar'), precached)).toBe('network-first');
		expect(routeStrategy(url('/'), precached)).toBe('network-first');
	});

	it('never classifies an authenticated HTML route as cache-first', () => {
		// The safety invariant: even a hashed-looking app path is network-first
		// unless it is explicitly in the precache set.
		for (const path of ['/dashboard', '/activities', '/settings', '/imports', '/login']) {
			expect(routeStrategy(url(path), precached)).not.toBe('cache-first');
		}
	});

	it('falls back to network-first for an unknown static-looking path not in the precache set', () => {
		// A stale hashed asset from a previous build is not in the current set,
		// so it must go to the network rather than be served cache-first.
		expect(routeStrategy(url('/_app/immutable/entry/start.OLD000.js'), precached)).toBe('network-first');
	});
});
