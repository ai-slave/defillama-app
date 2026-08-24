import { describe, expect, it } from 'vitest'
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
	it('builds stacked unlock bars outside ECharts large mode', () => {
		const result = buildUnlocksMultiSeriesChartForDateRange({
			dates: ['2026-01-01', '2026-01-02'],
			unlocksData: {
				'2026-01-01': {
					totalValue: 15,
					events: [unlockEvent('Alpha', 10), unlockEvent('Beta', 5), unlockEvent('Weekly Rate', 100, 'week')]
				},
				'2026-01-02': {
					totalValue: 3,
					events: [unlockEvent('Alpha', 3)]
				}
			}
		})

		expect(result.charts).toHaveLength(2)
		expect(result.charts.every((chart) => chart.type === 'bar' && chart.stack === 'unlocks')).toBe(true)
		expect(result.charts.every((chart) => chart.large === false)).toBe(true)
		expect(result.dataset.dimensions).toEqual(['timestamp', 'Alpha', 'Beta'])
	})
})
