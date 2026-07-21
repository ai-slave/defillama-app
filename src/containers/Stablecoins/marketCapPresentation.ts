import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { CHART_COLORS } from '~/constants/colors'

const PIE_SLICE_LIMIT = 10
const HORIZONTAL_BAR_SLICE_LIMIT = 9
const TREEMAP_ITEM_LIMIT = 20

type MarketCapRow = { mcap?: number | null }

type MarketCapSlice = { name: string; value: number }

export type StablecoinMarketCapPresentation =
	| { kind: 'pie'; chartData: MarketCapSlice[] }
	| { kind: 'hbar'; categories: string[]; values: number[]; colors: string[] }
	| { kind: 'treemap'; treeData: TreemapNode[] }

/**
 * Builds only the selected market-cap presentation. Callers pass rows already sorted by
 * descending market cap by the stablecoin aggregation hooks, avoiding another full-array sort.
 */
export function buildStablecoinMarketCapPresentation<T extends MarketCapRow>({
	rows,
	view,
	getName
}: {
	rows: T[]
	view: StablecoinMarketCapPresentation['kind']
	getName: (row: NoInfer<T>) => string
}): StablecoinMarketCapPresentation {
	if (view === 'treemap') {
		const treeData: TreemapNode[] = []
		let total = 0
		for (const row of rows) {
			const value = row.mcap ?? 0
			if (value <= 0) continue
			const name = getName(row)
			treeData.push({
				name,
				path: `Stablecoins/${name}`,
				value: [value, 0, 0],
				itemStyle: { color: CHART_COLORS[treeData.length % CHART_COLORS.length] }
			})
			total += value
			if (treeData.length >= TREEMAP_ITEM_LIMIT) break
		}

		if (total > 0) {
			for (const item of treeData) {
				const share = Number(((item.value[0] / total) * 100).toFixed(2))
				item.value[1] = share
				item.value[2] = share
			}
		}

		return { kind: 'treemap', treeData }
	}

	const slices = buildLimitedSlices(rows, getName, view === 'pie' ? PIE_SLICE_LIMIT : HORIZONTAL_BAR_SLICE_LIMIT)
	if (view === 'pie') {
		return { kind: 'pie', chartData: slices }
	}

	const categories = new Array<string>(slices.length)
	const values = new Array<number>(slices.length)
	const colors = new Array<string>(slices.length)
	for (let i = 0; i < slices.length; i++) {
		categories[i] = slices[i].name
		values[i] = slices[i].value
		colors[i] = CHART_COLORS[i % CHART_COLORS.length]
	}
	return { kind: 'hbar', categories, values, colors }
}

function buildLimitedSlices<T extends MarketCapRow>(rows: T[], getName: (row: T) => string, limit: number) {
	const slices: MarketCapSlice[] = []
	let otherSlicesValue = 0
	let mainOthersIndex = -1

	for (let i = 0; i < rows.length; i++) {
		const value = rows[i].mcap ?? 0
		if (i >= limit) {
			otherSlicesValue += value
			continue
		}

		const name = getName(rows[i])
		if (name === 'Others' && mainOthersIndex === -1) {
			mainOthersIndex = slices.length
		}
		slices.push({ name, value })
	}

	if (mainOthersIndex !== -1) {
		otherSlicesValue += slices[mainOthersIndex].value
		slices.splice(mainOthersIndex, 1)
	}
	if (otherSlicesValue > 0) {
		slices.push({ name: 'Others', value: otherSlicesValue })
	}

	return slices
}
