import { describe, expect, it } from 'vitest'
import { convertToNumberFormat, normalizeHourlyToDaily } from '../utils'

describe('convertToNumberFormat', () => {
	it('normalizes mixed API tuple scalars in one pass', () => {
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
	it('keeps the last hourly value for each day in one pass', () => {
		expect(
			normalizeHourlyToDaily([
				[0, 1],
				[3_600, 2],
				[7_200, 3],
				[86_400, 4]
			])
		).toEqual([
			[0, 3],
			[86_400, 4]
		])
	})

	it('sums hourly flow values per day', () => {
		expect(
			normalizeHourlyToDaily(
				[
					[0, 1],
					[3_600, 2],
					[86_400, 4]
				],
				'sum'
			)
		).toEqual([
			[0, 3],
			[86_400, 4]
		])
	})

	it('returns already-daily data without allocating a replacement', () => {
		const data: [number, number][] = [
			[0, 1],
			[86_400, 2]
		]
		expect(normalizeHourlyToDaily(data)).toBe(data)
	})
})
