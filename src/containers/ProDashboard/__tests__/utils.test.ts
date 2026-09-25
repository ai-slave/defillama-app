import { describe, expect, test } from 'vitest'
import { convertToNumberFormat, normalizeHourlyToDaily } from '../utils'

describe('convertToNumberFormat', () => {
	test('normalizes mixed API tuple scalars in one pass', () => {
		expect(
			convertToNumberFormat(
				[
					['1000', '1.5'],
					[2000, 2]
				],
				true
			)
		).toEqual([
			[1, 1.5],
			[2, 2]
		])
	})
})

describe('normalizeHourlyToDaily', () => {
	test('keeps the last hourly value for each day in one pass', () => {
		expect(
			normalizeHourlyToDaily([
				[0, 1],
				[3600, 2],
				[7200, 3],
				[86_400, 4]
			])
		).toEqual([
			[0, 3],
			[86_400, 4]
		])
	})

	test('sums hourly flow values per day', () => {
		expect(
			normalizeHourlyToDaily(
				[
					[0, 1],
					[3600, 2],
					[86_400, 4]
				],
				'sum'
			)
		).toEqual([
			[0, 3],
			[86_400, 4]
		])
	})
})
