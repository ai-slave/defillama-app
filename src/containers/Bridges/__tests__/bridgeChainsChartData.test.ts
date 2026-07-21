import { describe, expect, it } from 'vitest'
import type { RawBridgeVolumePoint } from '../api.types'
import { buildBridgeChainsChartRows, buildBridgeChainsMultiSeriesChart } from '../queries.server'

describe('bridge chains chart contract', () => {
	it('builds chart rows from raw per-chain API streams', () => {
		const chartDataByChain = [
			[
				{ date: '3', depositUSD: 30, withdrawUSD: 5 },
				{ date: '1', depositUSD: 10 }
			],
			[
				{ date: '2', withdrawUSD: 7 },
				{ date: '1', depositUSD: 20, withdrawUSD: 4 }
			]
		] satisfies RawBridgeVolumePoint[][]

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
				[1_000, 10, 16],
				[2_000, undefined, -7],
				[3_000, 25, undefined]
			]
		})
		expect(result.charts).toEqual([
			{
				type: 'bar',
				name: 'Ethereum',
				encode: { x: 0, y: 1 },
				stack: 'Ethereum',
				color: '#1f67d2',
				large: false
			},
			{
				type: 'bar',
				name: 'Arbitrum',
				encode: { x: 0, y: 2 },
				stack: 'Arbitrum',
				color: '#E91E63',
				large: false
			}
		])
		for (const chart of result.charts) expect(chart.encode.y).toBeGreaterThan(0)
	})

	it('ignores invalid dates and missing chain streams without mutating raw points', () => {
		const point = { date: '1', depositUSD: 5 } satisfies RawBridgeVolumePoint
		const chartDataByChain = [[point], [{ date: 'invalid', withdrawUSD: 2 }]] satisfies RawBridgeVolumePoint[][]

		const result = buildBridgeChainsChartRows({
			chains: [{ name: 'Ethereum' }, { name: 'Arbitrum' }, { name: 'Base' }],
			chartDataByChain
		})

		expect(Array.from(result, ([date, values]) => [date, Object.fromEntries(values)])).toEqual([[1, { Ethereum: 5 }]])
		expect(point).toEqual({ date: '1', depositUSD: 5 })
	})

	it('returns a dimensioned empty chart for empty raw streams', () => {
		const chartRows = buildBridgeChainsChartRows({ chains: [{ name: 'Ethereum' }], chartDataByChain: [[]] })
		const result = buildBridgeChainsMultiSeriesChart({ chartRows, chains: ['Ethereum'] })

		expect(result.dataset).toEqual({ dimensions: ['timestamp', 'Ethereum'], source: [] })
		expect(result.charts[0]?.encode.y).toBe(1)
	})
})
