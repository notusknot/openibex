<script lang="ts">
	import type { PageData } from './$types';

	export let sport: PageData['dashboard']['sport'];

	const DONUT_R = 46;
	const DONUT_C = 2 * Math.PI * DONUT_R;

	$: donut = (() => {
		const swim = sport.swimPct / 100;
		const bike = sport.bikePct / 100;
		const run = sport.runPct / 100;
		let cum = 0;
		const seg = (frac: number) => {
			const len = frac * DONUT_C;
			const out = {
				dash: `${len.toFixed(1)} ${(DONUT_C - len).toFixed(1)}`,
				offset: (-cum * DONUT_C).toFixed(1)
			};
			cum += frac;
			return out;
		};
		return { swim: seg(swim), bike: seg(bike), run: seg(run) };
	})();
</script>

<div class="card sport-card">
	<div class="card-eyebrow oi-mono">Sport split · load</div>
	<div class="sport-body">
		<svg width="68" height="68" viewBox="0 0 120 120" aria-hidden="true">
			<circle
				cx="60"
				cy="60"
				r={DONUT_R}
				fill="none"
				stroke="var(--swim)"
				stroke-width="16"
				stroke-dasharray={donut.swim.dash}
				stroke-dashoffset={donut.swim.offset}
				transform="rotate(-90 60 60)"
			/>
			<circle
				cx="60"
				cy="60"
				r={DONUT_R}
				fill="none"
				stroke="var(--bike)"
				stroke-width="16"
				stroke-dasharray={donut.bike.dash}
				stroke-dashoffset={donut.bike.offset}
				transform="rotate(-90 60 60)"
			/>
			<circle
				cx="60"
				cy="60"
				r={DONUT_R}
				fill="none"
				stroke="var(--run)"
				stroke-width="16"
				stroke-dasharray={donut.run.dash}
				stroke-dashoffset={donut.run.offset}
				transform="rotate(-90 60 60)"
			/>
		</svg>
		<div class="sport-legend">
			<div class="sport-row">
				<span class="sport-key"><span class="sport-chip" style="background: var(--swim)"></span>Swim</span>
				<span class="oi-mono sport-pct">{sport.swimPct}%</span>
			</div>
			<div class="sport-row">
				<span class="sport-key"><span class="sport-chip" style="background: var(--bike)"></span>Bike</span>
				<span class="oi-mono sport-pct">{sport.bikePct}%</span>
			</div>
			<div class="sport-row">
				<span class="sport-key"><span class="sport-chip" style="background: var(--run)"></span>Run</span>
				<span class="oi-mono sport-pct">{sport.runPct}%</span>
			</div>
		</div>
	</div>
</div>

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
	}
	.sport-card {
		padding: 13px 14px;
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.card-eyebrow {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
		margin-bottom: 10px;
	}
	.sport-body {
		display: flex;
		align-items: center;
		gap: 13px;
		flex: 1;
	}
	.sport-legend {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.sport-row {
		display: flex;
		justify-content: space-between;
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.sport-key {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.sport-chip {
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}
	.sport-pct {
		color: var(--muted);
	}
</style>
