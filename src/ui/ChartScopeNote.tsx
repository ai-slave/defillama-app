import type { ReactNode } from 'react'

/**
 * One sentence under a `ChartPanelToolbar` for a chart that cannot follow the page filters. Render it only while
 * a filter the chart ignores is active, and say what the chart shows instead:
 * "This chart ignores the X filter and shows Y."
 */
export function ChartScopeNote({ children }: { children: ReactNode }) {
	return <p className="px-2 pt-2 body-sm text-tertiary">{children}</p>
}

/** "the TVL range filter", "the TVL range and Group Chains filters", "the A, B and C filters". */
export function ignoredFiltersPhrase(labels: ReadonlyArray<string>): string {
	if (labels.length === 1) return `the ${labels[0]} filter`
	const last = labels[labels.length - 1]
	return `the ${labels.slice(0, -1).join(', ')} and ${last} filters`
}
