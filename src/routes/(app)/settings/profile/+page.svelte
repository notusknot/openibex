<script lang="ts">
	export let data: { user: { email: string; role: string; displayName: string | null } };
	export let form: { error?: string; success?: boolean } | null;
</script>

<h1>Profile</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}
{#if form?.success}
	<p class="success">Saved.</p>
{/if}

<div class="card">
	<div class="row"><span class="label">Email</span> <span>{data.user.email}</span></div>
	<div class="row"><span class="label">Role</span> <span>{data.user.role}</span></div>
</div>

<h2>Edit display name</h2>
<form method="POST" class="card">
	<label>
		<span>Display name</span>
		<input name="displayName" type="text" value={data.user.displayName ?? ''} />
	</label>
	<button type="submit">Save</button>
</form>

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

	.row {
		display: flex;
		gap: 10px;
	}

	.label {
		min-width: 90px;
		color: #475569;
	}

	label {
		display: grid;
		gap: 6px;
	}

	input {
		padding: 10px 12px;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
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

	.error {
		color: #b91c1c;
	}
	.success {
		color: #047857;
	}
</style>
