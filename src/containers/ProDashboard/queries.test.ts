import { describe, expect, it } from 'vitest'
import { filterDataByTimePeriod } from './queries'

const data: [number, number][] = [
	[10, 1],
	[20, 2],
	[20, 3],
	[30, 4],
	[40, 5]
]

describe('filterDataByTimePeriod', () => {
	it('slices ascending data with inclusive bounds and duplicate timestamps', () => {
		expect(
			filterDataByTimePeriod(data, 'custom', {
				type: 'absolute',
				startDate: 20,
				endDate: 30
			})
		).toEqual([
			[20, 2],
			[20, 3],
			[30, 4]
		])
	})

	it('reuses the source for all-time and full-range selections', () => {
		expect(filterDataByTimePeriod(data, 'all')).toBe(data)
		expect(
			filterDataByTimePeriod(data, 'custom', {
				type: 'absolute',
				startDate: 0,
				endDate: 100
			})
		).toBe(data)
	})

	it('returns an empty slice when the selected period has no rows', () => {
		expect(
			filterDataByTimePeriod(data, 'custom', {
				type: 'absolute',
				startDate: 50,
				endDate: 60
			})
		).toEqual([])
	})
})
