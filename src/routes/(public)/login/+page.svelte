<script lang="ts">
	export let form: { error?: string } | null;
</script>

<h1>Login</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST" class="card">
	<label>
		<span>Email</span>
		<input name="email" type="email" autocomplete="email" required />
	</label>

	<label>
		<span>Password</span>
		<input name="password" type="password" autocomplete="current-password" required />
	</label>

	<button type="submit">Login</button>
</form>

<p>
	No account yet? <a href="/register">Register</a>.
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
</style>

