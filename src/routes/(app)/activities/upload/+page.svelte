<script lang="ts">
	export let form: { error?: string } | null;

	let fileName = '';
	let fileSize = 0;

	function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		if (f) {
			fileName = f.name;
			fileSize = f.size;
		} else {
			fileName = '';
			fileSize = 0;
		}
	}

	function fmtKb(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}
</script>

<section class="upload">
	<header class="head">
		<a class="back" href="/activities" aria-label="Back to activities">‹</a>
		<div>
			<h1 class="title">Upload .fit</h1>
			<p class="subtitle oi-mono">A single Garmin/Wahoo FIT activity file</p>
		</div>
	</header>

	<form method="POST" enctype="multipart/form-data" class="card">
		<label class="dropzone" class:has-file={fileName.length > 0}>
			<input
				type="file"
				name="file"
				accept=".fit"
				on:change={onFileChange}
				required
			/>
			<div class="dropzone-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
			</div>
			{#if fileName}
				<div class="dropzone-main">{fileName}</div>
				<div class="dropzone-sub oi-mono">{fmtKb(fileSize)} · tap to choose another</div>
			{:else}
				<div class="dropzone-main">Choose a .fit file</div>
				<div class="dropzone-sub oi-mono">Tap to browse · max ~25 MB</div>
			{/if}
		</label>

		{#if form?.error}
			<div class="form-error">{form.error}</div>
		{/if}

		<footer class="form-foot">
			<a class="btn" href="/activities">Cancel</a>
			<button type="submit" class="btn btn-primary" disabled={!fileName}>
				Upload &amp; import
			</button>
		</footer>
	</form>

	<p class="footnote oi-mono">
		For large batches (e.g. a Garmin data export), use
		<code class="code">pnpm import:garmin</code>
		from the project root — much faster than one-at-a-time uploads.
	</p>
</section>

<style>
	.upload {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 560px;
	}

	.head {
		display: flex;
		align-items: flex-start;
		gap: 13px;
	}
	.back {
		margin-top: 3px;
		width: 30px;
		height: 30px;
		border-radius: 7px;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--btn-ink);
		font-size: 15px;
		line-height: 28px;
		text-align: center;
		text-decoration: none;
		flex: none;
	}
	.back:hover {
		color: var(--ink);
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
		margin: 6px 0 0;
	}

	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 28px 18px;
		border: 1px dashed var(--line);
		border-radius: 10px;
		background: var(--bg-soft);
		cursor: pointer;
		color: var(--muted);
		transition: border-color 120ms ease, background 120ms ease;
		text-align: center;
	}
	.dropzone:hover {
		border-color: var(--green);
		background: var(--bg-emphasis);
		color: var(--ink);
	}
	.dropzone.has-file {
		border-style: solid;
		border-color: var(--green);
		background: var(--bg-emphasis);
		color: var(--ink);
	}
	.dropzone:focus-within {
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(28, 93, 58, 0.1);
	}
	.dropzone input[type='file'] {
		position: absolute;
		opacity: 0;
		pointer-events: none;
		width: 0;
		height: 0;
	}
	.dropzone-icon {
		color: var(--green);
		margin-bottom: 4px;
	}
	.dropzone-main {
		font-size: 14px;
		font-weight: 600;
		color: var(--ink);
	}
	.dropzone-sub {
		font-size: 11px;
		color: var(--faint);
	}

	.form-error {
		font-size: 12px;
		color: var(--danger);
		background: var(--danger-bg);
		border-radius: 7px;
		padding: 9px 11px;
	}

	.form-foot {
		display: flex;
		justify-content: flex-end;
		gap: 9px;
	}
	.btn {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--btn-ink);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 10px 16px;
		cursor: pointer;
		text-decoration: none;
		line-height: 1.2;
	}
	.btn-primary {
		color: #fff;
		background: var(--green);
		border-color: transparent;
	}
	.btn-primary:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.footnote {
		font-size: 11px;
		color: var(--muted);
		margin: 0;
		line-height: 1.55;
	}
	.code {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		border-radius: 5px;
		padding: 1px 6px;
		font-size: 10.5px;
	}
</style>
