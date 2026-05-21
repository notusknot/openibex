export function sqlitePathFromDatabaseUrl(databaseUrl: string): string {
	if (databaseUrl.startsWith('file:')) {
		return databaseUrl.slice('file:'.length);
	}
	return databaseUrl;
}
