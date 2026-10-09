import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import {
	buildComputedBreakdownResult,
	type ProtocolBreakdownChart
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import type { ProtocolBreakdownChart as ProtocolValueBreakdownChart } from '~/containers/ProtocolOverview/valueChartSources'
import type { ProtocolTvlBreakdownSource } from '../services/protocolTvl'
import type { AdvancedTvlChartType } from '../types'

export interface AdvancedTvlChartData {
	dataset: TimestampDataset | null
	breakdown: ProtocolBreakdownChart | null
	seriesNames: Array<string>
	defaultSeriesNames: Array<string>
	pieSeries: RuntimePieChartData
}

const EMPTY_PIE_SERIES: RuntimePieChartData = { peers: [], limit: CHART_SERIES_LIMIT, upstreamOthersValue: 0 }

const BINANCE_CEX_EXCLUDED_INFLOW_TIMESTAMPS = [1_681_430_400_000, 1_681_516_800_000] as const

function excludeBinanceCexInflows(
	dataset: TimestampDataset | null,
	protocolName: string,
	chartType: AdvancedTvlChartType
): TimestampDataset | null {
	if (!dataset || protocolName !== 'Binance CEX' || (chartType !== 'usdInflows' && chartType !== 'tokenInflows')) {
		return dataset
	}

	const source: TimestampDataset['source'] = []
	for (const row of dataset.source) {
		if (row[0] !== BINANCE_CEX_EXCLUDED_INFLOW_TIMESTAMPS[0] && row[0] !== BINANCE_CEX_EXCLUDED_INFLOW_TIMESTAMPS[1]) {
			source.push(row)
		}
	}
	return { ...dataset, source }
}

function excludeBinanceCexInflowPoints(
	breakdown: ProtocolBreakdownChart | null,
	protocolName: string,
	chartType: AdvancedTvlChartType
): ProtocolBreakdownChart | null {
	if (!breakdown || protocolName !== 'Binance CEX' || chartType !== 'tokenInflows') return breakdown
	return breakdown.filter(
		([timestamp]) =>
			timestamp !== BINANCE_CEX_EXCLUDED_INFLOW_TIMESTAMPS[0] && timestamp !== BINANCE_CEX_EXCLUDED_INFLOW_TIMESTAMPS[1]
	)
}

export function buildAdvancedTvlChartData(
	chartType: AdvancedTvlChartType,
	sources: Array<ProtocolTvlBreakdownSource>,
	breakdowns: Array<ProtocolValueBreakdownChart | null | undefined>,
	protocolName: string
): AdvancedTvlChartData {
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

	const isChainView = chartType === 'chainsTvl'
	const isInflowsView = chartType === 'usdInflows' || chartType === 'tokenInflows'
	const computed = buildComputedBreakdownResult({
		tvlCharts: [],
		chainBreakdownCharts,
		tokenBreakdownUsdCharts,
		tokenBreakdownRawCharts,
		valueSeriesName: 'TVL',
		inflows: !isChainView,
		computeInflows: isInflowsView,
		buildTokenRawBreakdown: chartType === 'tokenBalances' || chartType === 'tokenInflows',
		buildTokenPieChart: chartType === 'tokensPie'
	})

	let result: AdvancedTvlChartData
	switch (chartType) {
		case 'chainsTvl':
			result = {
				dataset: null,
				breakdown: computed.chainBreakdown,
				seriesNames: computed.chainsUnique,
				defaultSeriesNames: computed.chainsUnique,
				pieSeries: EMPTY_PIE_SERIES
			}
			break
		case 'tokenValuesUsd':
			result = {
				dataset: null,
				breakdown: computed.tokenBreakdownUSD,
				seriesNames: computed.tokensUnique,
				defaultSeriesNames: computed.tokensUnique,
				pieSeries: EMPTY_PIE_SERIES
			}
			break
		case 'tokensPie':
			result = {
				dataset: null,
				breakdown: null,
				seriesNames: computed.tokensUnique,
				defaultSeriesNames: computed.tokensUnique,
				pieSeries: computed.tokenBreakdownPieSeries
			}
			break
		case 'tokenBalances':
			result = {
				dataset: null,
				breakdown: computed.tokenRawBreakdown,
				seriesNames: computed.rawTokensUnique,
				defaultSeriesNames: computed.defaultRawTokens,
				pieSeries: EMPTY_PIE_SERIES
			}
			break
		case 'usdInflows':
			result = {
				dataset: computed.usdInflowsDataset,
				breakdown: null,
				seriesNames: ['USD Inflows'],
				defaultSeriesNames: ['USD Inflows'],
				pieSeries: EMPTY_PIE_SERIES
			}
			break
		case 'tokenInflows':
			result = {
				dataset: null,
				breakdown: computed.tokenInflows,
				seriesNames: computed.inflowTokensUnique,
				defaultSeriesNames: computed.inflowTokensUnique,
				pieSeries: EMPTY_PIE_SERIES
			}
			break
		default:
			result = {
				dataset: null,
				breakdown: null,
				seriesNames: [],
				defaultSeriesNames: [],
				pieSeries: EMPTY_PIE_SERIES
			}
	}

	return {
		...result,
		dataset: excludeBinanceCexInflows(result.dataset, protocolName, chartType),
		breakdown: excludeBinanceCexInflowPoints(result.breakdown, protocolName, chartType)
	}
}
