<script lang="ts">
	import BackLink from '$lib/components/ui/BackLink.svelte';

	export let form: { error?: string } | null;
</script>

<section class="export">
	<header class="head">
		<BackLink fallback="/settings" fallbackLabel="settings" />
		<div>
			<h1 class="title">Data export</h1>
			<p class="subtitle oi-mono">A full archive of your activities and originals</p>
		</div>
	</header>

	<form method="POST" class="card">
		<div class="card-body">
			<div class="card-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="30" height="30">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
			</div>
			<div class="card-main">Generate a ZIP archive</div>
			<div class="card-sub oi-mono">
				JSON + CSV metadata for every activity, plus your original uploaded files.
			</div>
		</div>

		{#if form?.error}
			<div class="form-error">{form.error}</div>
		{/if}

		<footer class="form-foot">
			<a class="btn" href="/settings">Cancel</a>
			<button type="submit" class="btn btn-primary">Generate export</button>
		</footer>
	</form>
</section>

<style>
	.export {
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
	.card-body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 22px 18px;
		border: 1px dashed var(--line);
		border-radius: 10px;
		background: var(--bg-soft);
		text-align: center;
	}
	.card-icon {
		color: var(--green);
		margin-bottom: 4px;
	}
	.card-main {
		font-size: 14px;
		font-weight: 600;
		color: var(--ink);
	}
	.card-sub {
		font-size: 11px;
		color: var(--faint);
		line-height: 1.55;
		max-width: 360px;
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
</style>
