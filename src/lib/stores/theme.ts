import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'oi-theme';

function initial(): Theme {
	if (!browser) return 'light';
	const stored = window.localStorage.getItem(STORAGE_KEY);
	return stored === 'dark' ? 'dark' : 'light';
}

export const theme = writable<Theme>(initial());

if (browser) {
	theme.subscribe((value) => {
		window.localStorage.setItem(STORAGE_KEY, value);
	});
}

export function setTheme(next: Theme): void {
	theme.set(next);
}
