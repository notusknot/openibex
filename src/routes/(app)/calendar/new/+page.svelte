<script lang="ts">
	type Sport = 'Bike' | 'Run' | 'Swim' | 'Strength' | 'Other';
	export let data: { sports: readonly Sport[]; initialDate: string };
	export let form: { error?: string } | null;
</script>

<h1>New planned workout</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST" class="card">
	<label>
		<span>Date</span>
		<input name="scheduledDate" type="date" value={data.initialDate} required />
	</label>

	<label>
		<span>Sport</span>
		<select name="sport" required>
			{#each data.sports as s}
				<option value={s}>{s}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Title</span>
		<input name="title" type="text" required />
	</label>

	<label>
		<span>Description (optional)</span>
		<textarea name="description" rows="3"></textarea>
	</label>

	<div class="grid2">
		<label>
			<span>Planned duration (sec)</span>
			<input name="plannedDurationSec" type="number" min="0" step="1" />
		</label>
		<label>
			<span>Planned distance (m)</span>
			<input name="plannedDistanceM" type="number" min="0" step="0.01" />
		</label>
	</div>

	<label>
		<span>Planned load (optional)</span>
		<input name="plannedLoad" type="number" min="0" step="0.01" />
	</label>

	<div class="buttons">
		<button type="submit">Create</button>
		<a class="link" href="/calendar">Cancel</a>
	</div>
</form>

<style>
	.card {
		display: grid;
		gap: 12px;
		max-width: 560px;
		margin-inline: auto;
		padding: 16px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
	}

	label {
		display: grid;
		gap: 6px;
	}

	input,
	select,
	textarea {
		padding: 10px 12px;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		background: white;
	}

	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.buttons {
		display: flex;
		gap: 10px;
		align-items: center;
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

	.link {
		color: #334155;
	}

	.error {
		color: #b91c1c;
	}
</style>
