import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import {
	buildComputedBreakdownResult,
	type ProtocolBreakdownChart
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import type { ProtocolBreakdownChart as ProtocolValueBreakdownChart } from '~/containers/ProtocolOverview/valueChartSources'
import type { BorrowedBreakdownSource } from '../services/protocolTvl'
import type { BorrowedChartType } from '../types'

interface BorrowedChartData {
	dataset: TimestampDataset | null
	breakdown: ProtocolBreakdownChart | null
	seriesNames: Array<string>
	defaultSeriesNames: Array<string>
	pieSeries: RuntimePieChartData
}

const EMPTY_PIE_SERIES: RuntimePieChartData = { peers: [], limit: CHART_SERIES_LIMIT, upstreamOthersValue: 0 }

export function buildBorrowedChartData(
	chartType: BorrowedChartType,
	sources: Array<BorrowedBreakdownSource>,
	breakdowns: Array<ProtocolValueBreakdownChart | null | undefined>
): BorrowedChartData {
	const chainBreakdownCharts: Array<IProtocolChainBreakdownChart | null | undefined> = []
	const tokenBreakdownUsdCharts: Array<IProtocolChainBreakdownChart | null | undefined> = []
	const tokenBreakdownRawCharts: Array<IProtocolChainBreakdownChart | null | undefined> = []

	for (let i = 0; i < sources.length; i++) {
		const source = sources[i]
		if (!source) continue
		const breakdown = breakdowns[i]
		switch (source.kind) {
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
		buildTokenRawBreakdown: isRawTokenBreakdown,
		buildTokenPieChart: chartType === 'tokensBorrowedPie'
	})

	if (isChainBreakdown) {
		return {
			dataset: null,
			breakdown: computed.chainBreakdown,
			seriesNames: computed.chainsUnique,
			defaultSeriesNames: computed.chainsUnique,
			pieSeries: EMPTY_PIE_SERIES
		}
	}
	if (isRawTokenBreakdown) {
		return {
			dataset: null,
			breakdown: computed.tokenRawBreakdown,
			seriesNames: computed.rawTokensUnique,
			defaultSeriesNames: computed.defaultRawTokens,
			pieSeries: EMPTY_PIE_SERIES
		}
	}
	return {
		dataset: null,
		breakdown: chartType === 'tokenBorrowedUsd' ? computed.tokenBreakdownUSD : null,
		seriesNames: computed.tokensUnique,
		defaultSeriesNames: computed.tokensUnique,
		pieSeries: computed.tokenBreakdownPieSeries
	}
}
