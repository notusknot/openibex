import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: ['nixos.tail529cc.ts.net']
	},
	test: {
		// Only discover tests in the source tree. The Nix devshell symlinks a
		// snapshot of the repo into .direnv/flake-inputs/, and the default glob
		// would otherwise pick up a stale duplicate of every test from there
		// (which fails because that copy has no generated .svelte-kit/tsconfig).
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
