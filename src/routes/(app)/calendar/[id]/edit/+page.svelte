<script lang="ts">
	import BackLink from '$lib/components/ui/BackLink.svelte';

	type Sport = 'Bike' | 'Run' | 'Swim' | 'Strength' | 'Other';
	export let data: {
		sports: readonly Sport[];
		workout: {
			id: string;
			sport: Sport;
			scheduledDate: string;
			title: string;
			description: string | null;
			plannedDurationSec: number | null;
			plannedDistanceM: number | null;
			plannedLoad: number | null;
		};
		link: {
			matchType: string;
			durationCompliance: number | null;
			distanceCompliance: number | null;
			loadCompliance: number | null;
		} | null;
		matchedActivity: { id: string; title: string; startTime: Date } | null;
		candidates: Array<{ id: string; title: string; startTime: Date }>;
	};
	export let form: { error?: string; success?: boolean } | null;

	const w = data.workout;

	const SPORT_COLOR: Record<Sport, string> = {
		Bike: 'var(--bike)',
		Run: 'var(--run)',
		Swim: 'var(--swim)',
		Strength: 'var(--c-fat)',
		Other: 'var(--muted)'
	};

	const UNIT_FACTOR: Record<'km' | 'mi' | 'm', number> = { km: 1000, mi: 1609.344, m: 1 };

	function round2(n: number): number {
		return Math.round(n * 100) / 100;
	}

	// ── Core fields ────────────────────────────────────────────────────────
	let sport: Sport = w.sport;
	let scheduledDate = w.scheduledDate;
	let title = w.title;
	let description = w.description ?? '';

	// ── Duration: friendly h/m/s, recombined into plannedDurationSec (seconds).
	let durH: number | null = null;
	let durM: number | null = null;
	let durS: number | null = null;
	if (w.plannedDurationSec != null) {
		durH = Math.floor(w.plannedDurationSec / 3600);
		durM = Math.floor((w.plannedDurationSec % 3600) / 60);
		durS = w.plannedDurationSec % 60;
	}
	$: durationSet = durH !== null || durM !== null || durS !== null;
	$: plannedDurationSec = durationSet
		? String((durH ?? 0) * 3600 + (durM ?? 0) * 60 + (durS ?? 0))
		: '';

	// ── Distance: value + unit selector, recombined into plannedDistanceM (m).
	let distUnit: 'km' | 'mi' | 'm' = w.sport === 'Swim' ? 'm' : 'km';
	let distValue: number | null =
		w.plannedDistanceM != null ? round2(w.plannedDistanceM / UNIT_FACTOR[distUnit]) : null;
	$: plannedDistanceM =
		distValue === null || !Number.isFinite(distValue)
			? ''
			: String(Math.round(distValue * UNIT_FACTOR[distUnit]));

	function onUnitChange(e: Event) {
		const next = (e.currentTarget as HTMLSelectElement).value as 'km' | 'mi' | 'm';
		if (distValue !== null && Number.isFinite(distValue)) {
			const metres = distValue * UNIT_FACTOR[distUnit];
			distValue = round2(metres / UNIT_FACTOR[next]);
		}
		distUnit = next;
	}

	// ── Load (TSS-style), submitted directly.
	let plannedLoad: number | null = w.plannedLoad;

	// ── Live pace / speed preview from the two targets.
	$: previewSec = plannedDurationSec === '' ? 0 : Number(plannedDurationSec);
	$: previewM = plannedDistanceM === '' ? 0 : Number(plannedDistanceM);
	$: pacePreview = (() => {
		if (!previewSec || !previewM) return null;
		if (sport === 'Run') return `${fmtClock(previewSec / (previewM / 1000))} /km`;
		if (sport === 'Swim') return `${fmtClock(previewSec / (previewM / 100))} /100m`;
		if (sport === 'Bike') return `${(previewM / 1000 / (previewSec / 3600)).toFixed(1)} km/h`;
		return null;
	})();

	function fmtClock(sec: number): string {
		const s = Math.round(sec);
		const m = Math.floor(s / 60);
		const ss = s % 60;
		return `${m}:${ss.toString().padStart(2, '0')}`;
	}

	function pct(v: number | null) {
		return v === null ? '—' : `${Math.round(v * 100)}%`;
	}

	function fmtTime(d: Date) {
		return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}
</script>

<section class="edit">
	<header class="head">
		<BackLink fallback="/calendar" fallbackLabel="calendar" />
		<div>
			<h1 class="title">Edit planned workout</h1>
			<p class="subtitle oi-mono">{data.workout.scheduledDate} · {data.workout.sport}</p>
		</div>
	</header>

	{#if form?.error}
		<div class="banner banner-error">{form.error}</div>
	{/if}
	{#if form?.success}
		<div class="banner banner-success">Saved.</div>
	{/if}

	<form method="POST" action="?/update" class="card">
		<!-- Hidden fields the backend parses; populated from the friendly controls. -->
		<input type="hidden" name="sport" value={sport} />
		<input type="hidden" name="plannedDurationSec" value={plannedDurationSec} />
		<input type="hidden" name="plannedDistanceM" value={plannedDistanceM} />

		<div class="field">
			<span class="label oi-mono">Sport</span>
			<div class="chips" role="radiogroup" aria-label="Sport">
				{#each data.sports as s}
					<button
						type="button"
						class="chip"
						class:active={sport === s}
						role="radio"
						aria-checked={sport === s}
						style="--chip: {SPORT_COLOR[s]}"
						on:click={() => (sport = s)}
					>
						<span class="chip-dot" aria-hidden="true"></span>
						{s}
					</button>
				{/each}
			</div>
		</div>

		<div class="grid2">
			<label class="field">
				<span class="label oi-mono">Date</span>
				<input type="date" bind:value={scheduledDate} name="scheduledDate" required />
			</label>
			<label class="field">
				<span class="label oi-mono">Planned load <span class="hint">TSS</span></span>
				<input
					type="number"
					name="plannedLoad"
					bind:value={plannedLoad}
					min="0"
					step="1"
					placeholder="e.g. 65"
				/>
			</label>
		</div>

		<label class="field">
			<span class="label oi-mono">Title <span class="counter">{title.length}/120</span></span>
			<input type="text" name="title" bind:value={title} maxlength="120" required placeholder="Workout name" />
		</label>

		<label class="field">
			<span class="label oi-mono">Description</span>
			<textarea
				bind:value={description}
				name="description"
				rows="4"
				placeholder="Structure, intervals, intent, fueling…"
			></textarea>
		</label>

		<div class="field">
			<span class="label oi-mono">Targets</span>
			<div class="targets">
				<div class="target-block">
					<span class="target-cap oi-mono">Duration</span>
					<div class="dur">
						<div class="dur-cell">
							<input type="number" bind:value={durH} min="0" step="1" placeholder="0" aria-label="Hours" />
							<span class="dur-unit oi-mono">h</span>
						</div>
						<div class="dur-cell">
							<input type="number" bind:value={durM} min="0" max="59" step="1" placeholder="00" aria-label="Minutes" />
							<span class="dur-unit oi-mono">m</span>
						</div>
						<div class="dur-cell">
							<input type="number" bind:value={durS} min="0" max="59" step="1" placeholder="00" aria-label="Seconds" />
							<span class="dur-unit oi-mono">s</span>
						</div>
					</div>
				</div>

				<div class="target-block">
					<span class="target-cap oi-mono">Distance</span>
					<div class="dist">
						<input type="number" bind:value={distValue} min="0" step="0.01" placeholder="0" aria-label="Distance" />
						<select value={distUnit} on:change={onUnitChange} aria-label="Distance unit">
							<option value="km">km</option>
							<option value="mi">mi</option>
							<option value="m">m</option>
						</select>
					</div>
				</div>
			</div>
			{#if pacePreview}
				<p class="preview oi-mono">≈ {pacePreview} at target</p>
			{/if}
		</div>

		<footer class="form-foot">
			<a class="btn" href="/calendar">Cancel</a>
			<button type="submit" class="btn btn-primary">Save changes</button>
		</footer>
	</form>

	<div class="card">
		<div class="card-title">Matched activity</div>
		{#if data.link && data.matchedActivity}
			<div class="match">
				<div class="match-row">
					<span class="match-pill oi-mono">{data.link.matchType}</span>
					<a class="match-link" href={`/activities/${data.matchedActivity.id}`}>
						{data.matchedActivity.title}
					</a>
					<span class="match-when oi-mono">
						{new Date(data.matchedActivity.startTime).toLocaleDateString()} {fmtTime(data.matchedActivity.startTime)}
					</span>
				</div>
				<div class="compliance">
					<div class="comp">
						<span class="comp-cap oi-mono">Duration</span>
						<span class="comp-val oi-mono">{pct(data.link.durationCompliance)}</span>
					</div>
					<div class="comp">
						<span class="comp-cap oi-mono">Distance</span>
						<span class="comp-val oi-mono">{pct(data.link.distanceCompliance)}</span>
					</div>
					<div class="comp">
						<span class="comp-cap oi-mono">Load</span>
						<span class="comp-val oi-mono">{pct(data.link.loadCompliance)}</span>
					</div>
				</div>
				<form method="POST" action="?/unlink">
					<button type="submit" class="btn btn-danger-ghost">Unlink</button>
				</form>
			</div>
		{:else}
			<p class="muted">
				No completed activity linked yet. Pick one recorded on this date and sport to link it manually.
			</p>
			<form method="POST" action="?/link" class="link-form">
				<select name="activityId" required aria-label="Activity to link">
					<option value="" selected disabled>Select an activity…</option>
					{#each data.candidates as a}
						<option value={a.id}>{a.title} — {fmtTime(a.startTime)}</option>
					{/each}
				</select>
				<button type="submit" class="btn" disabled={data.candidates.length === 0}>Link</button>
			</form>
			{#if data.candidates.length === 0}
				<p class="muted small">
					Nothing recorded for this date and sport. Upload an activity or adjust the planned
					date/sport.
				</p>
			{/if}
		{/if}
	</div>

	<div class="card danger-card">
		<div>
			<div class="card-title">Delete workout</div>
			<p class="muted small">This permanently removes the planned workout from your calendar.</p>
		</div>
		<form
			method="POST"
			action="?/delete"
			on:submit={(e) => {
				if (!confirm(`Delete "${title}"? This can't be undone.`)) e.preventDefault();
			}}
		>
			<button type="submit" class="btn btn-danger">Delete</button>
		</form>
	</div>
</section>

<style>
	.edit {
		display: flex;
		flex-direction: column;
		gap: 13px;
		max-width: 640px;
	}

	.head {
		display: flex;
		align-items: flex-start;
		gap: 13px;
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
		margin: 6px 0 0;
	}

	.banner {
		font-size: 12px;
		border-radius: 8px;
		padding: 10px 12px;
	}
	.banner-error {
		color: var(--danger);
		background: var(--danger-bg);
	}
	.banner-success {
		color: var(--green);
		background: var(--run-soft);
	}

	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.label {
		font-size: 9px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--faint);
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.hint,
	.counter {
		text-transform: none;
		letter-spacing: 0;
		color: var(--faint);
		font-weight: 400;
	}
	.counter {
		margin-left: auto;
	}

	input,
	select,
	textarea {
		font: 500 13px 'Archivo', system-ui, sans-serif;
		color: var(--ink);
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 9px 11px;
		width: 100%;
		box-sizing: border-box;
	}
	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--green);
		box-shadow: 0 0 0 3px var(--bg-emphasis);
	}
	textarea {
		resize: vertical;
		line-height: 1.5;
	}
	/* Strip number spinners — the layout already labels the units. */
	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--btn-ink);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 7px 13px;
		cursor: pointer;
		line-height: 1;
	}
	.chip-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--chip);
		flex: none;
	}
	.chip.active {
		border-color: var(--chip);
		color: var(--ink);
		background: var(--bg-emphasis);
		box-shadow: inset 0 0 0 1px var(--chip);
	}

	.targets {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.target-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.target-cap {
		font-size: 10px;
		color: var(--muted);
	}
	.dur {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.dur-cell {
		position: relative;
	}
	.dur-cell input {
		padding-right: 22px;
		text-align: right;
	}
	.dur-unit {
		position: absolute;
		right: 9px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 10px;
		color: var(--faint);
		pointer-events: none;
	}
	.dist {
		display: grid;
		grid-template-columns: 1fr 72px;
		gap: 6px;
	}
	.dist select {
		padding: 9px 8px;
	}
	.preview {
		font-size: 11px;
		color: var(--green);
		margin: 2px 0 0;
	}

	.form-foot {
		display: flex;
		justify-content: flex-end;
		gap: 9px;
	}
	.btn {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--btn-ink);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 10px 16px;
		cursor: pointer;
		text-decoration: none;
		line-height: 1.2;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-primary {
		color: #fff;
		background: var(--green);
		border-color: transparent;
	}
	.btn-danger {
		color: #fff;
		background: var(--danger);
		border-color: transparent;
	}
	.btn-danger-ghost {
		color: var(--danger);
		background: transparent;
		border-color: var(--danger);
		width: fit-content;
	}

	.muted {
		font-size: 12px;
		color: var(--muted);
		margin: 0;
		line-height: 1.5;
	}
	.muted.small {
		font-size: 11px;
		color: var(--faint);
	}

	.match {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.match-row {
		display: flex;
		align-items: center;
		gap: 9px;
		flex-wrap: wrap;
	}
	.match-pill {
		font-size: 9px;
		color: var(--green);
		background: var(--run-soft);
		border-radius: 4px;
		padding: 3px 7px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.match-link {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink2);
		text-decoration: none;
	}
	.match-link:hover {
		text-decoration: underline;
	}
	.match-when {
		font-size: 10px;
		color: var(--faint);
	}
	.compliance {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.comp {
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 9px 11px;
	}
	.comp-cap {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--faint);
		display: block;
	}
	.comp-val {
		font-size: 16px;
		font-weight: 600;
		color: var(--ink2);
		margin-top: 4px;
		display: block;
		line-height: 1;
	}
	.link-form {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 9px;
		align-items: center;
	}

	.danger-card {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
	}

	@media (max-width: 639px) {
		.card {
			padding: 15px 16px;
		}
		.grid2,
		.targets {
			grid-template-columns: 1fr;
		}
		.compliance {
			grid-template-columns: repeat(3, 1fr);
		}
		.danger-card {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
