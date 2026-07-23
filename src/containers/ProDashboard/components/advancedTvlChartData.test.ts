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
		expect(result.dataset).toBeNull()
		expect(result.breakdown).toEqual(usdBreakdown)
		expect(result.pieSeries.peers).toEqual([])
	})

	it('uses the same USD source for token lines and the latest-value pie', () => {
		const lineSources = getAdvancedTvlBreakdownSources('aave', 'tokenValuesUsd', {})
		const pieSources = getAdvancedTvlBreakdownSources('aave', 'tokensPie', {})
		const line = buildAdvancedTvlChartData('tokenValuesUsd', lineSources, [usdBreakdown], 'Aave')
		const pie = buildAdvancedTvlChartData('tokensPie', pieSources, [usdBreakdown], 'Aave')

		expect(line.breakdown).toHaveLength(4)
		expect(pie.dataset).toBeNull()
		expect(pie.pieSeries.peers).toEqual([
			{ name: 'USDC', value: 145 },
			{ name: 'ETH', value: 65 }
		])
	})

	it('selects raw token series using their USD values', () => {
		const sources = getAdvancedTvlBreakdownSources('aave', 'tokenBalances', {})
		const result = buildAdvancedTvlChartData('tokenBalances', sources, [usdBreakdown, rawBreakdown], 'Aave')

		expect(result.seriesNames).toEqual(['USDC', 'ETH'])
		expect(result.breakdown?.at(-1)).toEqual([1_681_603_200_000, { USDC: 145, ETH: 1 }])
		expect(result.defaultSeriesNames).toEqual(['USDC', 'ETH'])
	})

	it('preserves the Binance CEX inflow exclusions from the legacy presentation', () => {
		const sources = getAdvancedTvlBreakdownSources('binance-cex', 'usdInflows', {})
		const result = buildAdvancedTvlChartData('usdInflows', sources, [usdBreakdown, rawBreakdown], 'Binance CEX')

		expect(result.dataset?.source.map((row) => row[0])).not.toContain(1_681_430_400_000)
		expect(result.dataset?.source.map((row) => row[0])).not.toContain(1_681_516_800_000)
	})

	it('retains the full token pie universe and isolates backend Others', () => {
		const latest = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`TOKEN_${index}`, 100 - index]))
		const breakdown: IProtocolChainBreakdownChart = [
			[1_000, latest],
			[2_000, { ...latest, Others: 25 }]
		]
		const result = buildAdvancedTvlChartData(
			'tokensPie',
			getAdvancedTvlBreakdownSources('aave', 'tokensPie', {}),
			[breakdown],
			'Aave'
		)

		expect(result.pieSeries.peers).toHaveLength(17)
		expect(result.pieSeries.upstreamOthersValue).toBe(25)
		expect(result.pieSeries.limit).toBe(15)
	})
})
