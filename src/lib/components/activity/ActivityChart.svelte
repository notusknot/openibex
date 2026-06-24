<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { TrackPoint, ActivityTrackMetrics } from '$lib/track';

	export let points: TrackPoint[];
	export let metrics: ActivityTrackMetrics;
	export let durationSec: number;
	export let hoverIndex: Writable<number | null>;

	// Geometry (matches the previous inline chart so the look is unchanged).
	const W = 640;
	const VIEW_H = 208;
	const PAD_L = 6;
	const PAD_T = 6;
	const INNER_H = 170;
	const INNER_W = W - 2 * PAD_L;
	const BASE_Y = PAD_T + INNER_H;

	$: n = points.length;
	$: available = metrics.hr || metrics.pace;

	// x-axis by elapsed time so the unevenly-spaced simplified points still land
	// at their true moment. Falls back to index spacing if timestamps are flat.
	$: tMin = n > 0 ? points[0]!.t : 0;
	$: tSpan = n > 0 ? points[n - 1]!.t - tMin : 0;
	$: xAt = (i: number): number => {
		const frac = tSpan > 0 ? (points[i]!.t - tMin) / tSpan : n > 1 ? i / (n - 1) : 0;
		return PAD_L + frac * INNER_W;
	};

	function rangeOf(get: (p: TrackPoint) => number | null, pad: number) {
		let mn = Infinity;
		let mx = -Infinity;
		for (const p of points) {
			const v = get(p);
			if (v === null) continue;
			if (v < mn) mn = v;
			if (v > mx) mx = v;
		}
		if (!Number.isFinite(mn)) return { min: 0, max: 1 };
		mn -= pad;
		mx += pad;
		return { min: mn, max: mx === mn ? mx + 1 : mx };
	}

	$: hrRange = rangeOf((p) => p.hr, 6);
	$: paceRange = rangeOf((p) => p.pace, 8);

	const hrY = (v: number) => PAD_T + ((hrRange.max - v) / (hrRange.max - hrRange.min)) * INNER_H;
	// Lower pace seconds = faster = higher on the chart (standard for run pace).
	const paceY = (v: number) =>
		PAD_T + ((v - paceRange.min) / (paceRange.max - paceRange.min)) * INNER_H;

	// Build an SVG path that breaks (lifts the pen) on null gaps.
	function linePath(yOf: (p: TrackPoint) => number | null): string {
		let d = '';
		let pen = false;
		for (let i = 0; i < n; i++) {
			const y = yOf(points[i]!);
			if (y === null) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)},${y.toFixed(1)} `;
			pen = true;
		}
		return d.trim();
	}

	$: hrLine = metrics.hr ? linePath((p) => (p.hr === null ? null : hrY(p.hr))) : '';
	$: paceLine = metrics.pace ? linePath((p) => (p.pace === null ? null : paceY(p.pace))) : '';

	// Filled area under the HR trace (subtle). Connects across rare internal gaps.
	$: hrArea = (() => {
		if (!metrics.hr) return '';
		const seg: string[] = [];
		let firstX: number | null = null;
		let lastX = PAD_L;
		for (let i = 0; i < n; i++) {
			const v = points[i]!.hr;
			if (v === null) continue;
			const x = xAt(i);
			if (firstX === null) firstX = x;
			lastX = x;
			seg.push(`L${x.toFixed(1)},${hrY(v).toFixed(1)}`);
		}
		if (firstX === null) return '';
		return `M${firstX.toFixed(1)},${BASE_Y} ${seg.join(' ')} L${lastX.toFixed(1)},${BASE_Y} Z`;
	})();

	$: gridLines = (() => {
		const out: { y: string; label: number }[] = [];
		for (let k = 0; k <= 3; k++) {
			const v = hrRange.min + ((hrRange.max - hrRange.min) * (3 - k)) / 3;
			out.push({ y: hrY(v).toFixed(1), label: Math.round(v) });
		}
		return out;
	})();

	$: xLabels = (() => {
		const out: { x: number; label: string }[] = [];
		if (n === 0 || durationSec <= 0) return out;
		for (let k = 0; k < 5; k++) {
			const i = Math.round((k / 4) * (n - 1));
			out.push({ x: xAt(i), label: fmtClock(points[i]!.t) });
		}
		return out;
	})();

	// Nearest point to a pixel x (points are time-ordered; linear scan is fine).
	function nearestByX(px: number): number {
		let best = 0;
		let bestD = Infinity;
		for (let i = 0; i < n; i++) {
			const d = Math.abs(xAt(i) - px);
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		return best;
	}

	let rafPending = false;
	let pendingX = 0;
	function onMove(e: MouseEvent) {
		if (n === 0) return;
		const target = e.currentTarget as SVGGraphicsElement;
		const css = target.getBoundingClientRect().width || 1;
		pendingX = (e.offsetX / css) * W;
		if (rafPending) return;
		rafPending = true;
		requestAnimationFrame(() => {
			rafPending = false;
			hoverIndex.set(nearestByX(pendingX));
		});
	}

	$: hover = (() => {
		const i = $hoverIndex;
		if (i === null || i < 0 || i >= n) return null;
		const p = points[i]!;
		const x = xAt(i);
		return {
			x,
			leftPct: `${((x / W) * 100).toFixed(2)}%`,
			hrY: p.hr !== null ? hrY(p.hr).toFixed(1) : null,
			paceY: p.pace !== null ? paceY(p.pace).toFixed(1) : null,
			time: fmtClock(p.t),
			hr: p.hr !== null ? `${Math.round(p.hr)} bpm` : null,
			pace: p.pace !== null ? `${fmtPace(p.pace)}/km` : null
		};
	})();

	function fmtClock(sec: number): string {
		const s = Math.round(sec);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const ss = s % 60;
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
		return `${m}:${ss.toString().padStart(2, '0')}`;
	}

	function fmtPace(secPerKm: number): string {
		const m = Math.floor(secPerKm / 60);
		const s = Math.round(secPerKm % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<div class="card chart-card">
	<div class="card-head">
		<div class="card-title">Heart rate &amp; pace</div>
		<div class="chart-legend">
			{#if metrics.hr}
				<span class="legend-item"><span class="legend-swatch hr-swatch"></span>HR (bpm)</span>
			{/if}
			{#if metrics.pace}
				<span class="legend-item"><span class="legend-swatch pace-swatch"></span>Pace (/km)</span>
			{/if}
		</div>
	</div>
	{#if available}
		<div class="chart-wrap">
			<svg
				width="100%"
				height={VIEW_H}
				viewBox="0 0 {W} {VIEW_H}"
				preserveAspectRatio="none"
				role="img"
				aria-label="Heart rate and pace over time"
				style="cursor: crosshair"
				on:mousemove={onMove}
				on:mouseleave={() => hoverIndex.set(null)}
			>
				{#each gridLines as g}
					<line x1={PAD_L} y1={g.y} x2={W - PAD_L} y2={g.y} stroke="var(--grid)" stroke-width="1" />
				{/each}
				{#if metrics.hr}
					<path d={hrArea} fill="var(--green)" opacity="0.06" />
					<path d={hrLine} fill="none" stroke="var(--green)" stroke-width="1.9" stroke-linejoin="round" />
				{/if}
				{#if metrics.pace}
					<path d={paceLine} fill="none" stroke="var(--bike)" stroke-width="1.5" stroke-linejoin="round" opacity="0.9" />
				{/if}
				{#if hover}
					<line x1={hover.x} y1="6" x2={hover.x} y2="176" stroke="var(--ink2)" stroke-width="1" opacity="0.4" />
					{#if hover.hrY}<circle cx={hover.x} cy={hover.hrY} r="3.3" fill="var(--green)" />{/if}
					{#if hover.paceY}<circle cx={hover.x} cy={hover.paceY} r="3.3" fill="var(--bike)" />{/if}
				{/if}
			</svg>
			{#each gridLines as g}
				<span class="axis-y oi-mono" style="top: {g.y}px">{g.label}</span>
			{/each}
			{#each xLabels as x}
				<span class="axis-x oi-mono" style="left: {(x.x / W) * 100}%">{x.label}</span>
			{/each}
			{#if hover}
				<div class="chart-tip" style="left: {hover.leftPct}">
					<div class="tip-time oi-mono">{hover.time}</div>
					{#if hover.hr}
						<div class="tip-row"><span class="tip-hr">HR</span><span class="oi-mono">{hover.hr}</span></div>
					{/if}
					{#if hover.pace}
						<div class="tip-row"><span class="tip-pace">Pace</span><span class="oi-mono">{hover.pace}</span></div>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div class="chart-empty oi-mono">No stream data available for this activity.</div>
	{/if}
</div>

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 14px 16px;
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}
	.chart-legend {
		display: flex;
		gap: 14px;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.legend-swatch {
		width: 10px;
		height: 3px;
		border-radius: 2px;
	}
	.hr-swatch {
		background: var(--green);
	}
	.pace-swatch {
		background: var(--bike);
	}
	.chart-wrap {
		position: relative;
		width: 100%;
	}
	.axis-y {
		position: absolute;
		left: 0;
		transform: translateY(-100%);
		font-size: 8px;
		color: var(--faint);
		line-height: 1;
		pointer-events: none;
		padding-left: 2px;
	}
	.axis-x {
		position: absolute;
		top: 188px;
		transform: translateX(-50%);
		font-size: 8.5px;
		color: var(--faint);
		line-height: 1;
		pointer-events: none;
	}
	.chart-tip {
		position: absolute;
		top: 2px;
		transform: translateX(-50%);
		pointer-events: none;
		background: var(--tip);
		color: #fff;
		border-radius: 6px;
		padding: 7px 10px;
		min-width: 104px;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}
	.tip-time {
		font-size: 9.5px;
		color: #9bbaa8;
		margin-bottom: 6px;
	}
	.tip-row {
		display: flex;
		justify-content: space-between;
		gap: 14px;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1.5;
	}
	.tip-hr {
		color: #7fc090;
	}
	.tip-pace {
		color: #e7c24b;
	}
	.chart-empty {
		padding: 28px 0;
		text-align: center;
		font-size: 11px;
		color: var(--faint);
	}
	@media (max-width: 639px) {
		.card {
			padding: 12px 13px;
		}
		.chart-legend {
			gap: 10px;
		}
		.axis-x {
			font-size: 8px;
		}
	}
</style>
