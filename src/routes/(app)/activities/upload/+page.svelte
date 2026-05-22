<script lang="ts">
	export let form: { error?: string } | null;
</script>

<h1>Upload FIT</h1>
<p class="muted">Milestone 3 supports FIT uploads only (no GPX/TCX yet).</p>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST" enctype="multipart/form-data" class="card">
	<label>
		<span>FIT file</span>
		<input name="file" type="file" accept=".fit" required />
	</label>

	<button type="submit">Upload and import</button>
</form>

<p><a href="/activities">Back to activities</a></p>

<style>
	.card {
		display: grid;
		gap: 12px;
		max-width: 520px;
		padding: 16px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
	}

	label {
		display: grid;
		gap: 6px;
	}

	input {
		padding: 10px 12px;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
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

