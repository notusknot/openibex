<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import BackLink from '$lib/components/ui/BackLink.svelte';
	import CompareChart from '$lib/components/activity/CompareChart.svelte';
	import {
		buildSeries,
		commonMetrics,
		hasDistanceAxis,
		sharedDomain,
		type CompareAxis,
		type CompareMetric
	} from '$lib/compare';
	import { SPORT_TAG, type Sport } from '$lib/sport';
	import type { Units } from '$lib/units';
	import type { ActivityListRow } from '$lib/server/services/activitiesListService';

	export let data: PageData;

	$: comparison = data.comparison;
	$: idA = data.idA;
	$: idB = data.idB;
	$: units = data.units as Units;

	$: detailA = comparison?.a ?? null;
	$: detailB = comparison?.b ?? null;

	// Activities, newest first, for the two pickers.
	$: options = [...data.list.rows].sort((a, b) => b.startTimeMs - a.startTimeMs);
	function optionLabel(r: ActivityListRow): string {
		const d = new Date(r.startTimeMs).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		return `${r.title} · ${d} · ${SPORT_TAG[r.sportLabel]}`;
	}

	function sportOf(rows: ActivityListRow[], id: string | null): Sport | null {
		return id ? (rows.find((r) => r.id === id)?.sportLabel ?? null) : null;
	}

	// Picker options as optgroups: the 3 most recent activities matching the OTHER
	// pick's sport float to a "Suggested" group, then everything else. Excludes the
	// other pick so you can't compare an activity with itself.
	type PickerGroup = { label: string | null; rows: ActivityListRow[] };
	function pickerGroups(
		rows: ActivityListRow[],
		excludeId: string | null,
		refSport: Sport | null
	): PickerGroup[] {
		const avail = rows.filter((r) => r.id !== excludeId);
		const suggested = refSport ? avail.filter((r) => r.sportLabel === refSport).slice(0, 3) : [];
		if (suggested.length === 0) return [{ label: null, rows: avail }];
		const ids = new Set(suggested.map((r) => r.id));
		return [
			{ label: 'Suggested', rows: suggested },
			{ label: 'All activities', rows: avail.filter((r) => !ids.has(r.id)) }
		];
	}
	$: groupsA = pickerGroups(options, idB, sportOf(options, idB));
	$: groupsB = pickerGroups(options, idA, sportOf(options, idA));

	function navTo(a: string | null, b: string | null) {
		const params = new URLSearchParams();
		if (a) params.set('a', a);
		if (b) params.set('b', b);
		goto(`/activities/compare?${params.toString()}`, { keepFocus: true, noScroll: true });
	}
	const selectA = (e: Event) => navTo((e.currentTarget as HTMLSelectElement).value || null, idB);
	const selectB = (e: Event) => navTo(idA, (e.currentTarget as HTMLSelectElement).value || null);

	// Overlay controls. Metrics/axis available depend on what BOTH activities have.
	$: metrics = detailA && detailB ? commonMetrics(detailA.track.metrics, detailB.track.metrics) : [];
	$: distanceAvailable =
		detailA && detailB ? hasDistanceAxis(detailA.track.points, detailB.track.points) : false;

	const METRIC_LABEL: Record<CompareMetric, string> = {
		hr: 'HR',
		pace: 'Pace',
		power: 'Power',
		elevation: 'Elev'
	};

	let metric: CompareMetric = 'hr';
	let axis: CompareAxis = 'time';
	// Snap the toggles to something valid whenever the compared pair changes.
	$: if (metrics.length > 0 && !metrics.includes(metric)) metric = metrics[0]!;
	$: if (!distanceAvailable && axis === 'distance') axis = 'time';

	$: seriesA = detailA ? buildSeries(detailA.track.points, metric, axis) : [];
	$: seriesB = detailB ? buildSeries(detailB.track.points, metric, axis) : [];
	$: domain = sharedDomain(seriesA, seriesB);
</script>

<section class="compare">
	<header class="head">
		<BackLink fallback="/activities" fallbackLabel="activities" />
		<h1 class="title">Compare activities</h1>
	</header>

	<div class="pickers">
		<label class="picker">
			<span class="picker-label oi-mono">Activity A</span>
			<select on:change={selectA}>
				<option value="">Select an activity…</option>
				{#each groupsA as g}
					{#if g.label}
						<optgroup label={g.label}>
							{#each g.rows as r (r.id)}
								<option value={r.id} selected={r.id === idA}>{optionLabel(r)}</option>
							{/each}
						</optgroup>
					{:else}
						{#each g.rows as r (r.id)}
							<option value={r.id} selected={r.id === idA}>{optionLabel(r)}</option>
						{/each}
					{/if}
				{/each}
			</select>
		</label>
		<label class="picker">
			<span class="picker-label oi-mono">Activity B</span>
			<select on:change={selectB}>
				<option value="">Select an activity…</option>
				{#each groupsB as g}
					{#if g.label}
						<optgroup label={g.label}>
							{#each g.rows as r (r.id)}
								<option value={r.id} selected={r.id === idB}>{optionLabel(r)}</option>
							{/each}
						</optgroup>
					{:else}
						{#each g.rows as r (r.id)}
							<option value={r.id} selected={r.id === idB}>{optionLabel(r)}</option>
						{/each}
					{/if}
				{/each}
			</select>
		</label>
	</div>

	{#if detailA && detailB}
		<div class="titles">
			<div class="act-card">
				<span class="dot" style="background: var(--run)"></span>
				<div class="act-meta">
					<div class="act-title">{detailA.activity.title}</div>
					<div class="act-date oi-mono">{detailA.activity.dateLabel}</div>
				</div>
				<a class="open" href="/activities/{detailA.activity.id}">Open ›</a>
			</div>
			<div class="act-card">
				<span class="dot" style="background: var(--swim)"></span>
				<div class="act-meta">
					<div class="act-title">{detailB.activity.title}</div>
					<div class="act-date oi-mono">{detailB.activity.dateLabel}</div>
				</div>
				<a class="open" href="/activities/{detailB.activity.id}">Open ›</a>
			</div>
		</div>

		{#if metrics.length > 0}
			<div class="toggles">
				<div class="toggle-group" role="group" aria-label="Metric">
					{#each metrics as m}
						<button type="button" class="tbtn" class:active={metric === m} on:click={() => (metric = m)}>
							{METRIC_LABEL[m]}
						</button>
					{/each}
				</div>
				<div class="toggle-group" role="group" aria-label="X axis">
					<button type="button" class="tbtn" class:active={axis === 'time'} on:click={() => (axis = 'time')}>Time</button>
					{#if distanceAvailable}
						<button type="button" class="tbtn" class:active={axis === 'distance'} on:click={() => (axis = 'distance')}>Distance</button>
					{/if}
				</div>
			</div>

			<CompareChart
				{seriesA}
				{seriesB}
				{domain}
				{metric}
				{axis}
				{units}
				labelA={detailA.activity.title}
				labelB={detailB.activity.title}
			/>
		{:else}
			<div class="card empty oi-mono">
				These two activities share no overlay metric (HR / pace / power / elevation).
			</div>
		{/if}

		{#if comparison && comparison.stats.length > 0}
			<div class="card stats">
				<div class="card-title">Stats</div>
				<div class="stats-grid">
					<div class="sh oi-mono"></div>
					<div class="sh oi-mono"><span class="dot sm" style="background: var(--run)"></span>A</div>
					<div class="sh oi-mono"><span class="dot sm" style="background: var(--swim)"></span>B</div>
					<div class="sh oi-mono">Δ</div>
					{#each comparison.stats as s}
						<div class="sc sc-label">{s.label}</div>
						<div class="sc oi-mono">{s.a}</div>
						<div class="sc oi-mono">{s.b}</div>
						<div class="sc oi-mono sc-delta">{s.delta ?? ''}</div>
					{/each}
				</div>
			</div>
		{/if}
	{:else if comparison && (!detailA || !detailB)}
		<div class="card empty oi-mono">Couldn't load one of the selected activities.</div>
	{:else}
		<div class="card empty oi-mono">
			Pick two activities to overlay their pace, power and heart rate.
		</div>
	{/if}
</section>

<style>
	.compare {
		display: flex;
		flex-direction: column;
		gap: 13px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 13px;
	}
	.title {
		font-size: 22px;
		font-weight: 700;
		color: var(--ink2);
		line-height: 1;
		margin: 0;
	}

	.pickers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 11px;
	}
	.picker {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.picker-label {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--faint);
	}
	select {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--ink2);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 7px;
		padding: 9px 11px;
		width: 100%;
		cursor: pointer;
	}

	.titles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 11px;
	}
	.act-card {
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 11px 14px;
		min-width: 0;
	}
	.dot {
		width: 11px;
		height: 11px;
		border-radius: 3px;
		flex: none;
	}
	.dot.sm {
		width: 8px;
		height: 8px;
		display: inline-block;
		margin-right: 5px;
		vertical-align: middle;
	}
	.act-meta {
		min-width: 0;
		flex: 1;
	}
	.act-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.act-date {
		font-size: 10px;
		color: var(--muted);
		margin-top: 2px;
	}
	.open {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
		text-decoration: none;
		flex: none;
	}
	.open:hover {
		color: var(--ink2);
	}

	.toggles {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.toggle-group {
		display: inline-flex;
		gap: 2px;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 7px;
		padding: 2px;
	}
	.tbtn {
		font: 600 11px 'Archivo', system-ui, sans-serif;
		color: var(--muted);
		background: transparent;
		border: none;
		border-radius: 5px;
		padding: 5px 11px;
		cursor: pointer;
		line-height: 1.2;
	}
	.tbtn.active {
		color: var(--ink2);
		background: var(--card);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 14px 16px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
		margin-bottom: 11px;
	}
	.empty {
		text-align: center;
		font-size: 11px;
		color: var(--faint);
		padding: 26px 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
		font-size: 11px;
	}
	.sh {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--faint);
		padding: 0 0 7px;
	}
	.sc {
		padding: 8px 0;
		border-top: 1px solid var(--line);
		color: var(--ink-soft);
	}
	.sc-label {
		font-weight: 600;
		color: var(--ink2);
	}
	.sc-delta {
		color: var(--muted);
	}

	@media (max-width: 639px) {
		.pickers,
		.titles {
			grid-template-columns: 1fr;
		}
		.card {
			padding: 12px 13px;
		}
	}
</style>
