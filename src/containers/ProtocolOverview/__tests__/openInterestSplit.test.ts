import { describe, expect, test } from 'vitest'
import { selectOpenInterestBreakdownSeries } from '../openInterestSplit'

// Shape of /chart/open-interest/protocol/:protocol/version-breakdown: one series per child protocol.
const breakdown: Array<[number, Record<string, number>]> = [
	[1_790_380_800, { 'Derive V2': 86_000_000, 'Derive Options': 900_000 }],
	[1_790_467_200, { 'Derive V2': 87_000_000, 'Derive Options': 950_000 }],
	// The options child has not reported the latest day yet.
	[1_790_553_600, { 'Derive V2': 88_000_000 }]
]

describe('selectOpenInterestBreakdownSeries', () => {
	test('options open interest charts only the options children', () => {
		expect(selectOpenInterestBreakdownSeries(breakdown, ['Derive Options'], 'options')).toEqual([
			[1_790_380_800, 900_000],
			[1_790_467_200, 950_000]
		])
	})

	test('perp open interest charts every child except the options children', () => {
		expect(selectOpenInterestBreakdownSeries(breakdown, ['Derive Options'], 'perps')).toEqual([
			[1_790_380_800, 86_000_000],
			[1_790_467_200, 87_000_000],
			[1_790_553_600, 88_000_000]
		])
	})
})
