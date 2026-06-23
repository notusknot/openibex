import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

import { getEnv } from '../src/lib/server/env';
import {
	deleteActivityForUser,
	listAllActivitiesForUser
} from '../src/lib/server/repositories/activitiesRepository';
import {
	deleteActivityFileForUser,
	getActivityFileByIdForUser
} from '../src/lib/server/repositories/activityFilesRepository';
import { getUserByEmail } from '../src/lib/server/repositories/usersRepository';

type Args = {
	userEmail: string;
	source: string;
	apply: boolean;
	deleteFiles: boolean;
};

function parseArgs(argv: string[]): Args {
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
	if (!userEmail) {
		throw new Error(
			'Missing required arg: --user EMAIL\n' +
				'Usage: pnpm cleanup:ghosts -- --user EMAIL [--source garmin-export] [--apply] [--delete-files]\n' +
				'  Without --apply this is a dry run (no DB changes, no files deleted).\n' +
				'  --delete-files also unlinks the orphaned .fit files under OPENIBEX_DATA_DIR.'
		);
	}
	return {
		userEmail,
		source: args.get('source') ?? 'garmin-export',
		apply: args.get('apply') === 'true',
		deleteFiles: args.get('delete-files') === 'true'
	};
}

async function main() {
	const { userEmail, source, apply, deleteFiles } = parseArgs(process.argv.slice(2));
	const user = await getUserByEmail(userEmail.trim().toLowerCase());
	if (!user) throw new Error(`User not found: ${userEmail}`);

	const all = await listAllActivitiesForUser(user.id);
	const ghosts = all.filter(
		(a) => a.source === source && a.durationSec === null && a.distanceM === null
	);

	console.log(
		`Found ${ghosts.length} ghost activities (source='${source}', duration_sec IS NULL, distance_m IS NULL) for ${user.email}.`
	);
	if (!apply) {
		console.log('Dry run — no changes. Re-run with --apply to delete, add --delete-files to also unlink .fit files.');
	}

	const env = getEnv();
	let deletedActivities = 0;
	let deletedFileRows = 0;
	let deletedFilesOnDisk = 0;
	let fileMissing = 0;
	let fileUnlinkErrors = 0;

	for (const a of ghosts) {
		let file = null;
		if (a.activityFileId) {
			file = (await getActivityFileByIdForUser(a.activityFileId, user.id)) ?? null;
		}

		if (apply) {
			await deleteActivityForUser({ id: a.id, userId: user.id });
			deletedActivities += 1;

			if (file) {
				await deleteActivityFileForUser({ id: file.id, userId: user.id });
				deletedFileRows += 1;

				if (deleteFiles && file.filePath) {
					const abs = path.isAbsolute(file.filePath)
						? file.filePath
						: path.join(env.OPENIBEX_DATA_DIR, file.filePath);
					try {
						await fs.unlink(abs);
						deletedFilesOnDisk += 1;
					} catch (err: unknown) {
						const code = (err as NodeJS.ErrnoException)?.code;
						if (code === 'ENOENT') fileMissing += 1;
						else fileUnlinkErrors += 1;
					}
				}
			}
		}
	}

	console.log(
		`scanned=${ghosts.length} ` +
			`deleted-activities=${deletedActivities} ` +
			`deleted-file-rows=${deletedFileRows} ` +
			(deleteFiles
				? `deleted-files-on-disk=${deletedFilesOnDisk} missing-on-disk=${fileMissing} unlink-errors=${fileUnlinkErrors} `
				: '') +
			(apply ? '(applied)' : '(dry run)')
	);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
