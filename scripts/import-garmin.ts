import 'dotenv/config';

import path from 'node:path';

import { importGarminHistoricalExport } from '../src/lib/server/services/imports/garminImportService';

function parseArgs(argv: string[]): { userEmail: string; importPath: string } {
	const args = new Map<string, string>();
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		if (!a.startsWith('--')) continue;
		const key = a.slice(2);
		const val = argv[i + 1];
		if (val && !val.startsWith('--')) {
			args.set(key, val);
			i++;
		} else {
			args.set(key, 'true');
		}
	}
	const userEmail = args.get('user');
	const importPath = args.get('path');
	if (!userEmail) throw new Error('Missing required arg: --user user@example.com');
	if (!importPath) throw new Error('Missing required arg: --path /path/to/garmin-export');
	return { userEmail, importPath };
}

async function main() {
	const { userEmail, importPath } = parseArgs(process.argv.slice(2));
	const resolved = path.resolve(importPath);
	const result = await importGarminHistoricalExport({ userEmail, path: resolved });
	// Summary in a stable, grep-friendly format.
	console.log(`batch_id=${result.batchId}`);
	console.log(`total_files=${result.totalFiles}`);
	console.log(`processed_files=${result.processedFiles}`);
	console.log(`imported_count=${result.importedCount}`);
	console.log(`duplicate_count=${result.duplicateCount}`);
	console.log(`failed_count=${result.failedCount}`);
	console.log(`next=pnpm analytics:rebuild -- --user ${userEmail}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
