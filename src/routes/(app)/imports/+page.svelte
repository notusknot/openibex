<script lang="ts">
	export let data: {
		batches: Array<{
			id: string;
			source: string;
			originalName: string;
			status: string;
			totalFiles: number;
			processedFiles: number;
			importedCount: number;
			duplicateCount: number;
			failedCount: number;
			createdAt: Date;
			completedAt: Date | null;
		}>;
	};
</script>

<h1>Imports</h1>
<p class="subtle">Garmin exports and other bulk imports.</p>

{#if data.batches.length === 0}
	<div class="empty">
		<p>No imports yet.</p>
		<p class="subtle">Use the CLI: <code>pnpm import:garmin -- --user you@example.com --path /path/to/export</code></p>
	</div>
{:else}
	<div class="tableWrap" role="region" aria-label="Import batches">
		<table>
			<thead>
				<tr>
					<th>Created</th>
					<th>Source</th>
					<th>Name</th>
					<th>Status</th>
					<th>Progress</th>
					<th>Imported</th>
					<th>Duplicates</th>
					<th>Failed</th>
				</tr>
			</thead>
			<tbody>
				{#each data.batches as b}
					<tr>
						<td>{new Date(b.createdAt).toLocaleString()}</td>
						<td>{b.source}</td>
						<td><a href={`/imports/${b.id}`}>{b.originalName}</a></td>
						<td>{b.status}</td>
						<td>{b.processedFiles}/{b.totalFiles}</td>
						<td>{b.importedCount}</td>
						<td>{b.duplicateCount}</td>
						<td>{b.failedCount}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.subtle {
		color: #475569;
	}
	.empty {
		margin-top: 18px;
		padding: 16px;
		border: 1px dashed #cbd5e1;
		border-radius: 12px;
		background: #f8fafc;
	}
	.tableWrap {
		margin-top: 16px;
		overflow: auto;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 760px;
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
	a {
		color: inherit;
	}
	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 0.95em;
	}
@media (max-width: 640px) {
	table {
		min-width: 680px;
	}
}
</style>
