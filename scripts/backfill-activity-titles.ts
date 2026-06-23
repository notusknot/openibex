import 'dotenv/config';

import {
	listAllActivitiesForUser,
	updateActivityTitleForUser
} from '../src/lib/server/repositories/activitiesRepository';
import { getUserByEmail } from '../src/lib/server/repositories/usersRepository';
import { composeFallbackTitle } from '../src/lib/server/parsers/fit/fitParser';
import {
	loadGarminMetadata,
	resolveNameByFingerprint
} from '../src/lib/server/services/imports/garminMetadata';

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
				'Usage: pnpm titles:backfill -- --user EMAIL [--path /garmin/export/root] [--source garmin-export] [--dry-run]'
		);
	}
	return {
		userEmail,
		exportPath: args.get('path') ?? null,
		dryRun: args.get('dry-run') === 'true',
		source: args.get('source') ?? 'garmin-export'
	};
}

function looksGenerated(title: string | null | undefined): boolean {
	if (!title) return true;
	const t = title.trim();
	if (t.length === 0) return true;
	if (t.includes('@')) return true;
	if (/^[0-9]+$/.test(t)) return true;
	if (/^[0-9]+_ACTIVITY$/i.test(t)) return true;
	return false;
}

async function main() {
	const { userEmail, exportPath, dryRun, source } = parseArgs(process.argv.slice(2));
	const user = await getUserByEmail(userEmail.trim().toLowerCase());
	if (!user) throw new Error(`User not found: ${userEmail}`);

	const lookup = exportPath
		? await loadGarminMetadata(exportPath)
		: { totalActivities: 0, byActivityId: new Map(), byStartMinute: new Map() };
	if (exportPath) {
		console.log(`Loaded ${lookup.totalActivities} activities from Garmin metadata at ${exportPath}`);
	} else {
		console.log('No --path supplied; titles will only get the Sport · date fallback.');
	}

	const all = await listAllActivitiesForUser(user.id);
	const candidates = source ? all.filter((a) => a.source === source) : all;

	let metaHits = 0;
	let fallbackHits = 0;
	let unchanged = 0;
	let skipped = 0;

	for (const a of candidates) {
		if (!looksGenerated(a.title)) {
			skipped += 1;
			continue;
		}
		const metaName = resolveNameByFingerprint(lookup, {
			sport: a.sport,
			startTime: new Date(a.startTime)
		});
		const nextTitle =
			metaName ??
			composeFallbackTitle({
				originalFilename: a.sourceFilename ?? '',
				sport: a.sport,
				startTime: new Date(a.startTime)
			});
		if (nextTitle === a.title) {
			unchanged += 1;
			continue;
		}
		if (metaName) metaHits += 1;
		else fallbackHits += 1;
		if (!dryRun) {
			await updateActivityTitleForUser({ id: a.id, userId: user.id, title: nextTitle });
		}
	}

	console.log(
		`scanned=${candidates.length} ` +
			`renamed-from-metadata=${metaHits} ` +
			`renamed-from-fallback=${fallbackHits} ` +
			`already-clean=${skipped} ` +
			`unchanged=${unchanged}` +
			(dryRun ? ' (dry run — no DB writes)' : '')
	);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
