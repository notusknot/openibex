<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	export let data: PageData;
	export let form: ActionData;

	$: calendar = data.calendar;

	type FilterKey = 'all' | 'swim' | 'bike' | 'run';
	type ModalSport = 'Swim' | 'Bike' | 'Run';

	let filter: FilterKey = 'all';
	let modalOpen = false;
	let modalSport: ModalSport = 'Run';
	let modalTitle = '';
	let modalDay = '';
	let modalTss = '60';

	const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const FILTERS: { key: FilterKey; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'swim', label: 'Swim' },
		{ key: 'bike', label: 'Bike' },
		{ key: 'run', label: 'Run' }
	];
	const MODAL_SPORTS: { key: ModalSport; display: 'swim' | 'bike' | 'run'; label: string }[] = [
		{ key: 'Swim', display: 'swim', label: 'Swim' },
		{ key: 'Bike', display: 'bike', label: 'Bike' },
		{ key: 'Run', display: 'run', label: 'Run' }
	];

	function dowFor(dateStr: string): string {
		// `T12:00:00` to avoid timezone-shift surprises.
		const d = new Date(`${dateStr}T12:00:00`);
		return DOW_LABELS[(d.getDay() + 6) % 7]!;
	}

	function defaultModalDay(): number {
		const today = calendar.todayDate;
		if (today && today.startsWith(calendar.monthParam)) {
			return Number(today.slice(-2));
		}
		return 1;
	}

	function openModal(day?: number) {
		const fallback = Number(modalDay) || defaultModalDay();
		modalDay = String(day ?? fallback);
		if (!modalTitle) modalTitle = '';
		modalOpen = true;
	}

	function closeModal() {
		modalOpen = false;
	}

	function onModalKey(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
	}
</script>

<svelte:window on:keydown={onModalKey} />

<section class="cal">
	<header class="head">
		<div>
			<h1 class="title">Calendar</h1>
			<p class="subtitle oi-mono">Plan &amp; review training · month view</p>
		</div>
		<div class="head-actions">
			<div class="month-nav">
				<a class="month-arrow" href="/calendar?month={calendar.nav.prev}" aria-label="Previous month">‹</a>
				<span class="month-label oi-mono">{calendar.monthLabel}</span>
				<a class="month-arrow" href="/calendar?month={calendar.nav.next}" aria-label="Next month">›</a>
			</div>
			<button type="button" class="btn btn-primary" on:click={() => openModal()}>+ New planned</button>
		</div>
	</header>

	<div class="summary-strip">
		<div class="summary-card sum-completed">
			<div class="sum-label oi-mono">Completed</div>
			<div class="sum-val oi-mono">{calendar.summary.completed}</div>
			<div class="sum-sub oi-mono">sessions this month</div>
		</div>
		<div class="summary-card sum-planned">
			<div class="sum-label oi-mono">Planned</div>
			<div class="sum-val oi-mono">{calendar.summary.planned}</div>
			<div class="sum-sub oi-mono">upcoming workouts</div>
		</div>
		<div class="summary-card sum-tss">
			<div class="sum-label oi-mono">Monthly TSS</div>
			<div class="sum-val oi-mono">{calendar.summary.tss}</div>
			<div class="sum-sub oi-mono">completed load</div>
		</div>
		<div class="summary-card sum-volume">
			<div class="sum-label oi-mono">Volume</div>
			<div class="sum-val oi-mono">
				{calendar.summary.hours}<span class="sum-unit">h</span>
			</div>
			<div class="sum-sub oi-mono">across {calendar.summary.weekCount} weeks</div>
		</div>
	</div>

	<div class="filter-row">
		<div class="filter-chips">
			{#each FILTERS as f}
				<button
					type="button"
					class="filter-chip"
					class:active={filter === f.key}
					on:click={() => (filter = f.key)}
					aria-pressed={filter === f.key}
				>
					{f.label}
				</button>
			{/each}
		</div>
		<div class="legend">
			<span class="legend-item">
				<span class="legend-chip legend-completed" aria-hidden="true"></span>Completed
			</span>
			<span class="legend-item">
				<span class="legend-chip legend-planned" aria-hidden="true"></span>Planned
			</span>
		</div>
	</div>

	<div class="cal-grid-wrap">
		<div class="cal-grid">
			{#each DOW_LABELS as label}
				<div class="cal-dow oi-mono">{label}</div>
			{/each}
			<div class="cal-dow cal-dow-week oi-mono">Week</div>

			{#each calendar.weeks as week}
				{#each week.cells as cell}
					<div
						class="cal-cell"
						class:out={!cell.inMonth}
						class:today={cell.isToday}
						class:has-sessions={cell.sessions.length > 0}
					>
						<div class="cal-cell-head">
							<span class="cal-dow-mobile oi-mono" aria-hidden="true">{dowFor(cell.date)}</span>
							<span class="cal-day-num oi-mono" class:today={cell.isToday} class:dim={!cell.inMonth}>
								{cell.day}
							</span>
							{#if cell.inMonth}
								<button
									type="button"
									class="cal-add"
									aria-label="Add planned workout for {cell.date}"
									on:click={() => openModal(cell.day)}
								>
									+
								</button>
							{/if}
						</div>
						{#if cell.sessions.length > 0}
							<div class="cal-sessions">
								{#each cell.sessions as s}
									<a
										class="cal-chip {s.sport}"
										class:planned={s.planned}
										class:completed={!s.planned}
										class:dim={filter !== 'all' && s.sport !== filter}
										href={s.href}
										title={s.title}
									>
										<span class="cal-chip-dot" aria-hidden="true"></span>
										<span class="cal-chip-title">{s.title}</span>
										{#if s.tss > 0}
											<span class="cal-chip-tss oi-mono">{s.tss}</span>
										{/if}
									</a>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
				<div class="cal-week-sum">
					<div class="week-tss oi-mono">{week.tss}</div>
					<div class="week-label oi-mono">TSS</div>
					<div class="week-detail oi-mono">{week.hours}h · {week.count} ses</div>
				</div>
			{/each}
		</div>
	</div>
</section>

{#if modalOpen}
	<div
		class="modal-overlay"
		role="presentation"
		on:click|self={closeModal}
	>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
			<header class="modal-head">
				<div>
					<div id="modal-title" class="modal-title">New planned workout</div>
					<div class="modal-sub oi-mono">{calendar.monthLabel}</div>
				</div>
				<button type="button" class="modal-close" aria-label="Close" on:click={closeModal}>✕</button>
			</header>

			<form
				method="POST"
				action="?/createPlanned"
				class="modal-body"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success' || result.type === 'redirect') {
							modalOpen = false;
							modalTitle = '';
						}
						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="month" value={calendar.monthParam} />
				<input type="hidden" name="sport" bind:value={modalSport} />

				<div class="field">
					<div class="field-label oi-mono">Sport</div>
					<div class="sport-row">
						{#each MODAL_SPORTS as s}
							<button
								type="button"
								class="sport-pick {s.display}"
								class:active={modalSport === s.key}
								on:click={() => (modalSport = s.key)}
								aria-pressed={modalSport === s.key}
							>
								<span class="sport-pick-dot" aria-hidden="true"></span>
								{s.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="field">
					<label class="field-label oi-mono" for="modal-title-input">Workout title</label>
					<input
						id="modal-title-input"
						class="oi-input"
						type="text"
						name="title"
						placeholder="e.g. Threshold 5×1km"
						bind:value={modalTitle}
						required
					/>
				</div>

				<div class="field-row">
					<div class="field" style="flex: 1">
						<label class="field-label oi-mono" for="modal-day-input">Day</label>
						<input
							id="modal-day-input"
							class="oi-input"
							type="number"
							name="day"
							min="1"
							max="31"
							bind:value={modalDay}
							required
						/>
					</div>
					<div class="field" style="flex: 1">
						<label class="field-label oi-mono" for="modal-tss-input">Planned TSS</label>
						<input
							id="modal-tss-input"
							class="oi-input"
							type="number"
							name="tss"
							min="0"
							max="400"
							bind:value={modalTss}
						/>
					</div>
				</div>

				{#if form?.error}
					<div class="modal-error">{form.error}</div>
				{/if}

				<footer class="modal-foot">
					<button type="button" class="btn" on:click={closeModal}>Cancel</button>
					<button type="submit" class="btn btn-primary">Add to calendar</button>
				</footer>
			</form>
		</div>
	</div>
{/if}

<style>
	.cal {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
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

	.head-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.month-nav {
		display: flex;
		align-items: center;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		overflow: hidden;
	}
	.month-arrow {
		font: 600 14px 'Archivo', system-ui, sans-serif;
		color: var(--btn-ink);
		background: transparent;
		border: none;
		padding: 7px 12px;
		cursor: pointer;
		text-decoration: none;
		line-height: 1;
	}
	.month-arrow:hover {
		color: var(--ink2);
	}
	.month-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink2);
		padding: 0 8px;
		min-width: 110px;
		text-align: center;
	}

	.btn {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--btn-ink);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 8px 14px;
		cursor: pointer;
		text-decoration: none;
		line-height: 1.2;
	}
	.btn-primary {
		color: #fff;
		background: var(--green);
		border-color: transparent;
	}

	.summary-strip {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}
	.summary-card {
		background: var(--card);
		border: 1px solid var(--line);
		border-top: 2px solid var(--run);
		border-radius: 8px;
		padding: 12px 14px;
	}
	.sum-completed {
		border-top-color: var(--run);
	}
	.sum-planned {
		border-top-color: var(--c-fat);
	}
	.sum-tss {
		border-top-color: var(--green);
	}
	.sum-volume {
		border-top-color: var(--c-form);
	}
	.sum-label {
		font-size: 8.5px;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.sum-val {
		font-size: 24px;
		font-weight: 600;
		color: var(--ink);
		margin-top: 6px;
		line-height: 1;
	}
	.sum-unit {
		font-size: 13px;
		color: var(--faint);
		margin-left: 2px;
	}
	.sum-sub {
		font-size: 9.5px;
		color: var(--muted);
		margin-top: 5px;
	}

	.filter-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.filter-chips {
		display: flex;
		gap: 6px;
	}
	.filter-chip {
		font: 600 11px 'Archivo', system-ui, sans-serif;
		padding: 6px 12px;
		border-radius: 999px;
		cursor: pointer;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--btn-ink);
		line-height: 1;
	}
	.filter-chip.active {
		background: var(--green);
		color: #fff;
		border-color: transparent;
	}
	.legend {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.legend-chip {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.legend-completed {
		background: var(--run-soft);
		border: 1px solid var(--line);
	}
	.legend-planned {
		background: var(--card);
		border: 1px dashed var(--bike);
	}

	.cal-grid-wrap {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		overflow: hidden;
	}
	.cal-grid {
		display: grid;
		/* minmax(0, 1fr) — without the 0 min, a long unbreakable title in any
		   cell would let that column stretch past its fair share. */
		grid-template-columns: repeat(7, minmax(0, 1fr)) 108px;
	}
	.cal-dow {
		font-size: 9px;
		letter-spacing: 0.08em;
		color: var(--muted);
		text-transform: uppercase;
		font-weight: 600;
		padding: 10px 12px;
		border-bottom: 1px solid var(--line);
		background: var(--bg-soft);
	}
	.cal-dow-week {
		border-left: 1px solid var(--line);
	}

	.cal-cell {
		min-height: 104px;
		min-width: 0;
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		border-left: 1px solid var(--line);
		background: var(--card);
		display: flex;
		flex-direction: column;
	}
	.cal-cell.out {
		background: var(--bg-soft);
	}
	.cal-cell.today {
		background: var(--bg-emphasis);
		box-shadow: inset 3px 0 0 var(--green);
	}
	.cal-cell-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 6px;
	}
	.cal-day-num {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
	}
	.cal-day-num.dim {
		color: var(--faint);
	}
	.cal-day-num.today {
		color: #fff;
		background: var(--green);
		border-radius: 50%;
		width: 21px;
		height: 21px;
		line-height: 21px;
		text-align: center;
	}
	.cal-add {
		font-size: 15px;
		color: var(--faint);
		line-height: 1;
		cursor: pointer;
		width: 18px;
		height: 18px;
		text-align: center;
		border-radius: 4px;
		background: transparent;
		border: none;
		padding: 0;
	}
	.cal-add:hover {
		color: var(--ink);
		background: var(--bg-soft);
	}

	.cal-sessions {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.cal-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 7px;
		border-radius: 5px;
		text-decoration: none;
		transition: opacity 120ms ease;
		border: 1px solid transparent;
	}
	.cal-chip.dim {
		opacity: 0.3;
	}
	.cal-chip.completed.swim {
		background: var(--swim-soft);
	}
	.cal-chip.completed.bike {
		background: var(--bike-soft);
	}
	.cal-chip.completed.run {
		background: var(--run-soft);
	}
	.cal-chip.completed.other {
		background: var(--track);
	}
	.cal-chip.planned {
		background: var(--card);
		border-style: dashed;
	}
	.cal-chip.planned.swim {
		border-color: var(--swim);
	}
	.cal-chip.planned.bike {
		border-color: var(--bike);
	}
	.cal-chip.planned.run {
		border-color: var(--run);
	}
	.cal-chip.planned.other {
		border-color: var(--muted);
	}
	.cal-chip-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex: none;
	}
	.cal-chip.swim .cal-chip-dot {
		background: var(--swim);
	}
	.cal-chip.bike .cal-chip-dot {
		background: var(--bike);
	}
	.cal-chip.run .cal-chip-dot {
		background: var(--run);
	}
	.cal-chip.other .cal-chip-dot {
		background: var(--muted);
	}
	.cal-chip-title {
		flex: 1;
		min-width: 0;
		font-size: 10px;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cal-chip.planned .cal-chip-title {
		color: var(--muted);
	}
	.cal-chip-tss {
		font-size: 9px;
		color: var(--muted);
		flex: none;
	}

	.cal-week-sum {
		border-bottom: 1px solid var(--line);
		border-left: 1px solid var(--line);
		background: var(--bg-soft);
		padding: 9px 11px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.week-tss {
		font-size: 18px;
		font-weight: 600;
		color: var(--ink2);
		line-height: 1;
	}
	.week-label {
		font-size: 9px;
		color: var(--faint);
		margin-top: 4px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.week-detail {
		font-size: 10px;
		color: var(--muted);
		margin-top: 8px;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
	}
	.modal {
		width: 420px;
		max-width: 92vw;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 14px;
		box-shadow: 0 24px 60px rgba(20, 40, 30, 0.3);
		overflow: hidden;
	}
	.modal-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid var(--line);
	}
	.modal-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--ink2);
	}
	.modal-sub {
		font-size: 10px;
		color: var(--muted);
		margin-top: 3px;
	}
	.modal-close {
		font-size: 18px;
		color: var(--faint);
		cursor: pointer;
		line-height: 1;
		background: transparent;
		border: none;
		padding: 4px;
	}
	.modal-close:hover {
		color: var(--ink);
	}
	.modal-body {
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 15px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.field-label {
		font-size: 9px;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.field-row {
		display: flex;
		gap: 12px;
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
	.sport-row {
		display: flex;
		gap: 7px;
	}
	.sport-pick {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		flex: 1;
		font: 600 12px 'Archivo', system-ui, sans-serif;
		padding: 9px 0;
		border-radius: 8px;
		cursor: pointer;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--btn-ink);
	}
	.sport-pick.active {
		background: var(--bg-emphasis);
		border-color: var(--green);
		color: var(--green);
	}
	.sport-pick-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.sport-pick.swim .sport-pick-dot {
		background: var(--swim);
	}
	.sport-pick.bike .sport-pick-dot {
		background: var(--bike);
	}
	.sport-pick.run .sport-pick-dot {
		background: var(--run);
	}
	.modal-error {
		font-size: 11px;
		color: var(--danger);
		background: var(--danger-bg);
		border-radius: 6px;
		padding: 7px 10px;
	}
	.modal-foot {
		display: flex;
		justify-content: flex-end;
		gap: 9px;
		padding: 14px 20px;
		border-top: 1px solid var(--line);
		background: var(--bg-soft);
	}

	/* Hidden by default; agenda layout brings it on mobile. */
	.cal-dow-mobile {
		display: none;
	}

	/* ── Responsive ─────────────────────────────────────────────────────
	   The desktop grid (7 day cols + 108 week col) doesn't shrink past
	   ~700px usefully. At tablet we drop the week summary col; at phone
	   we collapse to an agenda layout — one row per day, out-of-month
	   and empty-day cells hidden. */

	@media (max-width: 899px) {
		.cal-grid {
			grid-template-columns: repeat(7, minmax(0, 1fr));
		}
		.cal-dow-week,
		.cal-week-sum {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.head {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}
		.head-actions {
			justify-content: space-between;
		}
		.summary-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.cal-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.cal-dow {
			display: none;
		}
		/* Hide empty in-month days and all out-of-month days — agenda
		   shows only what you've planned/completed (plus today). */
		.cal-cell:not(.has-sessions):not(.today),
		.cal-cell.out {
			display: none;
		}
		.cal-cell {
			flex-direction: row;
			align-items: flex-start;
			gap: 14px;
			min-height: auto;
			padding: 14px 12px;
			border-left: none;
		}
		.cal-cell.today {
			box-shadow: inset 4px 0 0 var(--green);
		}
		.cal-cell-head {
			flex-direction: column;
			align-items: center;
			gap: 2px;
			margin-bottom: 0;
			width: 48px;
			flex: none;
		}
		.cal-dow-mobile {
			display: block;
			font-size: 9px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--faint);
			font-weight: 600;
		}
		.cal-day-num {
			font-size: 20px;
		}
		.cal-day-num.today {
			width: 28px;
			height: 28px;
			line-height: 28px;
		}
		.cal-add {
			display: none; /* Use the global "+ New planned" header button on phone */
		}
		.cal-sessions {
			flex: 1;
			min-width: 0;
			gap: 6px;
		}
		.cal-chip {
			padding: 7px 10px;
		}
		.cal-chip-title {
			font-size: 12px;
		}
		/* The grid-wrap's border-radius would clip these row borders; lighten
		   the row separator instead of relying on the cell's bottom border. */
		.cal-grid-wrap {
			border-radius: 12px;
		}
	}
</style>
