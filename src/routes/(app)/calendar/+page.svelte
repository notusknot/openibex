<script lang="ts">
	type Sport = 'Bike' | 'Run' | 'Swim' | 'Strength' | 'Other';
	type Day = { date: string; dayOfMonth: number; workouts: Array<{ id: string; title: string; sport: Sport }> };
	type Cell = { kind: 'empty' } | { kind: 'day'; day: Day };

	export let data: {
		month: { year: number; month: number; param: string };
		nav: { prev: string; next: string };
		filter: { sport: Sport | null };
		sports: readonly Sport[];
		cells: Cell[];
	};

	const monthLabel = new Date(data.month.year, data.month.month - 1, 1).toLocaleString(undefined, {
		month: 'long',
		year: 'numeric'
	});
</script>

<div class="headerRow">
	<h1>Calendar</h1>
	<div class="actions">
		<a class="button" href={`/calendar/new?date=${data.month.param}-01`}>New planned workout</a>
	</div>
</div>

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
				{#if cell.day.workouts.length === 0}
					<div class="empty">—</div>
				{:else}
					<ul class="list">
						{#each cell.day.workouts as w}
							<li>
								<a href={`/calendar/${w.id}/edit`}>{w.title}</a>
								<span class="sport">{w.sport}</span>
							</li>
						{/each}
					</ul>
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
</style>
