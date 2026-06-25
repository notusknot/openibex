<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { TrackPoint } from '$lib/track';
	import { elevationLabel, elevationUnit, type Units } from '$lib/units';

	export let points: TrackPoint[];
	export let units: Units;
	export let hoverIndex: Writable<number | null>;

	const VIEW_H = 96;
	const PAD_L = 6;
	const PAD_T = 6;
	const INNER_H = 70;
	const BASE_Y = PAD_T + INNER_H;
	// Measured width so 1 unit = 1 CSS px (no preserveAspectRatio="none" stretch).
	let cw = 640;
	$: innerW = Math.max(1, cw - 2 * PAD_L);

	$: n = points.length;

	// x-axis by cumulative distance when available and increasing (a climb reads
	// more naturally against distance, and paused/stationary time doesn't smear),
	// else by elapsed time.
	$: hasDistance = n > 1 && points[0]!.distance !== null && points[n - 1]!.distance !== null;
	$: xKey = (p: TrackPoint): number => (hasDistance ? (p.distance ?? 0) : p.t);
	$: xMin = n > 0 ? xKey(points[0]!) : 0;
	$: xSpan = n > 0 ? xKey(points[n - 1]!) - xMin : 0;
	$: xAt = (i: number): number => {
		const frac = xSpan > 0 ? (xKey(points[i]!) - xMin) / xSpan : n > 1 ? i / (n - 1) : 0;
		return PAD_L + frac * innerW;
	};

	$: elevRange = (() => {
		let mn = Infinity;
		let mx = -Infinity;
		for (const p of points) {
			if (p.elevation === null) continue;
			if (p.elevation < mn) mn = p.elevation;
			if (p.elevation > mx) mx = p.elevation;
		}
		if (!Number.isFinite(mn)) return { min: 0, max: 1 };
		const padV = Math.max(2, (mx - mn) * 0.08);
		mn -= padV;
		mx += padV;
		return { min: mn, max: mx === mn ? mx + 1 : mx };
	})();

	const elevY = (v: number) =>
		PAD_T + ((elevRange.max - v) / (elevRange.max - elevRange.min)) * INNER_H;

	$: elevArea = (() => {
		const seg: string[] = [];
		let firstX: number | null = null;
		let lastX = PAD_L;
		for (let i = 0; i < n; i++) {
			const v = points[i]!.elevation;
			if (v === null) continue;
			const x = xAt(i);
			if (firstX === null) firstX = x;
			lastX = x;
			seg.push(`L${x.toFixed(1)},${elevY(v).toFixed(1)}`);
		}
		if (firstX === null) return '';
		return `M${firstX.toFixed(1)},${BASE_Y} ${seg.join(' ')} L${lastX.toFixed(1)},${BASE_Y} Z`;
	})();

	$: elevLine = (() => {
		let d = '';
		let pen = false;
		for (let i = 0; i < n; i++) {
			const v = points[i]!.elevation;
			if (v === null) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)},${elevY(v).toFixed(1)} `;
			pen = true;
		}
		return d.trim();
	})();

	$: gridLines = (() => {
		const out: { y: string; label: string }[] = [];
		for (let k = 0; k <= 2; k++) {
			const v = elevRange.min + ((elevRange.max - elevRange.min) * (2 - k)) / 2;
			out.push({ y: elevY(v).toFixed(1), label: elevationLabel(v, units) });
		}
		return out;
	})();

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
		pendingX = (e.offsetX / css) * cw;
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
		const leftPct = `${((x / cw) * 100).toFixed(2)}%`;
		if (p.elevation === null) return { x, leftPct, y: null, val: null };
		return {
			x,
			leftPct,
			y: elevY(p.elevation).toFixed(1),
			val: `${elevationLabel(p.elevation, units)} ${elevationUnit(units)}`
		};
	})();
</script>

<div class="card elev-card">
	<div class="card-head">
		<div class="card-title">Elevation</div>
		<span class="elev-unit oi-mono">{elevationUnit(units)}</span>
	</div>
	<div class="chart-wrap" bind:clientWidth={cw}>
		<svg
			width="100%"
			height={VIEW_H}
			viewBox="0 0 {cw} {VIEW_H}"
			role="img"
			aria-label="Elevation profile"
			style="cursor: crosshair"
			on:mousemove={onMove}
			on:mouseleave={() => hoverIndex.set(null)}
		>
			{#each gridLines as g}
				<line x1={PAD_L} y1={g.y} x2={cw - PAD_L} y2={g.y} stroke="var(--grid)" stroke-width="1" />
			{/each}
			<path d={elevArea} fill="var(--ink2)" opacity="0.07" />
			<path d={elevLine} fill="none" stroke="var(--ink2)" stroke-width="1.6" stroke-linejoin="round" opacity="0.75" />
			{#if hover}
				<line x1={hover.x} y1={PAD_T} x2={hover.x} y2={BASE_Y} stroke="var(--ink2)" stroke-width="1" opacity="0.4" />
				{#if hover.y}<circle cx={hover.x} cy={hover.y} r="3" fill="var(--ink2)" />{/if}
			{/if}
		</svg>
		{#each gridLines as g}
			<span class="axis-y oi-mono" style="top: {g.y}px">{g.label}</span>
		{/each}
		{#if hover?.val}
			<div class="elev-tip oi-mono" style="left: {hover.leftPct}">{hover.val}</div>
		{/if}
	</div>
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
		align-items: baseline;
		margin-bottom: 8px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}
	.elev-unit {
		font-size: 9px;
		color: var(--faint);
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
	.elev-tip {
		position: absolute;
		top: -2px;
		transform: translateX(-50%);
		pointer-events: none;
		background: var(--tip);
		color: #fff;
		border-radius: 5px;
		padding: 3px 7px;
		font-size: 10px;
		font-weight: 600;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}
	@media (max-width: 639px) {
		.card {
			padding: 12px 13px;
		}
	}
</style>
