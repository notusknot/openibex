// Static presentation metadata for the /activities summary strip. The labels,
// sub-labels, and accent colors are constant — only the numbers are data-derived
// — so both the loading skeleton (page wrapper) and the populated view read this
// one array to render identical card chrome, with no risk of the two drifting and
// flashing when the data streams in.
export type SummaryCardMeta = { label: string; sub: string; accent: string };

export const SUMMARY_CARD_META: SummaryCardMeta[] = [
	{ label: 'Shown', sub: 'activities', accent: 'var(--green)' },
	{ label: 'Load', sub: 'total TSS', accent: 'var(--c-fat)' },
	{ label: 'Distance', sub: 'combined', accent: 'var(--run)' },
	{ label: 'Time', sub: 'moving time', accent: 'var(--c-form)' }
];
