<script lang="ts">
	import { enhance } from '$app/forms';

	export let activityId: string;
	export let debrief: { rpe: number | null; grade: string | null; note: string };

	const RPES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	const GRADES = ['A', 'B', 'C', 'D', 'F'];

	let rpe = debrief.rpe;
	let grade = debrief.grade;
	let note = debrief.note;
	let lastId = activityId;
	// Re-seed local state only when navigating to a different activity — a
	// background SWR refresh of the same one must not clobber an in-progress edit.
	$: if (activityId !== lastId) {
		lastId = activityId;
		rpe = debrief.rpe;
		grade = debrief.grade;
		note = debrief.note;
	}

	$: logged = debrief.rpe !== null || debrief.grade !== null || debrief.note !== '';

	let saving = false;
	let savedFlash = false;
	let failed = false;

	// Minimal confetti: a handful of CSS-animated squares bursting from the save
	// button. No canvas, no dependency; skipped under prefers-reduced-motion.
	type Particle = { dx: number; dy: number; rot: number; clr: string; id: number };
	let burst: Particle[] = [];
	const CONFETTI_COLORS = ['var(--green)', '#f59e0b', '#60a5fa', '#f472b6'];
	function confetti() {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		burst = Array.from({ length: 14 }, (_, i) => ({
			dx: (Math.random() - 0.5) * 150,
			dy: -(24 + Math.random() * 80),
			rot: (Math.random() - 0.5) * 540,
			clr: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
			id: i
		}));
		setTimeout(() => (burst = []), 900);
	}
</script>

<form
	class="card debrief"
	method="POST"
	action="?/debrief"
	use:enhance={() => {
		saving = true;
		failed = false;
		return async ({ result, update }) => {
			saving = false;
			if (result.type === 'success') {
				savedFlash = true;
				confetti();
				setTimeout(() => (savedFlash = false), 1600);
			} else {
				failed = true;
			}
			await update({ reset: false });
		};
	}}
>
	<div class="debrief-head">
		<span class="card-title-sm">How did it go?</span>
		{#if failed}
			<span class="debrief-tag debrief-tag-err oi-mono">Couldn't save</span>
		{:else if logged && !savedFlash}
			<span class="debrief-tag oi-mono">Logged ✓</span>
		{/if}
	</div>

	<div class="debrief-rows">
		<div class="dim" role="group" aria-label="Session RPE, 0 easy to 10 max">
			<span class="dim-label oi-mono">RPE <span class="dim-hint">0 easy · 10 max</span></span>
			<div class="chips chips-rpe">
				{#each RPES as r}
					<button
						type="button"
						class="chip"
						class:on={rpe === r}
						aria-pressed={rpe === r}
						on:click={() => (rpe = rpe === r ? null : r)}
					>
						{r}
					</button>
				{/each}
			</div>
		</div>

		<div class="dim" role="group" aria-label="Grade: did the session do its job?">
			<span class="dim-label oi-mono">Grade <span class="dim-hint">did it do its job?</span></span>
			<div class="chips chips-grade">
				{#each GRADES as g}
					<button
						type="button"
						class="chip"
						class:on={grade === g}
						aria-pressed={grade === g}
						on:click={() => (grade = grade === g ? null : g)}
					>
						{g}
					</button>
				{/each}
			</div>
		</div>

		<div class="note-row">
			<input
				class="note"
				type="text"
				name="note"
				maxlength="280"
				placeholder="One line on how it felt…"
				aria-label="One line on how it felt"
				bind:value={note}
			/>
			<input type="hidden" name="rpe" value={rpe ?? ''} />
			<input type="hidden" name="grade" value={grade ?? ''} />
			<span class="save-wrap">
				<button type="submit" class="save" class:saved={savedFlash} disabled={saving}>
					{savedFlash ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
				</button>
				{#each burst as p (p.id)}
					<span
						class="confetto"
						style="--dx: {p.dx}px; --dy: {p.dy}px; --rot: {p.rot}deg; background: {p.clr}"
					></span>
				{/each}
			</span>
		</div>
	</div>
</form>

<style>
	.debrief {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 12px 16px;
	}
	.debrief-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.card-title-sm {
		font-size: 12.5px;
		font-weight: 700;
		color: var(--ink2);
	}
	.debrief-tag {
		font-size: 9px;
		color: var(--green);
		background: var(--run-soft);
		border-radius: 3px;
		padding: 1px 5px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.debrief-tag-err {
		color: var(--danger);
		background: transparent;
	}

	.debrief-rows {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 28px;
		margin-top: 9px;
	}
	.dim {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.dim-label {
		font-size: 9px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
		white-space: nowrap;
	}
	.dim-hint {
		text-transform: none;
		letter-spacing: 0;
		color: var(--faint);
		opacity: 0.75;
	}
	.chips {
		display: flex;
		gap: 4px;
	}
	.chip {
		font: 600 11px 'Archivo', system-ui, sans-serif;
		color: var(--ink-soft);
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 6px;
		min-width: 28px;
		height: 28px;
		padding: 0;
		cursor: pointer;
	}
	.chip.on {
		color: #fff;
		background: var(--green);
		border-color: transparent;
	}

	.note-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 220px;
	}
	.note {
		flex: 1;
		min-width: 0;
		font: 500 12px 'Archivo', system-ui, sans-serif;
		color: var(--ink2);
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 7px;
		height: 30px;
		padding: 0 10px;
	}
	.note::placeholder {
		color: var(--faint);
	}
	.save-wrap {
		position: relative;
		display: inline-flex;
	}
	.save {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: #fff;
		background: var(--green);
		border: none;
		border-radius: 7px;
		height: 30px;
		padding: 0 14px;
		cursor: pointer;
		white-space: nowrap;
	}
	.save:disabled {
		opacity: 0.7;
		cursor: default;
	}
	.save.saved {
		filter: saturate(1.2);
	}

	.confetto {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 6px;
		height: 6px;
		border-radius: 1.5px;
		pointer-events: none;
		animation: confetto-pop 0.8s ease-out forwards;
	}
	@keyframes confetto-pop {
		from {
			opacity: 1;
			transform: translate(-50%, -50%);
		}
		to {
			opacity: 0;
			transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 40px)) rotate(var(--rot));
		}
	}

	@media (max-width: 639px) {
		.debrief {
			padding: 12px 13px;
		}
		.debrief-rows {
			gap: 12px;
		}
		.dim {
			flex-direction: column;
			align-items: stretch;
			gap: 6px;
			width: 100%;
		}
		/* Full-width tap targets: RPE spreads its 11 chips across the row. */
		.chips-rpe {
			display: grid;
			grid-template-columns: repeat(11, minmax(0, 1fr));
		}
		.chips-grade {
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
		.chip {
			height: 40px;
			min-width: 0;
		}
		.note,
		.save {
			height: 40px;
		}
	}
</style>
