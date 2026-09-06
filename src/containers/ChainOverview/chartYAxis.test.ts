import { describe, expect, test } from 'vitest'
import { buildChainYAxis } from './chartYAxis'
import { chainOverviewChartColors } from './constants'

describe('chain chart y-axis layout', () => {
	test('keeps per-metric colors, formatters, and spacing across three axes', () => {
		const axes = buildChainYAxis({
			allYAxis: [
				['TVL', undefined],
				['Active Addresses', 1],
				['Token Price', 2]
			],
			baseYAxis: { axisLabel: { color: '#aaa' } },
			chartColors: { ...chainOverviewChartColors, TVL: '#111', 'Active Addresses': '#222', 'Token Price': '#333' },
			chartsInSeries: new Set(['TVL', 'Active Addresses', 'Token Price']),
			themeText: '#aaa'
		})

		const [, usersAxis, priceAxis] = axes
		if (!usersAxis || !priceAxis) throw new Error('Expected three configured chain axes')
		const usersFormatter = usersAxis.axisLabel?.formatter
		const priceFormatter = priceAxis.axisLabel?.formatter
		if (typeof usersFormatter !== 'function' || typeof priceFormatter !== 'function') {
			throw new Error('Expected numeric chain-axis formatters')
		}
		expect(axes.map((axis) => axis.offset ?? 0)).toEqual([0, 0, 40])
		expect(usersAxis.axisLine?.lineStyle).toMatchObject({ color: '#222', type: [5, 10] })
		expect(priceAxis.axisLine?.lineStyle).toMatchObject({ color: '#333', type: [5, 10] })
		expect(usersAxis.axisLabel).toMatchObject({ color: '#aaa' })
		expect(priceAxis.axisLabel).toMatchObject({ color: '#aaa' })
		expect(usersAxis.axisLine?.lineStyle).not.toHaveProperty('opacity')
		expect(priceAxis.axisLine?.lineStyle).not.toHaveProperty('opacity')
		expect(usersFormatter(1000, 0, null)).toBe('1,000')
		expect(priceFormatter(5, 0, null)).toContain('$')
		expect(axes.every((axis) => axis.alignTicks == null)).toBe(true)
	})

	test('preserves explicitly requested tick alignment', () => {
		const axes = buildChainYAxis({
			allYAxis: [
				['TVL', undefined],
				['Token Price', 1]
			],
			baseYAxis: { alignTicks: true },
			chartColors: { ...chainOverviewChartColors, TVL: '#111', 'Token Price': '#333' },
			chartsInSeries: new Set(['TVL', 'Token Price']),
			themeText: '#aaa'
		})
		expect(axes.every((axis) => axis.alignTicks === true)).toBe(true)
	})
})
