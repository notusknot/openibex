<script lang="ts">
	export let data: { openRegistration: boolean };
	export let form: { error?: string } | null;
</script>

<div class="auth">
	<div class="brand">
		<div class="logo oi-mono">OI</div>
		<div class="brand-text">
			<div class="brand-name">OpenIbex</div>
			<div class="brand-tag oi-mono">TRAINING COCKPIT</div>
		</div>
	</div>

	<div class="card">
		<header class="card-head">
			<div class="card-title">Create your account</div>
			<div class="card-sub oi-mono">
				First user becomes admin · open registration {data.openRegistration ? 'on' : 'off'}
			</div>
		</header>

		<form method="POST" class="form">
			<label class="field">
				<span class="field-label oi-mono">Email</span>
				<input
					class="oi-input"
					name="email"
					type="email"
					autocomplete="email"
					inputmode="email"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
					required
				/>
			</label>

			<label class="field">
				<span class="field-label oi-mono">Display name <span class="hint">optional</span></span>
				<input
					class="oi-input"
					name="displayName"
					type="text"
					autocomplete="nickname"
					maxlength="120"
				/>
			</label>

			<label class="field">
				<span class="field-label oi-mono">Password</span>
				<input class="oi-input" name="password" type="password" autocomplete="new-password" required />
			</label>

			{#if form?.error}
				<div class="form-error">{form.error}</div>
			{/if}

			<button type="submit" class="submit">Create account</button>
		</form>
	</div>

	<p class="alt-link">
		Already have one? <a href="/login">Sign in</a>
	</p>
</div>

<style>
	.auth {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		width: 100%;
		max-width: 380px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 4px;
	}
	.logo {
		width: 44px;
		height: 44px;
		border-radius: 10px;
		background: var(--gold);
		color: var(--ink2);
		font-size: 18px;
		font-weight: 700;
		line-height: 44px;
		text-align: center;
		flex: none;
	}
	.brand-text {
		text-align: left;
	}
	.brand-name {
		font-size: 18px;
		font-weight: 700;
		color: var(--ink2);
		line-height: 1;
	}
	.brand-tag {
		font-size: 9px;
		letter-spacing: 0.14em;
		color: var(--muted);
		margin-top: 4px;
	}

	.card {
		width: 100%;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 22px 22px 20px;
	}
	.card-head {
		margin-bottom: 16px;
	}
	.card-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--ink2);
	}
	.card-sub {
		font-size: 11px;
		color: var(--muted);
		margin-top: 4px;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 13px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.field-label {
		font-size: 9px;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.hint {
		color: var(--muted);
		text-transform: none;
		letter-spacing: 0;
		font-weight: 500;
	}
	.oi-input {
		font: 400 14px 'Archivo', system-ui, sans-serif;
		color: var(--ink);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 11px 12px;
		outline: none;
	}
	.oi-input:focus {
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(28, 93, 58, 0.1);
	}

	.submit {
		margin-top: 4px;
		font: 600 13px 'Archivo', system-ui, sans-serif;
		color: #fff;
		background: var(--green);
		border: none;
		border-radius: 8px;
		padding: 12px 16px;
		cursor: pointer;
	}
	.submit:hover {
		filter: brightness(1.05);
	}
	.submit:active {
		transform: scale(0.99);
	}

	.form-error {
		font-size: 12px;
		color: var(--danger);
		background: var(--danger-bg);
		border-radius: 7px;
		padding: 9px 11px;
	}

	.alt-link {
		font-size: 12.5px;
		color: var(--muted);
		margin: 0;
	}
	.alt-link a {
		color: var(--green);
		font-weight: 600;
		text-decoration: none;
	}
	.alt-link a:hover {
		text-decoration: underline;
	}
</style>
