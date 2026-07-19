import { describe, expect, it } from 'vitest'
import { buildChainYAxis } from './chartYAxis'

describe('chain chart y-axis layout', () => {
	it('keeps per-metric colors, formatters, and spacing across three axes', () => {
		const axes = buildChainYAxis({
			allYAxis: [
				['TVL', undefined],
				['Active Addresses', 1],
				['Token Price', 2]
			],
			baseYAxis: { axisLabel: { color: '#aaa' } },
			chartColors: { TVL: '#111', 'Active Addresses': '#222', 'Token Price': '#333' },
			chartsInSeries: new Set(['TVL', 'Active Addresses', 'Token Price']),
			themeText: '#aaa'
		})

		const usersAxisLine = axes[1].axisLine as { lineStyle: { color: string } }
		const priceAxisLine = axes[2].axisLine as { lineStyle: { color: string } }
		const usersAxisLabel = axes[1].axisLabel as { color: string; formatter: (value: number) => string }
		const priceAxisLabel = axes[2].axisLabel as { color: string; formatter: (value: number) => string }
		expect(axes.map((axis) => axis.offset ?? 0)).toEqual([0, 0, 40])
		expect(usersAxisLine.lineStyle.color).toBe('#222')
		expect(priceAxisLine.lineStyle.color).toBe('#333')
		expect(usersAxisLabel.color).toBe('#222')
		expect(priceAxisLabel.color).toBe('#333')
		expect(usersAxisLabel.formatter(1_000)).toBe('1,000')
		expect(priceAxisLabel.formatter(5)).toContain('$')
	})
})
