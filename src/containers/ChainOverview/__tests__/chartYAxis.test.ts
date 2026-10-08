import { describe, expect, test } from 'vitest'
import { buildChainYAxis } from '../chartYAxis'

describe('chain chart y-axis layout', () => {
	test('gives each metric axis its own color, unit formatter and stacked offset', () => {
		const axes = buildChainYAxis({
			allYAxis: [
				['TVL', undefined],
				['Active Addresses', 1],
				['Token Price', 2]
			],
			baseYAxis: {},
			chartColors: { TVL: '#111', 'Active Addresses': '#222', 'Token Price': '#333' },
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
		expect(usersAxis.axisLine?.lineStyle).toMatchObject({ color: '#222' })
		expect(priceAxis.axisLine?.lineStyle).toMatchObject({ color: '#333' })
		expect(usersFormatter(1000, 0, null)).toBe('1,000')
		expect(usersFormatter(2_500_000, 0, null)).toBe('2.5m')
		expect(priceFormatter(5, 0, null)).toBe('$5')
		// The third axis shifts right so its labels do not overlap the second axis.
		expect(axes.map((axis) => axis.offset ?? 0)).toEqual([0, 0, 40])
	})
})
