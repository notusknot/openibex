const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: string): boolean {
	const match = DATE_RE.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
	if (month < 1 || month > 12) return false;
	if (day < 1 || day > 31) return false;
	return true;
}

export function formatLocalDate(date: Date): string {
	const yyyy = String(date.getFullYear());
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

export function parseMonthParam(value: string): { ok: true; year: number; month: number } | { ok: false } {
	const m = /^(\d{4})-(\d{2})$/.exec(value);
	if (!m) return { ok: false };
	const year = Number(m[1]);
	const month = Number(m[2]);
	if (!Number.isFinite(year) || !Number.isFinite(month)) return { ok: false };
	if (month < 1 || month > 12) return { ok: false };
	return { ok: true, year, month };
}

export function monthStartDate(year: number, month: number): string {
	return `${String(year)}-${String(month).padStart(2, '0')}-01`;
}

export function monthEndDate(year: number, month: number): string {
	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const firstOfNext = new Date(Date.UTC(nextYear, nextMonth - 1, 1));
	const lastOfMonth = new Date(firstOfNext.getTime() - 24 * 60 * 60 * 1000);
	const yyyy = String(lastOfMonth.getUTCFullYear());
	const mm = String(lastOfMonth.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(lastOfMonth.getUTCDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

