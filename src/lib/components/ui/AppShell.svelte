<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { theme } from '$lib/stores/theme';

	export let user: { displayName: string | null; email: string; role: string };
	export let railSummary: {
		activitiesCount: number;
		season: { tss: number; hours: number; km: number };
	} | null = null;

	type TabIcon = 'dashboard' | 'calendar' | 'activities' | 'settings';

	// Analytics + Imports are intentionally hidden from the nav for now —
	// the routes are still reachable by direct URL but the user hasn't
	// committed to surfacing them yet. Re-add when ready.
	const navItems: { href: string; label: string; showCount?: boolean; icon: TabIcon }[] = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/calendar', label: 'Calendar', icon: 'calendar' },
		{ href: '/activities', label: 'Activities', showCount: true, icon: 'activities' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];

	// Keep iOS Safari's URL bar / PWA chrome color in sync with the in-app
	// theme store. The static <meta theme-color> tags in app.html cover
	// prefers-color-scheme; this one (no `media`) wins when present.
	let themeMeta: HTMLMetaElement | null = null;
	onMount(() => {
		let existing = document.querySelector<HTMLMetaElement>(
			'meta[name="theme-color"]:not([media])'
		);
		if (!existing) {
			existing = document.createElement('meta');
			existing.name = 'theme-color';
			document.head.appendChild(existing);
		}
		themeMeta = existing;
	});
	$: if (themeMeta) {
		themeMeta.content = $theme === 'dark' ? '#0d1a15' : '#f4f2ec';
	}

	$: pathname = $page.url.pathname;
	$: displayName = user.displayName ?? user.email;
	$: initials = computeInitials(displayName);
	$: roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

	function computeInitials(name: string): string {
		const trimmed = name.trim();
		const at = trimmed.indexOf('@');
		const base = at >= 0 ? trimmed.slice(0, at) : trimmed;
		const parts = base.split(/[\s._-]+/).filter(Boolean);
		if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
		return base.slice(0, 2).toUpperCase();
	}

	// `current` must be passed explicitly so the {@const} in the each block
	// has pathname as a tracked dependency — Svelte's compiler doesn't trace
	// into function bodies, so reading $page from inside this function would
	// not trigger re-renders on navigation.
	function isActive(current: string, href: string): boolean {
		if (href === '/dashboard') return current === '/dashboard';
		return current === href || current.startsWith(href + '/');
	}
</script>

<div class="oi oi-root" data-theme={$theme}>
	<aside class="rail">
		<div class="brand-row">
			<div class="logo oi-mono">OI</div>
			<div>
				<div class="brand-name">OpenIbex</div>
				<div class="brand-tag oi-mono">TRAINING COCKPIT</div>
			</div>
		</div>

		<nav class="nav" aria-label="Primary">
			{#each navItems as item}
				{@const active = isActive(pathname, item.href)}
				<a class="nav-item" class:active href={item.href} aria-current={active ? 'page' : undefined}>
					<span class="nav-label">{item.label}</span>
					{#if active}
						<span class="nav-dot" aria-hidden="true">●</span>
					{:else if item.showCount && railSummary}
						<span class="nav-count oi-mono">{railSummary.activitiesCount}</span>
					{/if}
				</a>
			{/each}
		</nav>

		{#if railSummary}
			<div class="season">
				<div class="season-label oi-mono">SEASON LOAD</div>
				<div class="season-val oi-mono">{railSummary.season.tss}</div>
				<div class="season-sub oi-mono">
					{railSummary.season.hours}h · {railSummary.season.km} km
				</div>
			</div>
		{/if}

		<form method="POST" action="/logout" class="logout-form">
			<button type="submit" class="logout">
				<span class="logout-icon" aria-hidden="true" />
				Log out
			</button>
		</form>

		<div class="user-foot">
			<div class="avatar oi-mono">{initials}</div>
			<div class="user-meta">
				<div class="user-name">{displayName}</div>
				<div class="user-role">{roleLabel}</div>
			</div>
		</div>
	</aside>

	<main class="oi-main" id="main" tabindex="-1">
		<slot />
	</main>

	<nav class="bottom-tabs" aria-label="Primary (mobile)">
		{#each navItems as item}
			{@const active = isActive(pathname, item.href)}
			<a class="tab" class:active href={item.href} aria-current={active ? 'page' : undefined}>
				{#if item.icon === 'dashboard'}
					<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
						<rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
						<rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
						<rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
					</svg>
				{:else if item.icon === 'calendar'}
					<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="3" y="5" width="18" height="16" rx="2" />
						<line x1="3" y1="10" x2="21" y2="10" />
						<line x1="8" y1="3" x2="8" y2="7" />
						<line x1="16" y1="3" x2="16" y2="7" />
					</svg>
				{:else if item.icon === 'activities'}
					<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
					</svg>
				{:else if item.icon === 'settings'}
					<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="3" />
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.27 16.96l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
					</svg>
				{/if}
				<span class="tab-label">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	:global(.oi-root) {
		--bg: #f4f2ec;
		--rail: #13332a;
		--rail2: #0f291f;
		--rail-active: #1d4537;
		--rail-ink: #f3f1e8;
		--rail-mut: #9bbaa8;
		--rail-faint: #7fa690;
		--rail-line: #224c3d;
		--card: #ffffff;
		--line: #e6e0d2;
		--ink: #22241d;
		--ink2: #13332a;
		--ink-soft: #46443a;
		--muted: #7d7b6f;
		--faint: #a39e8b;
		--track: #efebde;
		--grid: #eef0ea;
		--zero: #d6cfbb;
		--tip: #13332a;
		--c-fit: #1c5d3a;
		--c-fat: #c79a3a;
		--c-form: #5e708a;
		--green: #1c5d3a;
		--gold: #e7c24b;
		--swim: #3e86b5;
		--bike: #d2a03a;
		--run: #3c7a53;
		--btn: #ffffff;
		--btn-ink: #5a6b5e;
		--bg-soft: #faf8f3;
		--bg-emphasis: #f1f7f3;
		--overlay: rgba(19, 40, 32, 0.42);
		--danger: #a3402e;
		--danger-bg: #f7e9e5;
		--swim-soft: #eaf2f7;
		--bike-soft: #f8f0dd;
		--run-soft: #e8f1ec;
	}
	:global(.oi-root[data-theme='dark']) {
		--bg: #0d1a15;
		--rail: #0a1510;
		--rail2: #08120d;
		--rail-active: #173829;
		--rail-ink: #eef3ef;
		--rail-mut: #8aa89a;
		--rail-faint: #5f8270;
		--rail-line: #1d3a2d;
		--card: #15241c;
		--line: #27392f;
		--ink: #eef3ef;
		--ink2: #eef3ef;
		--ink-soft: #c4d2c8;
		--muted: #8fa597;
		--faint: #6f8a7c;
		--track: #233a30;
		--grid: #22362c;
		--zero: #33493d;
		--tip: #04110b;
		--c-fit: #4caf7e;
		--c-fat: #e3b34a;
		--c-form: #8ba2c0;
		--green: #3f9e6f;
		--gold: #e7c24b;
		--swim: #5aa0cf;
		--bike: #e0b14e;
		--run: #54a574;
		--btn: #1b2a22;
		--btn-ink: #aebfb4;
		--bg-soft: #11201a;
		--bg-emphasis: #173829;
		--overlay: rgba(0, 0, 0, 0.6);
		--danger: #ef8779;
		--danger-bg: #2a1814;
		--swim-soft: #1a3447;
		--bike-soft: #3a3017;
		--run-soft: #1d3025;
	}

	.oi {
		font-family: 'Archivo', system-ui, -apple-system, Segoe UI, sans-serif;
	}
	:global(.oi-mono) {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-feature-settings: 'tnum' 1;
	}

	.oi-root {
		display: flex;
		/* Exactly viewport-sized (not min-height) so .oi-main is the only
		   scroller — otherwise content taller than the viewport triggers a
		   body-level scroll that takes the rail with it. */
		height: 100vh;
		background: var(--bg);
		color: var(--ink);
	}

	.rail {
		flex: none;
		width: 188px;
		background: var(--rail);
		padding: 20px 13px;
		display: flex;
		flex-direction: column;
	}

	.brand-row {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 24px;
	}
	.logo {
		width: 30px;
		height: 30px;
		border-radius: 7px;
		background: var(--gold);
		color: #13332a;
		font-size: 13px;
		font-weight: 700;
		line-height: 30px;
		text-align: center;
		flex: none;
	}
	.brand-name {
		font-size: 16px;
		font-weight: 700;
		color: var(--rail-ink);
		line-height: 1;
	}
	.brand-tag {
		font-size: 8px;
		letter-spacing: 0.12em;
		color: var(--rail-faint);
		margin-top: 3px;
	}

	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nav-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 9px 11px;
		border-radius: 7px;
		font-size: 13px;
		font-weight: 500;
		color: var(--rail-mut);
		text-decoration: none;
	}
	.nav-item:hover {
		color: var(--rail-ink);
	}
	.nav-item.active {
		background: var(--rail-active);
		color: var(--rail-ink);
		font-weight: 600;
	}
	.nav-dot {
		font-size: 10px;
		color: var(--gold);
	}
	.nav-count {
		font-size: 10px;
		color: var(--rail-faint);
	}

	.season {
		margin-top: 18px;
		padding: 12px 11px;
		border-radius: 8px;
		background: var(--rail2);
	}
	.season-label {
		font-size: 8.5px;
		letter-spacing: 0.1em;
		color: var(--rail-faint);
		text-transform: uppercase;
	}
	.season-val {
		font-size: 20px;
		font-weight: 600;
		color: var(--rail-ink);
		margin-top: 5px;
	}
	.season-sub {
		font-size: 10px;
		color: var(--rail-faint);
		margin-top: 3px;
	}

	.logout-form {
		margin: 12px 0 0;
	}
	.logout {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 8px 11px;
		border-radius: 7px;
		border: 1px solid var(--rail-line);
		background: transparent;
		font: 600 11px 'Archivo', system-ui, sans-serif;
		color: var(--rail-mut);
		cursor: pointer;
	}
	.logout:hover {
		color: var(--rail-ink);
		border-color: var(--rail-faint);
	}
	.logout-icon {
		width: 12px;
		height: 12px;
		border-left: 1.5px solid var(--rail-faint);
		border-bottom: 1.5px solid var(--rail-faint);
		flex: none;
	}

	.user-foot {
		margin-top: auto;
		padding-top: 16px;
		border-top: 1px solid var(--rail-line);
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--rail-active);
		color: var(--gold);
		font-size: 11px;
		font-weight: 700;
		line-height: 30px;
		text-align: center;
		flex: none;
	}
	.user-meta {
		min-width: 0;
	}
	.user-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--rail-ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.user-role {
		font-size: 10px;
		color: var(--rail-faint);
		margin-top: 2px;
	}

	.oi-main {
		flex: 1;
		overflow: auto;
		/* Prevents scroll-chaining bounce from leaking out to the body. */
		overscroll-behavior: contain;
		min-width: 0;
		padding: 20px 24px 28px;
	}

	.bottom-tabs {
		display: none;
	}

	@media (max-width: 767px) {
		.rail {
			display: none;
		}
		.bottom-tabs {
			display: flex;
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			/* tab area + iPhone safe-area + a bit of breathing room. */
			height: calc(60px + env(safe-area-inset-bottom, 0px));
			background: var(--card);
			border-top: 1px solid var(--line);
			justify-content: space-around;
			align-items: stretch;
			padding: 6px 0 env(safe-area-inset-bottom, 0px);
			z-index: 10;
			/* iOS-blur for a more native feel; falls back to solid card bg. */
			backdrop-filter: saturate(160%) blur(14px);
			-webkit-backdrop-filter: saturate(160%) blur(14px);
		}
		.tab {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 3px;
			flex: 1;
			text-decoration: none;
			color: var(--faint);
			font-size: 10.5px;
			font-weight: 600;
			padding: 6px 6px;
			min-height: 44px;
			-webkit-tap-highlight-color: transparent;
			touch-action: manipulation;
			user-select: none;
			transition: color 100ms ease, transform 100ms ease;
		}
		.tab:active {
			transform: scale(0.94);
		}
		.tab.active {
			color: var(--green);
		}
		.tab-icon {
			width: 24px;
			height: 24px;
			flex: none;
		}
		.tab-label {
			line-height: 1;
		}
		.oi-main {
			padding: 16px 16px calc(82px + env(safe-area-inset-bottom, 0px));
			/* Allow momentum scroll on iOS. */
			-webkit-overflow-scrolling: touch;
			/* Safety net: nothing in the app should produce horizontal scroll
			   on a phone — clip if a rogue element does anyway. */
			overflow-x: hidden;
		}
	}

	/* ── Global mobile typography bump ─────────────────────────────────────
	   Most page chrome was sized for desktop and felt small on a phone.
	   Tag-with-:global() so these override per-page scoped styles. */
	@media (max-width: 767px) {
		:global(.title) {
			font-size: 26px !important;
		}
		:global(.subtitle) {
			font-size: 12.5px !important;
		}
		:global(.card-title) {
			font-size: 15px !important;
		}
		:global(.card-title-sm) {
			font-size: 14px !important;
		}
		:global(.card-eyebrow) {
			font-size: 11px !important;
		}
		:global(.sum-label),
		:global(.kpi-label),
		:global(.stat-label) {
			font-size: 9.5px !important;
		}
		:global(.sum-val),
		:global(.kpi-val) {
			font-size: 26px !important;
		}
		:global(.sum-sub),
		:global(.kpi-sub) {
			font-size: 10.5px !important;
		}
		:global(.btn),
		:global(.btn-primary) {
			padding: 10px 16px !important;
			font-size: 13px !important;
		}
		:global(.filter-chip) {
			font-size: 12px !important;
			padding: 7px 14px !important;
		}
		:global(.cell-title),
		:global(.recent-title) {
			font-size: 13.5px !important;
		}
		:global(.cell-num),
		:global(.cell-tss),
		:global(.cell-date),
		:global(.recent-cell) {
			font-size: 12px !important;
		}
		:global(.cell-hr) {
			font-size: 11.5px !important;
		}
	}
	:global(.oi-main::-webkit-scrollbar) {
		width: 10px;
	}
	:global(.oi-main::-webkit-scrollbar-thumb) {
		background: var(--line);
		border-radius: 6px;
	}
</style>
