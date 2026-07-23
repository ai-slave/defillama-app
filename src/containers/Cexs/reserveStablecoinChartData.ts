import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import type { IProtocolTokenBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import type { StablecoinListAsset } from '~/containers/Stablecoins/api.types'

type ChartSpec = {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
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
	pegMechanismPieSeries: RuntimePieChartData
	stablecoinBreakdown: StablecoinBreakdownPoint[]
	stablecoinTokensUnique: string[]
	pegTypesUnique: string[]
	pegMechanismsUnique: string[]
	currentTotal: number | null
}

export const TOTAL_STABLECOINS_SERIES_NAME = 'Total Stablecoins'

function buildLineChartSpec(source: MultiSeriesChartDataset['source'], names: string[]): ChartSpec | null {
	if (source.length <= 1 || names.length === 0) return null
	return {
		dataset: { source, dimensions: ['timestamp', ...names] },
		charts: names.map((name, index) => ({
			type: 'line',
			name,
			encode: { x: 0, y: index + 1 }
		}))
	}
}

function buildPegMechanismSummary(latestRow: MultiSeriesChartDataset['source'][number] | undefined, names: string[]) {
	if (!latestRow) {
		return {
			stablecoinBreakdown: [],
			pegMechanismPieSeries: { peers: [], limit: 10, upstreamOthersValue: 0 }
		}
	}

	let total = 0
	for (let i = 1; i < latestRow.length; i++) total += (latestRow[i] as number | undefined) ?? 0

	const stablecoinBreakdown: StablecoinBreakdownPoint[] = []
	for (let i = 0; i < names.length; i++) {
		const name = names[i]
		const value = latestRow[i + 1] as number | undefined
		if (value == null) continue
		stablecoinBreakdown.push({ mechanism: name, value, percentage: (value / total) * 100 })
	}
	stablecoinBreakdown.sort((a, b) => b.value - a.value)

	const peers: RuntimePieChartData['peers'] = []
	let upstreamOthersValue = 0
	for (const item of stablecoinBreakdown) {
		if (item.value <= 0) continue
		if (item.mechanism === 'Others') upstreamOthersValue += item.value
		else peers.push({ name: item.mechanism, value: item.value })
	}
	const pegMechanismPieSeries: RuntimePieChartData = { peers, limit: 10, upstreamOthersValue }

	return { stablecoinBreakdown, pegMechanismPieSeries }
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

	const stablecoinTokensUnique: string[] = []
	const pegTypesUnique: string[] = []
	const pegMechanismsUnique: string[] = []
	const tokenIndex = new Map<string, number>()
	const pegTypeIndex = new Map<string, number>()
	const pegMechanismIndex = new Map<string, number>()
	const stablecoinsByPegMechanismSource: MultiSeriesChartDataset['source'] = []
	const stablecoinsByPegTypeSource: MultiSeriesChartDataset['source'] = []
	const stablecoinsByTokenSource: MultiSeriesChartDataset['source'] = []
	const totalStablecoinSource: MultiSeriesChartDataset['source'] = []

	let activeTimestamp = -1
	let mechanismRow: MultiSeriesChartDataset['source'][number] | null = null
	let pegTypeRow: MultiSeriesChartDataset['source'][number] | null = null
	let tokenRow: MultiSeriesChartDataset['source'][number] | null = null
	let totalRow: MultiSeriesChartDataset['source'][number] | null = null

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
				mechanismRow = [timestamp]
				pegTypeRow = [timestamp]
				tokenRow = [timestamp]
				totalRow = [timestamp, 0]
				stablecoinsByPegMechanismSource.push(mechanismRow)
				stablecoinsByPegTypeSource.push(pegTypeRow)
				stablecoinsByTokenSource.push(tokenRow)
				totalStablecoinSource.push(totalRow)
			}

			const value = tokens[token]
			let outputIndex = tokenIndex.get(token)
			if (outputIndex == null) {
				outputIndex = stablecoinTokensUnique.length + 1
				tokenIndex.set(token, outputIndex)
				stablecoinTokensUnique.push(token)
			}
			tokenRow[outputIndex] = ((tokenRow[outputIndex] as number | undefined) ?? 0) + value
			totalRow![1] = ((totalRow![1] as number | undefined) ?? 0) + value

			const pegType = pegTypeMap.get(token)
			if (pegType) {
				let pegTypeOutputIndex = pegTypeIndex.get(pegType)
				if (pegTypeOutputIndex == null) {
					pegTypeOutputIndex = pegTypesUnique.length + 1
					pegTypeIndex.set(pegType, pegTypeOutputIndex)
					pegTypesUnique.push(pegType)
				}
				pegTypeRow![pegTypeOutputIndex] = ((pegTypeRow![pegTypeOutputIndex] as number | undefined) ?? 0) + value
			}

			const pegMechanism = pegMechanismMap.get(token)
			if (pegMechanism) {
				let mechanismOutputIndex = pegMechanismIndex.get(pegMechanism)
				if (mechanismOutputIndex == null) {
					mechanismOutputIndex = pegMechanismsUnique.length + 1
					pegMechanismIndex.set(pegMechanism, mechanismOutputIndex)
					pegMechanismsUnique.push(pegMechanism)
				}
				mechanismRow![mechanismOutputIndex] = ((mechanismRow![mechanismOutputIndex] as number | undefined) ?? 0) + value
			}
		}
	}

	const { stablecoinBreakdown, pegMechanismPieSeries } = buildPegMechanismSummary(
		stablecoinsByPegMechanismSource[stablecoinsByPegMechanismSource.length - 1],
		pegMechanismsUnique
	)
	const latestTotalRow = totalStablecoinSource[totalStablecoinSource.length - 1]

	return {
		totalStablecoins: buildLineChartSpec(totalStablecoinSource, [TOTAL_STABLECOINS_SERIES_NAME]),
		stablecoinsByPegMechanism: buildLineChartSpec(stablecoinsByPegMechanismSource, pegMechanismsUnique),
		stablecoinsByPegType: buildLineChartSpec(stablecoinsByPegTypeSource, pegTypesUnique),
		stablecoinsByToken: buildLineChartSpec(stablecoinsByTokenSource, stablecoinTokensUnique),
		pegMechanismPieSeries,
		stablecoinBreakdown,
		stablecoinTokensUnique,
		pegTypesUnique,
		pegMechanismsUnique,
		currentTotal: (latestTotalRow?.[1] as number | undefined) ?? null
	}
}
