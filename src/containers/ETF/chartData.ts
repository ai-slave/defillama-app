import type { LowercaseDwmcGrouping } from '~/components/ECharts/ChartGroupingSelector'
import { getBucketTimestampSec } from '~/components/ECharts/utils'
import type { IProcessedFlows } from './types'

type ETFFlowChartRow = {
	timestamp: number
	Bitcoin: number
	Ethereum: number | null
	Solana: number | null
}

export function buildETFFlowChartData(flows: IProcessedFlows, groupBy: LowercaseDwmcGrouping): ETFFlowChartRow[] {
	const source: ETFFlowChartRow[] = []
	const isCumulative = groupBy === 'cumulative'
	let totalBitcoin = 0
	let totalEthereum = 0
	let totalSolana = 0
	let activeBucket: string | number | null = null
	let activeRow: ETFFlowChartRow | null = null

	// Flow timestamps are integer-like object keys, so JavaScript iterates them chronologically.
	for (const flowDate in flows) {
		const flowEntry = flows[flowDate]
		const bucket = groupBy === 'daily' || isCumulative ? flowDate : getBucketTimestampSec(+flowDate, groupBy)
		if (!activeRow || bucket !== activeBucket) {
			activeBucket = bucket
			activeRow = {
				timestamp: +bucket * 1e3,
				Bitcoin: isCumulative ? totalBitcoin : 0,
				Ethereum: null,
				Solana: null
			}
			source.push(activeRow)
		}

		const bitcoinFlow = flowEntry.Bitcoin ?? 0
		if (isCumulative) totalBitcoin += bitcoinFlow
		activeRow.Bitcoin = isCumulative ? totalBitcoin : activeRow.Bitcoin + bitcoinFlow

		if (flowEntry.Ethereum != null) {
			if (isCumulative) totalEthereum += flowEntry.Ethereum
			activeRow.Ethereum = isCumulative ? totalEthereum : (activeRow.Ethereum ?? 0) + flowEntry.Ethereum
		}
		if (flowEntry.Solana != null) {
			if (isCumulative) totalSolana += flowEntry.Solana
			activeRow.Solana = isCumulative ? totalSolana : (activeRow.Solana ?? 0) + flowEntry.Solana
		}
	}

	return source
}
