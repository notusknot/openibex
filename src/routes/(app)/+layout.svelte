<script lang="ts">
	export let data: { user: { email: string; displayName: string | null; role: string } };

	const title = 'OpenIbex';
	const userLabel = data.user.displayName ?? data.user.email;
</script>

<div class="appShell">
	<a class="skip" href="#main">Skip to content</a>
	<header class="header">
		<div class="left">
			<a class="brand" href="/dashboard">{title}</a>
			<nav class="nav" aria-label="Primary">
				<a href="/dashboard">Dashboard</a>
				<a href="/calendar">Calendar</a>
				<a href="/activities">Activities</a>
				<a href="/imports">Imports</a>
				<a href="/analytics">Analytics</a>
				<a href="/settings">Settings</a>
			</nav>
		</div>
		<div class="right">
			<div class="user">{userLabel}</div>
			<form method="POST" action="/logout">
				<button type="submit">Logout</button>
			</form>
		</div>
	</header>

	<main class="main" id="main" tabindex="-1">
		<slot />
	</main>
</div>

<style>
	.appShell {
		min-height: 100vh;
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.skip {
		position: absolute;
		left: -999px;
		top: 8px;
		background: white;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		padding: 8px 10px;
	}
	.skip:focus {
		left: 8px;
		z-index: 10;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid #e2e8f0;
		background: white;
		gap: 12px;
	}

	.left {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	.brand {
		font-weight: 800;
		text-decoration: none;
	}

	.nav {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.user {
		color: #334155;
		font-size: 0.95rem;
	}

	button {
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid #cbd5e1;
		background: white;
		cursor: pointer;
	}

	.main {
		padding: 24px 20px;
		max-width: 960px;
		width: 100%;
		margin: 0 auto;
	}
</style>
