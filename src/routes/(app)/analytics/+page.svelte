<script lang="ts">
	type Sport = 'Bike' | 'Run' | 'Swim' | 'Strength' | 'Other';
	type WeeklyRow = {
		weekStart: string;
		completed: { durationSec: number; distanceM: number; elevationM: number; load: number };
		planned: { durationSec: number; distanceM: number; load: number };
		compliance: { durationPct: number | null; distancePct: number | null; loadPct: number | null };
	};
	type FitnessRow = { date: string; load: number; fitness: number; fatigue: number; freshness: number };

	export let data: {
		weeks: number;
		fromDate: string;
		toDate: string;
		sports: readonly Sport[];
		sport: Sport | null;
		weekly: WeeklyRow[];
		fitness: FitnessRow[];
		totals: {
			completedDuration: number;
			completedDistance: number;
			completedElevation: number;
			completedLoad: number;
			plannedDuration: number;
			plannedDistance: number;
			plannedLoad: number;
		};
	};

	function h(sec: number) {
		return (sec / 3600).toFixed(1);
	}
	function km(m: number) {
		return (m / 1000).toFixed(1);
	}
	function pct(v: number | null) {
		if (v === null) return '—';
		return `${Math.round(v * 100)}%`;
	}

	function svgPath(rows: FitnessRow[], key: keyof FitnessRow, width: number, height: number) {
		if (rows.length === 0) return '';
		const values = rows.map((r) => Number(r[key]));
		const min = Math.min(...values);
		const max = Math.max(...values);
		const span = Math.max(1e-9, max - min);
		const stepX = width / Math.max(1, rows.length - 1);
		return rows
			.map((r, i) => {
				const x = i * stepX;
				const y = height - ((Number(r[key]) - min) / span) * height;
				return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			})
			.join(' ');
	}
</script>

<div class="headerRow">
	<h1>Analytics</h1>
	<form method="GET" class="filters">
		<label>
			<span>Weeks</span>
			<input name="weeks" type="number" min="4" max="52" value={data.weeks} />
		</label>
		<label>
			<span>Sport</span>
			<select name="sport">
				<option value="">All</option>
				{#each data.sports as s}
					<option value={s} selected={data.sport === s}>{s}</option>
				{/each}
			</select>
		</label>
		<button type="submit">Apply</button>
	</form>
</div>

<p class="muted">Range: {data.fromDate} → {data.toDate}</p>

<h2>Fitness / Fatigue / Freshness</h2>
{#if data.fitness.length === 0}
	<p class="muted">No activity data yet.</p>
{:else}
	<div class="chart">
		<svg viewBox="0 0 600 160" preserveAspectRatio="none" aria-label="Fitness/Fatigue/Freshness chart">
			<path d={svgPath(data.fitness, 'fitness', 600, 160)} fill="none" stroke="#0f172a" stroke-width="2" />
			<path d={svgPath(data.fitness, 'fatigue', 600, 160)} fill="none" stroke="#2563eb" stroke-width="2" />
			<path d={svgPath(data.fitness, 'freshness', 600, 160)} fill="none" stroke="#059669" stroke-width="2" />
		</svg>
	</div>
	<p class="muted">
		Legend: <span class="swatch fitness"></span>Fitness (42d avg) <span class="swatch fatigue"></span>Fatigue (7d avg)
		<span class="swatch fresh"></span>Freshness
	</p>
{/if}

<h2>Weekly totals</h2>
{#if data.weekly.length === 0}
	<p class="muted">No data in this range.</p>
{:else}
	<div class="tableWrap" role="region" aria-label="Weekly analytics table">
	<table class="table">
		<thead>
			<tr>
				<th>Week</th>
				<th>Completed (h)</th>
				<th>Completed (km)</th>
				<th>Elevation (m)</th>
				<th>Load</th>
				<th>Planned (h)</th>
				<th>Planned (km)</th>
				<th>Planned load</th>
				<th>Compliance (dur)</th>
				<th>Compliance (dist)</th>
				<th>Compliance (load)</th>
			</tr>
		</thead>
		<tbody>
			{#each data.weekly as w}
				<tr>
					<td>{w.weekStart}</td>
					<td>{h(w.completed.durationSec)}</td>
					<td>{km(w.completed.distanceM)}</td>
					<td>{Math.round(w.completed.elevationM)}</td>
					<td>{w.completed.load.toFixed(0)}</td>
					<td>{h(w.planned.durationSec)}</td>
					<td>{km(w.planned.distanceM)}</td>
					<td>{w.planned.load.toFixed(0)}</td>
					<td>{pct(w.compliance.durationPct)}</td>
					<td>{pct(w.compliance.distancePct)}</td>
					<td>{pct(w.compliance.loadPct)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	</div>

	<div class="totals">
		<div class="card">
			<div class="k">Completed</div>
			<div class="v">{h(data.totals.completedDuration)} h · {km(data.totals.completedDistance)} km · {Math.round(data.totals.completedElevation)} m · {data.totals.completedLoad.toFixed(0)} load</div>
		</div>
		<div class="card">
			<div class="k">Planned</div>
			<div class="v">{h(data.totals.plannedDuration)} h · {km(data.totals.plannedDistance)} km · {data.totals.plannedLoad.toFixed(0)} load</div>
		</div>
	</div>
{/if}

<style>
	.headerRow {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 12px;
		flex-wrap: wrap;
	}

	.filters {
		display: flex;
		gap: 10px;
		align-items: end;
	}

	label {
		display: grid;
		gap: 6px;
	}

	input,
	select {
		padding: 8px 10px;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		background: white;
	}

	button {
		padding: 9px 12px;
		border-radius: 10px;
		border: 1px solid #cbd5e1;
		background: white;
		cursor: pointer;
	}

	.muted {
		color: #64748b;
	}

	.chart {
		border: 1px solid #e2e8f0;
		background: white;
		border-radius: 12px;
		padding: 8px;
		max-width: 900px;
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		margin: 0 6px 0 12px;
	}
	.swatch.fitness {
		background: #0f172a;
	}
	.swatch.fatigue {
		background: #2563eb;
	}
	.swatch.fresh {
		background: #059669;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		overflow: hidden;
	}

	.tableWrap {
		max-width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-radius: 12px;
	}

	th,
	td {
		padding: 10px 8px;
		border-bottom: 1px solid #e2e8f0;
		text-align: left;
		font-size: 0.92rem;
		white-space: nowrap;
	}

	th {
		background: #f8fafc;
	}

	.totals {
		margin-top: 12px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		max-width: 900px;
	}

	.card {
		border: 1px solid #e2e8f0;
		background: white;
		border-radius: 12px;
		padding: 12px;
	}

	.k {
		color: #64748b;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.v {
		margin-top: 6px;
		font-weight: 600;
	}
</style>
