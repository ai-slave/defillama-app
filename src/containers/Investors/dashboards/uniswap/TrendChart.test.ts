import { describe, expect, it } from 'vitest'
import { aggregate, detectCadence, type TrendSeries, viewOptionsFor } from './TrendChart'

const DAY = 86400
// The ir-server keys weekly payloads to the week's first day; 2026-08-10 is a Monday.
const MONDAY = Math.floor(Date.parse('2026-08-10T00:00:00Z') / 1000)

const points = (step: number, count: number): TrendSeries[] => [
	{ name: 'Volume', data: Array.from({ length: count }, (_, i): [number, number] => [MONDAY + i * step, 1]) }
]
const monthly = (count: number): TrendSeries[] => [
	{
		name: 'Volume',
		data: Array.from({ length: count }, (_, i): [number, number] => [Math.floor(Date.UTC(2025, i, 1) / 1000), 1])
	}
]
const labels = (series: TrendSeries[], valueSymbol = '$') =>
	viewOptionsFor(detectCadence(series), valueSymbol).map((view) => view.label)

describe('trend chart cadence detection', () => {
	it('reads the cadence off the payload spacing', () => {
		expect(detectCadence(points(DAY, 30))).toBe('day')
		expect(detectCadence(points(7 * DAY, 30))).toBe('week')
		expect(detectCadence(monthly(12))).toBe('month')
		expect(detectCadence(points(91 * DAY, 8))).toBe('quarter')
	})

	it('ignores a single gap in an otherwise weekly series', () => {
		const weekly = points(7 * DAY, 10)
		weekly[0]!.data.splice(4, 1)

		expect(detectCadence(weekly)).toBe('week')
	})

	it('never reports a cadence finer than the caller allows', () => {
		expect(detectCadence(points(DAY, 30), 'week')).toBe('week')
		// A floor only raises: monthly data stays monthly under a weekly floor.
		expect(detectCadence(monthly(12), 'week')).toBe('month')
	})

	it('falls back to daily when there is nothing to measure', () => {
		expect(detectCadence([])).toBe('day')
		expect(detectCadence(points(DAY, 1))).toBe('day')
	})
})

describe('trend chart granularity options', () => {
	it('offers no view finer than the payload itself', () => {
		expect(labels(points(DAY, 60))).toEqual(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Cumulative'])
		expect(labels(points(7 * DAY, 30))).toEqual(['Weekly', 'Monthly', 'Quarterly', 'Cumulative'])
		expect(labels(monthly(12))).toEqual(['Monthly', 'Quarterly', 'Cumulative'])
		expect(labels(points(91 * DAY, 8))).toEqual(['Quarterly', 'Cumulative'])
	})

	it('drops the cumulative view for a percentage series', () => {
		expect(labels(points(7 * DAY, 30), '%')).toEqual(['Weekly', 'Monthly', 'Quarterly'])
	})
})

describe('trend chart weekly bucketing', () => {
	it('leaves an already-weekly payload on its own week-start timestamps', () => {
		expect(aggregate(points(7 * DAY, 2), 'week', false)[0]?.data).toEqual([
			[MONDAY, 1],
			[MONDAY + 7 * DAY, 1]
		])
	})

	it('collapses a daily payload into the Monday of each week', () => {
		expect(aggregate(points(DAY, 7), 'week', false)[0]?.data).toEqual([[MONDAY, 7]])
	})
})
