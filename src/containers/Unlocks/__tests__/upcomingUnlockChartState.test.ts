import { describe, expect, test } from 'vitest'
import {
	getUpcomingUnlockGroupByQueryValue,
	getUpcomingUnlockTypeQueryUpdates,
	getUpcomingUnlockTypeQueryValue,
	getUpcomingUnlockViewModeQueryValue,
	parseUpcomingUnlockChartState,
	UPCOMING_UNLOCK_CHART_QUERY_KEYS
} from '../upcomingUnlockChartState'

describe('upcoming unlock chart URL state', () => {
	test('uses the URL values as the complete chart state', () => {
		expect(
			parseUpcomingUnlockChartState({
				[UPCOMING_UNLOCK_CHART_QUERY_KEYS.unlockType]: getUpcomingUnlockTypeQueryValue('linear'),
				chartGroup: 'weekly',
				chartView: 'breakdown'
			})
		).toEqual({ unlockType: 'linear', groupBy: 'weekly', viewMode: 'Breakdown View' })
	})

	test('reads the release type from the old chartUnlockType key on shared links', () => {
		expect(parseUpcomingUnlockChartState({ chartUnlockType: 'cliff' })).toEqual({
			unlockType: 'cliff',
			groupBy: 'daily',
			viewMode: 'Total View'
		})
		expect(parseUpcomingUnlockChartState({ release: 'linear', chartUnlockType: 'cliff' }).unlockType).toBe('linear')
	})

	test('a new selection replaces the old key carried by a shared link', () => {
		const apply = (query: Record<string, string>, updates: Record<string, string | undefined>) => {
			const next = { ...query }
			for (const key in updates) {
				if (updates[key] === undefined) delete next[key]
				else next[key] = updates[key]
			}
			return next
		}
		const legacy = { chartUnlockType: 'cliff' }
		expect(parseUpcomingUnlockChartState(apply(legacy, getUpcomingUnlockTypeQueryUpdates('all'))).unlockType).toBe(
			'all'
		)
		expect(parseUpcomingUnlockChartState(apply(legacy, getUpcomingUnlockTypeQueryUpdates('linear'))).unlockType).toBe(
			'linear'
		)
	})

	test('defaults invalid and missing values without local state', () => {
		expect(parseUpcomingUnlockChartState({ release: 'invalid', chartGroup: 'invalid', chartView: 'invalid' })).toEqual({
			unlockType: 'all',
			groupBy: 'daily',
			viewMode: 'Total View'
		})
	})

	test('preserves existing chart URLs', () => {
		expect(
			parseUpcomingUnlockChartState({ release: 'total', chartGroup: 'Weekly', chartView: 'Breakdown View' })
		).toEqual({ unlockType: 'all', groupBy: 'weekly', viewMode: 'Breakdown View' })
	})

	test('omits defaults and serializes non-default selections', () => {
		expect(getUpcomingUnlockTypeQueryValue('all')).toBeUndefined()
		expect(getUpcomingUnlockGroupByQueryValue('daily')).toBeUndefined()
		expect(getUpcomingUnlockViewModeQueryValue('Total View')).toBeUndefined()
		expect(getUpcomingUnlockTypeQueryValue('cliff')).toBe('cliff')
		expect(getUpcomingUnlockGroupByQueryValue('monthly')).toBe('monthly')
		expect(getUpcomingUnlockViewModeQueryValue('Breakdown View')).toBe('breakdown')
	})
})
