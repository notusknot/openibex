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

	function fmtDate(d: Date): string {
		return new Date(d).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function statusKind(status: string): 'done' | 'running' | 'failed' | 'idle' {
		const s = status.toLowerCase();
		if (s.includes('complete') || s.includes('done') || s.includes('success')) return 'done';
		if (s.includes('fail') || s.includes('error')) return 'failed';
		if (s.includes('run') || s.includes('progress') || s.includes('pending')) return 'running';
		return 'idle';
	}
</script>

<section class="page">
	<header class="head">
		<div>
			<h1 class="title">Imports</h1>
			<p class="subtitle oi-mono">Garmin exports &amp; other bulk imports</p>
		</div>
	</header>

	{#if data.batches.length === 0}
		<div class="empty">
			<div class="empty-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
			</div>
			<div class="empty-main">No imports yet</div>
			<div class="empty-sub oi-mono">
				Bulk-import a Garmin export from the project root:
			</div>
			<code class="code">pnpm import:garmin -- --user you@example.com --path /path/to/export</code>
		</div>
	{:else}
		<div class="table-wrap" role="region" aria-label="Import batches">
			<div class="thead">
				<span class="th oi-mono">Created</span>
				<span class="th oi-mono">Name</span>
				<span class="th oi-mono">Status</span>
				<span class="th oi-mono right">Progress</span>
				<span class="th oi-mono right">Imported</span>
				<span class="th oi-mono right">Dup</span>
				<span class="th oi-mono right">Failed</span>
			</div>
			{#each data.batches as b}
				<a class="row" href={`/imports/${b.id}`} title={b.originalName}>
					<span class="cell-date oi-mono">{fmtDate(b.createdAt)}</span>
					<span class="cell-name">
						<span class="name-main">{b.originalName}</span>
						<span class="name-sub oi-mono">{b.source}</span>
					</span>
					<span class="cell-status">
						<span class="status-pill oi-mono status-{statusKind(b.status)}">{b.status}</span>
					</span>
					<span class="cell-num oi-mono">{b.processedFiles}/{b.totalFiles}</span>
					<span class="cell-num cell-imported oi-mono">{b.importedCount}</span>
					<span class="cell-num oi-mono">{b.duplicateCount}</span>
					<span class="cell-num oi-mono" class:cell-failed={b.failedCount > 0}>{b.failedCount}</span>
				</a>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.title {
		font-size: 22px;
		font-weight: 700;
		color: var(--ink2);
		line-height: 1;
		margin: 0;
	}
	.subtitle {
		font-size: 11px;
		color: var(--muted);
		margin: 5px 0 0;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		text-align: center;
		padding: 36px 20px;
		background: var(--card);
		border: 1px dashed var(--line);
		border-radius: 12px;
	}
	.empty-icon {
		color: var(--faint);
		margin-bottom: 2px;
	}
	.empty-main {
		font-size: 14px;
		font-weight: 600;
		color: var(--ink);
	}
	.empty-sub {
		font-size: 11px;
		color: var(--faint);
	}
	.code {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 6px 10px;
		font-size: 10.5px;
		color: var(--ink-soft);
		margin-top: 4px;
		max-width: 100%;
		overflow-x: auto;
	}

	.table-wrap {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		overflow: hidden;
	}
	.thead,
	.row {
		display: grid;
		grid-template-columns: 110px minmax(0, 1fr) 116px 72px 72px 52px 56px;
		align-items: center;
		padding: 0 14px;
	}
	.thead {
		border-bottom: 1px solid var(--line);
		background: var(--bg-soft);
	}
	.th {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--muted);
		text-transform: uppercase;
		font-weight: 600;
		padding: 10px 0;
	}
	.th.right {
		text-align: right;
	}

	.row {
		border-bottom: 1px solid var(--line);
		text-decoration: none;
		transition: background 120ms ease;
	}
	.row:last-child {
		border-bottom: none;
	}
	.row:hover {
		background: var(--bg-soft);
	}
	.cell-date {
		font-size: 11px;
		color: var(--ink-soft);
		padding: 11px 0;
	}
	.cell-name {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 9px 8px 9px 0;
		min-width: 0;
	}
	.name-main {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.name-sub {
		font-size: 9.5px;
		color: var(--faint);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.cell-status {
		padding: 11px 0;
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
	.cell-num {
		font-size: 11px;
		color: var(--ink-soft);
		padding: 11px 0;
		text-align: right;
	}
	.cell-imported {
		font-weight: 600;
		color: var(--ink2);
	}
	.cell-failed {
		color: var(--danger);
		font-weight: 600;
	}

	@media (max-width: 640px) {
		.thead,
		.row {
			grid-template-columns: 92px minmax(0, 1fr) 56px;
			padding: 0 12px;
		}
		/* Keep Created / Name / Imported. Drop Status, Progress, Dup, Failed. */
		.thead > :nth-child(3),
		.thead > :nth-child(4),
		.thead > :nth-child(6),
		.thead > :nth-child(7),
		.row > :nth-child(3),
		.row > :nth-child(4),
		.row > :nth-child(6),
		.row > :nth-child(7) {
			display: none;
		}
	}
</style>
