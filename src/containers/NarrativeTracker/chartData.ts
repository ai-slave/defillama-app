/**
 * Narrative Tracker returns.
 *
 * - When the selected denomination has no usable benchmark, relative returns stay unavailable. Keep the selected
 *   denomination and show its availability message; never substitute USD returns.
 * - USD returns need no benchmark.
 * - A benchmark return of -100% makes the division undefined, so that point is unavailable.
 */

import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { boundSelection } from '~/components/Select/localSelection'
import { divergingColor } from '~/constants/colors'
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
				value: [0, null, null],
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

	// Shades are relative to each category: its best gain and worst loss take the full color and every other
	// move starts at 40% of it, so a small move still reads as a rise or fall.
	for (const { node, min, max } of categoryGroups.values()) {
		for (const child of node.children) {
			const value = child.value[2] ?? 0
			const shade = value > 0 ? (value / max) * 0.6 + 0.4 : value < 0 ? ((value - min) / -min) * 0.6 - 1 : 0
			child.itemStyle = { color: divergingColor(shade) }
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
		filtered.push({ ...category, value: [marketCap, null, null], children })
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
