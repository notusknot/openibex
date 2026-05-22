<script lang="ts">
	export let form: { error?: string } | null;
</script>

<h1>Data export</h1>
<p class="muted">
	Generates a ZIP archive containing JSON/CSV metadata and your original uploaded files.
</p>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST" class="card">
	<button type="submit">Generate export</button>
</form>

<p><a href="/settings">Back to settings</a></p>

<style>
	.card {
		display: grid;
		gap: 12px;
		max-width: 560px;
		padding: 16px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
	}

	button {
		padding: 10px 12px;
		border: 1px solid #0f172a;
		border-radius: 10px;
		background: #0f172a;
		color: white;
		font-weight: 600;
		cursor: pointer;
		width: fit-content;
	}

	.muted {
		color: #64748b;
	}

	.error {
		color: #b91c1c;
	}
</style>
