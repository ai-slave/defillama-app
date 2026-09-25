import { describe, expect, test } from 'vitest'
import type { RWAPositionalChartDataset } from '../chartDataset'
import {
	dropRwaRedundantTotal,
	ensureRwaTotalSeries,
	foldRwaTopSeries,
	RWA_OTHERS_SERIES_LABEL,
	toRwaShareDataset
} from '../chartFold'

const dataset = (dimensions: Array<string>, source: RWAPositionalChartDataset['source']): RWAPositionalChartDataset =>
	({ dimensions, source }) as RWAPositionalChartDataset

describe('foldRwaTopSeries', () => {
	test('keeps the largest series by latest value, in that order, and folds the rest into Others', () => {
		const folded = foldRwaTopSeries(
			dataset(
				['timestamp', 'Total Active AUM', 'A', 'B', 'C', 'D'],
				[
					[1, 10, 1, 2, 3, 4],
					[2, 20, 9, 1, 5, 5]
				]
			),
			{ max: 2 }
		)
		expect(folded.dimensions).toEqual(['timestamp', 'Total Active AUM', 'A', 'C', RWA_OTHERS_SERIES_LABEL])
		expect(folded.source).toEqual([
			[1, 10, 1, 3, 6],
			[2, 20, 9, 5, 6]
		])
	})

	test('breaks a tie on the latest value by name', () => {
		const folded = foldRwaTopSeries(dataset(['timestamp', 'B', 'A', 'C'], [[1, 5, 5, 1]]), { max: 2 })
		expect(folded.dimensions).toEqual(['timestamp', 'A', 'B', RWA_OTHERS_SERIES_LABEL])
	})

	test('adds no Others when the series fit under or at the cap', () => {
		const under = foldRwaTopSeries(dataset(['timestamp', 'A', 'B'], [[1, 1, 2]]), { max: 3 })
		expect(under.dimensions).toEqual(['timestamp', 'B', 'A'])
		const at = foldRwaTopSeries(dataset(['timestamp', 'A', 'B', 'C'], [[1, 1, 2, 3]]), { max: 3 })
		expect(at.dimensions).toEqual(['timestamp', 'C', 'B', 'A'])
	})

	test('keeps an Others row null when every folded series is null', () => {
		const folded = foldRwaTopSeries(
			dataset(
				['timestamp', 'A', 'B', 'C'],
				[
					[1, 5, null, null],
					[2, 5, 1, null]
				]
			),
			{ max: 1 }
		)
		expect(folded.source).toEqual([
			[1, 5, null],
			[2, 5, 1]
		])
	})

	test('ranks a series whose latest value is null as zero', () => {
		const folded = foldRwaTopSeries(
			dataset(
				['timestamp', 'A', 'B'],
				[
					[1, 100, 1],
					[2, null, 1]
				]
			),
			{ max: 1 }
		)
		expect(folded.dimensions).toEqual(['timestamp', 'B', RWA_OTHERS_SERIES_LABEL])
	})

	test('keeps the Total line out of the ranking', () => {
		const folded = foldRwaTopSeries(dataset(['timestamp', 'A', 'Total Onchain AUM', 'B'], [[1, 1, 3, 2]]), { max: 1 })
		expect(folded.dimensions).toEqual(['timestamp', 'Total Onchain AUM', 'B', RWA_OTHERS_SERIES_LABEL])
		expect(folded.source).toEqual([[1, 3, 2, 1]])
	})

	test('folds an existing Others series into the new one and keeps it last', () => {
		const folded = foldRwaTopSeries(
			dataset(['timestamp', 'Total Active AUM', 'Others', 'A', 'B'], [[1, 10, 5, 1, 2]]),
			{ max: 1 }
		)
		expect(folded.dimensions).toEqual(['timestamp', 'Total Active AUM', 'B', RWA_OTHERS_SERIES_LABEL])
		expect(folded.source).toEqual([[1, 10, 2, 6]])
		const under = foldRwaTopSeries(dataset(['timestamp', 'Others', 'A'], [[1, 5, 1]]), { max: 3 })
		expect(under.dimensions).toEqual(['timestamp', 'A', RWA_OTHERS_SERIES_LABEL])
		expect(under.source).toEqual([[1, 1, 5]])
	})

	test('takes a custom Others label', () => {
		const folded = foldRwaTopSeries(dataset(['timestamp', 'A', 'B'], [[1, 1, 2]]), { max: 1, othersLabel: 'Rest' })
		expect(folded.dimensions).toEqual(['timestamp', 'B', 'Rest'])
	})
})

describe('toRwaShareDataset', () => {
	test('draws every row as percent of its total and drops the Total series', () => {
		const share = toRwaShareDataset(
			dataset(
				['timestamp', 'Total Active AUM', 'A', 'B'],
				[
					[1, 4, 1, 3],
					[2, 10, 5, 5]
				]
			)
		)
		expect(share.dimensions).toEqual(['timestamp', 'A', 'B'])
		expect(share.source).toEqual([
			[1, 25, 75],
			[2, 50, 50]
		])
	})

	test('sums the row from the series, not the Total column', () => {
		const share = toRwaShareDataset(dataset(['timestamp', 'Total Active AUM', 'A', 'B'], [[1, 999, 2, 2]]))
		expect(share.source).toEqual([[1, 50, 50]])
	})

	test('keeps Others in the share and in its denominator', () => {
		const share = toRwaShareDataset(dataset(['timestamp', 'Total Active AUM', 'A', 'Others'], [[1, 4, 1, 3]]))
		expect(share.dimensions).toEqual(['timestamp', 'A', 'Others'])
		expect(share.source).toEqual([[1, 25, 75]])
	})

	test('keeps a row null when its total is zero or missing', () => {
		const share = toRwaShareDataset(
			dataset(
				['timestamp', 'A', 'B'],
				[
					[1, 0, 0],
					[2, null, null],
					[3, null, 4]
				]
			)
		)
		expect(share.source).toEqual([
			[1, null, null],
			[2, null, null],
			[3, null, 100]
		])
	})
})

describe('ensureRwaTotalSeries', () => {
	test('adds a Total series first when the dataset has none', () => {
		const withTotal = ensureRwaTotalSeries(
			dataset(
				['timestamp', 'A', 'B'],
				[
					[1, 1, 2],
					[2, null, null],
					[3, 4, null]
				]
			),
			'Total Active AUM'
		)
		expect(withTotal.dimensions).toEqual(['timestamp', 'Total Active AUM', 'A', 'B'])
		expect(withTotal.source).toEqual([
			[1, 3, 1, 2],
			[2, null, null, null],
			[3, 4, 4, null]
		])
	})

	test('counts Others in the Total it adds', () => {
		const withTotal = ensureRwaTotalSeries(dataset(['timestamp', 'A', 'Others'], [[1, 1, 2]]), 'Total Active AUM')
		expect(withTotal.source).toEqual([[1, 3, 1, 2]])
	})

	test('returns the dataset as is when a Total series exists', () => {
		const input = dataset(['timestamp', 'Total Active AUM', 'A'], [[1, 1, 1]])
		expect(ensureRwaTotalSeries(input, 'Total Active AUM')).toBe(input)
	})
})

describe('dropRwaRedundantTotal', () => {
	test('drops the Total when one member equals it on every row, so a one-asset platform draws one line', () => {
		const dropped = dropRwaRedundantTotal(
			dataset(
				['timestamp', 'Total Active AUM', 'Goldfish Gold'],
				[
					[0, 0, null],
					[1, 10, 10],
					[2, null, null],
					[3, 12, 12]
				]
			)
		)
		expect(dropped.dimensions).toEqual(['timestamp', 'Goldfish Gold'])
		expect(dropped.source).toEqual([
			[0, null],
			[1, 10],
			[2, null],
			[3, 12]
		])
	})

	test('keeps the Total with two members, and with one member that differs on a row', () => {
		const two = dataset(['timestamp', 'Total Active AUM', 'A', 'B'], [[1, 10, 4, 6]])
		expect(dropRwaRedundantTotal(two)).toBe(two)
		const differs = dataset(
			['timestamp', 'Total Active AUM', 'A'],
			[
				[1, 10, 10],
				[2, 12, 11]
			]
		)
		expect(dropRwaRedundantTotal(differs)).toBe(differs)
	})
})
