import { describe, expect, test } from 'vitest'
import { prepareProChartCsv } from './chartCsv'

describe('prepareProChartCsv', () => {
	test('exports every canonical time-series dimension', () => {
		expect(
			prepareProChartCsv(
				{
					dimensions: ['timestamp', 'Visible', 'Outside visual limit'],
					source: [
						[1_700_000_000_000, 100, 25],
						[1_700_086_400_000, 50]
					]
				},
				'complete-chart'
			)
		).toEqual({
			filename: 'complete-chart',
			rows: [
				['Date', 'Visible', 'Outside visual limit'],
				['2023-11-14', 100, 25],
				['2023-11-15', 50, '']
			]
		})
	})

	test('preserves category datasets without treating the first column as a date', () => {
		expect(
			prepareProChartCsv(
				{
					dimensions: ['Name', 'Value'],
					source: [
						['Alpha', 100],
						['Beta', 25]
					]
				},
				'categories'
			)
		).toEqual({
			filename: 'categories',
			rows: [
				['Name', 'Value'],
				['Alpha', 100],
				['Beta', 25]
			]
		})
	})
})
