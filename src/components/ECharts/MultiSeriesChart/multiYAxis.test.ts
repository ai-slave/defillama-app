import { describe, expect, it } from 'vitest'
import { buildMultiYAxis, normalizeSeriesYAxisIndices } from './multiYAxis'
import type { MultiSeriesYAxisOption } from './types'

const renderSeries = (name: string, yAxisIndex: number, color: string) => ({
	name,
	yAxisIndex,
	itemStyle: { color }
})

function formatAxisValue(axis: MultiSeriesYAxisOption, value: number): string {
	const formatter = axis.axisLabel?.formatter
	if (typeof formatter !== 'function') throw new Error('Expected a functional axis formatter')
	return formatter(value, 0, undefined)
}

describe('MultiSeriesChart y-axis layout', () => {
	it('uses a single series symbol without tinting the only axis', () => {
		const defaultFormatter = (value: number) => `${value} DEFAULT`
		const axes = buildMultiYAxis({
			series: [{ name: 'APY', itemStyle: { color: '#f00' } }],
			yAxis: { axisLabel: { formatter: defaultFormatter } },
			expandTo100Percent: false,
			effectiveCharts: [
				{
					type: 'line',
					name: 'APY',
					encode: { x: 'timestamp', y: 'APY' },
					color: '#f00',
					valueSymbol: '%'
				}
			],
			valueSymbol: '$',
			sourceAxisIndexes: null
		})!

		expect(axes).toHaveLength(1)
		expect(formatAxisValue(axes[0], 5)).toContain('%')
		expect(axes[0].axisLabel.formatter).not.toBe(defaultFormatter)
		expect(axes[0].axisLabel).not.toHaveProperty('color')
		expect(axes[0].axisLine.lineStyle).not.toHaveProperty('color')
	})

	it('preserves a caller-provided color on a single axis', () => {
		const axes = buildMultiYAxis({
			series: [{ name: 'Supply', itemStyle: { color: '#f00' } }],
			yAxis: {
				axisLabel: { color: '#neutral' },
				axisLine: { lineStyle: { color: '#line' } }
			},
			expandTo100Percent: false,
			effectiveCharts: [{ type: 'line', name: 'Supply', encode: { x: 'timestamp', y: 'Supply' }, color: '#f00' }],
			valueSymbol: '$',
			sourceAxisIndexes: null
		})!

		expect(axes[0].axisLabel.color).toBe('#neutral')
		expect(axes[0].axisLine.lineStyle.color).toBe('#line')
	})

	it('preserves an explicitly unitless series instead of using the chart fallback symbol', () => {
		const axes = buildMultiYAxis({
			series: [{ name: 'Users', itemStyle: { color: '#f00' } }],
			yAxis: {},
			expandTo100Percent: false,
			effectiveCharts: [
				{
					type: 'line',
					name: 'Users',
					encode: { x: 'timestamp', y: 'Users' },
					valueSymbol: ''
				}
			],
			valueSymbol: '$',
			sourceAxisIndexes: null
		})!

		expect(formatAxisValue(axes[0], 5)).not.toContain('$')
	})

	it('densely remaps a selected sparse axis', () => {
		const input = [renderSeries('Funding Rate', 2, '#f00')]
		const result = normalizeSeriesYAxisIndices(input)

		expect(result.sourceAxisIndexes).toEqual([2])
		expect(result.series).toEqual([renderSeries('Funding Rate', 0, '#f00')])
	})

	it('keeps each configured axis formatter after dense remapping', () => {
		const primaryFormatter = (value: number) => `$${value}`
		const fundingFormatter = (value: number) => `${value}% funding`
		const normalized = normalizeSeriesYAxisIndices([renderSeries('Funding Rate', 2, '#f00')])
		const configuredYAxis = [
			{ axisLabel: { formatter: primaryFormatter } },
			{},
			{ axisLabel: { formatter: fundingFormatter } }
		]
		const axes = buildMultiYAxis({
			series: normalized.series,
			yAxis: configuredYAxis,
			configuredYAxis,
			expandTo100Percent: false,
			effectiveCharts: [
				{
					type: 'line',
					name: 'Funding Rate',
					encode: { x: 'timestamp', y: 'Funding Rate' },
					yAxisIndex: 2,
					valueSymbol: '%'
				}
			],
			valueSymbol: '$',
			sourceAxisIndexes: normalized.sourceAxisIndexes
		})!

		expect(axes).toHaveLength(1)
		expect(axes[0].position).toBe('left')
		expect(axes[0].axisLabel.formatter).toBe(fundingFormatter)
	})

	it('clamps only the normalized percentage axis while leaving dollar overlays unbounded', () => {
		const normalized = normalizeSeriesYAxisIndices([
			renderSeries('Unlocks', 0, '#00f'),
			renderSeries('Market Cap', 2, '#0a0')
		])
		const axes = buildMultiYAxis({
			series: normalized.series,
			yAxis: { axisLabel: { formatter: (value: number) => `${value} TOKEN` } },
			expandTo100Percent: true,
			effectiveCharts: [
				{ type: 'bar', name: 'Unlocks', encode: { x: 'timestamp', y: 'Unlocks' }, yAxisIndex: 0 },
				{
					type: 'line',
					name: 'Market Cap',
					encode: { x: 'timestamp', y: 'Market Cap' },
					yAxisIndex: 2,
					valueSymbol: '$'
				}
			],
			valueSymbol: '%',
			sourceAxisIndexes: normalized.sourceAxisIndexes
		})!

		expect(axes).toHaveLength(2)
		expect(axes[0]).toMatchObject({ min: 0, max: 100, position: 'left' })
		expect(formatAxisValue(axes[0], 25)).toContain('%')
		expect(axes[1]).not.toHaveProperty('min')
		expect(axes[1]).not.toHaveProperty('max')
		expect(formatAxisValue(axes[1], 25)).toContain('$')
	})

	it('does not clamp an overlay when it is the only selected display axis', () => {
		const normalized = normalizeSeriesYAxisIndices([renderSeries('Market Cap', 2, '#0a0')])
		const axes = buildMultiYAxis({
			series: normalized.series,
			yAxis: {},
			expandTo100Percent: true,
			effectiveCharts: [
				{
					type: 'line',
					name: 'Market Cap',
					encode: { x: 'timestamp', y: 'Market Cap' },
					yAxisIndex: 2,
					valueSymbol: '$'
				}
			],
			valueSymbol: '%',
			sourceAxisIndexes: normalized.sourceAxisIndexes
		})!

		expect(axes).toHaveLength(1)
		expect(axes[0]).not.toHaveProperty('min')
		expect(axes[0]).not.toHaveProperty('max')
		expect(formatAxisValue(axes[0], 25)).toContain('$')
	})

	it('preserves axis colors, sides, and third-axis spacing', () => {
		const series = [renderSeries('TVL', 0, '#111'), renderSeries('APY', 1, '#222'), renderSeries('Users', 2, '#333')]
		const normalized = normalizeSeriesYAxisIndices(series)
		const axes = buildMultiYAxis({
			series: normalized.series,
			yAxis: {
				axisLabel: { color: '#neutral' },
				axisLine: { lineStyle: { color: '#neutral-line', opacity: 0.1 } }
			},
			expandTo100Percent: false,
			effectiveCharts: [
				{ type: 'line', name: 'TVL', encode: { x: 'timestamp', y: 'TVL' }, yAxisIndex: 0, color: '#111' },
				{ type: 'line', name: 'APY', encode: { x: 'timestamp', y: 'APY' }, yAxisIndex: 1, color: '#222' },
				{ type: 'line', name: 'Users', encode: { x: 'timestamp', y: 'Users' }, yAxisIndex: 2, color: '#333' }
			],
			valueSymbol: '',
			sourceAxisIndexes: normalized.sourceAxisIndexes
		})!

		expect(axes.map(({ position, offset }) => ({ position, offset }))).toEqual([
			{ position: 'left', offset: 0 },
			{ position: 'right', offset: 0 },
			{ position: 'right', offset: 40 }
		])
		expect(axes.map((axis) => axis.axisLine.lineStyle.color)).toEqual(['#neutral-line', '#222', '#333'])
		expect(axes.map((axis) => axis.axisLabel.color)).toEqual(['#neutral', '#neutral', '#neutral'])
		expect(axes[0].axisLine.lineStyle.opacity).toBe(0.1)
		for (const axis of axes.slice(1)) {
			expect(axis.axisLine.lineStyle.type).toEqual([5, 10])
			expect(axis.axisLine.lineStyle).not.toHaveProperty('opacity')
		}
		expect(axes.map((axis) => axis.alignTicks)).toEqual([undefined, undefined, undefined])
	})

	it('keeps two-axis labels neutral and makes the secondary series line opaque and dashed', () => {
		const axes = buildMultiYAxis({
			series: [renderSeries('TVL', 0, '#111'), renderSeries('APY', 1, '#222')],
			yAxis: {
				axisLabel: { color: '#neutral' },
				axisLine: { lineStyle: { color: '#neutral-line', opacity: 0.1 } }
			},
			expandTo100Percent: false,
			effectiveCharts: [
				{ type: 'line', name: 'TVL', encode: { x: 0, y: 1 }, yAxisIndex: 0, color: '#111' },
				{ type: 'line', name: 'APY', encode: { x: 0, y: 1 }, yAxisIndex: 1, color: '#222' }
			],
			valueSymbol: '',
			sourceAxisIndexes: null
		})!

		expect(axes[0].axisLabel.color).toBe('#neutral')
		expect(axes[1].axisLabel.color).toBe('#neutral')
		expect(axes[1].axisLine.lineStyle).toMatchObject({ color: '#222', type: [5, 10] })
		expect(axes[1].axisLine.lineStyle).not.toHaveProperty('opacity')
	})

	it('preserves explicit tick alignment without enabling it for other axes', () => {
		const series = [renderSeries('TVL', 0, '#111'), renderSeries('APY', 1, '#222')]
		const axes = buildMultiYAxis({
			series,
			yAxis: [{ alignTicks: true }, {}],
			expandTo100Percent: false,
			effectiveCharts: [
				{ type: 'line', name: 'TVL', encode: { x: 'timestamp', y: 'TVL' }, yAxisIndex: 0 },
				{ type: 'line', name: 'APY', encode: { x: 'timestamp', y: 'APY' }, yAxisIndex: 1 }
			],
			valueSymbol: '',
			sourceAxisIndexes: null
		})!

		expect(axes[0].alignTicks).toBe(true)
		expect(axes[1]).not.toHaveProperty('alignTicks')
	})

	it('does not tint a shared axis when its series use different colors', () => {
		const axes = buildMultiYAxis({
			series: [renderSeries('Revenue', 1, '#111'), renderSeries('Users', 1, '#222')],
			yAxis: {},
			expandTo100Percent: false,
			effectiveCharts: [
				{ type: 'line', name: 'Revenue', encode: { x: 'timestamp', y: 'Revenue' }, yAxisIndex: 1, color: '#111' },
				{ type: 'line', name: 'Users', encode: { x: 'timestamp', y: 'Users' }, yAxisIndex: 1, color: '#222' }
			],
			valueSymbol: '',
			sourceAxisIndexes: null
		})!

		expect(axes[1].axisLine.lineStyle).not.toHaveProperty('color')
		expect(axes[1].axisLabel).not.toHaveProperty('color')
	})

	it('keeps caller-provided axis sides and offsets', () => {
		const series = [renderSeries('TVL', 0, '#111'), renderSeries('APY', 1, '#222')]
		const axes = buildMultiYAxis({
			series,
			yAxis: [
				{ position: 'right', offset: 12, axisLine: { show: true } },
				{ position: 'left', offset: 28, axisLine: { show: false } }
			],
			expandTo100Percent: false,
			effectiveCharts: [
				{ type: 'line', name: 'TVL', encode: { x: 'timestamp', y: 'TVL' }, yAxisIndex: 0, color: '#111' },
				{ type: 'line', name: 'APY', encode: { x: 'timestamp', y: 'APY' }, yAxisIndex: 1, color: '#222' }
			],
			valueSymbol: '',
			sourceAxisIndexes: null
		})!

		expect(axes.map(({ position, offset }) => ({ position, offset }))).toEqual([
			{ position: 'right', offset: 12 },
			{ position: 'left', offset: 28 }
		])
		expect(axes.map((axis) => axis.axisLine.show)).toEqual([true, false])
	})

	it('spaces default offsets independently on each configured side', () => {
		const series = [renderSeries('TVL', 0, '#111'), renderSeries('APY', 1, '#222'), renderSeries('Users', 2, '#333')]
		const axes = buildMultiYAxis({
			series,
			yAxis: [{ position: 'left' }, { position: 'left' }, { position: 'right' }],
			configuredYAxis: [{ position: 'left' }, { position: 'left' }, { position: 'right' }],
			expandTo100Percent: false,
			effectiveCharts: [
				{ type: 'line', name: 'TVL', encode: { x: 'timestamp', y: 'TVL' }, yAxisIndex: 0 },
				{ type: 'line', name: 'APY', encode: { x: 'timestamp', y: 'APY' }, yAxisIndex: 1 },
				{ type: 'line', name: 'Users', encode: { x: 'timestamp', y: 'Users' }, yAxisIndex: 2 }
			],
			valueSymbol: '',
			sourceAxisIndexes: null
		})!

		expect(axes.map(({ position, offset }) => ({ position, offset }))).toEqual([
			{ position: 'left', offset: 0 },
			{ position: 'left', offset: 40 },
			{ position: 'right', offset: 0 }
		])
	})
})
