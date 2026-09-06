import { describe, expect, test } from 'vitest'
import { assignColors, chartToModel, defaultZoomOptions, zoomStartPct, type ChartData } from './api'

describe('Odyssey chart API contracts', () => {
	test('aligns date and series arrays while preserving missing observations', () => {
		const chart = {
			dates: ['2026-01-01', '2026-01-02'],
			series: [{ name: 'TVL', data: [10], color: '#123' }]
		} satisfies ChartData
		const model = chartToModel(chart)
		expect(model.dataset).toEqual({
			dimensions: ['timestamp', 'TVL'],
			source: [
				[Date.parse('2026-01-01T00:00:00Z'), 10],
				[Date.parse('2026-01-02T00:00:00Z'), null]
			]
		})
		expect(model.charts).toEqual([
			expect.objectContaining({ name: 'TVL', type: 'line', color: '#123', encode: { x: 0, y: 1 } })
		])
	})

	test('builds deterministic zoom and color configuration', () => {
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
