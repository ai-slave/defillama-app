import { describe, expect, it } from 'vitest'
import type { IMultiSeriesChartProps } from '~/components/ECharts/types'
import { assignColors, chartToTs, defaultZoomOptions, seriesPairs, zoomStartPct, type ChartData } from './api'

describe('Odyssey chart API contracts', () => {
	it('aligns date and series arrays while preserving missing observations', () => {
		const chart = {
			dates: ['2026-01-01', '2026-01-02'],
			series: [{ name: 'TVL', data: [10], color: '#123' }]
		} satisfies ChartData
		const series: NonNullable<IMultiSeriesChartProps['series']> = chartToTs(chart)
		expect(series).toEqual([
			{
				name: 'TVL',
				type: 'line',
				color: '#123',
				data: [
					[Date.parse('2026-01-01T00:00:00Z') / 1e3, 10],
					[Date.parse('2026-01-02T00:00:00Z') / 1e3, null]
				]
			}
		])
		expect(seriesPairs(chart.dates, [1, null])).toEqual([
			[Date.parse('2026-01-01T00:00:00Z') / 1e3, 1],
			[Date.parse('2026-01-02T00:00:00Z') / 1e3, null]
		])
	})

	it('builds deterministic zoom and color configuration', () => {
		const dates = ['2026-01-01', '2026-02-01', '2026-03-01']
		expect(zoomStartPct(dates, '2026-02-01')).toBe(50)
		expect(defaultZoomOptions(50)).toEqual({
			dataZoom: [
				{ start: 50, end: 100 },
				{ start: 50, end: 100 }
			]
		})
		expect(defaultZoomOptions(0)).toBeUndefined()
		expect(Object.keys(assignColors(['Z', 'A']))).toEqual(['A', 'Z'])
	})
})
