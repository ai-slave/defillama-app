import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { LowercaseDwmcGrouping } from '~/components/ECharts/shared/ChartGroupingSelector'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import type { IProcessedFlows } from './types'

export const ETF_ASSET_NAMES = ['Bitcoin', 'Ethereum', 'Solana'] as const
export type ETFAssetName = (typeof ETF_ASSET_NAMES)[number]

const ETF_CHART_COLORS: Record<ETFAssetName, string> = {
	Bitcoin: '#F7931A',
	Ethereum: '#6B7280',
	Solana: '#9945FF'
}

export function buildETFFlowChartData(
	flows: IProcessedFlows,
	groupBy: LowercaseDwmcGrouping,
	assets: readonly ETFAssetName[] = ETF_ASSET_NAMES
): MultiSeriesChartDataset['source'] {
	const source: MultiSeriesChartDataset['source'] = []
	const isCumulative = groupBy === 'cumulative'
	const bitcoinIndex = assets.indexOf('Bitcoin') + 1
	const ethereumIndex = assets.indexOf('Ethereum') + 1
	const solanaIndex = assets.indexOf('Solana') + 1
	let totalBitcoin = 0
	let totalEthereum = 0
	let totalSolana = 0
	let activeBucket: string | number | null = null
	let activeRow: MultiSeriesChartDataset['source'][number] | null = null

	// Flow timestamps are integer-like object keys, so JavaScript iterates them chronologically.
	for (const flowDate in flows) {
		const flowEntry = flows[flowDate]
		const bucket = groupBy === 'daily' || isCumulative ? flowDate : getBucketTimestampSec(+flowDate, groupBy)
		if (!activeRow || bucket !== activeBucket) {
			activeBucket = bucket
			activeRow = new Array(assets.length + 1).fill(null)
			activeRow[0] = +bucket * 1e3
			if (bitcoinIndex > 0) activeRow[bitcoinIndex] = isCumulative ? totalBitcoin : 0
			source.push(activeRow)
		}

		if (bitcoinIndex > 0) {
			const bitcoinFlow = flowEntry.Bitcoin ?? 0
			if (isCumulative) totalBitcoin += bitcoinFlow
			activeRow[bitcoinIndex] = isCumulative ? totalBitcoin : (activeRow[bitcoinIndex] as number) + bitcoinFlow
		}

		if (ethereumIndex > 0 && flowEntry.Ethereum != null) {
			if (isCumulative) totalEthereum += flowEntry.Ethereum
			activeRow[ethereumIndex] = isCumulative
				? totalEthereum
				: ((activeRow[ethereumIndex] as number | null) ?? 0) + flowEntry.Ethereum
		}
		if (solanaIndex > 0 && flowEntry.Solana != null) {
			if (isCumulative) totalSolana += flowEntry.Solana
			activeRow[solanaIndex] = isCumulative
				? totalSolana
				: ((activeRow[solanaIndex] as number | null) ?? 0) + flowEntry.Solana
		}
	}

	return source
}

export function buildETFChartSpec({
	flows,
	groupBy,
	assets
}: {
	flows: IProcessedFlows
	groupBy: LowercaseDwmcGrouping
	assets: ETFAssetName[]
}): {
	dataset: MultiSeriesChartDataset
	charts: NonNullable<IMultiSeriesChartProps['charts']>
} {
	const type: 'line' | 'bar' = groupBy === 'cumulative' ? 'line' : 'bar'
	const charts = assets.map((name, index) => ({
		type,
		name,
		encode: { x: 0, y: index + 1 },
		stack: name,
		color: ETF_CHART_COLORS[name]
	}))

	return {
		dataset: {
			source: buildETFFlowChartData(flows, groupBy, assets),
			dimensions: ['timestamp', ...assets]
		},
		charts
	}
}
