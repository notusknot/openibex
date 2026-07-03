<script lang="ts">
	import type { PageData } from './$types';
	import { STAT_TIPS } from './statTips';

	export let readinessVal: PageData['dashboard']['kpis']['readinessVal'];
	export let readinessLabel: PageData['dashboard']['kpis']['readinessLabel'];

	const READ_R = 52;
	const READ_C = 2 * Math.PI * READ_R;

	$: readinessDash = `${((READ_C * readinessVal) / 100).toFixed(1)} ${READ_C.toFixed(1)}`;
</script>

<div class="card readiness-card">
	<svg width="74" height="74" viewBox="0 0 130 130" aria-hidden="true">
		<circle cx="65" cy="65" r={READ_R} fill="none" stroke="var(--grid)" stroke-width="13" />
		<circle
			cx="65"
			cy="65"
			r={READ_R}
			fill="none"
			stroke="var(--green)"
			stroke-width="13"
			stroke-linecap="round"
			stroke-dasharray={readinessDash}
			transform="rotate(-90 65 65)"
		/>
		<text x="65" y="64" text-anchor="middle" class="oi-mono ring-val">{readinessVal}</text>
		<text x="65" y="83" text-anchor="middle" class="oi-mono ring-sub">/100</text>
	</svg>
	<div>
		<div class="readiness-label oi-mono" title={STAT_TIPS.readiness}>Readiness</div>
		<div class="readiness-state">{readinessLabel}</div>
		<div class="readiness-hint">Based on TSB. Updated today.</div>
	</div>
</div>

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
	}
	.readiness-card {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 13px 14px;
	}
	.ring-val {
		font-size: 30px;
		font-weight: 600;
		fill: var(--ink);
	}
	.ring-sub {
		font-size: 9px;
		fill: var(--faint);
	}
	.readiness-label {
		font-size: 8.5px;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-transform: uppercase;
		cursor: help;
	}
	.readiness-state {
		font-size: 15px;
		font-weight: 700;
		color: var(--green);
		margin-top: 4px;
	}
	.readiness-hint {
		font-size: 10px;
		color: var(--muted);
		margin-top: 4px;
		line-height: 1.45;
	}
</style>
