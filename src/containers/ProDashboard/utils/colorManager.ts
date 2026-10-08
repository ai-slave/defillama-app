import { chartColor } from '~/constants/colors'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { ChartConfig } from '../types'

/** A protocol and a chain can share a name, so the subject type is part of the key. */
export function getChartEntityKey(chart: ChartConfig): string {
	return chart.subjectType === 'protocol' ? `protocol:${chart.protocol}` : `chain:${chart.chain}`
}

/**
 * The colour of every protocol and chain the dashboard's chart cards draw, so an entity looks the same on every
 * card. Entities take the palette in order of first appearance, so no two share a colour until there are more than
 * the palette holds. Derived from the items alone, so the server and the client agree.
 */
export function getDashboardEntityColors(items: ReadonlyArray<DashboardItemConfig>): Record<string, string> {
	const colors: Record<string, string> = {}
	let count = 0
	const add = (chart: ChartConfig) => {
		const key = getChartEntityKey(chart)
		if (colors[key] === undefined) colors[key] = chartColor(count++)
	}
	for (const item of items) {
		if (item.kind === 'chart') add(item)
		else if (item.kind === 'multi') for (const chart of item.items) add(chart)
	}
	return colors
}

/**
 * Series colours of a combined card, by item id. Each series takes its entity's dashboard colour while those stay
 * distinct in the card; when an entity repeats (one protocol, several metrics) or the palette has wrapped, the card
 * colours its series by rank instead. A colour the user chose always wins.
 */
export function getMultiChartSeriesColors(
	items: ReadonlyArray<ChartConfig>,
	entityColors: Record<string, string>
): Record<string, string> {
	const dashboardColors = items.map((item) => entityColors[getChartEntityKey(item)])
	const distinct = new Set(dashboardColors).size === dashboardColors.length
	const colors: Record<string, string> = {}
	for (const [index, item] of items.entries()) {
		colors[item.id] = item.color ?? (distinct ? dashboardColors[index] : chartColor(index))
	}
	return colors
}
