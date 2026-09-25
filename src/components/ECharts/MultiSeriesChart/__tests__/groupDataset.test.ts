import { describe, expect, test } from 'vitest'
import { groupMultiSeriesBarChartDataset } from '../groupDataset'
import type { MultiSeriesTimeSeriesDataset } from '../types'

const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

describe('groupMultiSeriesBarChartDataset', () => {
	test('groups multi-series bar datasets by interval', () => {
		const dataset: MultiSeriesTimeSeriesDataset = {
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[toMs(2024, 1, 15), 10, 5],
				[toMs(2024, 1, 20), 15],
				[toMs(2024, 2, 1), 30, 20]
			]
		}

		expect(groupMultiSeriesBarChartDataset({ dataset, groupBy: 'monthly' })).toEqual({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[toMs(2024, 1, 1), 25, 5],
				[toMs(2024, 2, 1), 30, 20]
			]
		})
		expect(groupMultiSeriesBarChartDataset({ dataset, groupBy: 'daily' })).toBe(dataset)
	})

	test('groups sparse multi-series rows in one chronological dataset', () => {
		const dataset: MultiSeriesTimeSeriesDataset = {
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[toMs(2024, 1, 3), 10],
				[toMs(2024, 1, 3), 2],
				[toMs(2024, 1, 20), undefined, 5],
				[toMs(2024, 2, 1), undefined, 4]
			]
		}

		expect(groupMultiSeriesBarChartDataset({ dataset, groupBy: 'monthly' })).toEqual({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[toMs(2024, 1, 1), 12, 5],
				[toMs(2024, 2, 1), undefined, 4]
			]
		})
	})

	test('preserves negative flows when grouping multi-series bars', () => {
		const dataset: MultiSeriesTimeSeriesDataset = {
			dimensions: ['timestamp', 'Inflows'],
			source: [
				[toMs(2024, 1, 3), 100],
				[toMs(2024, 1, 20), -30]
			]
		}

		expect(groupMultiSeriesBarChartDataset({ dataset, groupBy: 'monthly' })).toEqual({
			dimensions: ['timestamp', 'Inflows'],
			source: [[toMs(2024, 1, 1), 70]]
		})
	})

	test('computes independent cumulative totals for sparse multi-series rows', () => {
		const dataset: MultiSeriesTimeSeriesDataset = {
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[toMs(2024, 1, 1), undefined, 7],
				[toMs(2024, 1, 1), 10],
				[toMs(2024, 1, 2), 5],
				[toMs(2024, 1, 3), undefined, -2]
			]
		}

		expect(groupMultiSeriesBarChartDataset({ dataset, groupBy: 'cumulative' })).toEqual({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[toMs(2024, 1, 1), 10, 7],
				[toMs(2024, 1, 2), 15, 7],
				[toMs(2024, 1, 3), 15, 5]
			]
		})
	})
})
