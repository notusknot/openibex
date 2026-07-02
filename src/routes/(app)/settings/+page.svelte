<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { paceFromSecPerKm, paceUnit, type Units } from '$lib/units';

	export let data: PageData;
	export let form: ActionData;

	$: user = data.user;
	$: garmin = data.garmin;
	$: initials = computeInitials(user.displayName ?? user.email);

	let saving = false;
	let saved = false;

	// IMPORTANT: form inputs are bound to plain `let` values, not `$:` derived
	// ones. With `$:` the reactive statement re-runs on every render and clobbers
	// what the user is typing — bind:value writes to the variable, then the `$:`
	// snapshot of server data overwrites it. Initialized once at script-eval
	// time; the component re-instantiates on full navigation, and use:enhance
	// post-save sees the already-correct values (the user just typed them).
	let displayName = data.user.displayName ?? '';
	let units: Units = (data.userPrefs?.units ?? 'imperial') as Units;
	let weekStart: 'mon' | 'sun' = (data.userPrefs?.weekStart ?? 'mon') as 'mon' | 'sun';
	let ftpInput = data.userPrefs?.ftpWatts != null ? String(data.userPrefs.ftpWatts) : '';
	let thrHrInput = data.userPrefs?.thresholdHrBpm != null ? String(data.userPrefs.thresholdHrBpm) : '';
	let maxHrInput = data.userPrefs?.maxHrBpm != null ? String(data.userPrefs.maxHrBpm) : '';
	let thrPaceInput = paceInputFromPrefs(
		data.userPrefs?.thresholdPaceSecPerKm ?? null,
		units
	);

	// Garmin integration UI state.
	let showConnect = false;
	let connecting = false;
	let syncing = false;
	let disconnecting = false;

	// Garmin action results live on the shared `form` prop; read loosely to avoid
	// union friction across the page's several actions.
	$: gform = (form ?? {}) as Record<string, any>;
	$: garminError = gform.garminError as string | undefined;
	$: garminNotice = noticeFrom(gform);

	// Garmin bulk-import (settings → Import Garmin export). Success is a redirect
	// to the batch log, so only the error path surfaces here.
	let importing = false;
	let importFailed = false;
	$: importError = gform.importError as string | undefined;

	// HR-zone field-test wizard.
	$: testActivities = data.hrTestActivities ?? [];
	$: lthrTest = data.lthrTest;
	$: lthrUncalibrated = data.userPrefs?.thresholdHrBpm == null;
	$: lthrError = gform.lthrError as string | undefined;
	$: lthrSaved = gform.lthrSaved as number | undefined;
	let savingLthr = false;

	function testOptionLabel(a: { title: string; startTimeMs: number }): string {
		const d = new Date(a.startTimeMs).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		return `${a.title} · ${d}`;
	}
	function onPickTest(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		const q = id ? `?test=${encodeURIComponent(id)}` : '';
		goto(`/settings${q}`, { keepFocus: true, noScroll: true });
	}

	// Calendar (ICS) subscriptions.
	$: calendar = data.calendar;
	$: calendarError = gform.calendarError as string | undefined;
	$: calendarNotice = gform.calendarNotice as string | undefined;
	let showAddCalendar = false;
	let calendarBusy = false;

	function noticeFrom(f: Record<string, any>): string | null {
		if (f.garminSync) {
			const s = f.garminSync;
			const bits = [`${s.imported} imported`];
			if (s.duplicate) bits.push(`${s.duplicate} already had`);
			if (s.unsupported) bits.push(`${s.unsupported} skipped`);
			if (s.failed) bits.push(`${s.failed} failed`);
			return bits.join(' · ');
		}
		if (f.garminConnected) return 'Connected to Garmin Connect.';
		if (f.garminDisconnected) return 'Disconnected.';
		return null;
	}

	function paceInputFromPrefs(secPerKm: number | null, u: Units): string {
		if (secPerKm === null) return '';
		const sec = paceFromSecPerKm(secPerKm, u);
		const m = Math.floor(sec / 60);
		const s = Math.round(sec % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatRelative(ms: number): string {
		const diff = Date.now() - ms;
		if (diff < 60_000) return 'just now';
		const min = Math.floor(diff / 60_000);
		if (min < 60) return `${min} min ago`;
		const h = Math.floor(min / 60);
		if (h < 24) return `${h} h ago`;
		const d = Math.floor(h / 24);
		if (d < 14) return `${d} d ago`;
		return new Date(ms).toLocaleDateString();
	}

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
		<div class="content">
			<form
				method="POST"
				action="?/save"
				class="save-form"
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

			<section id="hrzones" class="card">
				<div class="card-title">Heart-rate zones</div>
				<div class="card-eyebrow oi-mono">
					Your Z1–Z5 zones are anchored on your lactate-threshold HR (LTHR), the Friel
					standard — 100% LTHR is the Z4/Z5 line. Set it accurately with a 30-minute field
					test, then pick that activity below to auto-detect it.
				</div>

				{#if lthrUncalibrated}
					<div class="form-notice">
						Your zones currently use the default LTHR of 160 bpm — take the test below to
						calibrate them to you.
					</div>
				{/if}

				<ol class="protocol oi-mono">
					<li>Warm up 15 min easy.</li>
					<li>30 min all-out at a steady, sustainable max — solo, flattish, no stopping.</li>
					<li>Cool down 10 min easy.</li>
				</ol>

				<label class="field">
					<span class="field-label oi-mono">Interpret a test activity</span>
					<select class="oi-input" on:change={onPickTest}>
						<option value="">Select the activity you did the test in…</option>
						{#each testActivities as a (a.id)}
							<option value={a.id} selected={a.id === data.testActivityId}>
								{testOptionLabel(a)}
							</option>
						{/each}
					</select>
				</label>

				{#if lthrTest}
					{#if lthrTest.lthr === null}
						<div class="form-error">
							Couldn't detect an LTHR — “{lthrTest.activityTitle}” has
							{lthrTest.hasHr ? 'under 20 minutes of' : 'no'} heart-rate data. Pick your 30-min
							test activity.
						</div>
					{:else}
						<div class="lthr-result">
							<div class="lthr-headline">
								Detected LTHR <strong>{lthrTest.lthr} bpm</strong>
								<span class="row-help oi-mono">
									from the hardest 20 min ({lthrTest.segmentLabel}) of “{lthrTest.activityTitle}”
								</span>
							</div>

							{#if !lthrTest.looksMaximal}
								<div class="form-error">
									This doesn't look like a maximal 30-min test — the detected LTHR may be low.
									Save only if you're confident it was an all-out effort.
								</div>
							{/if}

							<div class="zone-table">
								{#each lthrTest.zones as z}
									<div class="zone-row">
										<span class="zone-swatch" style="background: {z.color}"></span>
										<span class="zone-name">{z.name}</span>
										<span class="zone-range oi-mono">{z.range}</span>
									</div>
								{/each}
							</div>

							<form
								method="POST"
								action="?/saveLthr"
								use:enhance={() => {
									savingLthr = true;
									return async ({ result, update }) => {
										savingLthr = false;
										// Keep the manual Thr. HR field in sync so a later "Save changes"
										// on the profile form doesn't wipe the LTHR we just stored.
										if (result.type === 'success' && lthrTest?.lthr != null) {
											thrHrInput = String(lthrTest.lthr);
										}
										await update({ reset: false });
									};
								}}
							>
								<input type="hidden" name="lthr" value={lthrTest.lthr} />
								<div class="lthr-foot">
									{#if lthrSaved}
										<span class="save-status oi-mono">Saved LTHR {lthrSaved} bpm.</span>
									{/if}
									<button class="btn btn-primary" disabled={savingLthr}>
										{savingLthr ? 'Saving…' : 'Save these zones'}
									</button>
								</div>
							</form>
						</div>
					{/if}
				{/if}

				{#if lthrError}
					<div class="form-error">{lthrError}</div>
				{/if}
			</section>

			<section id="integrations" class="card">
				<div class="card-title">
					Integrations <span class="soon-pill">Experimental</span>
				</div>
				<div class="card-eyebrow oi-mono">
					Automatic Garmin Connect sync pulls new activities each time you open OpenIbex.
					Only encrypted session tokens are stored — never your password. Uses an
					unofficial Garmin API; see the README for caveats.
				</div>

				<div class="integration-list">
					<div class="integration-row">
						<div class="integration-mark oi-mono" style="background: #0a7ac2">G</div>
						<div class="integration-meta">
							<div class="row-title">Garmin Connect</div>
							{#if garmin.connected}
								<div
									class="row-help oi-mono"
									class:warn={garmin.lastSyncStatus === 'auth_failed' || garmin.lastSyncStatus === 'error'}
								>
									{#if garmin.lastSyncStatus === 'auth_failed'}
										Reconnect needed — session expired
									{:else if garmin.lastSyncStatus === 'error'}
										Last sync failed{garmin.lastSyncError ? ` — ${garmin.lastSyncError}` : ' — try again'}
									{:else if garmin.lastSyncAt}
										Last synced {formatRelative(garmin.lastSyncAt)}
									{:else}
										Connected · not synced yet
									{/if}
								</div>
							{:else}
								<div class="row-help oi-mono">Not connected</div>
							{/if}
						</div>

						{#if garmin.connected}
							<div class="integration-actions">
								<form
									method="POST"
									action="?/syncNow"
									use:enhance={() => {
										syncing = true;
										return async ({ update }) => {
											syncing = false;
											await update({ reset: false });
										};
									}}
								>
									<button class="btn-soft" disabled={syncing}>{syncing ? 'Syncing…' : 'Sync now'}</button>
								</form>
								<form
									method="POST"
									action="?/disconnectGarmin"
									use:enhance={() => {
										disconnecting = true;
										return async ({ update }) => {
											disconnecting = false;
											await update({ reset: false });
										};
									}}
								>
									<button class="btn-soft danger" disabled={disconnecting}>Disconnect</button>
								</form>
							</div>
						{:else}
							<button type="button" class="btn-soft" on:click={() => (showConnect = !showConnect)}>
								Connect
							</button>
						{/if}
					</div>

					{#if !garmin.connected && showConnect}
						<form
							class="garmin-connect"
							method="POST"
							action="?/connectGarmin"
							use:enhance={() => {
								connecting = true;
								return async ({ result, update }) => {
									connecting = false;
									if (result.type === 'success') showConnect = false;
									await update({ reset: false });
								};
							}}
						>
							<div class="field-grid two-col">
								<label class="field">
									<span class="field-label oi-mono">Garmin email</span>
									<input class="oi-input" type="email" name="garminEmail" autocomplete="username" />
								</label>
								<label class="field">
									<span class="field-label oi-mono">Password</span>
									<input class="oi-input" type="password" name="garminPassword" autocomplete="current-password" />
								</label>
							</div>
							<div class="garmin-foot">
								<span class="row-help oi-mono">Two-factor (2FA) accounts aren't supported yet.</span>
								<button class="btn btn-primary" disabled={connecting}>
									{connecting ? 'Connecting…' : 'Connect'}
								</button>
							</div>
						</form>
					{/if}

					{#if garminError}
						<div class="form-error">{garminError}</div>
					{:else if garminNotice}
						<div class="form-notice">{garminNotice}</div>
					{/if}

					<div class="integration-row">
						<div class="integration-mark oi-mono" style="background: #e2602a">S</div>
						<div class="integration-meta">
							<div class="row-title">Strava</div>
							<div class="row-help oi-mono">
								Requires a paid Strava subscription under their June 2026 API rules — not planned.
							</div>
						</div>
						<button type="button" class="btn-soft" disabled>Connect</button>
					</div>
				</div>
			</section>

			<section id="import" class="card">
				<div class="card-title">Import Garmin export</div>
				<div class="card-eyebrow oi-mono">
					Bulk-import your full history from Garmin's <strong>Account → Export Your Data</strong> archive.
					Upload the <code>.zip</code> — FIT activities are parsed and de-duplicated against what you
					already have, so re-uploading is always safe. This runs the same job as the
					<code>pnpm import:garmin</code> CLI; progress and a per-file log appear on the
					<a href="/imports">imports</a> page.
				</div>

				<form
					class="import-form"
					method="POST"
					action="?/importGarminExport"
					enctype="multipart/form-data"
					use:enhance={() => {
						importing = true;
						importFailed = false;
						return async ({ result, update }) => {
							importing = false;
							// The success path is a 303 redirect to the batch log; anything
							// that isn't a redirect here is an error (e.g. body too large).
							if (result.type === 'error') importFailed = true;
							await update({ reset: false });
						};
					}}
				>
					<label class="field">
						<span class="field-label oi-mono">Garmin export archive (.zip)</span>
						<input class="oi-input" type="file" name="file" accept=".zip,application/zip" required />
					</label>
					<div class="import-foot">
						<span class="row-help oi-mono">
							Large exports may require raising the server's <code>BODY_SIZE_LIMIT</code> — see the docs.
						</span>
						<button class="btn btn-primary" disabled={importing}>
							{importing ? 'Uploading…' : 'Import export'}
						</button>
					</div>
				</form>

				{#if importError}
					<div class="form-error">{importError}</div>
				{:else if importFailed}
					<div class="form-error">
						Upload failed — the file may exceed the server's <code>BODY_SIZE_LIMIT</code>. Raise it
						(and any reverse-proxy body cap) and try again.
					</div>
				{/if}
			</section>

			<section id="calendar" class="card">
				<div class="card-title">
					Calendar subscriptions <span class="soon-pill">Experimental</span>
				</div>
				<div class="card-eyebrow oi-mono">
					Subscribe to a public ICS feed (e.g. a coach's team calendar). Events become planned
					workouts, analyzed like any you create. Changes flow in within ~15 min of an update
					(poll interval + the provider's export lag) — not real-time. Your own edits are never
					silently overwritten.
				</div>

				{#if calendar.conflicts > 0}
					<div class="form-error">
						{calendar.conflicts} customized workout{calendar.conflicts === 1 ? '' : 's'} changed
						upstream — open {calendar.conflicts === 1 ? 'it' : 'them'} from the
						<a href="/calendar">calendar</a> to review.
					</div>
				{/if}

				<div class="integration-list">
					{#each calendar.subscriptions as sub (sub.id)}
						<div class="integration-row">
							<div class="integration-mark oi-mono" style="background: #6b4ea8">C</div>
							<div class="integration-meta">
								<div class="row-title">{sub.label}</div>
								<div
									class="row-help oi-mono"
									class:warn={sub.state === 'failing' || sub.state === 'rate_limited'}
								>
									{sub.host}
									{#if sub.state === 'syncing'}· syncing…
									{:else if sub.state === 'rate_limited'}· rate-limited — cooling down
									{:else if sub.state === 'failing'}· last sync failed{sub.lastError ? ` — ${sub.lastError}` : ''}
									{:else if sub.state === 'disabled'}· paused
									{:else if sub.lastPolledAt}· {sub.lastEventCount ?? 0} events · synced {formatRelative(sub.lastPolledAt)}
									{:else}· not synced yet{/if}
								</div>
							</div>
							<div class="integration-actions">
								<form
									method="POST"
									action="?/syncCalendar"
									use:enhance={() => {
										calendarBusy = true;
										return async ({ update }) => {
											calendarBusy = false;
											await update({ reset: false });
										};
									}}
								>
									<input type="hidden" name="id" value={sub.id} />
									<button class="btn-soft" disabled={calendarBusy || !sub.enabled}>Sync now</button>
								</form>
								<form
									method="POST"
									action="?/toggleCalendar"
									use:enhance={() => {
										calendarBusy = true;
										return async ({ update }) => {
											calendarBusy = false;
											await update({ reset: false });
										};
									}}
								>
									<input type="hidden" name="id" value={sub.id} />
									<input type="hidden" name="enabled" value={sub.enabled ? 'false' : 'true'} />
									<button class="btn-soft" disabled={calendarBusy}>{sub.enabled ? 'Pause' : 'Resume'}</button>
								</form>
								<form
									method="POST"
									action="?/removeCalendar"
									use:enhance={() => {
										calendarBusy = true;
										return async ({ update }) => {
											calendarBusy = false;
											await update({ reset: false });
										};
									}}
									on:submit={(e) => {
										if (!confirm(`Remove "${sub.label}"? Synced workouts already on your calendar are kept.`))
											e.preventDefault();
									}}
								>
									<input type="hidden" name="id" value={sub.id} />
									<button class="btn-soft danger" disabled={calendarBusy}>Remove</button>
								</form>
							</div>
						</div>
					{/each}

					{#if calendar.subscriptions.length === 0}
						<p class="row-help oi-mono" style="padding: 2px 0 6px">No calendars subscribed yet.</p>
					{/if}

					{#if showAddCalendar}
						<form
							class="garmin-connect"
							method="POST"
							action="?/addCalendar"
							use:enhance={() => {
								calendarBusy = true;
								return async ({ result, update }) => {
									calendarBusy = false;
									if (result.type === 'success') showAddCalendar = false;
									await update({ reset: false });
								};
							}}
						>
							<div class="field-grid two-col">
								<label class="field">
									<span class="field-label oi-mono">Feed URL (https / webcal)</span>
									<input
										class="oi-input"
										type="text"
										name="url"
										placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
									/>
								</label>
								<label class="field">
									<span class="field-label oi-mono">Label (optional)</span>
									<input class="oi-input" type="text" name="label" placeholder="Team calendar" maxlength="120" />
								</label>
							</div>
							<div class="garmin-foot">
								<span class="row-help oi-mono">Read-only public feeds only — the URL is stored as a secret.</span>
								<button class="btn btn-primary" disabled={calendarBusy}>
									{calendarBusy ? 'Adding…' : 'Add calendar'}
								</button>
							</div>
						</form>
					{:else}
						<div style="padding-top: 8px">
							<button type="button" class="btn-soft" on:click={() => (showAddCalendar = true)}>
								Add calendar
							</button>
						</div>
					{/if}

					{#if calendarError}
						<div class="form-error">{calendarError}</div>
					{:else if calendarNotice}
						<div class="form-notice">{calendarNotice}</div>
					{/if}
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
		</div>
	</div>
</section>

<form id="logoutForm" method="POST" action="/logout" class="logout-form" aria-hidden="true"></form>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 900px;
		margin-inline: auto;
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
		grid-template-columns: minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}

	.content,
	.save-form {
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
	.btn-soft.danger {
		color: var(--danger);
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
	.row-help.warn {
		color: var(--danger);
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
	.integration-actions {
		display: flex;
		gap: 8px;
	}
	.integration-actions form,
	.integration-row form {
		margin: 0;
	}

	.garmin-connect {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px 0 4px;
		border-top: 1px solid var(--line);
		margin: 0;
	}
	.garmin-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.import-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.import-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.import-form input[type='file'] {
		font: 400 12px 'Archivo', system-ui, sans-serif;
		padding: 8px 11px;
		cursor: pointer;
	}

	.protocol {
		margin: 0 0 14px;
		padding-left: 18px;
		font-size: 11px;
		color: var(--ink-soft);
		line-height: 1.7;
	}
	select.oi-input {
		cursor: pointer;
	}
	.lthr-result {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px solid var(--line);
	}
	.lthr-headline {
		font-size: 14px;
		font-weight: 600;
		color: var(--ink2);
	}
	.lthr-headline strong {
		color: var(--green);
	}
	.lthr-headline .row-help {
		display: block;
		font-weight: 400;
		margin-top: 4px;
	}
	.zone-table {
		display: flex;
		flex-direction: column;
	}
	.zone-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 0;
		border-top: 1px solid var(--line);
	}
	.zone-row:first-child {
		border-top: none;
	}
	.zone-swatch {
		width: 11px;
		height: 11px;
		border-radius: 3px;
		flex: none;
	}
	.zone-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
		flex: 1;
	}
	.zone-range {
		font-size: 11px;
		color: var(--muted);
	}
	.lthr-foot {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 10px;
	}
	.card-eyebrow code,
	.row-help code,
	.form-error code {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.92em;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 4px;
		padding: 0 4px;
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
	.form-notice {
		font-size: 11px;
		color: var(--green);
		background: var(--bg-emphasis);
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
			gap: 0;
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
		.import-foot {
			flex-direction: column;
			align-items: stretch;
		}
		.save-status {
			width: 100%;
			text-align: right;
		}
	}
</style>
