<script lang="ts">
	export let data: {
		batch: {
			id: string;
			source: string;
			originalName: string;
			status: string;
			totalFiles: number;
			processedFiles: number;
			importedCount: number;
			duplicateCount: number;
			failedCount: number;
			startedAt: Date | null;
			completedAt: Date | null;
			createdAt: Date;
		};
		items: Array<{
			id: string;
			sourcePath: string;
			originalFilename: string;
			detectedFormat: string;
			fileSizeBytes: number;
			sha256: string;
			status: string;
			activityId: string | null;
			errorMessage: string | null;
			createdAt: Date;
		}>;
		problemItems: Array<{
			id: string;
			sourcePath: string;
			originalFilename: string;
			detectedFormat: string;
			sha256: string;
			status: string;
			errorMessage: string | null;
		}>;
	};

	import BackLink from '$lib/components/ui/BackLink.svelte';

	const b = data.batch;

	$: stats = [
		{ label: 'Progress', val: `${b.processedFiles}/${b.totalFiles}`, accent: 'var(--green)' },
		{ label: 'Imported', val: String(b.importedCount), accent: 'var(--run)' },
		{ label: 'Duplicates', val: String(b.duplicateCount), accent: 'var(--c-form, #b4791f)' },
		{ label: 'Failed', val: String(b.failedCount), accent: 'var(--danger)' }
	];

	function statusKind(status: string): 'done' | 'running' | 'failed' | 'idle' {
		const s = status.toLowerCase();
		if (s.includes('import') || s.includes('complete') || s.includes('done') || s.includes('success'))
			return 'done';
		if (s.includes('fail') || s.includes('error')) return 'failed';
		if (s.includes('dup') || s.includes('skip')) return 'idle';
		if (s.includes('run') || s.includes('progress') || s.includes('pending')) return 'running';
		return 'idle';
	}

	function shortSha(sha: string): string {
		return sha.slice(0, 12);
	}
</script>

<section class="detail">
	<header class="head">
		<BackLink fallback="/imports" fallbackLabel="imports" />
		<div>
			<div class="title-row">
				<h1 class="title">{b.originalName}</h1>
				<span class="status-pill oi-mono status-{statusKind(b.status)}">{b.status}</span>
			</div>
			<p class="subtitle oi-mono">{b.source} · {b.id}</p>
		</div>
	</header>

	<div class="stats-strip">
		{#each stats as s}
			<div class="stat-card" style="border-top-color: {s.accent}">
				<div class="stat-label oi-mono">{s.label}</div>
				<div class="stat-val oi-mono">{s.val}</div>
			</div>
		{/each}
	</div>

	{#if data.problemItems.length > 0}
		<div class="card">
			<div class="card-head">
				<div class="card-title">Failures</div>
				<span class="card-count oi-mono">{data.problemItems.length}</span>
			</div>
			<div class="table-scroll" role="region" aria-label="Failed import items">
				<table>
					<thead>
						<tr>
							<th>Status</th>
							<th>File</th>
							<th>Format</th>
							<th>SHA-256</th>
							<th>Error</th>
						</tr>
					</thead>
					<tbody>
						{#each data.problemItems as it}
							<tr>
								<td>
									<span class="status-pill oi-mono status-{statusKind(it.status)}">{it.status}</span>
								</td>
								<td class="mono" title={it.sourcePath}>{it.sourcePath}</td>
								<td class="oi-mono dim">{it.detectedFormat}</td>
								<td class="mono dim" title={it.sha256}>{shortSha(it.sha256)}</td>
								<td class="err">{it.errorMessage ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<div class="card">
		<div class="card-head">
			<div class="card-title">Items</div>
			<span class="card-count oi-mono">latest {data.items.length}</span>
		</div>
		<div class="table-scroll" role="region" aria-label="Import items">
			<table>
				<thead>
					<tr>
						<th>Status</th>
						<th>File</th>
						<th>Format</th>
						<th class="right">Size</th>
						<th>SHA-256</th>
						<th>Activity</th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as it}
						<tr>
							<td>
								<span class="status-pill oi-mono status-{statusKind(it.status)}">{it.status}</span>
							</td>
							<td class="mono" title={it.sourcePath}>{it.sourcePath}</td>
							<td class="oi-mono dim">{it.detectedFormat}</td>
							<td class="oi-mono right">{(it.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</td>
							<td class="mono dim" title={it.sha256}>{shortSha(it.sha256)}</td>
							<td>
								{#if it.activityId}
									<a class="open-link" href={`/activities/${it.activityId}`}>Open</a>
								{:else}
									<span class="dim">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: 13px;
	}

	.head {
		display: flex;
		align-items: flex-start;
		gap: 13px;
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.title {
		font-size: 22px;
		font-weight: 700;
		color: var(--ink2);
		line-height: 1.05;
		margin: 0;
		word-break: break-word;
	}
	.subtitle {
		font-size: 11px;
		color: var(--muted);
		margin: 6px 0 0;
		word-break: break-all;
	}

	.stats-strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.stat-card {
		background: var(--card);
		border: 1px solid var(--line);
		border-top: 2px solid var(--green);
		border-radius: 8px;
		padding: 11px 13px;
		min-width: 0;
	}
	.stat-label {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.stat-val {
		font-size: 20px;
		font-weight: 600;
		color: var(--ink);
		margin-top: 6px;
		line-height: 1;
	}

	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 14px 16px;
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 10px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}
	.card-count {
		font-size: 9.5px;
		color: var(--faint);
	}

	.table-scroll {
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: 8px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 760px;
	}
	th,
	td {
		text-align: left;
		padding: 9px 12px;
		border-bottom: 1px solid var(--line);
		vertical-align: middle;
		font-size: 11px;
		color: var(--ink-soft);
	}
	th {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		font-weight: 600;
		color: var(--muted);
		background: var(--bg-soft);
		position: sticky;
		top: 0;
	}
	th.right,
	td.right {
		text-align: right;
	}
	tr:last-child td {
		border-bottom: none;
	}
	.mono {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 10.5px;
		white-space: nowrap;
		max-width: 280px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dim {
		color: var(--faint);
	}
	.err {
		color: var(--danger);
		max-width: 320px;
	}
	.open-link {
		color: var(--green);
		font-weight: 600;
		text-decoration: none;
	}
	.open-link:hover {
		text-decoration: underline;
	}

	.status-pill {
		font-size: 9px;
		font-weight: 600;
		border-radius: 4px;
		padding: 3px 7px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.status-done {
		color: var(--green);
		background: var(--run-soft);
	}
	.status-running {
		color: var(--c-form, #b4791f);
		background: var(--bg-emphasis);
	}
	.status-failed {
		color: var(--danger);
		background: var(--danger-bg);
	}
	.status-idle {
		color: var(--muted);
		background: var(--bg-soft);
	}

	@media (max-width: 639px) {
		.stats-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 6px;
		}
	}
</style>
