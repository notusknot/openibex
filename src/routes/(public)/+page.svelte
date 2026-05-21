<script lang="ts">
	export let data: { user: { email: string; displayName: string | null } | null };
</script>

<h1>Welcome to OpenIbex</h1>
<p>
	OpenIbex is a self-hosted training platform for endurance athletes. Milestone 1 adds local
	email/password authentication and a basic authenticated app shell.
</p>

{#if data.user}
	<p>
		Signed in as <strong>{data.user.displayName ?? data.user.email}</strong>. Go to your
		<a href="/dashboard">dashboard</a>.
	</p>
{:else}
	<p>
		<a href="/register">Create the first account</a> (first user becomes admin), or
		<a href="/login">log in</a>.
	</p>
{/if}

