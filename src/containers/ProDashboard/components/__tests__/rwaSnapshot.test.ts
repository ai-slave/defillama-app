import { assert, describe, expect, test } from 'vitest'
import type { RWAPositionalChartDataset } from '~/containers/RWA/chartDataset'
import {
	buildRwaSnapshotCsvRows,
	buildRwaSnapshotPresentation,
	findLatestRwaSnapshotRow,
	hasRwaOverviewChartExportData
} from '../rwaSnapshot'

const DAY = 86_400_000
const dataset: RWAPositionalChartDataset = {
	dimensions: ['timestamp', 'Alpha', 'Beta', 'Gamma'],
	source: [
		[DAY, 1, 0, null],
		[2 * DAY, -4, 3, 2],
		[3 * DAY, 5, null, 4],
		[3 * DAY, 6, 1, 0]
	]
}

describe('RWA snapshot presentation', () => {
	test('selects the latest duplicate timestamp and keeps inclusive custom boundaries', () => {
		expect(
			findLatestRwaSnapshotRow(dataset, 'custom', {
				type: 'absolute',
				startDate: (2 * DAY) / 1e3,
				endDate: (3 * DAY) / 1e3
			})
		).toEqual([3 * DAY, 6, 1, 0])
	})

	test('returns no snapshot when the latest point before the end is outside the period', () => {
		expect(
			findLatestRwaSnapshotRow(dataset, 'custom', {
				type: 'absolute',
				startDate: (4 * DAY) / 1e3,
				endDate: (5 * DAY) / 1e3
			})
		).toBeNull()
		expect(findLatestRwaSnapshotRow({ source: [], dimensions: ['timestamp'] }, 'all')).toBeNull()
	})

	test('builds only the requested sorted pie or capped hbar snapshot', () => {
		expect(buildRwaSnapshotPresentation({ dataset, view: 'pie', timePeriod: 'all', breakdownLabel: 'Chain' })).toEqual({
			view: 'pie',
			data: [
				{ name: 'Alpha', value: 6 },
				{ name: 'Beta', value: 1 }
			]
		})
		expect(buildRwaSnapshotPresentation({ dataset, view: 'hbar', timePeriod: 'all', breakdownLabel: 'Chain' })).toEqual(
			{ view: 'hbar', categories: ['Alpha', 'Beta'], values: [6, 1] }
		)
	})

	test('preserves dimension order and excludes negative, zero, and missing values in treemaps', () => {
		const presentation = buildRwaSnapshotPresentation({
			dataset,
			view: 'treemap',
			timePeriod: 'custom',
			customTimePeriod: { type: 'absolute', startDate: (2 * DAY) / 1e3, endDate: (2 * DAY) / 1e3 },
			breakdownLabel: 'Category'
		})
		assert(presentation.view === 'treemap')
		expect(presentation.data.map(({ name, value }) => ({ name, value: value[0] }))).toEqual([
			{ name: 'Beta', value: 3 },
			{ name: 'Gamma', value: 2 }
		])
	})

	test('exposes exports only when the active presentation has data', () => {
		const emptyDataset: RWAPositionalChartDataset = { dimensions: ['timestamp'], source: [] }
		expect(hasRwaOverviewChartExportData('timeSeries', dataset, null)).toBe(true)
		expect(hasRwaOverviewChartExportData('timeSeries', emptyDataset, null)).toBe(false)
		expect(hasRwaOverviewChartExportData('pie', null, { view: 'pie', data: [{ name: 'Alpha', value: 1 }] })).toBe(true)
		expect(hasRwaOverviewChartExportData('hbar', null, { view: 'hbar', categories: [], values: [] })).toBe(false)
		expect(hasRwaOverviewChartExportData('hbar', null, { view: 'hbar', categories: ['Alpha'], values: [1] })).toBe(true)
		expect(hasRwaOverviewChartExportData('treemap', null, { view: 'treemap', data: [] })).toBe(false)
		expect(
			hasRwaOverviewChartExportData('treemap', null, {
				view: 'treemap',
				data: [{ name: 'Alpha', path: 'Alpha', value: [1, 1, 1], children: [] }]
			})
		).toBe(true)
	})
})

test('exports snapshot labels and raw values for each presentation', () => {
	const expected = [
		['Chain', 'TVL'],
		['Alpha', 12]
	]
	expect(buildRwaSnapshotCsvRows({ view: 'pie', data: [{ name: 'Alpha', value: 12 }] }, 'Chain', 'TVL')).toEqual(
		expected
	)
	expect(buildRwaSnapshotCsvRows({ view: 'hbar', categories: ['Alpha'], values: [12] }, 'Chain', 'TVL')).toEqual(
		expected
	)
	expect(
		buildRwaSnapshotCsvRows(
			{ view: 'treemap', data: [{ name: 'Alpha', path: 'Alpha', value: [12, 12, 12], children: [] }] },
			'Chain',
			'TVL'
		)
	).toEqual(expected)
})
