import { describe, expect, test } from 'vitest'
import { chartColor } from '~/constants/colors'
import { buildBridgeChainsChartRows, buildBridgeChainsMultiSeriesChart } from '../queries.server'

describe('bridge chains chart contract', () => {
	test('builds chart rows from normalized per-chain API streams', () => {
		const chartDataByChain = [
			[
				{ date: 3, depositUSD: 30, withdrawUSD: 5 },
				{ date: 1, depositUSD: 10, withdrawUSD: null }
			],
			[
				{ date: 2, depositUSD: null, withdrawUSD: 7 },
				{ date: 1, depositUSD: 20, withdrawUSD: 4 }
			]
		]

		const chartRows = buildBridgeChainsChartRows({
			chains: [{ name: 'Ethereum' }, { name: 'Arbitrum' }],
			chartDataByChain
		})
		const result = buildBridgeChainsMultiSeriesChart({
			chartRows,
			chains: ['Ethereum', 'Arbitrum']
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Ethereum', 'Arbitrum'],
			source: [
				[1000, null, 16],
				[2000, null, null],
				[3000, 25, null]
			]
		})
		expect(result.charts).toEqual([
			{
				type: 'bar',
				name: 'Ethereum',
				encode: { x: 0, y: 1 },
				stack: 'Ethereum',
				color: chartColor(0),
				large: false
			},
			{
				type: 'bar',
				name: 'Arbitrum',
				encode: { x: 0, y: 2 },
				stack: 'Arbitrum',
				color: chartColor(1),
				large: false
			}
		])
	})

	test('rejects misaligned chain and chart response arrays', () => {
		expect(() =>
			buildBridgeChainsChartRows({
				chains: [{ name: 'Ethereum' }, { name: 'Arbitrum' }],
				chartDataByChain: [[]]
			})
		).toThrow('Bridge chain/chart response count mismatch: 2 chains, 1 charts')
	})

	test('returns a dimensioned empty chart for empty streams', () => {
		const chartRows = buildBridgeChainsChartRows({ chains: [{ name: 'Ethereum' }], chartDataByChain: [[]] })
		const result = buildBridgeChainsMultiSeriesChart({ chartRows, chains: ['Ethereum'] })

		expect(result.dataset).toEqual({ dimensions: ['timestamp', 'Ethereum'], source: [] })
		expect(result.charts[0]?.encode.y).toBe(1)
	})

	test('keeps an unavailable chain stream out of rows without dropping other chains', () => {
		const chartRows = buildBridgeChainsChartRows({
			chains: [{ name: 'Unavailable' }, { name: 'Ethereum' }],
			chartDataByChain: [null, [{ date: 1, depositUSD: 5, withdrawUSD: 2 }]]
		})

		expect(Array.from(chartRows, ([date, values]) => [date, Object.fromEntries(values)])).toEqual([
			[1, { Ethereum: 3 }]
		])
	})
})
