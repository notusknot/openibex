<script lang="ts">
	// A single stat tile for the summary strips on the activities and calendar
	// pages. The accent sets the top-border color; `unit` renders smaller, after
	// the value (e.g. "42 km", "6.5 h").
	export let label: string;
	export let value: string | number;
	export let sub: string;
	export let unit = '';
	export let accent = 'var(--green)';
</script>

<div class="summary-card" style="border-top-color: {accent}">
	<div class="sum-label oi-mono">{label}</div>
	<div class="sum-val oi-mono">
		{value}{#if unit}<span class="sum-unit"> {unit}</span>{/if}
	</div>
	<div class="sum-sub oi-mono">{sub}</div>
</div>

<style>
	.summary-card {
		background: var(--card);
		border: 1px solid var(--line);
		border-top: 2px solid var(--green);
		border-radius: 8px;
		padding: 12px 14px;
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
</style>
