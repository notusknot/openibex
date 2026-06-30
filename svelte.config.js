import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// precompress: emit .gz/.br alongside the hashed client bundle + prerendered
		// files so adapter-node's static server (sirv, which runs before hooks) serves
		// them pre-compressed. Dynamic responses (SSR HTML, __data.json) are compressed
		// separately in hooks.server.ts — sirv never sees those.
		adapter: adapter({ precompress: true })
	}
};

export default config;
