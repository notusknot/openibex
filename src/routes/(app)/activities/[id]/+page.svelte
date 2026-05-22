<script lang="ts">
	export let data: {
		activity: {
			id: string;
			sport: string;
			title: string;
			startTime: Date;
			durationSec: number | null;
			distanceM: number | null;
			elevationGainM: number | null;
			avgHr: number | null;
			maxHr: number | null;
			avgPowerW: number | null;
			maxPowerW: number | null;
			avgCadence: number | null;
			calories: number | null;
			parserVersion: string | null;
		};
		file: { id: string; originalFilename: string; sha256: string; sizeBytes: number } | null;
		link: { matchType: string; durationCompliance: number | null; distanceCompliance: number | null; loadCompliance: number | null } | null;
		planned: { id: string; title: string; scheduledDate: string } | null;
	};

	function fmtDistance(m: number | null) {
		if (m === null) return '—';
		return `${(m / 1000).toFixed(2)} km`;
	}

	function fmtDuration(sec: number | null) {
		if (sec === null) return '—';
		const s = Math.round(sec);
		const h = Math.floor(s / 3600);
		const mm = Math.floor((s % 3600) / 60);
		const ss = s % 60;
		return h > 0 ? `${h}h ${mm}m ${ss}s` : `${mm}m ${ss}s`;
	}

	function pct(v: number | null) {
		if (v === null) return '—';
		return `${Math.round(v * 100)}%`;
	}
</script>

<div class="headerRow">
	<h1>{data.activity.title}</h1>
	<div class="actions">
		<a class="link" href="/activities">Back</a>
	</div>
</div>

<div class="card">
	<div class="row"><span class="label">Sport</span> <span>{data.activity.sport}</span></div>
	<div class="row"><span class="label">Start</span> <span>{new Date(data.activity.startTime).toLocaleString()}</span></div>
	<div class="row"><span class="label">Duration</span> <span>{fmtDuration(data.activity.durationSec)}</span></div>
	<div class="row"><span class="label">Distance</span> <span>{fmtDistance(data.activity.distanceM)}</span></div>
	<div class="row"><span class="label">Elevation</span> <span>{data.activity.elevationGainM ?? '—'}</span></div>
	<div class="row"><span class="label">Avg HR</span> <span>{data.activity.avgHr ?? '—'}</span></div>
	<div class="row"><span class="label">Max HR</span> <span>{data.activity.maxHr ?? '—'}</span></div>
	<div class="row"><span class="label">Avg Power</span> <span>{data.activity.avgPowerW ?? '—'}</span></div>
	<div class="row"><span class="label">Max Power</span> <span>{data.activity.maxPowerW ?? '—'}</span></div>
	<div class="row"><span class="label">Avg Cadence</span> <span>{data.activity.avgCadence ?? '—'}</span></div>
	<div class="row"><span class="label">Calories</span> <span>{data.activity.calories ?? '—'}</span></div>
	<div class="row"><span class="label">Parser</span> <span>{data.activity.parserVersion ?? '—'}</span></div>
</div>

<h2>Original file</h2>
{#if data.file}
	<div class="card">
		<div class="row"><span class="label">Filename</span> <span>{data.file.originalFilename}</span></div>
		<div class="row"><span class="label">SHA-256</span> <span class="mono">{data.file.sha256}</span></div>
		<div class="row"><span class="label">Size</span> <span>{data.file.sizeBytes} bytes</span></div>
		<a class="button" href={`/activities/files/${data.file.id}/download`}>Download</a>
	</div>
{:else}
	<p class="muted">No original file attached.</p>
{/if}

<h2>Planned workout match</h2>
{#if data.link && data.planned}
	<div class="card">
		<p>
			Linked (<strong>{data.link.matchType}</strong>) to planned workout
			<a href={`/calendar/${data.planned.id}/edit`}>{data.planned.title}</a>
			({data.planned.scheduledDate}).
		</p>
		<p class="muted">
			Compliance: duration {pct(data.link.durationCompliance)}, distance {pct(data.link.distanceCompliance)}, load
			{pct(data.link.loadCompliance)}
		</p>
		<form method="POST" action="?/unlink">
			<button type="submit" class="dangerButton">Unlink</button>
		</form>
	</div>
{:else}
	<p class="muted">Not linked to a planned workout.</p>
{/if}

<style>
	.headerRow {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.card {
		display: grid;
		gap: 10px;
		max-width: 720px;
		padding: 16px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
	}

	.row {
		display: flex;
		gap: 10px;
	}

	.label {
		min-width: 110px;
		color: #475569;
	}

	.muted {
		color: #64748b;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.9rem;
	}

	.button {
		padding: 10px 12px;
		border: 1px solid #0f172a;
		border-radius: 10px;
		background: #0f172a;
		color: white;
		text-decoration: none;
		font-weight: 600;
		width: fit-content;
	}

	.dangerButton {
		padding: 10px 12px;
		border: 1px solid #b91c1c;
		border-radius: 10px;
		background: #b91c1c;
		color: white;
		font-weight: 600;
		cursor: pointer;
		width: fit-content;
	}

	.link {
		color: #334155;
	}
</style>
