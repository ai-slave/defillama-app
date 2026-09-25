import { describe, expect, test } from 'vitest'
import { buildUnlocksMultiSeriesChartForDateRange } from '../buildUnlocksMultiSeriesChart'
import type { CalendarUnlockEvent } from '../calendarTypes'

function unlockEvent(protocol: string, value: number, unit?: 'week'): CalendarUnlockEvent {
	const fields = {
		protocol,
		value,
		details: `${protocol} unlock`,
		unlockType: 'Cliff'
	}
	return unit === 'week' ? { ...fields, unit } : fields
}

describe('buildUnlocksMultiSeriesChartForDateRange', () => {
	test('plots cliff amounts by date without adding weekly rates', () => {
		const result = buildUnlocksMultiSeriesChartForDateRange({
			dates: ['2026-01-01', '2026-01-02'],
			unlocksData: {
				'2026-01-01': {
					totalValue: 15,
					events: [unlockEvent('Alpha', 10), unlockEvent('Beta', 5), unlockEvent('Weekly Rate', 100, 'week')]
				},
				'2026-01-02': {
					totalValue: 3,
					events: [unlockEvent('Alpha', 1), unlockEvent('Alpha', 2), unlockEvent('Beta', 0), unlockEvent('Beta', -5)]
				}
			}
		})

		expect(result.charts).toHaveLength(2)
		expect(result.charts.every((chart) => chart.type === 'bar' && chart.stack === 'unlocks')).toBe(true)
		expect(result.charts.every((chart) => chart.large === false)).toBe(true)
		expect(result.dataset.dimensions).toEqual(['timestamp', 'Alpha', 'Beta'])
		expect(result.dataset.source.map((row) => row.slice(1))).toEqual([
			[10, 5],
			[3, 0]
		])
		expect(result.charts.map((chart) => chart.encode)).toEqual([
			{ x: 0, y: 1 },
			{ x: 0, y: 2 }
		])
	})
	test('keeps empty dates as zero values without inventing a protocol', () => {
		const result = buildUnlocksMultiSeriesChartForDateRange({ dates: ['2026-01-01', '2026-01-02'], unlocksData: {} })
		expect(result.dataset.dimensions).toEqual(['timestamp', 'Unlocks'])
		expect(result.dataset.source.map((row) => row.slice(1))).toEqual([[0], [0]])
	})
})
