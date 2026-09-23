import { describe, expect, test } from 'vitest'
import { detectCadence, type TrendSeries } from './transform'
import { aggregate, viewOptionsFor } from './TrendChart'

const DAY = 86_400
// The ir-server keys weekly payloads to the week's first day; 2026-08-10 is a Monday.
const MONDAY = Math.floor(Date.parse('2026-08-10T00:00:00Z') / 1000)

const points = (step: number, count: number): Array<TrendSeries> => [
	{ name: 'Volume', data: Array.from({ length: count }, (_, i): [number, number] => [MONDAY + i * step, 1]) }
]
const monthly = (count: number): Array<TrendSeries> => [
	{
		name: 'Volume',
		data: Array.from({ length: count }, (_, i): [number, number] => [Math.floor(Date.UTC(2025, i, 1) / 1000), 1])
	}
]
const labels = (series: Array<TrendSeries>, valueSymbol = '$') =>
	viewOptionsFor(detectCadence(series), valueSymbol).map((view) => view.label)

describe('trend chart cadence detection', () => {
	test('reads the cadence off the payload spacing', () => {
		expect(detectCadence(points(DAY, 30))).toBe('day')
		expect(detectCadence(points(7 * DAY, 30))).toBe('week')
		expect(detectCadence(monthly(12))).toBe('month')
		expect(detectCadence(points(91 * DAY, 8))).toBe('quarter')
	})

	test('ignores a single gap in an otherwise weekly series', () => {
		const weekly = points(7 * DAY, 10)
		weekly[0]!.data.splice(4, 1)

		expect(detectCadence(weekly)).toBe('week')
	})

	test('never reports a cadence finer than the caller allows', () => {
		expect(detectCadence(points(DAY, 30), 'week')).toBe('week')
		// A floor only raises: monthly data stays monthly under a weekly floor.
		expect(detectCadence(monthly(12), 'week')).toBe('month')
	})

	test('falls back to daily when there is nothing to measure', () => {
		expect(detectCadence([])).toBe('day')
		expect(detectCadence(points(DAY, 1))).toBe('day')
	})
})

describe('trend chart granularity options', () => {
	test('offers no view finer than the payload itself', () => {
		expect(labels(points(DAY, 60))).toEqual(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Cumulative'])
		expect(labels(points(7 * DAY, 30))).toEqual(['Weekly', 'Monthly', 'Quarterly', 'Cumulative'])
		expect(labels(monthly(12))).toEqual(['Monthly', 'Quarterly', 'Cumulative'])
		expect(labels(points(91 * DAY, 8))).toEqual(['Quarterly', 'Cumulative'])
	})

	test('drops the cumulative view for a percentage series', () => {
		expect(labels(points(7 * DAY, 30), '%')).toEqual(['Weekly', 'Monthly', 'Quarterly'])
	})
})

describe('trend chart weekly bucketing', () => {
	// Weeks are keyed by the Sunday that ends them, which the shared weekly tooltip reads as Mon-Sun.
	test('keys an already-weekly Monday payload by the Sunday ending each week', () => {
		expect(aggregate(points(7 * DAY, 2), 'week', false)[0]?.data).toEqual([
			[MONDAY + 6 * DAY, 1],
			[MONDAY + 13 * DAY, 1]
		])
	})

	test('collapses a daily payload into the Sunday ending each week', () => {
		expect(aggregate(points(DAY, 7), 'week', false)[0]?.data).toEqual([[MONDAY + 6 * DAY, 7]])
	})
})
