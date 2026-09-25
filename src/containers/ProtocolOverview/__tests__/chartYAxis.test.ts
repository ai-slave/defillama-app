import { describe, expect, test } from 'vitest'
import { buildProtocolYAxis } from '../chartYAxis'
import type { ProtocolChartsLabels } from '../constants'

function axes(allYAxis: Array<[ProtocolChartsLabels, number | undefined]>) {
	return buildProtocolYAxis({
		allYAxis,
		baseYAxis: { axisLabel: { color: '#aaa' } },
		chartColors: { TVL: '#111', 'Median APY': '#222', 'Gas Used': '#333' },
		chartsInSeries: new Set(allYAxis.map(([type]) => type)),
		unlockTokenSymbol: 'TOKEN',
		gasUsedValueSymbol: 'GAS'
	}).map((axis) => {
		if (axis.type === 'log') throw new Error('protocol charts only build value axes')
		return axis
	})
}

type AxisMin = (extent: { min?: number }) => number

describe('protocol chart y-axis layout', () => {
	test('labels each axis in its metric unit and colors it like its series', () => {
		const [, apyAxis, gasAxis, unlocksAxis] = axes([
			['TVL', undefined],
			['Median APY', 1],
			['Gas Used', 2],
			['Unlocks', 3]
		])
		const label = (axis: typeof apyAxis) => (axis!.axisLabel as { formatter: (value: number) => string }).formatter
		expect(label(apyAxis)(5)).toBe('5%')
		expect(label(gasAxis)(5)).toBe('5 GAS')
		expect(label(unlocksAxis)(5)).toBe('5 TOKEN')
		expect((apyAxis!.axisLine as { lineStyle: { color: string } }).lineStyle.color).toBe('#222')
		expect((gasAxis!.axisLine as { lineStyle: { color: string } }).lineStyle.color).toBe('#333')
	})

	test('scales price and valuation axes while volume and TVL start at zero unless values go negative', () => {
		const [priceAxis, volumeAxis, valuationAxis, tvlAxis] = axes([
			['Token Price', undefined],
			['Token Volume', 1],
			['Mcap', 2],
			['TVL', 3]
		])
		expect([priceAxis!.scale, priceAxis!.min]).toEqual([true, undefined])
		expect([valuationAxis!.scale, valuationAxis!.min]).toEqual([true, undefined])
		for (const axis of [volumeAxis!, tvlAxis!]) {
			const min = axis.min as AxisMin
			expect([axis.scale, min({ min: 5 }), min({ min: -3 })]).toEqual([undefined, 0, -3])
		}
	})
})
