<script lang="ts">
	type Sport = 'Bike' | 'Run' | 'Swim' | 'Strength' | 'Other';
	type Day = {
		date: string;
		dayOfMonth: number;
		planned: Array<{
			id: string;
			title: string;
			sport: Sport;
			match?: { activityId: string; matchType: string; durationCompliance: number | null; distanceCompliance: number | null; loadCompliance: number | null };
		}>;
		completed: Array<{ id: string; title: string; sport: Sport }>;
	};
	type Cell = { kind: 'empty' } | { kind: 'day'; day: Day };

	export let data: {
		month: { year: number; month: number; param: string };
		nav: { prev: string; next: string };
		filter: { sport: Sport | null };
		sports: readonly Sport[];
		cells: Cell[];
		hasAny: boolean;
	};

	const monthLabel = new Date(data.month.year, data.month.month - 1, 1).toLocaleString(undefined, {
		month: 'long',
		year: 'numeric'
	});

	function pct(v: number | null | undefined) {
		if (v === null || v === undefined) return '—';
		return `${Math.round(v * 100)}%`;
	}
</script>

<div class="headerRow">
	<h1>Calendar</h1>
	<div class="actions">
		<a class="button" href={`/calendar/new?date=${data.month.param}-01`}>New planned workout</a>
	</div>
</div>

{#if !data.hasAny}
	<div class="emptyCard">
		<p class="muted">Nothing on your calendar yet.</p>
		<p class="muted">
			Start by <a href={`/calendar/new?date=${data.month.param}-01`}>creating a planned workout</a> or
			<a href="/activities/upload">uploading a FIT activity</a>.
		</p>
	</div>
{/if}

<div class="toolbar">
	<div class="monthNav">
		<a href={`/calendar?month=${data.nav.prev}${data.filter.sport ? `&sport=${data.filter.sport}` : ''}`}>←</a>
		<div class="month">{monthLabel}</div>
		<a href={`/calendar?month=${data.nav.next}${data.filter.sport ? `&sport=${data.filter.sport}` : ''}`}>→</a>
	</div>

	<form method="GET" class="filters">
		<input type="hidden" name="month" value={data.month.param} />
		<label>
			<span>Sport</span>
			<select name="sport">
				<option value="">All</option>
				{#each data.sports as s}
					<option value={s} selected={data.filter.sport === s}>{s}</option>
				{/each}
			</select>
		</label>
		<button type="submit">Apply</button>
	</form>
</div>

<div class="grid">
	<div class="dow">Mon</div>
	<div class="dow">Tue</div>
	<div class="dow">Wed</div>
	<div class="dow">Thu</div>
	<div class="dow">Fri</div>
	<div class="dow">Sat</div>
	<div class="dow">Sun</div>

	{#each data.cells as cell}
		{#if cell.kind === 'empty'}
			<div class="cell emptyCell" />
		{:else}
			<div class="cell">
				<div class="cellHeader">
					<div class="dayNum">{cell.day.dayOfMonth}</div>
					<a class="add" href={`/calendar/new?date=${cell.day.date}`}>+</a>
				</div>

				{#if cell.day.planned.length === 0 && cell.day.completed.length === 0}
					<div class="empty">—</div>
				{:else}
					{#if cell.day.planned.length > 0}
						<div class="sectionLabel">Planned</div>
						<ul class="list plannedList">
							{#each cell.day.planned as w}
								<li class:matched={!!w.match}>
									<a href={`/calendar/${w.id}/edit`}>{w.title}</a>
									{#if w.match}
										<span class="pill">
											{w.match.matchType} · D {pct(w.match.durationCompliance)} · Dist {pct(w.match.distanceCompliance)} · Load {pct(w.match.loadCompliance)}
										</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}

					{#if cell.day.completed.length > 0}
						<div class="sectionLabel">Completed</div>
						<ul class="list completedList">
							{#each cell.day.completed as a}
								<li>
									<a href={`/activities/${a.id}`}>{a.title}</a>
									<span class="sport">{a.sport}</span>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.headerRow {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.button {
		padding: 10px 12px;
		border: 1px solid #0f172a;
		border-radius: 10px;
		background: #0f172a;
		color: white;
		text-decoration: none;
		font-weight: 600;
	}

	.emptyCard {
		margin-top: 12px;
		padding: 12px 14px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
		max-width: 720px;
	}

	.muted {
		color: #64748b;
	}

	.muted a {
		color: #334155;
	}

	.toolbar {
		margin-top: 12px;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.monthNav {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.monthNav a {
		text-decoration: none;
		padding: 6px 10px;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		background: white;
	}

	.month {
		font-weight: 700;
	}

	.filters {
		display: flex;
		align-items: end;
		gap: 10px;
	}

	label {
		display: grid;
		gap: 6px;
	}

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

	.grid {
		margin-top: 16px;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 8px;
	}

	.dow {
		font-size: 0.85rem;
		color: #475569;
		padding: 0 6px;
	}

	.cell {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 10px;
		min-height: 92px;
	}

	.emptyCell {
		background: transparent;
		border-style: dashed;
	}

	.cellHeader {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.dayNum {
		font-weight: 700;
		color: #0f172a;
	}

	.add {
		text-decoration: none;
		border: 1px solid #cbd5e1;
		border-radius: 999px;
		width: 24px;
		height: 24px;
		display: grid;
		place-items: center;
		background: #f8fafc;
	}

	.empty {
		color: #94a3b8;
	}

	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 6px;
	}

	.sectionLabel {
		margin-top: 6px;
		margin-bottom: 4px;
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	li {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.92rem;
	}

	.sport {
		color: #64748b;
		white-space: nowrap;
		font-size: 0.85rem;
	}

	.matched a {
		font-weight: 600;
	}

	.pill {
		font-size: 0.78rem;
		color: #065f46;
		border: 1px solid #a7f3d0;
		background: #ecfdf5;
		padding: 1px 6px;
		border-radius: 999px;
		white-space: nowrap;
	}

	@media (max-width: 720px) {
		.grid {
			gap: 6px;
		}
		.cell {
			padding: 8px;
			min-height: 76px;
		}
		li {
			font-size: 0.88rem;
		}
		.pill {
			display: none;
		}
	}
</style>
