import { describe, expect, test } from 'vitest'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { getBorrowedBreakdownSources } from '../../services/protocolTvl'
import { buildBorrowedChartData } from '../borrowedChartData'

const breakdown: IProtocolChainBreakdownChart = [
	[1000, { ETH: 10, USDC: 20 }],
	[2000, { ETH: 30, USDC: 40 }]
]

describe('buildBorrowedChartData', () => {
	test('builds only the requested chain presentation', () => {
		const result = buildBorrowedChartData('chainsBorrowed', getBorrowedBreakdownSources('aave', 'chainsBorrowed'), [
			breakdown
		])

		expect(result.dataset).toBeNull()
		expect(result.breakdown).toEqual(breakdown)
		expect(result.seriesNames).toEqual(['USDC', 'ETH'])
		expect(result.pieSeries.peers).toEqual([])
	})

	test('reuses the USD token breakdown for line and pie presentations', () => {
		const line = buildBorrowedChartData('tokenBorrowedUsd', getBorrowedBreakdownSources('aave', 'tokenBorrowedUsd'), [
			breakdown
		])
		const pie = buildBorrowedChartData('tokensBorrowedPie', getBorrowedBreakdownSources('aave', 'tokensBorrowedPie'), [
			breakdown
		])

		expect(line.breakdown).toHaveLength(2)
		expect(pie.dataset).toBeNull()
		expect(line.seriesNames).toEqual(pie.seriesNames)
		expect(pie.pieSeries.peers).toEqual([
			{ name: 'USDC', value: 40 },
			{ name: 'ETH', value: 30 }
		])
		expect(pie.pieSeries.limit).toBe(15)
	})

	test('keeps raw token quantities in an unaggregated dataset', () => {
		const rawBreakdown: IProtocolChainBreakdownChart = [
			[1000, { ETH: 0.004, USDC: 20 }],
			[2000, { ETH: 0.01, USDC: 40 }]
		]
		const result = buildBorrowedChartData('tokenBorrowedRaw', getBorrowedBreakdownSources('aave', 'tokenBorrowedRaw'), [
			breakdown,
			rawBreakdown
		])

		expect(result.breakdown).toEqual(rawBreakdown)
	})

	test('selects raw token series by USD value instead of raw quantity', () => {
		const usdValues: Record<string, number> = {}
		const rawValues: Record<string, number> = {}
		for (let index = 0; index < 31; index++) {
			const token = `TOKEN_${index}`
			usdValues[token] = 1000 - index
			rawValues[token] = index + 1
		}
		usdValues.RAW_WHALE = 1
		rawValues.RAW_WHALE = 50_000_000
		const usdBreakdown: IProtocolChainBreakdownChart = [
			[1000, usdValues],
			[2000, usdValues]
		]
		const rawBreakdown: IProtocolChainBreakdownChart = [
			[1000, rawValues],
			[2000, rawValues]
		]

		const result = buildBorrowedChartData('tokenBorrowedRaw', getBorrowedBreakdownSources('aave', 'tokenBorrowedRaw'), [
			usdBreakdown,
			rawBreakdown
		])

		expect(result.seriesNames).toContain('TOKEN_0')
		expect(result.seriesNames).toContain('RAW_WHALE')
		expect(result.defaultSeriesNames).not.toContain('RAW_WHALE')
	})
})
