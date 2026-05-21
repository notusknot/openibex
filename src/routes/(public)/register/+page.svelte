<script lang="ts">
	export let data: { openRegistration: boolean };
	export let form: { error?: string } | null;
</script>

<h1>Register</h1>

<p>
	The first registered user becomes <strong>admin</strong>. After that, registration is disabled by
	default (set <code>OPEN_REGISTRATION=true</code> to allow additional users).
</p>

<p class="muted">
	Current config: <code>OPEN_REGISTRATION={data.openRegistration ? 'true' : 'false'}</code>
</p>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST" class="card">
	<label>
		<span>Email</span>
		<input name="email" type="email" autocomplete="email" required />
	</label>

	<label>
		<span>Display name (optional)</span>
		<input name="displayName" type="text" autocomplete="nickname" />
	</label>

	<label>
		<span>Password</span>
		<input name="password" type="password" autocomplete="new-password" required />
	</label>

	<button type="submit">Create account</button>
</form>

<p>
	Already have an account? <a href="/login">Login</a>.
</p>

<style>
	.card {
		display: grid;
		gap: 12px;
		max-width: 420px;
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
	}

	button {
		padding: 10px 12px;
		border: 1px solid #0f172a;
		border-radius: 10px;
		background: #0f172a;
		color: white;
		font-weight: 600;
		cursor: pointer;
	}

	.error {
		color: #b91c1c;
	}

	.muted {
		color: #475569;
	}
</style>
