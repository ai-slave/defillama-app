import { describe, expect, it } from 'vitest'
import {
	buildDistributionViewModel,
	buildSparkCumulativeBarAsLineChart,
	buildSparkDistributionChart,
	type DistributionResponse
} from './distributionApi'

describe('Spark distribution chart construction', () => {
	it('zero-fills sparse series without coercing numeric values', () => {
		const result = buildSparkDistributionChart(
			{
				keys: ['USDS', 'USDC'],
				data: [
					{ date: 1, USDC: 5 },
					{ date: 2, USDS: 20 }
				]
			},
			'line',
			'a'
		)

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'USDS', 'USDC'],
			source: [
				{ timestamp: 1000, USDS: 0, USDC: 5 },
				{ timestamp: 2000, USDS: 20, USDC: 0 }
			]
		})
	})

	it('keeps snapshot line values unchanged instead of accumulating them', () => {
		const result = buildSparkDistributionChart(
			{
				keys: ['TVL'],
				data: [
					{ date: 1, TVL: 10 },
					{ date: 2, TVL: 15 },
					{ date: 3, TVL: 12 }
				]
			},
			'line',
			'a'
		)

		expect(result.dataset.source).toEqual([
			{ timestamp: 1000, TVL: 10 },
			{ timestamp: 2000, TVL: 15 },
			{ timestamp: 3000, TVL: 12 }
		])
		expect(result.charts).toMatchObject([
			{ type: 'line', name: 'TVL', stack: 'a', encode: { x: 'timestamp', y: 'TVL' } }
		])
	})

	it('cumulates flow values once and emits chronological line rows', () => {
		const result = buildSparkCumulativeBarAsLineChart({
			keys: ['Revenue', 'Costs'],
			data: [
				{ date: 1, Revenue: 2 },
				{ date: 2, Revenue: 3, Costs: 1 },
				{ date: 3, Revenue: 4, Costs: -2 }
			]
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Revenue', 'Costs'],
			source: [
				{ timestamp: 1000, Revenue: 2, Costs: 0 },
				{ timestamp: 2000, Revenue: 5, Costs: 1 },
				{ timestamp: 3000, Revenue: 9, Costs: -1 }
			]
		})
		expect(result.charts).toMatchObject([
			{ type: 'line', name: 'Revenue', stack: 'a', encode: { x: 'timestamp', y: 'Revenue' } },
			{ type: 'line', name: 'Costs', stack: 'a', encode: { x: 'timestamp', y: 'Costs' } }
		])
	})

	it('renames the upstream undefined key without changing its values', () => {
		const result = buildSparkDistributionChart(
			{ keys: ['undefined'], data: [{ date: 1, undefined: 7 }] },
			'bar',
			'a',
			'USD'
		)

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'USD'],
			source: [{ timestamp: 1000, USD: 7 }]
		})
	})

	it('builds the six cached views without retaining raw charts or metadata', () => {
		const payload = (key: string, values: number[]) => ({
			keys: [key],
			data: values.map((value, index) => ({ date: index + 1, [key]: value }))
		})
		const response: DistributionResponse = {
			meta: { updatedAt: '2026-01-01' },
			charts: {
				actualRevenue: payload('Revenue', [1, 2]),
				revenueProjection: {
					keys: ['Projection'],
					data: [
						{ date: 1, Projection: 3 },
						{ date: 2, Projection: 5 }
					]
				},
				susdsTvl: payload('sUSDS TVL', [10, 8]),
				xrSusds: payload('sUSDS Rate', [1, 2]),
				xrSusdc: payload('sUSDC Rate', [2, 3]),
				stakedUsdsTvl: payload('Staked TVL', [6, 4])
			}
		}
		const result = buildDistributionViewModel(response)

		expect(Object.keys(result)).toEqual([
			'actualRevenue',
			'revenueProjection',
			'susdsTvl',
			'xrSusds',
			'xrSusdc',
			'stakedUsdsTvl'
		])
		expect(result).not.toHaveProperty('meta')
		expect(result).not.toHaveProperty('charts')
		expect(result.actualRevenue.charts[0]).toMatchObject({ type: 'bar', stack: 'a' })
		expect(result.revenueProjection.dataset.source).toEqual([
			{ timestamp: 1000, Projection: 3 },
			{ timestamp: 2000, Projection: 8 }
		])
		expect(result.revenueProjection.charts[0]).toMatchObject({ type: 'line', stack: 'a' })
		expect(result.susdsTvl.dataset.source).toEqual([
			{ timestamp: 1000, 'sUSDS TVL': 10 },
			{ timestamp: 2000, 'sUSDS TVL': 8 }
		])
		expect(result.susdsTvl.charts[0]).toMatchObject({ type: 'line', stack: 'a' })
		expect(result.stakedUsdsTvl.dataset.source).toEqual([
			{ timestamp: 1000, 'Staked TVL': 6 },
			{ timestamp: 2000, 'Staked TVL': 4 }
		])
		expect(result.stakedUsdsTvl.charts[0]).toMatchObject({ type: 'line', stack: 'a' })
	})
})
