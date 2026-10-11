import { describe, expect, test } from 'vitest'
import type { RWAPositionalChartDataset } from '../chartDataset'
import { getRwaRankedSeriesNames } from '../chartFold'
import { getRwaSeriesPickQuery, readRwaSeriesPick } from '../seriesPick'

const DAY = 86_400_000
/* Twelve venues V1..V12 whose latest value is their number, so V12 is the largest; a Total line and an upstream Others. */
const names = Array.from({ length: 12 }, (_, index) => `V${index + 1}`)
const dataset: RWAPositionalChartDataset = {
	dimensions: ['timestamp', 'Total Open Interest', ...names, 'Others'],
	source: [
		[DAY, 100, ...names.map(() => 1), 2],
		[2 * DAY, 200, ...names.map((_, index) => index + 1), 3]
	]
}

describe('the series picker selection in the URL', () => {
	const options = getRwaRankedSeriesNames(dataset)
	const roundTrip = (picked: Array<string>) => readRwaSeriesPick(getRwaSeriesPickQuery(options, picked), options)

	test('picks every member when the URL says nothing, and picking every member leaves the URL clean', () => {
		expect(readRwaSeriesPick({}, options)).toEqual(options)
		expect(getRwaSeriesPickQuery(options, options)).toEqual({})
	})

	test('a pick reads back in option order: a few members, all but one, and nothing', () => {
		expect(roundTrip(['V1', 'V12'])).toEqual(['V12', 'V1'])
		expect(roundTrip(['V1', 'V5', 'V12'])).toEqual(['V12', 'V5', 'V1'])
		expect(roundTrip(options.filter((name) => name !== 'V12'))).toEqual(options.slice(1))
		expect(roundTrip([])).toEqual([])
	})

	test('a link made under another Group by, whose members are all unknown here, reads as every member', () => {
		const otherGroupBy = ['Crypto', 'Equities', 'Metals']
		expect(readRwaSeriesPick(getRwaSeriesPickQuery(otherGroupBy, ['Crypto']), options)).toEqual(options)
		expect(readRwaSeriesPick(getRwaSeriesPickQuery(otherGroupBy, ['Crypto', 'Equities']), options)).toEqual(options)
	})
})
