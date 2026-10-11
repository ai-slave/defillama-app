import { describe, expect, test } from 'vitest'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
import type { RWAPositionalChartDataset } from '../chartDataset'
import {
	dropRwaRedundantTotal,
	ensureRwaTotalSeries,
	foldRwaTopSeries,
	getRwaRankedSeriesNames,
	RWA_OTHERS_SERIES_LABEL
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
})

describe('foldRwaTopSeries with a pick', () => {
	/* Two venues past the series cap, V1..Vn, whose latest value is their number, so Vn is the largest; a Total line and
	   an upstream Others. */
	const names = Array.from({ length: CHART_SERIES_LIMIT + 2 }, (_, index) => `V${index + 1}`)
	const largest = names[names.length - 1]
	const venues = dataset(
		['timestamp', 'Total Open Interest', ...names, 'Others'],
		[
			[1, 100, ...names.map(() => 1), 2],
			[2, 200, ...names.map((_, index) => index + 1), 3]
		]
	)
	const top = names.slice(2).reverse()
	const topLatest = top.map((_, index) => names.length - index)

	test('lists the members largest first, without the Total line or the upstream Others', () => {
		expect(getRwaRankedSeriesNames(venues)).toEqual([...top, 'V2', 'V1'])
	})

	test('without a pick the largest up to the cap draw their own series and the rest, upstream Others included, is Others', () => {
		const folded = foldRwaTopSeries(venues, {})
		expect(folded.dimensions).toEqual(['timestamp', 'Total Open Interest', ...top, 'Others'])
		expect(folded.source[1]).toEqual([2, 200, ...topLatest, 2 + 1 + 3])
	})

	test('an unpicked member leaves the chart, and so does the upstream Others while a member is unpicked', () => {
		const folded = foldRwaTopSeries(venues, { picked: ['V1', largest] })
		expect(folded.dimensions).toEqual(['timestamp', 'Total Open Interest', largest, 'V1'])
		expect(folded.source).toEqual([
			[1, 100, 1, 1],
			[2, 200, names.length, 1]
		])
	})

	test('picks past the cap fold into Others; the upstream Others joins only when every member is picked', () => {
		const pastCap = foldRwaTopSeries(venues, { picked: names.slice(0, CHART_SERIES_LIMIT + 1) })
		expect(pastCap.dimensions).toEqual([
			'timestamp',
			'Total Open Interest',
			...names.slice(1, CHART_SERIES_LIMIT + 1).reverse(),
			'Others'
		])
		expect(pastCap.source[1]?.at(-1)).toBe(1)
		const every = foldRwaTopSeries(venues, { picked: names })
		expect(every.dimensions).toEqual(['timestamp', 'Total Open Interest', ...top, 'Others'])
		expect(every.source[1]?.at(-1)).toBe(2 + 1 + 3)
	})

	test('every pick keeps its own column without the series cap', () => {
		const folded = foldRwaTopSeries(venues, { picked: names, max: Number.POSITIVE_INFINITY })
		expect(folded.dimensions).toEqual(['timestamp', 'Total Open Interest', ...top, 'V2', 'V1', 'Others'])
		expect(folded.source[1]?.at(-1)).toBe(3)
	})

	test('nothing picked draws nothing, not even the Total', () => {
		expect(foldRwaTopSeries(venues, { picked: [] })).toEqual({ dimensions: ['timestamp'], source: [] })
	})
})

describe('ensureRwaTotalSeries', () => {
	test('a member named "Total something" is a member: the Total line is still added and the member is ranked', () => {
		const withTotal = ensureRwaTotalSeries(
			dataset(['timestamp', 'Total Crypto Market Cap ex-BTC', 'Gold'], [[1, 1, 18]]),
			'Total Open Interest'
		)
		expect(withTotal.dimensions).toEqual(['timestamp', 'Total Open Interest', 'Total Crypto Market Cap ex-BTC', 'Gold'])
		expect(withTotal.source).toEqual([[1, 19, 1, 18]])
		expect(getRwaRankedSeriesNames(withTotal)).toEqual(['Gold', 'Total Crypto Market Cap ex-BTC'])
	})

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
