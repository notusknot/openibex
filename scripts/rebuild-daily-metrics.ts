import 'dotenv/config';

import { getUserByEmail } from '../src/lib/server/repositories/usersRepository';
import { rebuildDailyMetricsForUser } from '../src/lib/server/services/analytics/dailyMetricsService';

function parseArgs(argv: string[]): { userEmail: string } {
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
	if (!userEmail) throw new Error('Missing required arg: --user user@example.com');
	return { userEmail };
}

async function main() {
	const { userEmail } = parseArgs(process.argv.slice(2));
	const user = await getUserByEmail(userEmail.trim().toLowerCase());
	if (!user) throw new Error(`User not found: ${userEmail}`);

	const result = await rebuildDailyMetricsForUser(user.id);
	console.log(`rows=${result.rows}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});

