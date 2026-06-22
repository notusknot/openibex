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

	const b = data.batch;
</script>

<div class="crumbs">
	<a href="/imports">Imports</a>
	<span aria-hidden="true">/</span>
	<span>{b.id}</span>
</div>

<h1>Import batch</h1>
<div class="meta">
	<div><span class="k">Source</span> {b.source}</div>
	<div><span class="k">Name</span> {b.originalName}</div>
	<div><span class="k">Status</span> {b.status}</div>
	<div><span class="k">Progress</span> {b.processedFiles}/{b.totalFiles}</div>
	<div><span class="k">Imported</span> {b.importedCount}</div>
	<div><span class="k">Duplicates</span> {b.duplicateCount}</div>
	<div><span class="k">Failed</span> {b.failedCount}</div>
</div>

{#if data.problemItems.length > 0}
	<h2>Failures</h2>
	<div class="tableWrap" role="region" aria-label="Failed import items">
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
						<td>{it.status}</td>
						<td class="mono">{it.sourcePath}</td>
						<td>{it.detectedFormat}</td>
						<td class="mono">{it.sha256}</td>
						<td>{it.errorMessage ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<h2>Items (latest 500)</h2>
<div class="tableWrap" role="region" aria-label="Import items">
	<table>
		<thead>
			<tr>
				<th>Status</th>
				<th>File</th>
				<th>Format</th>
				<th>Size</th>
				<th>SHA-256</th>
				<th>Activity</th>
			</tr>
		</thead>
		<tbody>
			{#each data.items as it}
				<tr>
					<td>{it.status}</td>
					<td class="mono">{it.sourcePath}</td>
					<td>{it.detectedFormat}</td>
					<td>{(it.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</td>
					<td class="mono">{it.sha256}</td>
					<td>
						{#if it.activityId}
							<a href={`/activities/${it.activityId}`}>Open</a>
						{:else}
							—
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.crumbs {
		display: flex;
		gap: 8px;
		align-items: center;
		color: #475569;
		margin-bottom: 10px;
	}
	.crumbs a {
		color: inherit;
	}
	.meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 10px;
		padding: 12px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
		margin: 14px 0;
	}
	.k {
		font-weight: 700;
		margin-right: 6px;
	}
	.tableWrap {
		margin-top: 10px;
		overflow: auto;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 980px;
	}
	th,
	td {
		text-align: left;
		padding: 10px 12px;
		border-bottom: 1px solid #e2e8f0;
		vertical-align: top;
	}
	th {
		font-weight: 700;
		background: #f8fafc;
		position: sticky;
		top: 0;
	}
	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 0.92em;
		white-space: nowrap;
	}
@media (max-width: 640px) {
	table {
		min-width: 860px;
	}
}
</style>
