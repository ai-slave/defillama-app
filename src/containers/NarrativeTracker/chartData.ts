import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { boundSelection } from '~/components/Select/localSelection'
import type { TimeSeriesEntry } from './api.types'
import type { IPctChangeRow } from './types'

type NarrativeTreemapCategory = TreemapNode & { path: string; children: Array<TreemapNode> }
type NarrativeTreemapGroup = { node: NarrativeTreemapCategory; min: number; max: number }

export type NarrativeTreemapTreeData = Array<NarrativeTreemapCategory>
export type NarrativeTreemapReturnField = 'change1W' | 'change1M' | 'change1Y' | 'changeYtd' | 'returnField'

export function calculateDenominatedTimeSeries(
	data: Array<TimeSeriesEntry> | undefined,
	denominatedCoin: string
): Array<TimeSeriesEntry> {
	const rows = data ?? []
	if (rows.length === 0) return rows

	if (denominatedCoin === '$') return rows

	const denominatedReturns: Array<TimeSeriesEntry> = []

	for (const dayData of rows) {
		const newDayData: TimeSeriesEntry = { date: dayData.date }
		const denominatedCoinValue = dayData[denominatedCoin] ?? null
		const denominatedCoinPerformance = denominatedCoinValue == null ? null : 1 + denominatedCoinValue / 100
		if (denominatedCoinPerformance === null || denominatedCoinPerformance === 0) {
			// Relative performance is undefined without a valid denominator for that day.
			denominatedReturns.push(newDayData)
			continue
		}

		for (const category in dayData) {
			if (category === 'date' || category === denominatedCoin) continue

			const categoryValue = dayData[category] ?? null
			if (categoryValue == null) continue
			const categoryPerformance = 1 + categoryValue / 100
			const relativePerformance = (categoryPerformance / denominatedCoinPerformance - 1) * 100

			newDayData[category] = relativePerformance
		}

		denominatedReturns.push(newDayData)
	}

	return denominatedReturns
}

export function calculateDenominatedChange(
	data: Array<IPctChangeRow>,
	denominatedCoin: string,
	field: 'change1W' | 'change1M' | 'change1Y' | 'changeYtd'
): Array<IPctChangeRow> {
	if (denominatedCoin === '$') return data
	const denomRow = data.find((i) => i.name === denominatedCoin)
	const denomChange = denomRow?.[field]
	const denominatedCoinPerformance = denomChange == null ? null : 1 + denomChange / 100

	const denominatedReturns: Array<IPctChangeRow> = []
	for (const i of data) {
		const change = i[field]
		if (change == null || denominatedCoinPerformance == null || denominatedCoinPerformance === 0) {
			denominatedReturns.push({ ...i, [field]: null })
			continue
		}
		const categoryPerformance = 1 + change / 100
		const relativePerformance = (categoryPerformance / denominatedCoinPerformance - 1) * 100
		denominatedReturns.push({ ...i, [field]: relativePerformance })
	}

	return denominatedReturns
}

function safeTreemapReturn(value: number | null | undefined): number {
	return value == null ? 0 : Math.round(value * 100) / 100
}

export function buildNarrativeTreemapTreeData(
	rows: Array<IPctChangeRow>,
	returnField: NarrativeTreemapReturnField = 'returnField'
): NarrativeTreemapTreeData {
	const treeData: NarrativeTreemapTreeData = []
	const categoryGroups = new Map<string, NarrativeTreemapGroup>()

	for (const row of rows) {
		const categoryName = row.categoryName ?? ''
		const marketCap = row.mcap ?? 0
		let group = categoryGroups.get(categoryName)
		if (!group) {
			const node: NarrativeTreemapCategory = {
				value: [0, null, null, 0],
				name: categoryName,
				path: categoryName,
				children: []
			}
			group = { node, min: Infinity, max: -Infinity }
			categoryGroups.set(categoryName, group)
			treeData.push(node)
		}

		group.node.value[0] += marketCap
		const returnValue = safeTreemapReturn(row[returnField])
		if (returnValue < group.min) group.min = returnValue
		if (returnValue > group.max) group.max = returnValue
		group.node.children.push({
			value: [marketCap, returnValue, returnValue],
			name: row.name,
			path: `${categoryName}/${row.name}`
		})
	}

	// Value colors are normalized within each category, matching ECharts' previous
	// recursive sibling-local mapping without cloning the finished tree in the chart.
	for (const { node, min, max } of categoryGroups.values()) {
		for (const child of node.children) {
			const value = child.value[2] ?? 0
			if (value > 0) {
				child.value[3] = value === max ? 100 : (value / max) * 60 + 40
			} else if (value < 0) {
				child.value[3] = value === min ? -100 : ((value - min) / -min) * 60 - 100
			} else {
				child.value[3] = 0
			}
		}
	}

	return treeData
}

export function filterNarrativeTreemapTreeData(
	treeData: NarrativeTreemapTreeData,
	selectedSeries: ReadonlySet<string>
): NarrativeTreemapTreeData {
	// Both overview categories and individual coins are stored as leaf rows.
	const filtered: NarrativeTreemapTreeData = []
	for (const category of treeData) {
		const children = category.children.filter((coin) => selectedSeries.has(coin.name))
		if (children.length === 0) continue
		let marketCap = 0
		for (const child of children) marketCap += child.value[0]
		filtered.push({ ...category, value: [marketCap, null, null, 0], children })
	}
	return filtered
}

/**
 * The line and bar charts draw only the first `limit` selected series. An edit made there replaces that visible part
 * and keeps the rest of the selection, which the heatmap still shows. Deselecting everything clears it all.
 */
export function editVisibleSelection(
	selected: ReadonlyArray<string>,
	edited: Array<string>,
	limit: number
): Array<string> {
	if (edited.length === 0) return []
	const visible = selected.slice(0, limit)
	const shownSet = new Set(visible)
	return [...boundSelection(visible, edited, limit), ...selected.filter((name) => !shownSet.has(name))]
}
