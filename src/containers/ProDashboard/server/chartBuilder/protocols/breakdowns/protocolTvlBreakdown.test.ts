import { describe, expect, it } from 'vitest'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { buildTopProtocolChainSeries, sumProtocolTvlBreakdown } from './protocolTvlBreakdown'

const chart: IProtocolChainBreakdownChart = [
	[1_000_000, { Ethereum: 10, Arbitrum: 4 }],
	[2_000_000, { Ethereum: 12, Arbitrum: 5, Base: 8 }],
	[3_000_000, { Ethereum: 14, Arbitrum: 6, Base: 7 }]
]

describe('focused protocol TVL breakdown construction', () => {
	it('sums included and excluded chains directly from the V2 rows', () => {
		expect(sumProtocolTvlBreakdown(chart, { includeChains: new Set(['Arbitrum', 'Base']) })).toEqual([
			[1_000, 4],
			[2_000, 13],
			[3_000, 13]
		])
		expect(sumProtocolTvlBreakdown(chart, { excludeChains: new Set(['Ethereum']) })).toEqual([
			[1_000, 4],
			[2_000, 13],
			[3_000, 13]
		])
	})

	it('ranks by each chain latest value and reconciles sparse rows into Others', () => {
		const result = buildTopProtocolChainSeries({ chart, topN: 1 })

		expect(result.chains).toEqual(['Ethereum', 'Base', 'Arbitrum'])
		expect(result.series.map(({ name, data }) => ({ name, data }))).toEqual([
			{
				name: 'Ethereum',
				data: [
					[1_000, 10],
					[2_000, 12],
					[3_000, 14]
				]
			},
			{
				name: 'Others (2 chains)',
				data: [
					[1_000, 4],
					[2_000, 13],
					[3_000, 13]
				]
			}
		])
	})

	it('combines explicit and category filters before ranking', () => {
		const result = buildTopProtocolChainSeries({
			chart,
			topN: 5,
			filter: {
				excludeChains: new Set(['Ethereum']),
				categoryChains: new Set(['Arbitrum']),
				categoryFilterMode: 'exclude'
			}
		})

		expect(result.chains).toEqual(['Base'])
		expect(result.series[0].data).toEqual([
			[1_000, 0],
			[2_000, 8],
			[3_000, 7]
		])
	})
})
