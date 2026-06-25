<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Writable } from 'svelte/store';
	import {
		nearestIndex,
		projectEquirectangular,
		type TrackPoint,
		type ActivityTrackMetrics,
		type TrackBounds,
		type XY
	} from '$lib/track';
	import { HR_ZONE_COLORS, hrZoneIndex } from '$lib/zones';
	import { theme } from '$lib/stores/theme';

	export let points: TrackPoint[];
	export let bounds: TrackBounds | null;
	export let metrics: ActivityTrackMetrics;
	export let maxHrRef: number | null;
	export let hasGps: boolean;
	export let hoverIndex: Writable<number | null>;

	const PAD = 12;

	type Metric = 'hr' | 'pace' | 'power' | 'zone';
	$: options = [
		metrics.hr ? { key: 'hr' as Metric, label: 'HR' } : null,
		metrics.pace ? { key: 'pace' as Metric, label: 'Pace' } : null,
		metrics.power ? { key: 'power' as Metric, label: 'Power' } : null,
		metrics.hr && maxHrRef ? { key: 'zone' as Metric, label: 'Zone' } : null
	].filter((o): o is { key: Metric; label: string } => o !== null);

	let metric: Metric = 'hr';
	// Keep the selection valid as available metrics change between activities.
	$: if (options.length > 0 && !options.some((o) => o.key === metric)) metric = options[0]!.key;

	// ── Canvas plumbing ──────────────────────────────────────────────────────
	// The track is drawn on a base <canvas> (re-rendered only on data/metric/
	// resize/theme changes) with the hover marker on a separate overlay canvas,
	// so mousemove never re-renders the thousands of track segments.
	let baseCanvas: HTMLCanvasElement;
	let overlayCanvas: HTMLCanvasElement;
	let baseCtx: CanvasRenderingContext2D | null = null;
	let overlayCtx: CanvasRenderingContext2D | null = null;
	let dpr = 1;
	let W = 0; // wrapper CSS width (px); also the projection target box
	let H = 0; // wrapper CSS height (px)

	// Canvas strokeStyle can't read CSS custom properties, so resolve the few
	// theme colors we need to concrete strings (re-read on each base render).
	let colFaint = '#9aa3a0';
	let colGreen = '#3c7a53';
	let colInk2 = '#1a1a1a';

	// Project points to local meters (centered on bounds), then fit the bounding
	// box into the live W×H canvas box, preserving aspect ratio (north up).
	$: screen = (() => {
		if (!bounds || points.length === 0 || W <= 2 * PAD || H <= 2 * PAD) return [] as XY[];
		const lat0 = (bounds.minLat + bounds.maxLat) / 2;
		const lng0 = (bounds.minLng + bounds.maxLng) / 2;
		const proj = points.map((p) => projectEquirectangular(p.lat ?? lat0, p.lng ?? lng0, lat0, lng0));
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (const q of proj) {
			minX = Math.min(minX, q.x);
			maxX = Math.max(maxX, q.x);
			minY = Math.min(minY, q.y);
			maxY = Math.max(maxY, q.y);
		}
		const spanX = Math.max(1e-6, maxX - minX);
		const spanY = Math.max(1e-6, maxY - minY);
		const availW = W - 2 * PAD;
		const availH = H - 2 * PAD;
		const scale = Math.min(availW / spanX, availH / spanY);
		const offX = PAD + (availW - spanX * scale) / 2;
		const offY = PAD + (availH - spanY * scale) / 2;
		// Canvas y grows downward, so invert latitude (north up).
		return proj.map((q) => ({ x: offX + (q.x - minX) * scale, y: offY + (maxY - q.y) * scale }));
	})();

	function metricValue(p: TrackPoint): number | null {
		if (metric === 'pace') return p.pace;
		if (metric === 'power') return p.power;
		return p.hr; // hr + zone both key off heart rate
	}

	$: metricRange = (() => {
		let min = Infinity;
		let max = -Infinity;
		for (const p of points) {
			const v = metricValue(p);
			if (v === null) continue;
			if (v < min) min = v;
			if (v > max) max = v;
		}
		if (!Number.isFinite(min)) return { min: 0, max: 1 };
		return { min, max: max === min ? min + 1 : max };
	})();

	// Intensity ramp reusing the app's hues: green (low) → amber → deep red (high).
	const RAMP: Array<[number, [number, number, number]]> = [
		[0, [0x3c, 0x7a, 0x53]],
		[0.5, [0xd2, 0xa0, 0x3a]],
		[1, [0x9a, 0x4b, 0x2e]]
	];
	function rampColor(t: number): string {
		const x = Math.max(0, Math.min(1, t));
		let a = RAMP[0]!;
		let b = RAMP[RAMP.length - 1]!;
		for (let i = 0; i < RAMP.length - 1; i++) {
			if (x >= RAMP[i]![0] && x <= RAMP[i + 1]![0]) {
				a = RAMP[i]!;
				b = RAMP[i + 1]!;
				break;
			}
		}
		const span = b[0] - a[0] || 1;
		const f = (x - a[0]) / span;
		const r = Math.round(a[1][0] + (b[1][0] - a[1][0]) * f);
		const g = Math.round(a[1][1] + (b[1][1] - a[1][1]) * f);
		const bl = Math.round(a[1][2] + (b[1][2] - a[1][2]) * f);
		return `rgb(${r}, ${g}, ${bl})`;
	}

	function segColor(p: TrackPoint): string {
		const v = metricValue(p);
		if (v === null) return colFaint;
		if (metric === 'zone') return HR_ZONE_COLORS[hrZoneIndex(v, maxHrRef ?? v)]!;
		let t = (v - metricRange.min) / (metricRange.max - metricRange.min);
		if (metric === 'pace') t = 1 - t; // lower sec/km = faster = hotter
		return rampColor(t);
	}

	$: marker = (() => {
		const i = $hoverIndex;
		if (i === null || i < 0 || i >= screen.length) return null;
		return screen[i]!;
	})();

	$: startPt = screen[0] ?? null;
	$: endPt = screen.length > 0 ? screen[screen.length - 1]! : null;

	function resolveColors() {
		if (!browser || !baseCanvas) return;
		const cs = getComputedStyle(baseCanvas);
		const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
		colFaint = get('--faint', colFaint);
		colGreen = get('--green', colGreen);
		colInk2 = get('--ink2', colInk2);
	}

	// Size the backing store to device pixels and draw in CSS px (crisp on HiDPI).
	function applySize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
		const pw = Math.max(1, Math.round(W * dpr));
		const ph = Math.max(1, Math.round(H * dpr));
		if (canvas.width !== pw) canvas.width = pw;
		if (canvas.height !== ph) canvas.height = ph;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function drawDot(ctx: CanvasRenderingContext2D, p: XY, fill: string) {
		ctx.beginPath();
		ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.lineWidth = 1.4;
		ctx.strokeStyle = '#fff';
		ctx.stroke();
	}

	function renderBase() {
		if (!baseCtx || !baseCanvas || W <= 0 || H <= 0) return;
		resolveColors();
		applySize(baseCanvas, baseCtx);
		baseCtx.clearRect(0, 0, W, H);
		if (screen.length < 2) return;
		baseCtx.lineWidth = 2.8;
		baseCtx.lineCap = 'round';
		baseCtx.lineJoin = 'round';
		for (let i = 1; i < screen.length; i++) {
			const a = screen[i - 1]!;
			const b = screen[i]!;
			baseCtx.strokeStyle = segColor(points[i]!);
			baseCtx.beginPath();
			baseCtx.moveTo(a.x, a.y);
			baseCtx.lineTo(b.x, b.y);
			baseCtx.stroke();
		}
		if (startPt) drawDot(baseCtx, startPt, colGreen);
		if (endPt) drawDot(baseCtx, endPt, colInk2);
	}

	function renderOverlay() {
		if (!overlayCtx || !overlayCanvas || W <= 0 || H <= 0) return;
		applySize(overlayCanvas, overlayCtx);
		overlayCtx.clearRect(0, 0, W, H);
		const m = marker;
		if (!m) return;
		overlayCtx.beginPath();
		overlayCtx.arc(m.x, m.y, 5, 0, Math.PI * 2);
		overlayCtx.lineWidth = 2;
		overlayCtx.strokeStyle = colInk2;
		overlayCtx.stroke();
		overlayCtx.beginPath();
		overlayCtx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
		overlayCtx.fillStyle = colInk2;
		overlayCtx.fill();
	}

	// Coalesce base redraws to one per frame; the rAF also lets a theme change
	// settle into the DOM before resolveColors() reads the new custom-prop values.
	let baseScheduled = false;
	function scheduleBase() {
		if (baseScheduled) return;
		baseScheduled = true;
		requestAnimationFrame(() => {
			baseScheduled = false;
			renderBase();
		});
	}

	// Imperative renders, driven reactively. Re-creating the deps array whenever
	// any input changes is what re-triggers the draw.
	$: baseDeps = [screen, metric, metricRange, maxHrRef, W, H, dpr, $theme];
	$: if (baseCtx && baseDeps) scheduleBase();
	$: overlayDeps = [marker, W, H, dpr, $theme];
	$: if (overlayCtx && overlayDeps) renderOverlay();

	onMount(() => {
		if (!browser) return;
		baseCtx = baseCanvas.getContext('2d');
		overlayCtx = overlayCanvas.getContext('2d');
		resolveColors();

		// Keep the bitmap resolution matched to devicePixelRatio. Page/browser zoom
		// changes devicePixelRatio *without* firing a resize, so without this the
		// canvas would be upscaled and look pixelated after zooming (SVG re-rasterizes
		// at every zoom level for free). A `(resolution: Xdppx)` media query fires
		// whenever the ratio moves; we update `dpr` (reactive → both layers redraw
		// crisp) and re-arm the listener at the new ratio.
		let mq: MediaQueryList | null = null;
		function onDprChange() {
			dpr = window.devicePixelRatio || 1;
			arm();
		}
		function arm() {
			mq?.removeEventListener('change', onDprChange);
			mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
			mq.addEventListener('change', onDprChange);
		}
		dpr = window.devicePixelRatio || 1;
		arm();
		scheduleBase();
		renderOverlay();

		return () => mq?.removeEventListener('change', onDprChange);
	});

	let rafPending = false;
	let pendingX = 0;
	let pendingY = 0;
	function onMove(e: MouseEvent) {
		if (screen.length === 0) return;
		// offsetX/Y are CSS px relative to the overlay canvas, which is exactly the
		// space `screen` is projected into — so they feed nearestIndex directly.
		pendingX = e.offsetX;
		pendingY = e.offsetY;
		if (rafPending) return;
		rafPending = true;
		requestAnimationFrame(() => {
			rafPending = false;
			hoverIndex.set(nearestIndex(screen, pendingX, pendingY));
		});
	}

	function fmtPace(secPerKm: number): string {
		const m = Math.floor(secPerKm / 60);
		const s = Math.round(secPerKm % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	$: rangeLabel = (() => {
		if (metric === 'zone') return 'Z1–Z5';
		const r = metricRange;
		if (metric === 'pace') return `${fmtPace(r.min)}–${fmtPace(r.max)} /km`;
		if (metric === 'power') return `${Math.round(r.min)}–${Math.round(r.max)} W`;
		return `${Math.round(r.min)}–${Math.round(r.max)} bpm`;
	})();
</script>

{#if hasGps}
	<div class="map-head">
		{#if options.length > 1}
			<div class="metric-toggle" role="group" aria-label="Color track by">
				{#each options as o}
					<button
						type="button"
						class="metric-btn"
						class:active={metric === o.key}
						on:click={() => (metric = o.key)}
					>
						{o.label}
					</button>
				{/each}
			</div>
		{/if}
		<span class="range-label oi-mono">{rangeLabel}</span>
	</div>
	<div class="map-wrap" bind:clientWidth={W} bind:clientHeight={H}>
		<canvas class="map-canvas" bind:this={baseCanvas} aria-label="GPS route colored by {metric}"></canvas>
		<canvas
			class="map-canvas map-overlay"
			bind:this={overlayCanvas}
			on:mousemove={onMove}
			on:mouseleave={() => hoverIndex.set(null)}
		></canvas>
	</div>
{:else}
	<div class="map-empty">
		<span class="map-empty-text oi-mono">No GPS data</span>
	</div>
{/if}

<style>
	.map-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
	}
	.metric-toggle {
		display: inline-flex;
		gap: 2px;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 7px;
		padding: 2px;
	}
	.metric-btn {
		font: 600 10px 'Archivo', system-ui, sans-serif;
		color: var(--muted);
		background: transparent;
		border: none;
		border-radius: 5px;
		padding: 3px 8px;
		cursor: pointer;
		line-height: 1.2;
	}
	.metric-btn.active {
		color: var(--ink2);
		background: var(--card);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	.range-label {
		font-size: 9px;
		color: var(--faint);
		white-space: nowrap;
	}
	.map-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 280 / 188;
		border-radius: 7px;
		border: 1px solid var(--line);
		background: var(--bg-soft);
		overflow: hidden;
	}
	.map-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.map-overlay {
		cursor: crosshair;
	}
	.map-empty {
		height: 148px;
		border-radius: 7px;
		border: 1px solid var(--line);
		background-image: repeating-linear-gradient(45deg, var(--bg-soft) 0 10px, var(--bg) 10px 20px);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.map-empty-text {
		font-size: 10px;
		color: var(--faint);
		letter-spacing: 0.04em;
	}
	@media (max-width: 639px) {
		.map-empty {
			height: 110px;
		}
	}
</style>
