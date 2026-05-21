export function validateDisplayName(displayName: string):
	| { ok: true; value: string | null }
	| { ok: false; message: string } {
	const trimmed = displayName.trim();
	if (trimmed.length === 0) return { ok: true, value: null };
	if (trimmed.length > 50) return { ok: false, message: 'Display name must be 50 characters or less.' };
	return { ok: true, value: trimmed };
}
