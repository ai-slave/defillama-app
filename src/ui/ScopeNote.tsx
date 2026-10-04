import type { ReactNode } from 'react'

/*
 * Caveats that change how to read the numbers sit on top, under the `ChartPanelToolbar` or above a table, before the
 * reader reaches the chart. Metadata such as "Last updated" or a source stays in a footer row below. A stale-data
 * warning is a caveat too and stays on top. Never hide a mismatch in a tooltip, and never hand-roll the paragraph
 * (the `raw-scope-note` rule in check-design-tokens.mjs counts copies). Search never gets a note: it narrows the
 * table only and never reaches the URL.
 */

/**
 * One sentence for a chart or table that cannot follow the page filters. Render it only while a filter the data
 * ignores is active, and say what it shows instead: "This chart ignores the X filter and shows Y."
 * `ignoredFiltersPhrase` names several filters; when the header totals ignore the filter too, lead with
 * "The totals and this chart ignore …". `role="status"` is for a note that appears in place, such as
 * CumulativeUnavailableNotice's inline form.
 */
export function ScopeNote({ children, role }: { children: ReactNode; role?: 'status' }) {
	return (
		<p role={role} className="px-2 pt-2 body-sm text-tertiary">
			{children}
		</p>
	)
}

/** "A", "A and B", "A, B and C". */
export function listPhrase(labels: ReadonlyArray<string>): string {
	if (labels.length === 1) return labels[0]
	return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** "the TVL range filter", "the TVL range and Group Chains filters". */
export function ignoredFiltersPhrase(labels: ReadonlyArray<string>): string {
	if (labels.length === 1) return `the ${labels[0]} filter`
	return `the ${listPhrase(labels)} filters`
}

/** "Couldn't load Stablecoins Mcap and Token Price. The chart shows the other metrics." */
export function failedDataNote(labels: ReadonlyArray<string>, shows: string): string {
	return `Couldn't load ${listPhrase(labels)}. ${shows}`
}

/**
 * The same slot for a chart whose data partly failed to load: names what is missing and what the chart still
 * shows. Render it only once loading has settled, so a series still on its way is not reported as failed. Never a
 * corner icon or a popover.
 */
export function FailedDataNote({ labels, shows }: { labels: ReadonlyArray<string>; shows: string }) {
	if (labels.length === 0) return null
	return (
		<p role="alert" className="px-2 pt-2 body-sm text-data-down">
			{failedDataNote(labels, shows)}
		</p>
	)
}
