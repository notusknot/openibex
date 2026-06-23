<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { paceFromSecPerKm, paceUnit, type Units } from '$lib/units';

	export let data: PageData;
	export let form: ActionData;

	$: user = data.user;
	$: prefs = data.userPrefs;
	$: displayName = user.displayName ?? '';
	$: initials = computeInitials(user.displayName ?? user.email);

	let saving = false;
	let saved = false;

	// Form-local state, hydrated from server-loaded prefs. Numbers display as
	// empty strings when null so the input shows the placeholder rather than "0".
	$: units = (prefs?.units ?? 'imperial') as Units;
	$: weekStart = (prefs?.weekStart ?? 'mon') as 'mon' | 'sun';
	$: ftpInput = prefs?.ftpWatts != null ? String(prefs.ftpWatts) : '';
	$: thrHrInput = prefs?.thresholdHrBpm != null ? String(prefs.thresholdHrBpm) : '';
	$: maxHrInput = prefs?.maxHrBpm != null ? String(prefs.maxHrBpm) : '';
	$: thrPaceInput = paceInputFromPrefs(prefs?.thresholdPaceSecPerKm ?? null, units);

	function paceInputFromPrefs(secPerKm: number | null, u: Units): string {
		if (secPerKm === null) return '';
		const sec = paceFromSecPerKm(secPerKm, u);
		const m = Math.floor(sec / 60);
		const s = Math.round(sec % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	const SUB_NAV = [
		{ href: '#profile', label: 'Profile' },
		{ href: '#thresholds', label: 'Training thresholds' },
		{ href: '#display', label: 'Units & display' },
		{ href: '#integrations', label: 'Integrations' },
		{ href: '#account', label: 'Account' }
	];

	type Integration = { key: string; name: string; mark: string; color: string };
	const INTEGRATIONS: Integration[] = [
		{ key: 'garmin', name: 'Garmin Connect', mark: 'G', color: '#0a7ac2' },
		{ key: 'strava', name: 'Strava', mark: 'S', color: '#e2602a' },
		{ key: 'wahoo', name: 'Wahoo SYSTM', mark: 'W', color: '#1c5d3a' }
	];

	function signOut() {
		const f = document.getElementById('logoutForm');
		if (f instanceof HTMLFormElement) f.requestSubmit();
	}

	function computeInitials(name: string): string {
		const trimmed = name.trim();
		const at = trimmed.indexOf('@');
		const base = at >= 0 ? trimmed.slice(0, at) : trimmed;
		const parts = base.split(/[\s._-]+/).filter(Boolean);
		if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
		return base.slice(0, 2).toUpperCase();
	}
</script>

<section class="settings">
	<header class="head">
		<h1 class="title">Settings</h1>
		<p class="subtitle oi-mono">Profile · thresholds · units · integrations</p>
	</header>

	<div class="layout">
		<aside class="subnav" aria-label="Settings sections">
			{#each SUB_NAV as item, i}
				<a href={item.href} class="subnav-item" class:active={i === 0}>{item.label}</a>
			{/each}
		</aside>

		<form
			method="POST"
			action="?/save"
			class="content"
			use:enhance={() => {
				saving = true;
				saved = false;
				return async ({ result, update }) => {
					saving = false;
					if (result.type === 'success') saved = true;
					await update({ reset: false });
				};
			}}
		>
			<section id="profile" class="card">
				<div class="card-title">Profile</div>
				<div class="card-eyebrow oi-mono">How you appear across OpenIbex</div>

				<div class="avatar-row">
					<div class="avatar oi-mono">{initials}</div>
					<button type="button" class="btn-soft" disabled title="Coming soon">Change photo</button>
				</div>

				<div class="field-grid two-col">
					<label class="field">
						<span class="field-label oi-mono">Full name</span>
						<input class="oi-input" type="text" name="displayName" bind:value={displayName} maxlength="120" />
					</label>
					<label class="field">
						<span class="field-label oi-mono">Email</span>
						<input class="oi-input" type="email" value={user.email} readonly />
					</label>
					<label class="field">
						<span class="field-label oi-mono">Team <span class="soon">soon</span></span>
						<input class="oi-input" type="text" placeholder="—" disabled />
					</label>
					<label class="field">
						<span class="field-label oi-mono">Primary discipline <span class="soon">soon</span></span>
						<input class="oi-input" type="text" placeholder="—" disabled />
					</label>
				</div>
			</section>

			<section id="thresholds" class="card">
				<div class="card-title">Training thresholds</div>
				<div class="card-eyebrow oi-mono">
					Used to compute TSS and IF. Bike TSS uses normalized power vs FTP;
					run TSS uses average HR vs threshold HR. Leave blank to fall back to
					app defaults (FTP 240 W, threshold HR 160 bpm).
				</div>

				<div class="field-grid four-col">
					<label class="field">
						<span class="field-label oi-mono">FTP (W)</span>
						<input
							class="oi-input oi-mono"
							type="text"
							inputmode="numeric"
							name="ftpWatts"
							placeholder="240"
							bind:value={ftpInput}
						/>
					</label>
					<label class="field">
						<span class="field-label oi-mono">Thr. HR (bpm)</span>
						<input
							class="oi-input oi-mono"
							type="text"
							inputmode="numeric"
							name="thresholdHrBpm"
							placeholder="160"
							bind:value={thrHrInput}
						/>
					</label>
					<label class="field">
						<span class="field-label oi-mono">Thr. pace {paceUnit(units)}</span>
						<input
							class="oi-input oi-mono"
							type="text"
							name="thresholdPace"
							placeholder={units === 'imperial' ? '6:30' : '4:00'}
							bind:value={thrPaceInput}
						/>
					</label>
					<label class="field">
						<span class="field-label oi-mono">Max HR (bpm)</span>
						<input
							class="oi-input oi-mono"
							type="text"
							inputmode="numeric"
							name="maxHrBpm"
							placeholder="190"
							bind:value={maxHrInput}
						/>
					</label>
				</div>
			</section>

			<section id="display" class="card">
				<div class="card-title">Units &amp; display</div>
				<div class="card-eyebrow oi-mono">
					Applied across distance, elevation, and pace displays throughout the app.
				</div>

				<div class="display-row">
					<div>
						<div class="row-title">Measurement units</div>
						<div class="row-help oi-mono">Distance, elevation, pace</div>
					</div>
					<div class="seg-toggle">
						<button
							type="button"
							class="seg-btn"
							class:active={units === 'metric'}
							on:click={() => (units = 'metric')}
							aria-pressed={units === 'metric'}
						>
							Metric
						</button>
						<button
							type="button"
							class="seg-btn"
							class:active={units === 'imperial'}
							on:click={() => (units = 'imperial')}
							aria-pressed={units === 'imperial'}
						>
							Imperial
						</button>
					</div>
				</div>

				<div class="display-divider"></div>

				<div class="display-row">
					<div>
						<div class="row-title">Week starts on</div>
						<div class="row-help oi-mono">Calendar &amp; weekly totals</div>
					</div>
					<div class="seg-toggle">
						<button
							type="button"
							class="seg-btn"
							class:active={weekStart === 'mon'}
							on:click={() => (weekStart = 'mon')}
							aria-pressed={weekStart === 'mon'}
						>
							Monday
						</button>
						<button
							type="button"
							class="seg-btn"
							class:active={weekStart === 'sun'}
							on:click={() => (weekStart = 'sun')}
							aria-pressed={weekStart === 'sun'}
						>
							Sunday
						</button>
					</div>
				</div>

				<input type="hidden" name="units" value={units} />
				<input type="hidden" name="weekStart" value={weekStart} />
			</section>

			<section id="integrations" class="card">
				<div class="card-title">
					Integrations <span class="soon-pill">Not planned</span>
				</div>
				<div class="card-eyebrow oi-mono">
					OpenIbex intentionally avoids third-party API integrations. Upload FIT files manually via the Activities page or use the Garmin export bulk-import CLI.
				</div>

				<div class="integration-list">
					{#each INTEGRATIONS as g}
						<div class="integration-row">
							<div class="integration-mark oi-mono" style="background: {g.color}">{g.mark}</div>
							<div class="integration-meta">
								<div class="row-title">{g.name}</div>
								<div class="row-help oi-mono">Not connected</div>
							</div>
							<button type="button" class="btn-soft" disabled>Connect</button>
						</div>
					{/each}
				</div>
			</section>

			<section id="account" class="card">
				<div class="card-title">Account</div>
				<div class="card-eyebrow oi-mono">Session, data export, sign out</div>

				<div class="account-row">
					<div>
						<div class="row-title">Export your data</div>
						<div class="row-help oi-mono">Download a ZIP archive of your activities and original FIT files.</div>
					</div>
					<a class="btn" href="/settings/export">Generate export</a>
				</div>
				<div class="display-divider"></div>
				<div class="account-row">
					<div>
						<div class="row-title">Signed in as</div>
						<div class="row-help oi-mono">{user.email}</div>
					</div>
				</div>
				<div class="account-row">
					<div>
						<div class="row-title">Sign out</div>
						<div class="row-help oi-mono">Ends this browser session.</div>
					</div>
					<button type="button" class="btn btn-danger" on:click={signOut}>
						Sign out
					</button>
				</div>
			</section>

			{#if form?.error}
				<div class="form-error">{form.error}</div>
			{/if}

			<footer class="form-foot">
				<span class="save-status oi-mono">
					{#if saving}Saving…{:else if saved}Saved.{/if}
				</span>
				<a class="btn" href="/dashboard">Cancel</a>
				<button type="submit" class="btn btn-primary" disabled={saving}>Save changes</button>
			</footer>
		</form>
	</div>
</section>

<form id="logoutForm" method="POST" action="/logout" class="logout-form" aria-hidden="true"></form>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 920px;
	}

	.head {
		display: flex;
		flex-direction: column;
	}
	.title {
		font-size: 22px;
		font-weight: 700;
		color: var(--ink2);
		line-height: 1;
		margin: 0;
	}
	.subtitle {
		font-size: 11px;
		color: var(--muted);
		margin: 5px 0 0;
	}

	.layout {
		display: grid;
		grid-template-columns: 170px minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}

	.subnav {
		display: flex;
		flex-direction: column;
		gap: 2px;
		position: sticky;
		top: 0;
	}
	.subnav-item {
		padding: 9px 12px;
		border-radius: 8px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--muted);
		text-decoration: none;
	}
	.subnav-item:hover {
		color: var(--ink);
	}
	.subnav-item.active {
		font-weight: 600;
		color: var(--green);
		background: var(--bg-emphasis);
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}

	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 18px 20px;
	}
	.card-title {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 14px;
		font-weight: 700;
		color: var(--ink2);
		margin-bottom: 4px;
	}
	.card-eyebrow {
		font-size: 10px;
		color: var(--faint);
		margin-bottom: 16px;
		line-height: 1.5;
	}

	.soon-pill {
		font: 600 9px 'Archivo', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-fat);
		background: var(--bike-soft);
		border-radius: 999px;
		padding: 2px 7px;
	}
	.soon {
		font-size: 9px;
		font-weight: 600;
		color: var(--c-fat);
		margin-left: 4px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.avatar-row {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
	}
	.avatar {
		width: 54px;
		height: 54px;
		border-radius: 50%;
		background: var(--rail);
		color: var(--gold);
		font-size: 18px;
		font-weight: 700;
		line-height: 54px;
		text-align: center;
		flex: none;
	}
	.btn-soft {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--green);
		background: var(--bg-emphasis);
		border: 1px solid var(--line);
		border-radius: 7px;
		padding: 8px 14px;
		cursor: pointer;
	}
	.btn-soft:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.field-grid {
		display: grid;
		gap: 13px;
	}
	.field-grid.two-col {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.field-grid.four-col {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 7px;
		min-width: 0;
	}
	.field-label {
		font-size: 9px;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.oi-input {
		font: 400 13px 'Archivo', system-ui, sans-serif;
		color: var(--ink);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 7px;
		padding: 9px 11px;
		width: 100%;
		outline: none;
	}
	.oi-input:focus {
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(28, 93, 58, 0.1);
	}
	.oi-input[readonly] {
		color: var(--muted);
		background: var(--bg-soft);
	}
	.oi-input:disabled {
		color: var(--faint);
		background: var(--bg-soft);
		cursor: not-allowed;
	}

	.display-row,
	.account-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}
	.account-row {
		padding: 6px 0;
	}
	.row-title {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--ink);
	}
	.row-help {
		font-size: 10px;
		color: var(--faint);
		margin-top: 3px;
	}
	.display-divider {
		height: 1px;
		background: var(--line);
		margin: 14px 0;
	}

	.seg-toggle {
		display: flex;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 2px;
	}
	.seg-btn {
		font: 600 11px 'Archivo', system-ui, sans-serif;
		padding: 7px 14px;
		border-radius: 6px;
		cursor: pointer;
		border: none;
		background: transparent;
		color: var(--btn-ink);
	}
	.seg-btn.active {
		background: var(--green);
		color: #fff;
	}

	.integration-list {
		display: flex;
		flex-direction: column;
	}
	.integration-row {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 12px 0;
		border-top: 1px solid var(--line);
	}
	.integration-row:first-child {
		border-top: none;
		padding-top: 0;
	}
	.integration-mark {
		width: 34px;
		height: 34px;
		border-radius: 8px;
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		line-height: 34px;
		text-align: center;
		flex: none;
	}
	.integration-meta {
		flex: 1;
		min-width: 0;
	}

	.btn {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--btn-ink);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 9px 15px;
		cursor: pointer;
		text-decoration: none;
		line-height: 1.2;
	}
	.btn-primary {
		color: #fff;
		background: var(--green);
		border-color: transparent;
		padding: 10px 18px;
	}
	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.btn-danger {
		color: #fff;
		background: var(--danger);
		border-color: transparent;
	}

	.form-error {
		font-size: 11px;
		color: var(--danger);
		background: var(--danger-bg);
		border-radius: 6px;
		padding: 9px 12px;
	}

	.form-foot {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 9px;
	}
	.save-status {
		font-size: 11px;
		color: var(--muted);
		margin-right: auto;
	}

	.logout-form {
		display: none;
	}

	/* ── Responsive ───────────────────────────────────────────────────── */

	@media (max-width: 767px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}
		.subnav {
			display: none;
		}
		.card {
			padding: 16px;
		}
		.field-grid.four-col {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.field-grid.two-col {
			grid-template-columns: minmax(0, 1fr);
		}
		.display-row,
		.account-row {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}
		.seg-toggle {
			align-self: flex-start;
		}
		.integration-row {
			flex-wrap: wrap;
		}
		.integration-meta {
			min-width: 0;
			flex: 1 1 50%;
		}
		.form-foot {
			flex-wrap: wrap;
		}
		.save-status {
			width: 100%;
			text-align: right;
		}
	}
</style>
