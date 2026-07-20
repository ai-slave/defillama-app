import type { TimestampDataset } from '~/components/ECharts/timeSeriesDataset'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { buildComputedBreakdownResult } from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import type { BorrowedBreakdownSource } from '../services/protocolTvl'
import type { BorrowedChartType } from '../types'

interface BorrowedChartData {
	dataset: TimestampDataset | null
	seriesNames: string[]
	pieChart: Array<{ name: string; value: number }>
}

export function buildBorrowedChartData(
	chartType: BorrowedChartType,
	sources: BorrowedBreakdownSource[],
	breakdowns: Array<IProtocolChainBreakdownChart | null | undefined>
): BorrowedChartData {
	const chainBreakdownCharts: Array<IProtocolChainBreakdownChart | null | undefined> = []
	const tokenBreakdownUsdCharts: Array<IProtocolChainBreakdownChart | null | undefined> = []
	const tokenBreakdownRawCharts: Array<IProtocolChainBreakdownChart | null | undefined> = []

	for (let i = 0; i < sources.length; i++) {
		const breakdown = breakdowns[i]
		switch (sources[i].kind) {
			case 'chain':
				chainBreakdownCharts.push(breakdown)
				break
			case 'token-usd':
				tokenBreakdownUsdCharts.push(breakdown)
				break
			case 'token-raw':
				tokenBreakdownRawCharts.push(breakdown)
				break
		}
	}

	const isChainBreakdown = chartType === 'chainsBorrowed'
	const isRawTokenBreakdown = chartType === 'tokenBorrowedRaw'
	const computed = buildComputedBreakdownResult({
		tvlCharts: [],
		chainBreakdownCharts,
		tokenBreakdownUsdCharts,
		tokenBreakdownRawCharts,
		valueSeriesName: 'Borrowed',
		inflows: !isChainBreakdown,
		computeInflows: false,
		buildTokenUSDDataset: chartType === 'tokenBorrowedUsd',
		buildTokenRawDataset: isRawTokenBreakdown,
		buildTokenPieChart: chartType === 'tokensBorrowedPie'
	})

	if (isChainBreakdown) {
		return { dataset: computed.chainsDataset, seriesNames: computed.chainsUnique, pieChart: [] }
	}
	if (isRawTokenBreakdown) {
		return { dataset: computed.tokenRawDataset, seriesNames: computed.rawTokensUnique, pieChart: [] }
	}
	return {
		dataset: computed.tokenUSDDataset,
		seriesNames: computed.tokensUnique,
		pieChart: computed.tokenBreakdownPieChart
	}
}
