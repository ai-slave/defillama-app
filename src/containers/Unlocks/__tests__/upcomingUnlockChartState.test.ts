import { describe, expect, it } from 'vitest'
import {
	getUpcomingUnlockGroupByQueryValue,
	getUpcomingUnlockTypeLabel,
	getUpcomingUnlockTypeQueryValue,
	getUpcomingUnlockViewModeQueryValue,
	parseUpcomingUnlockChartState
} from '../upcomingUnlockChartState'

describe('upcoming unlock chart URL state', () => {
	it('uses the URL values as the complete chart state', () => {
		expect(
			parseUpcomingUnlockChartState({
				chartUnlockType: 'linear',
				chartGroup: 'weekly',
				chartView: 'breakdown'
			})
		).toEqual({ unlockType: 'linear', groupBy: 'weekly', viewMode: 'Breakdown View' })
	})

	it('defaults invalid and missing values without local state', () => {
		expect(
			parseUpcomingUnlockChartState({ chartUnlockType: 'invalid', chartGroup: 'invalid', chartView: 'invalid' })
		).toEqual({ unlockType: 'all', groupBy: 'daily', viewMode: 'Total View' })
	})

	it('preserves existing chart URLs', () => {
		expect(
			parseUpcomingUnlockChartState({ chartUnlockType: 'total', chartGroup: 'Weekly', chartView: 'Breakdown View' })
		).toEqual({ unlockType: 'all', groupBy: 'weekly', viewMode: 'Breakdown View' })
	})

	it('omits defaults and serializes non-default selections', () => {
		expect(getUpcomingUnlockTypeQueryValue('all')).toBeUndefined()
		expect(getUpcomingUnlockGroupByQueryValue('daily')).toBeUndefined()
		expect(getUpcomingUnlockViewModeQueryValue('Total View')).toBeUndefined()
		expect(getUpcomingUnlockTypeQueryValue('cliff')).toBe('cliff')
		expect(getUpcomingUnlockGroupByQueryValue('monthly')).toBe('monthly')
		expect(getUpcomingUnlockViewModeQueryValue('Breakdown View')).toBe('breakdown')
	})

	it('labels the combined view as all unlocks', () => {
		expect(getUpcomingUnlockTypeLabel('all')).toBe('All Unlocks')
	})
})
