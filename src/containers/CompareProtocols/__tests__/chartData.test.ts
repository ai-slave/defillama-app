import { describe, expect, it } from 'vitest'
import { buildCompareProtocolsChartData } from '../chartData'

describe('buildCompareProtocolsChartData', () => {
	it('aggregates enabled chain tvl into sparse protocol comparison rows', () => {
		const result = buildCompareProtocolsChartData({
			protocolResponses: [
				{
					name: 'Aave',
					chainTvls: {
						Ethereum: {
							tvl: [
								{ date: 1, totalLiquidityUSD: 100 },
								{ date: 2, totalLiquidityUSD: 120 }
							]
						},
						borrowed: {
							tvl: [{ date: 1, totalLiquidityUSD: 999 }]
						},
						'staking-extra': {
							tvl: [{ date: 1, totalLiquidityUSD: 999 }]
						},
						offers: {
							tvl: [{ date: 1, totalLiquidityUSD: 999 }]
						}
					}
				},
				{
					name: 'Compound',
					chainTvls: {
						Ethereum: {
							tvl: [{ date: 2, totalLiquidityUSD: 50 }]
						}
					}
				}
			],
			extraTvlEnabled: { borrowed: false }
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Aave', 'Compound'],
			source: [
				[1_000, 100, undefined],
				[2_000, 120, 50]
			]
		})
		expect(result.charts.map((chart) => chart.name)).toEqual(['Aave', 'Compound'])
		expect(result.charts.every((chart) => chart.type === 'line')).toBe(true)
	})

	it('keeps enabled extra tvl chain sections in the selected protocol series', () => {
		const result = buildCompareProtocolsChartData({
			protocolResponses: [
				{
					name: 'Aave',
					chainTvls: {
						Ethereum: {
							tvl: [{ date: 1, totalLiquidityUSD: 100 }]
						},
						borrowed: {
							tvl: [{ date: 1, totalLiquidityUSD: 25 }]
						}
					}
				}
			],
			extraTvlEnabled: { borrowed: true }
		})

		expect(result.dataset.source).toEqual([[1_000, 125]])
	})

	it('skips protocol detail chain sections without tvl chart rows', () => {
		const result = buildCompareProtocolsChartData({
			protocolResponses: [
				{
					name: 'Aave',
					chainTvls: {
						Ethereum: {},
						Base: {
							tvl: null
						},
						Arbitrum: {
							tvl: [{ date: 1, totalLiquidityUSD: 75 }]
						}
					}
				}
			],
			extraTvlEnabled: {}
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Aave'],
			source: [[1_000, 75]]
		})
	})
})
