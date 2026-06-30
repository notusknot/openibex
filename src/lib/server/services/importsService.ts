import {
	getImportBatchForUser,
	listImportBatchesForUser,
	type DbImportBatch
} from '$lib/server/repositories/importBatchesRepository';
import {
	listImportItemsForBatchUser,
	listProblemImportItemsForBatchUser,
	type DbImportItem
} from '$lib/server/repositories/importItemsRepository';

// Read side of the bulk-import history. Keeps the imports routes on the
// route → service → repository path instead of importing repositories directly.

export async function listImportsForUser(userId: string, limit = 100): Promise<DbImportBatch[]> {
	return listImportBatchesForUser(userId, limit);
}

export type ImportDetail = {
	batch: DbImportBatch;
	items: DbImportItem[];
	problemItems: DbImportItem[];
};

/** Batch + its items (and the failed/unsupported subset) for the detail page, or
 * null if the batch doesn't exist or isn't owned by the user. */
export async function getImportDetailForUser(
	userId: string,
	batchId: string
): Promise<ImportDetail | null> {
	const batch = await getImportBatchForUser(batchId, userId);
	if (!batch) return null;
	const [items, problemItems] = await Promise.all([
		listImportItemsForBatchUser({ batchId: batch.id, userId, limit: 500 }),
		listProblemImportItemsForBatchUser({ batchId: batch.id, userId, limit: 200 })
	]);
	return { batch, items, problemItems };
}
