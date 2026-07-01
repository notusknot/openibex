<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { movingTimeIndices, type TrackPoint, type ActivityTrackMetrics } from '$lib/track';

	export let points: TrackPoint[];
	export let metrics: ActivityTrackMetrics;
	export let durationSec: number;
	export let hoverIndex: Writable<number | null>;

	// Geometry. The width is measured (bind:clientWidth) so the coordinate system
	// is 1 unit = 1 CSS px — otherwise a fixed viewBox stretched with
	// preserveAspectRatio="none" makes strokes and the hover dots squish/stretch
	// (ovals) at non-640px widths.
	const VIEW_H = 208;
	const PAD_L = 6;
	const PAD_T = 6;
	const INNER_H = 170;
	const BASE_Y = PAD_T + INNER_H;
	let cw = 640; // measured wrapper width; 640 default keeps SSR sensible pre-mount
	$: innerW = Math.max(1, cw - 2 * PAD_L);

	$: n = points.length;
	$: available = metrics.hr || metrics.pace;

	// Time-axis base. Moving (default) excludes paused time for the clean
	// Strava/intervals look; Elapsed plots wall-clock and shows pauses as gaps.
	let mode: 'moving' | 'elapsed' = 'moving';
	$: xVal = (p: TrackPoint): number => (mode === 'moving' ? p.tMoving : p.t);
	$: xMin = n > 0 ? xVal(points[0]!) : 0;
	$: xMax = n > 0 ? xVal(points[n - 1]!) : 0;
	$: xSpan = xMax - xMin;
	$: xAt = (i: number): number => {
		const frac = xSpan > 0 ? (xVal(points[i]!) - xMin) / xSpan : n > 1 ? i / (n - 1) : 0;
		return PAD_L + frac * innerW;
	};

	// Indices to draw. Moving mode drops paused (stalled-timer) samples so the line
	// collapses each pause to a point; elapsed mode draws every sample.
	$: drawIndices = mode === 'moving' ? movingTimeIndices(points) : points.map((_, i) => i);

	// Elapsed-mode pause detection: a wall-clock jump far larger than the local
	// cadence. Threshold scales off the median interval (adapts to 1 Hz vs. smart
	// recording) with a floor so tiny activities don't false-positive.
	$: gapThreshold = (() => {
		if (n < 3) return Infinity;
		const dts: number[] = [];
		for (let i = 1; i < n; i++) dts.push(points[i]!.t - points[i - 1]!.t);
		dts.sort((a, b) => a - b);
		const median = dts[Math.floor(dts.length / 2)] || 1;
		return Math.max(12, median * 5);
	})();
	const isGap = (i: number) => i > 0 && points[i]!.t - points[i - 1]!.t > gapThreshold;
	$: breakAt = (i: number) => mode === 'elapsed' && isGap(i);

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

	// Line builders: walk the drawn indices, lifting the pen on nulls and (elapsed
	// mode only) across pauses. Inline IIFEs so Svelte tracks mode/drawIndices/xAt.
	$: hrLine = (() => {
		if (!metrics.hr) return '';
		let d = '';
		let pen = false;
		for (const i of drawIndices) {
			const v = points[i]!.hr;
			if (v === null) {
				pen = false;
				continue;
			}
			if (breakAt(i)) pen = false;
			d += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)},${hrY(v).toFixed(1)} `;
			pen = true;
		}
		return d.trim();
	})();
	$: paceLine = (() => {
		if (!metrics.pace) return '';
		let d = '';
		let pen = false;
		for (const i of drawIndices) {
			const v = points[i]!.pace;
			if (v === null) {
				pen = false;
				continue;
			}
			if (breakAt(i)) pen = false;
			d += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)},${paceY(v).toFixed(1)} `;
			pen = true;
		}
		return d.trim();
	})();

	// Filled HR area, broken on nulls and (elapsed) pauses.
	$: hrArea = (() => {
		if (!metrics.hr) return '';
		let d = '';
		let run: number[] = [];
		const flush = () => {
			if (run.length > 0) {
				const first = run[0]!;
				const last = run[run.length - 1]!;
				d += `M${xAt(first).toFixed(1)},${BASE_Y} `;
				for (const i of run) d += `L${xAt(i).toFixed(1)},${hrY(points[i]!.hr!).toFixed(1)} `;
				d += `L${xAt(last).toFixed(1)},${BASE_Y} Z `;
			}
			run = [];
		};
		for (const i of drawIndices) {
			if (points[i]!.hr === null) {
				flush();
				continue;
			}
			if (breakAt(i)) flush();
			run.push(i);
		}
		flush();
		return d.trim();
	})();

	function fmtClock(sec: number): string {
		const s = Math.round(sec);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const ss = s % 60;
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
		return `${m}:${ss.toString().padStart(2, '0')}`;
	}

	// Shaded pause bands (elapsed mode only; moving mode has no gaps).
	$: gaps = (() => {
		const out: { fromX: number; midX: number; w: number; label: string }[] = [];
		if (mode !== 'elapsed') return out;
		for (let i = 1; i < n; i++) {
			if (!isGap(i)) continue;
			const fromX = xAt(i - 1);
			const toX = xAt(i);
			out.push({ fromX, midX: (fromX + toX) / 2, w: toX - fromX, label: `paused ${fmtClock(points[i]!.t - points[i - 1]!.t)}` });
		}
		return out;
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
		const di = drawIndices;
		if (di.length === 0 || durationSec <= 0) return out;
		for (let k = 0; k < 5; k++) {
			const i = di[Math.round((k / 4) * (di.length - 1))]!;
			out.push({ x: xAt(i), label: fmtClock(xVal(points[i]!)) });
		}
		return out;
	})();

	// Nearest drawn point to a pixel x (linear scan over the drawn indices).
	function nearestByX(px: number): number {
		let best = drawIndices[0] ?? 0;
		let bestD = Infinity;
		for (const i of drawIndices) {
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
	// Pointer events (not mousemove) so the crosshair tracks a finger dragged
	// across the chart on touch, not just discrete taps. clientX − rect.left is
	// used instead of offsetX because offsetX is unreliable under pointer capture.
	function onMove(e: PointerEvent) {
		if (n === 0) return;
		const target = e.currentTarget as SVGGraphicsElement;
		const rect = target.getBoundingClientRect();
		const css = rect.width || 1;
		pendingX = ((e.clientX - rect.left) / css) * cw;
		if (rafPending) return;
		rafPending = true;
		requestAnimationFrame(() => {
			rafPending = false;
			hoverIndex.set(nearestByX(pendingX));
		});
	}
	function onDown(e: PointerEvent) {
		// Capture so a horizontal scrub keeps delivering moves even if the finger
		// drifts off the svg; the browser still pans vertically (touch-action: pan-y)
		// and fires pointercancel, which releases us.
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		onMove(e);
	}
	function onUp(e: PointerEvent) {
		(e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
		hoverIndex.set(null);
	}

	$: hover = (() => {
		const i = $hoverIndex;
		if (i === null || i < 0 || i >= n) return null;
		const p = points[i]!;
		const x = xAt(i);
		return {
			x,
			leftPct: `${((x / cw) * 100).toFixed(2)}%`,
			hrY: p.hr !== null ? hrY(p.hr).toFixed(1) : null,
			paceY: p.pace !== null ? paceY(p.pace).toFixed(1) : null,
			time: fmtClock(xVal(p)),
			hr: p.hr !== null ? `${Math.round(p.hr)} bpm` : null,
			pace: p.pace !== null ? `${fmtPace(p.pace)}/km` : null
		};
	})();

	function fmtPace(secPerKm: number): string {
		const m = Math.floor(secPerKm / 60);
		const s = Math.round(secPerKm % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<div class="card chart-card">
	<div class="card-head">
		<div class="card-title">HR / pace</div>
		<div class="head-right">
			<div class="time-toggle" role="group" aria-label="Time axis">
				<button type="button" class="time-btn" class:active={mode === 'moving'} on:click={() => (mode = 'moving')}>Moving</button>
				<button type="button" class="time-btn" class:active={mode === 'elapsed'} on:click={() => (mode = 'elapsed')}>Elapsed</button>
			</div>
			<div class="chart-legend">
				{#if metrics.hr}
					<span class="legend-item"><span class="legend-swatch hr-swatch"></span>HR (bpm)</span>
				{/if}
				{#if metrics.pace}
					<span class="legend-item"><span class="legend-swatch pace-swatch"></span>Pace (/km)</span>
				{/if}
			</div>
		</div>
	</div>
	{#if available}
		<div class="chart-wrap" bind:clientWidth={cw}>
			<svg
				width="100%"
				height={VIEW_H}
				viewBox="0 0 {cw} {VIEW_H}"
				role="img"
				aria-label="Heart rate and pace over time"
				style="cursor: crosshair; touch-action: pan-y"
				on:pointermove={onMove}
				on:pointerdown={onDown}
				on:pointerup={onUp}
				on:pointercancel={onUp}
				on:pointerleave={() => hoverIndex.set(null)}
			>
				{#each gaps as g}
					<rect x={g.fromX} y={PAD_T} width={g.w} height={INNER_H} fill="var(--ink2)" opacity="0.05" />
					<line x1={g.midX} y1={PAD_T} x2={g.midX} y2={BASE_Y} stroke="var(--faint)" stroke-width="1" stroke-dasharray="3 3" opacity="0.7" />
				{/each}
				{#each gridLines as g}
					<line x1={PAD_L} y1={g.y} x2={cw - PAD_L} y2={g.y} stroke="var(--grid)" stroke-width="1" />
				{/each}
				{#if metrics.hr}
					<path d={hrArea} fill="var(--green)" opacity="0.06" />
					<path d={hrLine} fill="none" stroke="var(--green)" stroke-width="1.9" stroke-linejoin="round" />
				{/if}
				{#if metrics.pace}
					<path d={paceLine} fill="none" stroke="var(--bike)" stroke-width="1.5" stroke-linejoin="round" opacity="0.9" />
				{/if}
				{#if hover}
					<line x1={hover.x} y1={PAD_T} x2={hover.x} y2={BASE_Y} stroke="var(--ink2)" stroke-width="1" opacity="0.4" />
					{#if hover.hrY}<circle cx={hover.x} cy={hover.hrY} r="3.3" fill="var(--green)" />{/if}
					{#if hover.paceY}<circle cx={hover.x} cy={hover.paceY} r="3.3" fill="var(--bike)" />{/if}
				{/if}
			</svg>
			{#each gridLines as g}
				<span class="axis-y oi-mono" style="top: {g.y}px">{g.label}</span>
			{/each}
			{#each xLabels as x}
				<span class="axis-x oi-mono" style="left: {(x.x / cw) * 100}%">{x.label}</span>
			{/each}
			{#each gaps as g}
				{#if g.w >= 44}
					<span class="gap-label oi-mono" style="left: {(g.midX / cw) * 100}%">{g.label}</span>
				{/if}
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
	.head-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.time-toggle {
		display: inline-flex;
		gap: 2px;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 7px;
		padding: 2px;
	}
	.time-btn {
		font: 600 10px 'Archivo', system-ui, sans-serif;
		color: var(--muted);
		background: transparent;
		border: none;
		border-radius: 5px;
		padding: 3px 8px;
		cursor: pointer;
		line-height: 1.2;
	}
	.time-btn.active {
		color: var(--ink2);
		background: var(--card);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
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
	.gap-label {
		position: absolute;
		top: 4px;
		transform: translateX(-50%);
		font-size: 8.5px;
		color: var(--muted);
		line-height: 1;
		pointer-events: none;
		white-space: nowrap;
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
