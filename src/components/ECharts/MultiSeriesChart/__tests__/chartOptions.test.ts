import { describe, expect, test } from 'vitest'
import { chartColor } from '~/constants/colors'
import { getChartTheme } from '../../shared/chartTheme'
import {
	buildDefaultChartSettings,
	getViewportTooltipPosition,
	inferMultiSeriesCharts,
	mergeChartOptions,
	remapLogEligibleYAxes,
	withChartGroupBy
} from '../chartOptions'

const lightDefaults = () => buildDefaultChartSettings({ chartTheme: getChartTheme(false), valueSymbol: '$' })

describe('mergeChartOptions', () => {
	test('merges array data zoom overrides into the two default controllers by index', () => {
		const dataZoom = mergeChartOptions(lightDefaults(), { dataZoom: [{ start: 70 }, { start: 80 }] }).dataZoom as Array<
			Record<string, unknown>
		>

		expect(dataZoom.map(({ start, end }) => [start, end])).toEqual([
			[70, 100],
			[80, 100]
		])
	})

	test('keeps an explicit local-time opt-out and leaves an omitted or undefined one to the UTC default', () => {
		expect(mergeChartOptions(lightDefaults(), { useUTC: false }).useUTC).toBe(false)
		expect(mergeChartOptions(lightDefaults(), { useUTC: undefined }).useUTC).toBeUndefined()
		expect(mergeChartOptions(lightDefaults(), {})).not.toHaveProperty('useUTC')
	})

	test('removes a default component when the caller sets it to undefined', () => {
		expect(mergeChartOptions(lightDefaults(), { dataZoom: undefined })).not.toHaveProperty('dataZoom')
	})
})

describe('inferMultiSeriesCharts', () => {
	test('infers series in dimension order without assigning timestamp a color', () => {
		expect(inferMultiSeriesCharts(['First', 'timestamp', 'Second'], false)).toEqual([
			{ type: 'line', name: 'First', encode: { x: 1, y: 0 }, color: chartColor(0) },
			{ type: 'line', name: 'Second', encode: { x: 1, y: 2 }, color: chartColor(1) }
		])
	})

	test('uses the first dimension as the x-axis for category datasets and stacks when asked', () => {
		expect(inferMultiSeriesCharts(['category', 'Value'], true)).toEqual([
			{ type: 'line', name: 'Value', encode: { x: 0, y: 1 }, color: chartColor(0), stack: 'A' }
		])
	})
})

test('follows a selected sparse axis when log eligibility is remapped to dense axes', () => {
	expect(remapLogEligibleYAxes([2], [2])).toEqual([0])
	expect(remapLogEligibleYAxes([0, 2], [1, 2])).toEqual([1])
	expect(remapLogEligibleYAxes([2], null)).toEqual([2])
})

describe('withChartGroupBy', () => {
	test('labels a caller dataset export with the chart grouping it was started in', async () => {
		const source = withChartGroupBy(
			{ type: 'dataset', prepare: async () => ({ dimensions: ['timestamp', 'Value'], source: [[1, 10]] }) },
			'weekly'
		)
		if (source === 'rendered-chart' || source.type !== 'dataset') throw new Error('Expected a dataset source')

		expect(await source.prepare()).toEqual({ groupBy: 'weekly', dimensions: ['timestamp', 'Value'], source: [[1, 10]] })
	})

	test('keeps a grouping the caller names itself', async () => {
		const source = withChartGroupBy(
			{ type: 'dataset', prepare: () => ({ dimensions: ['timestamp'], source: [], groupBy: 'monthly' }) },
			'weekly'
		)
		if (source === 'rendered-chart' || source.type !== 'dataset') throw new Error('Expected a dataset source')

		expect((await source.prepare()).groupBy).toBe('monthly')
	})
})

describe('getViewportTooltipPosition', () => {
	const viewport: [number, number] = [1200, 800]
	const rect = (top: number, left = 0) => ({ top, bottom: top + 300, left, right: left + 600 })

	test('parks the tooltip offscreen while its chart is scrolled out of the viewport', () => {
		expect(
			getViewportTooltipPosition({ point: [100, 100], tooltipSize: [200, 80], containerRect: rect(-900), viewport })
		).toEqual([-100_000, -100_000])
	})

	test('places the tooltip above and right of the cursor inside a visible chart', () => {
		expect(
			getViewportTooltipPosition({ point: [100, 200], tooltipSize: [200, 80], containerRect: rect(100), viewport })
		).toEqual([116, 104])
	})

	test('flips the tooltip left of the cursor near the right viewport edge and below it near the top', () => {
		expect(
			getViewportTooltipPosition({ point: [550, 20], tooltipSize: [200, 80], containerRect: rect(0, 600), viewport })
		).toEqual([334, 36])
	})
})
