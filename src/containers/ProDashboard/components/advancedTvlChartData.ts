import type { TimestampDataset } from '~/components/ECharts/timeSeriesDataset'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { buildComputedBreakdownResult } from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import type { ProtocolTvlBreakdownSource } from '../services/protocolTvl'
import type { AdvancedTvlChartType } from '../types'

export interface AdvancedTvlChartData {
	dataset: TimestampDataset | null
	seriesNames: string[]
	pieChart: Array<{ name: string; value: number }>
}

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
		if (
			row.timestamp !== BINANCE_CEX_EXCLUDED_INFLOW_TIMESTAMPS[0] &&
			row.timestamp !== BINANCE_CEX_EXCLUDED_INFLOW_TIMESTAMPS[1]
		) {
			source.push(row)
		}
	}
	return { ...dataset, source }
}

export function buildAdvancedTvlChartData(
	chartType: AdvancedTvlChartType,
	sources: ProtocolTvlBreakdownSource[],
	breakdowns: Array<IProtocolChainBreakdownChart | null | undefined>,
	protocolName: string
): AdvancedTvlChartData {
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
		buildTokenUSDDataset: chartType === 'tokenValuesUsd',
		buildTokenRawDataset: chartType === 'tokenBalances',
		buildTokenPieChart: chartType === 'tokensPie'
	})

	let result: AdvancedTvlChartData
	switch (chartType) {
		case 'chainsTvl':
			result = { dataset: computed.chainsDataset, seriesNames: computed.chainsUnique, pieChart: [] }
			break
		case 'tokenValuesUsd':
			result = { dataset: computed.tokenUSDDataset, seriesNames: computed.tokensUnique, pieChart: [] }
			break
		case 'tokensPie':
			result = {
				dataset: computed.tokenUSDDataset,
				seriesNames: computed.tokensUnique,
				pieChart: computed.tokenBreakdownPieChart
			}
			break
		case 'tokenBalances':
			result = { dataset: computed.tokenRawDataset, seriesNames: computed.rawTokensUnique, pieChart: [] }
			break
		case 'usdInflows':
			result = { dataset: computed.usdInflowsDataset, seriesNames: ['USD Inflows'], pieChart: [] }
			break
		case 'tokenInflows':
			result = { dataset: computed.tokenInflowsDataset, seriesNames: computed.tokensUnique, pieChart: [] }
			break
		default:
			result = { dataset: null, seriesNames: [], pieChart: [] }
	}

	return {
		...result,
		dataset: excludeBinanceCexInflows(result.dataset, protocolName, chartType)
	}
}
