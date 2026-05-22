export function weekStartIsoMonday(date: Date): string {
	const d = new Date(date);
	const day = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - day);
	const yyyy = String(d.getFullYear());
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

export function addDaysIso(dateIso: string, days: number): string {
	const d = new Date(`${dateIso}T00:00:00`);
	d.setDate(d.getDate() + days);
	const yyyy = String(d.getFullYear());
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

