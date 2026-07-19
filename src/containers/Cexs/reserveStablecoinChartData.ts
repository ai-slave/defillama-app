import { createChartRow } from '~/components/ECharts/dynamicRow'
import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import type { IProtocolTokenBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import type { StablecoinListAsset } from '~/containers/Stablecoins/api.types'

type NumericRow = { timestamp: number } & Record<string, number>
type ChartSpec = {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
}

export type StablecoinBreakdownPoint = {
	mechanism: string
	value: number
	percentage: number
}

export interface ReserveStablecoinChartData {
	totalStablecoins: ChartSpec | null
	stablecoinsByPegMechanism: ChartSpec | null
	stablecoinsByPegType: ChartSpec | null
	stablecoinsByToken: ChartSpec | null
	pegMechanismPieChart: Array<{ name: string; value: number }>
	stablecoinBreakdown: StablecoinBreakdownPoint[]
	stablecoinTokensUnique: string[]
	pegTypesUnique: string[]
	pegMechanismsUnique: string[]
	currentTotal: number | null
}

export const TOTAL_STABLECOINS_SERIES_NAME = 'Total Stablecoins'

function buildLineChartSpec(rows: NumericRow[], names: string[]): ChartSpec | null {
	if (rows.length <= 1 || names.length === 0) return null
	return {
		dataset: { source: rows, dimensions: ['timestamp', ...names] },
		charts: names.map((name) => ({
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name }
		}))
	}
}

function buildPegMechanismSummary(latestRow: NumericRow | undefined) {
	if (!latestRow) return { stablecoinBreakdown: [], pegMechanismPieChart: [] }

	let total = 0
	for (const name in latestRow) {
		if (name !== 'timestamp') total += latestRow[name]
	}

	const stablecoinBreakdown: StablecoinBreakdownPoint[] = []
	for (const name in latestRow) {
		if (name === 'timestamp') continue
		const value = latestRow[name]
		stablecoinBreakdown.push({ mechanism: name, value, percentage: (value / total) * 100 })
	}
	stablecoinBreakdown.sort((a, b) => b.value - a.value)

	const mainCount = Math.min(10, stablecoinBreakdown.length)
	const pegMechanismPieChart: Array<{ name: string; value: number }> = []
	let othersValue = 0
	for (let i = 0; i < stablecoinBreakdown.length; i++) {
		const item = stablecoinBreakdown[i]
		if (i < mainCount && item.mechanism !== 'Others') {
			pegMechanismPieChart.push({ name: item.mechanism, value: item.value })
		} else {
			othersValue += item.value
		}
	}
	if (othersValue > 0) pegMechanismPieChart.push({ name: 'Others', value: othersValue })

	return { stablecoinBreakdown, pegMechanismPieChart }
}

/**
 * Build all stablecoin snapshot datasets in one token pass per timestamp.
 * The protocol chart query guarantees ascending numeric millisecond timestamps.
 */
export function buildReserveStablecoinChartData(
	tokenBreakdownData: IProtocolTokenBreakdownChart,
	peggedAssets: Array<Pick<StablecoinListAsset, 'symbol' | 'pegType' | 'pegMechanism'>>
): ReserveStablecoinChartData {
	const stablecoinSymbols = new Set<string>()
	const pegTypeMap = new Map<string, string>()
	const pegMechanismMap = new Map<string, string>()
	for (const asset of peggedAssets) {
		stablecoinSymbols.add(asset.symbol)
		pegTypeMap.set(asset.symbol, asset.pegType)
		pegMechanismMap.set(asset.symbol, asset.pegMechanism)
	}

	const stablecoinTokensUniqueSet = new Set<string>()
	const pegTypesUniqueSet = new Set<string>()
	const pegMechanismsUniqueSet = new Set<string>()
	const stablecoinsByPegMechanismRows: NumericRow[] = []
	const stablecoinsByPegTypeRows: NumericRow[] = []
	const stablecoinsByTokenRows: NumericRow[] = []
	const totalStablecoinRows: NumericRow[] = []

	let activeTimestamp = -1
	let mechanismRow: NumericRow | null = null
	let pegTypeRow: NumericRow | null = null
	let tokenRow: NumericRow | null = null
	let totalRow: NumericRow | null = null

	for (const [timestamp, tokens] of tokenBreakdownData) {
		if (timestamp !== activeTimestamp) {
			activeTimestamp = timestamp
			mechanismRow = null
			pegTypeRow = null
			tokenRow = null
			totalRow = null
		}

		for (const token in tokens) {
			if (!stablecoinSymbols.has(token)) continue
			if (!tokenRow) {
				mechanismRow = createChartRow<number>(timestamp)
				pegTypeRow = createChartRow<number>(timestamp)
				tokenRow = createChartRow<number>(timestamp)
				totalRow = createChartRow<number>(timestamp)
				totalRow[TOTAL_STABLECOINS_SERIES_NAME] = 0
				stablecoinsByPegMechanismRows.push(mechanismRow)
				stablecoinsByPegTypeRows.push(pegTypeRow)
				stablecoinsByTokenRows.push(tokenRow)
				totalStablecoinRows.push(totalRow)
			}

			const value = tokens[token]
			stablecoinTokensUniqueSet.add(token)
			tokenRow[token] = (tokenRow[token] ?? 0) + value
			totalRow![TOTAL_STABLECOINS_SERIES_NAME] += value

			const pegType = pegTypeMap.get(token)
			if (pegType) {
				pegTypesUniqueSet.add(pegType)
				pegTypeRow![pegType] = (pegTypeRow![pegType] ?? 0) + value
			}

			const pegMechanism = pegMechanismMap.get(token)
			if (pegMechanism) {
				pegMechanismsUniqueSet.add(pegMechanism)
				mechanismRow![pegMechanism] = (mechanismRow![pegMechanism] ?? 0) + value
			}
		}
	}

	const stablecoinTokensUnique = Array.from(stablecoinTokensUniqueSet)
	const pegTypesUnique = Array.from(pegTypesUniqueSet)
	const pegMechanismsUnique = Array.from(pegMechanismsUniqueSet)
	const { stablecoinBreakdown, pegMechanismPieChart } = buildPegMechanismSummary(
		stablecoinsByPegMechanismRows[stablecoinsByPegMechanismRows.length - 1]
	)
	const latestTotalRow = totalStablecoinRows[totalStablecoinRows.length - 1]

	return {
		totalStablecoins: buildLineChartSpec(totalStablecoinRows, [TOTAL_STABLECOINS_SERIES_NAME]),
		stablecoinsByPegMechanism: buildLineChartSpec(stablecoinsByPegMechanismRows, pegMechanismsUnique),
		stablecoinsByPegType: buildLineChartSpec(stablecoinsByPegTypeRows, pegTypesUnique),
		stablecoinsByToken: buildLineChartSpec(stablecoinsByTokenRows, stablecoinTokensUnique),
		pegMechanismPieChart,
		stablecoinBreakdown,
		stablecoinTokensUnique,
		pegTypesUnique,
		pegMechanismsUnique,
		currentTotal: latestTotalRow?.[TOTAL_STABLECOINS_SERIES_NAME] ?? null
	}
}
