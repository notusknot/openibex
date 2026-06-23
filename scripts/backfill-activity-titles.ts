import 'dotenv/config';

import {
	listAllActivitiesForUser,
	updateActivityTitleForUser
} from '../src/lib/server/repositories/activitiesRepository';
import { getUserByEmail } from '../src/lib/server/repositories/usersRepository';
import {
	loadGarminMetadata,
	resolveNameByFingerprint,
	type GarminMetadataLookup
} from '../src/lib/server/services/imports/garminMetadata';
import { composeSmartTitle } from '../src/lib/server/services/imports/titleStrategy';

type Args = { userEmail: string; exportPath: string | null; dryRun: boolean; source: string | null };

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
			'Missing required arg: --user user@example.com\n' +
				'Usage: pnpm titles:backfill -- --user EMAIL [--path /garmin/export/root] [--source garmin-export] [--dry-run]\n' +
				'  --path: optional path to a Garmin export root. If supplied, activities matching\n' +
				'    summarizedActivities*.json by start time + sport get the real Garmin name.\n' +
				'    Unmatched activities get "Morning Run" / "Afternoon Bike" / etc.\n' +
				'  --source: which activity.source to retitle (default: garmin-export). Pass empty to retitle all.\n' +
				'  --dry-run: preview counts; no DB writes.'
		);
	}
	return {
		userEmail,
		exportPath: args.get('path') ?? null,
		dryRun: args.get('dry-run') === 'true',
		source: args.get('source') ?? 'garmin-export'
	};
}

function emptyLookup(): GarminMetadataLookup {
	return { totalActivities: 0, byActivityId: new Map(), byStartMinute: new Map() };
}

async function main() {
	const { userEmail, exportPath, dryRun, source } = parseArgs(process.argv.slice(2));
	const user = await getUserByEmail(userEmail.trim().toLowerCase());
	if (!user) throw new Error(`User not found: ${userEmail}`);

	const lookup = exportPath ? await loadGarminMetadata(exportPath) : emptyLookup();
	if (exportPath) {
		console.log(`Loaded ${lookup.totalActivities} activities from Garmin metadata at ${exportPath}`);
	} else {
		console.log('No --path supplied; titles will use the time-of-day fallback only.');
	}

	const all = await listAllActivitiesForUser(user.id);
	const candidates = source ? all.filter((a) => a.source === source) : all;

	let metaHits = 0;
	let timeOfDayHits = 0;
	let unchanged = 0;

	for (const a of candidates) {
		const startTime = new Date(a.startTime);
		const metaName = resolveNameByFingerprint(lookup, { sport: a.sport, startTime });
		const nextTitle = composeSmartTitle({
			metadataLookup: lookup,
			sport: a.sport,
			startTime
		});
		if (nextTitle === a.title) {
			unchanged += 1;
			continue;
		}
		if (metaName) metaHits += 1;
		else timeOfDayHits += 1;
		if (!dryRun) {
			await updateActivityTitleForUser({ id: a.id, userId: user.id, title: nextTitle });
		}
	}

	console.log(
		`scanned=${candidates.length} ` +
			`renamed-from-metadata=${metaHits} ` +
			`renamed-from-time-of-day=${timeOfDayHits} ` +
			`unchanged=${unchanged}` +
			(dryRun ? ' (dry run — no DB writes)' : '')
	);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
