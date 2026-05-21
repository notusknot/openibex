<script lang="ts">
	type Sport = 'Bike' | 'Run' | 'Swim' | 'Strength' | 'Other';
	export let data: {
		sports: readonly Sport[];
		workout: {
			id: string;
			sport: Sport;
			scheduledDate: string;
			title: string;
			description: string | null;
			plannedDurationSec: number | null;
			plannedDistanceM: number | null;
			plannedLoad: number | null;
		};
	};
	export let form: { error?: string; success?: boolean } | null;
</script>

<h1>Edit planned workout</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}
{#if form?.success}
	<p class="success">Saved.</p>
{/if}

<form method="POST" action="?/update" class="card">
	<label>
		<span>Date</span>
		<input name="scheduledDate" type="date" value={data.workout.scheduledDate} required />
	</label>

	<label>
		<span>Sport</span>
		<select name="sport" required>
			{#each data.sports as s}
				<option value={s} selected={data.workout.sport === s}>{s}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Title</span>
		<input name="title" type="text" value={data.workout.title} required />
	</label>

	<label>
		<span>Description (optional)</span>
		<textarea name="description" rows="3">{data.workout.description ?? ''}</textarea>
	</label>

	<div class="grid2">
		<label>
			<span>Planned duration (sec)</span>
			<input
				name="plannedDurationSec"
				type="number"
				min="0"
				step="1"
				value={data.workout.plannedDurationSec ?? ''}
			/>
		</label>
		<label>
			<span>Planned distance (m)</span>
			<input
				name="plannedDistanceM"
				type="number"
				min="0"
				step="0.01"
				value={data.workout.plannedDistanceM ?? ''}
			/>
		</label>
	</div>

	<label>
		<span>Planned load (optional)</span>
		<input name="plannedLoad" type="number" min="0" step="0.01" value={data.workout.plannedLoad ?? ''} />
	</label>

	<div class="buttons">
		<button type="submit">Save</button>
		<a class="link" href="/calendar">Back</a>
	</div>
</form>

<form method="POST" action="?/delete" class="danger">
	<button type="submit" class="dangerButton">Delete</button>
</form>

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
	.success {
		color: #047857;
	}

	.danger {
		margin-top: 12px;
	}

	.dangerButton {
		border-color: #b91c1c;
		background: #b91c1c;
	}
</style>
