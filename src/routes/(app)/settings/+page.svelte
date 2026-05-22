<h1>Settings</h1>
<p class="muted">Manage your account and data.</p>
<div class="grid">
	<a class="card" href="/settings/profile">
		<div class="title">Profile</div>
		<div class="desc">Display name and account details.</div>
	</a>
	<a class="card" href="/settings/export">
		<div class="title">Data export</div>
		<div class="desc">Download a ZIP archive of your data and original uploads.</div>
	</a>
</div>

<style>
	.muted {
		color: #64748b;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
		margin-top: 12px;
	}
	.card {
		display: block;
		text-decoration: none;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
		padding: 14px;
	}
	.title {
		font-weight: 700;
	}
	.desc {
		margin-top: 6px;
		color: #475569;
	}
</style>
