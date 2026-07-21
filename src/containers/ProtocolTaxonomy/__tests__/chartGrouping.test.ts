import { describe, expect, it } from 'vitest'
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
	it('groups bar and line series while preserving sparse null values', () => {
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

	it('returns original chart behavior and hasBarCharts false when no series started as bars', () => {
		const charts = makeCharts()
		charts.charts = [{ type: 'line', name: 'TVL', encode: { x: 'timestamp', y: 'TVL' } }]

		const result = buildProtocolTaxonomyGroupedCharts({ charts, groupBy: 'daily' })

		expect(result.charts).toBe(charts)
		expect(result.hasBarCharts).toBe(false)
	})

	it('renders cumulative bar groupings as line series', () => {
		const result = buildProtocolTaxonomyGroupedCharts({ charts: makeCharts(), groupBy: 'cumulative' })

		expect(result.hasBarCharts).toBe(true)
		expect(result.charts.charts[0].type).toBe('line')
		expect(result.charts.dataset.source.map((row) => row[1])).toEqual([10, null, 40])
	})

	it('sums bars but keeps the last line snapshot in weekly buckets', () => {
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

	it('never accumulates line snapshots in cumulative mode', () => {
		const result = buildProtocolTaxonomyGroupedCharts({ charts: makeCharts(), groupBy: 'cumulative' })

		expect(result.charts.dataset.source.map((row) => row[2])).toEqual([100, 120, null])
	})

	it('returns the original chart object and hasBarCharts false when bar series have no numeric values', () => {
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
