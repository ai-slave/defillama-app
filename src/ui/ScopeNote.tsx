import type { ReactNode } from 'react'

/**
 * One sentence under a `ChartPanelToolbar`, or above a table, for data that cannot follow the page filters. Render
 * it only while a filter the data ignores is active, and say what it shows instead:
 * "This chart ignores the X filter and shows Y."
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
 * shows. Render it only once loading has settled, so a series still on its way is not reported as failed.
 */
export function FailedDataNote({ labels, shows }: { labels: ReadonlyArray<string>; shows: string }) {
	if (labels.length === 0) return null
	return (
		<p role="alert" className="px-2 pt-2 body-sm text-data-down">
			{failedDataNote(labels, shows)}
		</p>
	)
}
