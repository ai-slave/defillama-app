import { describe, expect, test } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import { getChartTheme } from '../../shared/chartTheme'
import { buildMultiSeries, getPointerLines, getPointerStack, projectionLabelFits } from '../series'
import type { MultiSeriesChartSeriesConfig } from '../types'

const chartTheme = getChartTheme(false)
const NO_ICONS: ReadonlySet<string> = new Set()

function requireSeries(series: ReturnType<typeof buildMultiSeries>[number] | undefined) {
	if (!series) throw new Error('Expected a chart series')
	return series
}

function requireLineSeries(series: ReturnType<typeof buildMultiSeries>[number] | undefined) {
	if (!series || series.type !== 'line') throw new Error('Expected a line series')
	return series
}

describe('MultiSeriesChart series construction', () => {
	test('brightens emphasized series without dimming their peers', () => {
		const series = buildMultiSeries({
			charts: [
				// Fixed inputs: this tests the brightening, not the palette.
				{ name: 'First', type: 'bar', stack: 'total', encode: { x: 'timestamp', y: 'First' }, color: '#1f67d2' },
				{ name: 'Second', type: 'bar', stack: 'total', encode: { x: 'timestamp', y: 'Second' }, color: '#e91e63' }
			],
			selectedCharts: undefined,
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			validLegendIcons: NO_ICONS,
			chartTheme
		})

		expect(series[0]?.emphasis).toEqual({ itemStyle: { color: 'rgba(87,141,221,1)' } })
		expect(series[1]?.emphasis).toEqual({ itemStyle: { color: 'rgba(238,86,138,1)' } })
		expect(series[0]?.blur).toBeUndefined()
		expect(series[1]?.blur).toBeUndefined()
	})

	test('keeps stacked bars out of ECharts large mode and normalizes explicit axes', () => {
		const series = buildMultiSeries({
			charts: [
				{ name: 'Bars', type: 'bar', stack: 'total', encode: { x: 'timestamp', y: 'Bars' } },
				{ name: 'Rate', type: 'line', yAxisIndex: 1, encode: { x: 'timestamp', y: 'Rate' } }
			],
			selectedCharts: undefined,
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			validLegendIcons: NO_ICONS,
			chartTheme
		})

		expect(series[0]).toMatchObject({ large: false, stack: 'total', yAxisIndex: 0 })
		expect(series[1]).toMatchObject({ yAxisIndex: 1 })
	})

	test('uses TBD presentation when inconsistent external metadata marks both projection states', () => {
		const series = requireLineSeries(
			buildMultiSeries({
				charts: [
					{
						name: 'Projection',
						type: 'line',
						encode: { x: 'timestamp', y: 'Projection' },
						isTBD: true,
						isForecast: true
					}
				],
				selectedCharts: undefined,
				expandTo100Percent: false,
				solidChartAreaStyle: false,
				validLegendIcons: NO_ICONS,
				chartTheme
			})[0]
		)

		expect(series.endLabel).toMatchObject({ formatter: 'TBD', offset: [-40, 10] })
	})

	test('hides a projection end label only when its segment is too short to fit it', () => {
		expect(projectionLabelFits(100, 84)).toBe(true)
		expect(projectionLabelFits(84, 100)).toBe(true)
		expect(projectionLabelFits(100, 85)).toBe(false)
		// Log axes project zero to NaN; the label stays rather than disappearing.
		expect(projectionLabelFits(100, Number.NaN)).toBe(true)
	})

	test('keeps fallback colors stable when an earlier series is filtered out', () => {
		const series = requireSeries(
			buildMultiSeries({
				charts: [
					{ name: 'First', type: 'line', encode: { x: 0, y: 1 } },
					{ name: 'Second', type: 'line', encode: { x: 0, y: 2 } }
				],
				selectedCharts: new Set(['Second']),
				expandTo100Percent: false,
				solidChartAreaStyle: false,
				validLegendIcons: NO_ICONS,
				chartTheme
			})[0]
		)

		expect(series.itemStyle).toMatchObject({ color: CHART_COLORS[1] })
	})

	test('renders a legend icon only for URLs that have been probed as valid', () => {
		const charts = [
			{ name: 'Probed', type: 'line' as const, encode: { x: 0, y: 1 }, legendIconUrl: 'https://icons/probed.png' },
			{ name: 'Pending', type: 'line' as const, encode: { x: 0, y: 2 }, legendIconUrl: 'https://icons/pending.png' }
		]
		const series = buildMultiSeries({
			charts,
			selectedCharts: undefined,
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			validLegendIcons: new Set(['https://icons/probed.png']),
			chartTheme
		})

		expect(series[0]).toMatchObject({ legendIcon: 'image://https://icons/probed.png' })
		expect(series[1]).not.toHaveProperty('legendIcon')
	})

	test('connects line gaps when the chart asks for it', () => {
		const [line] = buildMultiSeries({
			charts: [{ type: 'line', name: 'Value', encode: { x: 0, y: 1 }, connectNulls: true }],
			selectedCharts: undefined,
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			validLegendIcons: NO_ICONS,
			chartTheme
		})

		expect(line).toMatchObject({ type: 'line', connectNulls: true })
	})

	test('passes a typed step mode to line series', () => {
		const series = requireLineSeries(
			buildMultiSeries({
				charts: [{ name: 'Rounds', type: 'line', encode: { x: 0, y: 1 }, step: 'end' }],
				selectedCharts: undefined,
				expandTo100Percent: false,
				solidChartAreaStyle: false,
				validLegendIcons: NO_ICONS,
				chartTheme
			})[0]
		)

		expect(series).toMatchObject({ type: 'line', step: 'end' })
	})

	describe('the chart stack', () => {
		const line = (name: string, extra: Partial<MultiSeriesChartSeriesConfig> = {}): MultiSeriesChartSeriesConfig => ({
			name,
			type: 'line',
			encode: { x: 'timestamp', y: name },
			...extra
		})

		test('stacks every drawn series of a share chart except its overlay', () => {
			const charts = [
				line('Solana', { stack: 'Solana' }),
				line('Bitcoin', { stack: 'Bitcoin' }),
				line('Sui', { stack: 'Sui' }),
				line('Price', { yAxisIndex: 1 })
			]

			expect(getPointerStack(charts, new Set(['Solana', 'Bitcoin', 'Price']), true)).toEqual({
				series: new Set(['Solana', 'Bitcoin']),
				yAxisIndex: 0
			})
		})

		test('is one shared stack, never stacks side by side or unstacked series', () => {
			const stacked = (stacks: Array<string | undefined>) =>
				getPointerStack(
					stacks.map((stack, index) => line(`Series ${index}`, { stack })),
					undefined,
					false
				)

			expect(stacked(['fees', 'fees', 'revenue', 'revenue'])).toBeNull()
			expect(stacked([undefined, undefined])).toBeNull()
			expect(stacked(['total', 'total'])).toEqual({ series: new Set(['Series 0', 'Series 1']), yAxisIndex: 0 })
		})

		test('is null when values stack across zero', () => {
			const charts = [
				line('Base', { stack: 'growth', stackStrategy: 'all' }),
				line('Reward', { stack: 'growth', stackStrategy: 'all' })
			]

			expect(getPointerStack(charts, undefined, false)).toBeNull()
		})
	})

	test('names each unstacked line by its axis, and nothing for a lone line or a stack', () => {
		const build = (charts: Array<MultiSeriesChartSeriesConfig>) =>
			buildMultiSeries({
				charts,
				selectedCharts: undefined,
				expandTo100Percent: false,
				solidChartAreaStyle: false,
				validLegendIcons: NO_ICONS,
				chartTheme
			})
		const line = (name: string, extra: Partial<MultiSeriesChartSeriesConfig> = {}): MultiSeriesChartSeriesConfig => ({
			name,
			type: 'line',
			encode: { x: 'timestamp', y: name },
			...extra
		})

		expect(
			getPointerLines(build([line('TVL'), line('Fees', { yAxisIndex: 1 }), line('Volume', { type: 'bar' })]))
		).toEqual(
			new Map([
				['TVL', 0],
				['Fees', 1]
			])
		)
		expect(getPointerLines(build([line('TVL'), line('Volume', { type: 'bar' })]))).toBeNull()
		expect(getPointerLines(build([line('A', { stack: 's' }), line('B', { stack: 's' })]))).toBeNull()
	})
})
