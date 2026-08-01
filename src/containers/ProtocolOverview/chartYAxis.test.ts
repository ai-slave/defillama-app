import { describe, expect, it } from 'vitest'
import { buildProtocolYAxis } from './chartYAxis'

describe('protocol chart y-axis layout', () => {
	it('keeps per-metric formatters, colors, and spacing across three axes', () => {
		const axes = buildProtocolYAxis({
			allYAxis: [
				['TVL', undefined],
				['Median APY', 1],
				['Gas Used', 2]
			],
			baseYAxis: { axisLabel: { color: '#aaa' } },
			chartColors: { TVL: '#111', 'Median APY': '#222', 'Gas Used': '#333' },
			chartsInSeries: new Set(['TVL', 'Median APY', 'Gas Used']),
			unlockTokenSymbol: 'TOKEN',
			gasUsedValueSymbol: 'GAS'
		})

		const apyAxis = axes[1]
		const gasAxis = axes[2]
		if (!apyAxis || !gasAxis) throw new Error('Expected APY and gas axes')
		const apyAxisLine = apyAxis.axisLine as { lineStyle: { color: string } }
		const gasAxisLine = gasAxis.axisLine as { lineStyle: { color: string } }
		const apyAxisLabel = apyAxis.axisLabel as { formatter: (value: number) => string }
		const gasAxisLabel = gasAxis.axisLabel as { formatter: (value: number) => string }
		expect(axes.map((axis) => axis.offset ?? 0)).toEqual([0, 0, 40])
		expect(apyAxisLine.lineStyle.color).toBe('#222')
		expect(gasAxisLine.lineStyle.color).toBe('#333')
		expect(apyAxisLabel.formatter(5)).toBe('5%')
		expect(gasAxisLabel.formatter(5)).toContain('GAS')
		expect(axes.every((axis) => axis.alignTicks == null)).toBe(true)
	})
})
