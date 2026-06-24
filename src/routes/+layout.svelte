<slot />

<style>
	/* Light-mode palette exposed at :root so non-AppShell surfaces (login,
	   register, upload) get the same tokens. AppShell defines its own dark
	   override on .oi-root[data-theme='dark'] which wins inside the app. */
	:global(:root) {
		--bg: #f4f2ec;
		--card: #ffffff;
		--bg-soft: #faf8f3;
		--bg-emphasis: #f1f7f3;
		--line: #e6e0d2;
		--ink: #22241d;
		--ink2: #13332a;
		--ink-soft: #46443a;
		--muted: #7d7b6f;
		--faint: #a39e8b;
		--green: #1c5d3a;
		--gold: #e7c24b;
		--btn-ink: #5a6b5e;
		--danger: #a3402e;
		--danger-bg: #f7e9e5;
		--swim-soft: #eaf2f7;
		--bike-soft: #f8f0dd;
		--run-soft: #e8f1ec;
		--swim: #3e86b5;
		--bike: #d2a03a;
		--run: #3c7a53;
	}

	:global(html, body) {
		margin: 0;
		height: 100%;
		/* Prevent iOS Safari's bounce/over-pull when the page itself isn't
		   the scroll container (AppShell's .oi-main is). */
		overscroll-behavior: none;
	}
	:global(body) {
		font-family: 'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, sans-serif;
		color: var(--ink, #101827);
		background: var(--bg, #f4f2ec);
		/* Default off; AppShell flips this on at mobile widths so long-press
		   doesn't select random UI chrome. */
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}
	:global(a) {
		color: inherit;
		/* Removes the gray flash on iOS tap. Each interactive element
		   provides its own :hover/:active treatment. */
		-webkit-tap-highlight-color: transparent;
	}
	:global(button) {
		-webkit-tap-highlight-color: transparent;
		/* Avoid the legacy 300ms click delay on touch. */
		touch-action: manipulation;
	}
	:global(:focus-visible) {
		outline: 2px solid var(--green, #1c5d3a);
		outline-offset: 2px;
	}

	/* iOS Safari zooms when an input has font-size < 16px on focus. Force
	   ≥16px on touch-width viewports across every form control in the app
	   regardless of where it's used. Desktop styling unchanged. */
	@media (max-width: 767px) {
		:global(input[type='text']),
		:global(input[type='email']),
		:global(input[type='password']),
		:global(input[type='number']),
		:global(input[type='search']),
		:global(input[type='tel']),
		:global(input[type='url']),
		:global(input[type='date']),
		:global(textarea),
		:global(select) {
			font-size: 16px !important;
		}
	}
</style>
