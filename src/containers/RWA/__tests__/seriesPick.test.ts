import { describe, expect, test } from 'vitest'
import type { RWAPositionalChartDataset } from '../chartDataset'
import { getRwaRankedSeriesNames } from '../chartFold'
import { readRwaSeriesPick, RWA_SERIES_PICK_EXCLUDE_KEY, RWA_SERIES_PICK_INCLUDE_KEY } from '../seriesPick'

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
const top10 = names.slice(2).reverse()

describe('the series picker selection in the URL', () => {
	const options = getRwaRankedSeriesNames(dataset)

	test('picks the ten largest when the URL says nothing', () => {
		expect(readRwaSeriesPick({}, options)).toEqual(top10)
	})

	test('an added member joins the picks and a removed one leaves them', () => {
		expect(readRwaSeriesPick({ [RWA_SERIES_PICK_INCLUDE_KEY]: ['V1', 'V12'] }, options)).toEqual(['V12', 'V1'])
		expect(readRwaSeriesPick({ [RWA_SERIES_PICK_EXCLUDE_KEY]: 'V12' }, options)).toEqual(options.slice(1))
	})

	test('a link from another Group by, whose members are all unknown here, falls back to the ten largest', () => {
		expect(readRwaSeriesPick({ [RWA_SERIES_PICK_INCLUDE_KEY]: ['Crypto', 'Equities'] }, options)).toEqual(top10)
		expect(readRwaSeriesPick({ [RWA_SERIES_PICK_INCLUDE_KEY]: 'None' }, options)).toEqual([])
	})

	test('an exclude link from another Group by, naming no member here, falls back to the ten largest, not every member', () => {
		expect(readRwaSeriesPick({ [RWA_SERIES_PICK_EXCLUDE_KEY]: 'Binance' }, options)).toEqual(top10)
	})
})
