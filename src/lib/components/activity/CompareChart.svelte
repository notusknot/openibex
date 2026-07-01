<script lang="ts">
	import type { XY } from '$lib/track';
	import type { CompareAxis, CompareDomain, CompareMetric } from '$lib/compare';
	import {
		distanceFromMeters,
		distanceUnit,
		elevationLabel,
		elevationUnit,
		paceLabel,
		paceUnit,
		type Units
	} from '$lib/units';

	export let seriesA: XY[];
	export let seriesB: XY[];
	export let domain: CompareDomain;
	export let metric: CompareMetric;
	export let axis: CompareAxis;
	export let units: Units;
	export let labelA: string;
	export let labelB: string;

	// Activity A vs B colors, independent of the metric (green / blue, distinct).
	const COLOR_A = 'var(--run)';
	const COLOR_B = 'var(--swim)';

	// Geometry mirrors ActivityChart: width measured (bind:clientWidth) so 1 unit
	// = 1 CSS px and strokes/dots don't squish at non-default widths.
	const VIEW_H = 220;
	const PAD_L = 6;
	const PAD_T = 8;
	const INNER_H = 176;
	const BASE_Y = PAD_T + INNER_H;
	let cw = 640;
	$: innerW = Math.max(1, cw - 2 * PAD_L);

	$: xSpan = domain.xMax - domain.xMin || 1;
	$: ySpan = domain.yMax - domain.yMin || 1;
	$: xPix = (v: number) => PAD_L + ((v - domain.xMin) / xSpan) * innerW;
	// Pace is reversed (lower sec/km = faster = higher); every other metric is
	// higher = higher.
	$: yPix = (v: number) =>
		metric === 'pace'
			? PAD_T + ((v - domain.yMin) / ySpan) * INNER_H
			: PAD_T + ((domain.yMax - v) / ySpan) * INNER_H;

	function path(series: XY[]): string {
		let d = '';
		for (let i = 0; i < series.length; i++) {
			const p = series[i]!;
			d += `${i === 0 ? 'M' : 'L'}${xPix(p.x).toFixed(1)},${yPix(p.y).toFixed(1)} `;
		}
		return d.trim();
	}
	$: pathA = path(seriesA);
	$: pathB = path(seriesB);
	$: hasData = seriesA.length > 0 || seriesB.length > 0;

	function fmtClock(sec: number): string {
		const s = Math.round(sec);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const ss = s % 60;
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
		return `${m}:${ss.toString().padStart(2, '0')}`;
	}
	$: fmtX = (v: number, decimals = 1): string =>
		axis === 'time'
			? fmtClock(v)
			: `${distanceFromMeters(v, units).toFixed(decimals)} ${distanceUnit(units)}`;

	// Metric value as text; `withUnit` appends the trailing unit (tooltip) or omits
	// it for axis ticks.
	function fmtMetric(v: number, withUnit = true): string {
		const n =
			metric === 'pace'
				? paceLabel(v, units)
				: metric === 'elevation'
					? elevationLabel(v, units)
					: String(Math.round(v));
		if (!withUnit) return n;
		const unit =
			metric === 'hr' ? ' bpm' : metric === 'power' ? ' W' : metric === 'pace' ? paceUnit(units) : ` ${elevationUnit(units)}`;
		return n + unit;
	}

	$: yTicks = (() => {
		const out: { y: number; label: string }[] = [];
		for (let k = 0; k <= 3; k++) {
			const v = domain.yMin + (ySpan * k) / 3;
			out.push({ y: yPix(v), label: fmtMetric(v, false) });
		}
		return out;
	})();
	$: xTicks = (() => {
		const out: { x: number; label: string }[] = [];
		for (let k = 0; k <= 4; k++) {
			const v = domain.xMin + (xSpan * k) / 4;
			out.push({ x: xPix(v), label: fmtX(v) });
		}
		return out;
	})();

	// Nearest point in a series to a domain x (linear scan; series ≤ ~2k points).
	function nearestByX(series: XY[], x: number): XY | null {
		let best: XY | null = null;
		let bestD = Infinity;
		for (const p of series) {
			const d = Math.abs(p.x - x);
			if (d < bestD) {
				bestD = d;
				best = p;
			}
		}
		return best;
	}

	let hoverPx: number | null = null;
	let rafPending = false;
	function onMove(e: PointerEvent) {
		if (!hasData) return;
		const target = e.currentTarget as SVGGraphicsElement;
		const rect = target.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / (rect.width || 1)) * cw;
		if (rafPending) return;
		rafPending = true;
		requestAnimationFrame(() => {
			rafPending = false;
			hoverPx = px;
		});
	}
	function onDown(e: PointerEvent) {
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		onMove(e);
	}
	function clear(e?: PointerEvent) {
		if (e) (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
		hoverPx = null;
	}

	$: hover = (() => {
		if (hoverPx === null || !hasData) return null;
		const x = domain.xMin + ((hoverPx - PAD_L) / innerW) * xSpan;
		const na = nearestByX(seriesA, x);
		const nb = nearestByX(seriesB, x);
		return {
			px: hoverPx,
			leftPct: `${((hoverPx / cw) * 100).toFixed(2)}%`,
			xLabel: fmtX(x, 2),
			a: na ? { y: yPix(na.y), val: fmtMetric(na.y) } : null,
			b: nb ? { y: yPix(nb.y), val: fmtMetric(nb.y) } : null
		};
	})();
</script>

<div class="card chart-card">
	<div class="card-head">
		<div class="card-title">{axis === 'time' ? 'By moving time' : 'By distance'}</div>
		<div class="legend">
			<span class="legend-item"><span class="swatch" style="background: {COLOR_A}"></span>{labelA}</span>
			<span class="legend-item"><span class="swatch" style="background: {COLOR_B}"></span>{labelB}</span>
		</div>
	</div>
	{#if hasData}
		<div class="chart-wrap" bind:clientWidth={cw}>
			<svg
				width="100%"
				height={VIEW_H}
				viewBox="0 0 {cw} {VIEW_H}"
				role="img"
				aria-label="Two activities overlaid"
				style="cursor: crosshair; touch-action: pan-y"
				on:pointermove={onMove}
				on:pointerdown={onDown}
				on:pointerup={clear}
				on:pointercancel={clear}
				on:pointerleave={() => clear()}
			>
				{#each yTicks as t}
					<line x1={PAD_L} y1={t.y} x2={cw - PAD_L} y2={t.y} stroke="var(--grid)" stroke-width="1" />
				{/each}
				<path d={pathA} fill="none" stroke={COLOR_A} stroke-width="1.9" stroke-linejoin="round" />
				<path d={pathB} fill="none" stroke={COLOR_B} stroke-width="1.9" stroke-linejoin="round" opacity="0.95" />
				{#if hover}
					<line x1={hover.px} y1={PAD_T} x2={hover.px} y2={BASE_Y} stroke="var(--ink2)" stroke-width="1" opacity="0.4" />
					{#if hover.a}<circle cx={hover.px} cy={hover.a.y} r="3.3" fill={COLOR_A} />{/if}
					{#if hover.b}<circle cx={hover.px} cy={hover.b.y} r="3.3" fill={COLOR_B} />{/if}
				{/if}
			</svg>
			{#each yTicks as t}
				<span class="axis-y oi-mono" style="top: {t.y}px">{t.label}</span>
			{/each}
			{#each xTicks as t}
				<span class="axis-x oi-mono" style="left: {(t.x / cw) * 100}%">{t.label}</span>
			{/each}
			{#if hover}
				<div class="chart-tip" style="left: {hover.leftPct}">
					<div class="tip-x oi-mono">{hover.xLabel}</div>
					{#if hover.a}
						<div class="tip-row"><span class="tip-dot" style="background: {COLOR_A}"></span><span class="oi-mono">{hover.a.val}</span></div>
					{/if}
					{#if hover.b}
						<div class="tip-row"><span class="tip-dot" style="background: {COLOR_B}"></span><span class="oi-mono">{hover.b.val}</span></div>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div class="chart-empty oi-mono">Neither activity has this metric.</div>
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
		gap: 12px;
		margin-bottom: 8px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}
	.legend {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink-soft);
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.swatch {
		width: 10px;
		height: 3px;
		border-radius: 2px;
		flex: none;
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
		top: 198px;
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
		min-width: 96px;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}
	.tip-x {
		font-size: 9.5px;
		color: #9bbaa8;
		margin-bottom: 6px;
	}
	.tip-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1.6;
	}
	.tip-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex: none;
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
		.legend-item {
			max-width: 130px;
		}
	}
</style>
