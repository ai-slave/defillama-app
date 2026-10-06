import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { LowercaseDwmcGrouping } from '~/components/ECharts/shared/ChartGroupingSelector'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import type { IProcessedFlows } from './types'

export const ETF_ASSET_NAMES = ['Bitcoin', 'Ethereum', 'Solana', 'Hyperliquid'] as const
export type ETFAssetName = (typeof ETF_ASSET_NAMES)[number]

const ETF_CHART_COLORS: Record<ETFAssetName, string> = {
	Bitcoin: '#F7931A',
	Ethereum: '#6B7280',
	Solana: '#9945FF',
	Hyperliquid: '#50D2C1'
}

export function buildETFFlowChartData(
	flows: IProcessedFlows,
	groupBy: LowercaseDwmcGrouping,
	assets: ReadonlyArray<ETFAssetName> = ETF_ASSET_NAMES
): MultiSeriesChartDataset['source'] {
	const source: MultiSeriesChartDataset['source'] = []
	const isCumulative = groupBy === 'cumulative'
	const bitcoinIndex = assets.indexOf('Bitcoin') + 1
	const totals: Partial<Record<ETFAssetName, number>> = {}
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
			// Bitcoin never gaps; other assets stay blank on days without data.
			if (bitcoinIndex > 0) activeRow[bitcoinIndex] = isCumulative ? (totals.Bitcoin ?? 0) : 0
			source.push(activeRow)
		}

		for (const [i, name] of assets.entries()) {
			const flow = flowEntry[name]
			if (flow == null) continue
			if (isCumulative) {
				totals[name] = (totals[name] ?? 0) + flow
				activeRow[i + 1] = totals[name]
			} else {
				activeRow[i + 1] = ((activeRow[i + 1] as number | null) ?? 0) + flow
			}
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
	assets: Array<ETFAssetName>
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
