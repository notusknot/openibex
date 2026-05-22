<script lang="ts">
	export let data: {
		activities: Array<{
			id: string;
			sport: string;
			title: string;
			startTime: Date;
			distanceM: number | null;
			durationSec: number | null;
		}>;
		importJobs: Array<{
			id: string;
			status: string;
			errorMessage: string | null;
			createdAt: Date;
		}>;
	};

	function fmtDistance(m: number | null) {
		if (m === null) return '';
		if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
		return `${Math.round(m)} m`;
	}

	function fmtDuration(sec: number | null) {
		if (sec === null) return '';
		const s = Math.round(sec);
		const h = Math.floor(s / 3600);
		const mm = Math.floor((s % 3600) / 60);
		return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
	}
</script>

<div class="headerRow">
	<h1>Activities</h1>
	<div class="actions">
		<a class="button" href="/activities/upload">Upload FIT</a>
	</div>
</div>

<h2>Recent imports</h2>
{#if data.importJobs.length === 0}
	<p class="muted">No imports yet.</p>
{:else}
	<ul class="imports">
		{#each data.importJobs as j}
			<li>
				<span class="status {j.status}">{j.status}</span>
				{#if j.errorMessage}
					<span class="error">{j.errorMessage}</span>
				{/if}
				<span class="muted">{new Date(j.createdAt).toLocaleString()}</span>
			</li>
		{/each}
	</ul>
{/if}

<h2>Recent activities</h2>
{#if data.activities.length === 0}
	<p class="muted">No activities yet.</p>
	<p><a class="buttonSecondary" href="/activities/upload">Upload your first FIT file</a></p>
{:else}
	<ul class="list">
		{#each data.activities as a}
			<li>
				<a href={`/activities/${a.id}`}>{a.title}</a>
				<span class="meta">
					{a.sport} · {new Date(a.startTime).toLocaleDateString()} {new Date(a.startTime).toLocaleTimeString()}
					{#if a.distanceM !== null} · {fmtDistance(a.distanceM)}{/if}
					{#if a.durationSec !== null} · {fmtDuration(a.durationSec)}{/if}
				</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.headerRow {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.button {
		padding: 10px 12px;
		border: 1px solid #0f172a;
		border-radius: 10px;
		background: #0f172a;
		color: white;
		text-decoration: none;
		font-weight: 600;
	}

	.buttonSecondary {
		padding: 10px 12px;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		background: white;
		color: #0f172a;
		text-decoration: none;
		font-weight: 600;
		display: inline-block;
	}

	.muted {
		color: #64748b;
	}

	.imports,
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 10px;
	}

	.imports li,
	.list li {
		padding: 12px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
		display: grid;
		gap: 6px;
	}

	.meta {
		color: #475569;
		font-size: 0.92rem;
	}

	.status {
		width: fit-content;
		padding: 2px 8px;
		border-radius: 999px;
		border: 1px solid #cbd5e1;
		font-size: 0.85rem;
		text-transform: lowercase;
	}

	.status.succeeded {
		border-color: #059669;
		color: #047857;
	}

	.status.failed {
		border-color: #b91c1c;
		color: #b91c1c;
	}

	.error {
		color: #b91c1c;
	}
</style>
