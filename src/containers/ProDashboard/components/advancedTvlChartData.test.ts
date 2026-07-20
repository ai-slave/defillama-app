import { describe, expect, it } from 'vitest'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { getAdvancedTvlBreakdownSources } from '../services/protocolTvl'
import { buildAdvancedTvlChartData } from './advancedTvlChartData'

const usdBreakdown: IProtocolChainBreakdownChart = [
	[1_681_344_000_000, { USDC: 100, ETH: 50 }],
	[1_681_430_400_000, { USDC: 120, ETH: 55 }],
	[1_681_516_800_000, { USDC: 135, ETH: 60 }],
	[1_681_603_200_000, { USDC: 145, ETH: 65 }]
]
const rawBreakdown: IProtocolChainBreakdownChart = [
	[1_681_344_000_000, { USDC: 100, ETH: 1 }],
	[1_681_430_400_000, { USDC: 120, ETH: 1 }],
	[1_681_516_800_000, { USDC: 135, ETH: 1 }],
	[1_681_603_200_000, { USDC: 145, ETH: 1 }]
]

describe('buildAdvancedTvlChartData', () => {
	it('builds only the selected chain presentation', () => {
		const sources = getAdvancedTvlBreakdownSources('aave', 'chainsTvl', {})
		const result = buildAdvancedTvlChartData('chainsTvl', sources, [usdBreakdown], 'Aave')

		expect(result.seriesNames).toEqual(['USDC', 'ETH'])
		expect(result.dataset?.dimensions).toEqual(['timestamp', 'USDC', 'ETH'])
		expect(result.pieChart).toEqual([])
	})

	it('uses the same USD source for token lines and the latest-value pie', () => {
		const lineSources = getAdvancedTvlBreakdownSources('aave', 'tokenValuesUsd', {})
		const pieSources = getAdvancedTvlBreakdownSources('aave', 'tokensPie', {})
		const line = buildAdvancedTvlChartData('tokenValuesUsd', lineSources, [usdBreakdown], 'Aave')
		const pie = buildAdvancedTvlChartData('tokensPie', pieSources, [usdBreakdown], 'Aave')

		expect(line.dataset?.source).toHaveLength(4)
		expect(pie.dataset).toBeNull()
		expect(pie.pieChart).toEqual([
			{ name: 'USDC', value: 145 },
			{ name: 'ETH', value: 65 }
		])
	})

	it('selects raw token series using their USD values', () => {
		const sources = getAdvancedTvlBreakdownSources('aave', 'tokenBalances', {})
		const result = buildAdvancedTvlChartData('tokenBalances', sources, [usdBreakdown, rawBreakdown], 'Aave')

		expect(result.seriesNames).toEqual(['USDC', 'ETH'])
		expect(result.dataset?.source.at(-1)).toEqual({
			timestamp: 1_681_603_200_000,
			USDC: 145,
			ETH: 1
		})
	})

	it('preserves the Binance CEX inflow exclusions from the legacy presentation', () => {
		const sources = getAdvancedTvlBreakdownSources('binance-cex', 'usdInflows', {})
		const result = buildAdvancedTvlChartData('usdInflows', sources, [usdBreakdown, rawBreakdown], 'Binance CEX')

		expect(result.dataset?.source.map((row) => row.timestamp)).not.toContain(1_681_430_400_000)
		expect(result.dataset?.source.map((row) => row.timestamp)).not.toContain(1_681_516_800_000)
	})
})
