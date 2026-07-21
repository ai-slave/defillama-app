import { describe, expect, it } from 'vitest'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { getBorrowedBreakdownSources } from '../services/protocolTvl'
import { buildBorrowedChartData } from './borrowedChartData'

const breakdown: IProtocolChainBreakdownChart = [
	[1_000, { ETH: 10, USDC: 20 }],
	[2_000, { ETH: 30, USDC: 40 }]
]

describe('buildBorrowedChartData', () => {
	it('builds only the requested chain presentation', () => {
		const result = buildBorrowedChartData('chainsBorrowed', getBorrowedBreakdownSources('aave', 'chainsBorrowed'), [
			breakdown
		])

		expect(result.dataset?.dimensions).toEqual(['timestamp', 'USDC', 'ETH'])
		expect(result.seriesNames).toEqual(['USDC', 'ETH'])
		expect(result.pieChart).toEqual([])
	})

	it('reuses the USD token breakdown for line and pie presentations', () => {
		const line = buildBorrowedChartData('tokenBorrowedUsd', getBorrowedBreakdownSources('aave', 'tokenBorrowedUsd'), [
			breakdown
		])
		const pie = buildBorrowedChartData('tokensBorrowedPie', getBorrowedBreakdownSources('aave', 'tokensBorrowedPie'), [
			breakdown
		])

		expect(line.dataset?.source).toHaveLength(2)
		expect(pie.dataset).toBeNull()
		expect(line.seriesNames).toEqual(pie.seriesNames)
		expect(pie.pieChart).toEqual([
			{ name: 'USDC', value: 40 },
			{ name: 'ETH', value: 30 }
		])
	})

	it('keeps raw token quantities in an unaggregated dataset', () => {
		const result = buildBorrowedChartData('tokenBorrowedRaw', getBorrowedBreakdownSources('aave', 'tokenBorrowedRaw'), [
			breakdown,
			breakdown
		])

		expect(result.dataset?.source).toEqual([
			[1_000, 20, 10],
			[2_000, 40, 30]
		])
		expect(result.pieChart).toEqual([])
	})

	it('selects raw token series by USD value instead of raw quantity', () => {
		const usdValues: Record<string, number> = {}
		const rawValues: Record<string, number> = {}
		for (let index = 0; index < 31; index++) {
			const token = `TOKEN_${index}`
			usdValues[token] = 1_000 - index
			rawValues[token] = index + 1
		}
		usdValues.RAW_WHALE = 1
		rawValues.RAW_WHALE = 50_000_000
		const usdBreakdown: IProtocolChainBreakdownChart = [
			[1_000, usdValues],
			[2_000, usdValues]
		]
		const rawBreakdown: IProtocolChainBreakdownChart = [
			[1_000, rawValues],
			[2_000, rawValues]
		]

		const result = buildBorrowedChartData('tokenBorrowedRaw', getBorrowedBreakdownSources('aave', 'tokenBorrowedRaw'), [
			usdBreakdown,
			rawBreakdown
		])

		expect(result.seriesNames).toContain('TOKEN_0')
		expect(result.seriesNames).not.toContain('RAW_WHALE')
		expect(result.dataset?.dimensions).not.toContain('RAW_WHALE')
	})
})
