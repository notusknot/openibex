import fs from 'node:fs/promises';
import path from 'node:path';

export async function* walkFiles(root: string): AsyncGenerator<string> {
	const stack: string[] = [root];
	while (stack.length > 0) {
		const current = stack.pop()!;
		let stat;
		try {
			stat = await fs.lstat(current);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			let entries: string[] = [];
			try {
				entries = await fs.readdir(current);
			} catch {
				continue;
			}
			for (const e of entries) {
				stack.push(path.join(current, e));
			}
		} else if (stat.isFile()) {
			yield current;
		}
	}
}

