import { describe, expect, it } from 'vitest'
import { normalizeHourlyToDaily } from '../utils'

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
