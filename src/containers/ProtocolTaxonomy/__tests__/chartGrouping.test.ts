import { describe, expect, test } from 'vitest'
import { buildProtocolTaxonomyGroupedCharts } from '../chartGrouping'
import type { IProtocolTaxonomyPageData } from '../types'

const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

function makeCharts(): IProtocolTaxonomyPageData['charts'] {
	return {
		dataset: {
			dimensions: ['timestamp', 'Volume', 'TVL'],
			source: [
				[toMs(2024, 1, 1), 10, 100],
				[toMs(2024, 1, 2), null, 120],
				[toMs(2024, 1, 3), 30, null]
			]
		},
		charts: [
			{ type: 'bar', name: 'Volume', encode: { x: 0, y: 1 } },
			{ type: 'line', name: 'TVL', encode: { x: 0, y: 2 } }
		]
	}
}

describe('buildProtocolTaxonomyGroupedCharts', () => {
	test('groups bar and line series while preserving sparse null values', () => {
		const result = buildProtocolTaxonomyGroupedCharts({ charts: makeCharts(), groupBy: 'daily' })

		expect(result.hasBarCharts).toBe(true)
		expect(result.charts.dataset).toEqual({
			dimensions: ['timestamp', 'Volume', 'TVL'],
			source: [
				[toMs(2024, 1, 1), 10, 100],
				[toMs(2024, 1, 2), null, 120],
				[toMs(2024, 1, 3), 30, null]
			]
		})
		expect(result.charts.charts.map((series) => series.type)).toEqual(['bar', 'line'])
	})

	test('reports the grouping its rows actually have, so lines alone never get a period label', () => {
		const lineOnly = makeCharts()
		lineOnly.charts = [{ type: 'line', name: 'TVL', encode: { x: 0, y: 2 } }]

		expect(buildProtocolTaxonomyGroupedCharts({ charts: makeCharts(), groupBy: 'monthly' }).groupBy).toBe('monthly')
		expect(buildProtocolTaxonomyGroupedCharts({ charts: lineOnly, groupBy: 'monthly' }).groupBy).toBe('daily')
	})

	test('returns original chart behavior and hasBarCharts false when no series started as bars', () => {
		const charts = makeCharts()
		charts.charts = [{ type: 'line', name: 'TVL', encode: { x: 0, y: 2 } }]

		const result = buildProtocolTaxonomyGroupedCharts({ charts, groupBy: 'daily' })

		expect(result.charts).toBe(charts)
		expect(result.hasBarCharts).toBe(false)
	})

	test('keeps cumulative bars unavailable after a missing required point', () => {
		const result = buildProtocolTaxonomyGroupedCharts({ charts: makeCharts(), groupBy: 'cumulative' })

		expect(result.hasBarCharts).toBe(true)
		expect(result.charts.charts[0]?.type).toBe('line')
		expect(result.charts.dataset.source.map((row) => row[1])).toEqual([10, null, null])
	})

	test('starts cumulative bars at their first measurement independent of input order', () => {
		const ordered = makeCharts()
		ordered.dataset.source = [
			[toMs(2024, 1, 1), null, 100],
			[toMs(2024, 1, 2), null, 120],
			[toMs(2024, 1, 3), 30, 130],
			[toMs(2024, 1, 4), 40, 140]
		]
		const shuffled = makeCharts()
		shuffled.dataset.source = [...ordered.dataset.source].reverse()

		const expected = [
			[toMs(2024, 1, 1), null, 100],
			[toMs(2024, 1, 2), null, 120],
			[toMs(2024, 1, 3), 30, 130],
			[toMs(2024, 1, 4), 70, 140]
		]
		expect(
			buildProtocolTaxonomyGroupedCharts({ charts: ordered, groupBy: 'cumulative' }).charts.dataset.source
		).toEqual(expected)
		expect(
			buildProtocolTaxonomyGroupedCharts({ charts: shuffled, groupBy: 'cumulative' }).charts.dataset.source
		).toEqual(expected)
	})

	test('does not poison the first weekly bucket when a bar starts mid-bucket', () => {
		const charts = makeCharts()
		charts.dataset.source = [
			[toMs(2024, 1, 15), null, 100],
			[toMs(2024, 1, 17), 5, 120]
		]

		expect(buildProtocolTaxonomyGroupedCharts({ charts, groupBy: 'weekly' }).charts.dataset.source).toEqual([
			[toMs(2024, 1, 21), 5, 120]
		])
	})

	test('sums bars but keeps the last line snapshot in weekly buckets', () => {
		const charts = makeCharts()
		charts.dataset.source = [
			[toMs(2024, 1, 15), 10, 100],
			[toMs(2024, 1, 17), 5, 120],
			[toMs(2024, 1, 22), 7, 130]
		]

		const result = buildProtocolTaxonomyGroupedCharts({ charts, groupBy: 'weekly' })

		expect(result.charts.dataset.source).toEqual([
			[toMs(2024, 1, 21), 15, 120],
			[toMs(2024, 1, 28), 7, 130]
		])
	})

	test('keeps a later unavailable line snapshot independent of input order', () => {
		const ordered = makeCharts()
		ordered.dataset.source = [
			[toMs(2024, 1, 15), 10, 100],
			[toMs(2024, 1, 17), 5, null]
		]
		const shuffled = makeCharts()
		shuffled.dataset.source = [...ordered.dataset.source].reverse()

		expect(buildProtocolTaxonomyGroupedCharts({ charts: ordered, groupBy: 'weekly' }).charts.dataset.source).toEqual([
			[toMs(2024, 1, 21), 15, null]
		])
		expect(buildProtocolTaxonomyGroupedCharts({ charts: shuffled, groupBy: 'weekly' }).charts.dataset.source).toEqual([
			[toMs(2024, 1, 21), 15, null]
		])
	})

	test('keeps a grouped bar unavailable when any bucket contribution is unavailable', () => {
		const ordered = makeCharts()
		ordered.dataset.source = [
			[toMs(2024, 1, 15), 10, 100],
			[toMs(2024, 1, 17), null, 120],
			[toMs(2024, 1, 22), 7, 130]
		]
		const shuffled = makeCharts()
		shuffled.dataset.source = [...ordered.dataset.source].reverse()

		const expected = [
			[toMs(2024, 1, 21), null, 120],
			[toMs(2024, 1, 28), 7, 130]
		]
		expect(buildProtocolTaxonomyGroupedCharts({ charts: ordered, groupBy: 'weekly' }).charts.dataset.source).toEqual(
			expected
		)
		expect(buildProtocolTaxonomyGroupedCharts({ charts: shuffled, groupBy: 'weekly' }).charts.dataset.source).toEqual(
			expected
		)
	})

	test('never accumulates line snapshots in cumulative mode', () => {
		const result = buildProtocolTaxonomyGroupedCharts({ charts: makeCharts(), groupBy: 'cumulative' })

		expect(result.charts.dataset.source.map((row) => row[2])).toEqual([100, 120, null])
	})

	test('preserves an explicit all-null timestamp between valid rows', () => {
		const charts = makeCharts()
		charts.dataset.source = [
			[toMs(2024, 1, 1), 10, 100],
			[toMs(2024, 1, 2), null, null],
			[toMs(2024, 1, 3), 30, 120]
		]

		const result = buildProtocolTaxonomyGroupedCharts({ charts, groupBy: 'daily' })

		expect(result.charts.dataset.source).toEqual(charts.dataset.source)
	})

	test('returns the original chart object and hasBarCharts false when bar series have no numeric values', () => {
		const charts = makeCharts()
		charts.dataset.source = [
			[toMs(2024, 1, 1), null, 100],
			[toMs(2024, 1, 2), null, 120]
		]
		const result = buildProtocolTaxonomyGroupedCharts({ charts, groupBy: 'daily' })

		expect(result.charts).toBe(charts)
		expect(result.hasBarCharts).toBe(false)
	})
})
