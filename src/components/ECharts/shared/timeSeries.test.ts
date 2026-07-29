import { describe, expect, it } from 'vitest'
import {
	formatBarChart,
	formatLineChart,
	formatNullableBarChart,
	getBucketTimestampMs,
	getBucketTimestampSec
} from './timeSeries'

const toSec = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / 1000
const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

// Pre-computed weekly bucket timestamps (lastDayOfWeek = next Sunday)
// Jan 15 2024 is Monday → bucket = Jan 21 (Sunday)
// Jan 22 2024 is Monday → bucket = Jan 28 (Sunday)
const weekBucketJan21 = toMs(2024, 1, 21)
const weekBucketJan28 = toMs(2024, 1, 28)

describe('formatBarChart', () => {
	it('exports canonical bucket helpers for week/month/quarter/year', () => {
		expect(getBucketTimestampSec(toSec(2024, 1, 17) + 13 * 60 * 60, 'daily')).toBe(toSec(2024, 1, 17))
		expect(getBucketTimestampSec(toSec(2024, 1, 17), 'weekly')).toBe(toSec(2024, 1, 21))
		expect(getBucketTimestampSec(toSec(2024, 3, 17), 'monthly')).toBe(toSec(2024, 3, 1))
		expect(getBucketTimestampSec(toSec(2024, 3, 17), 'quarterly')).toBe(toSec(2024, 1, 1))
		expect(getBucketTimestampSec(toSec(2024, 9, 17), 'yearly')).toBe(toSec(2024, 1, 1))
		expect(getBucketTimestampMs(toMs(2024, 3, 17), 'quarterly')).toBe(toMs(2024, 1, 1))
	})

	it('returns empty array for empty input', () => {
		expect(formatBarChart({ data: [], groupBy: 'daily', denominationPriceHistory: null })).toEqual([])
	})

	it('preserves hourly timestamps in daily mode and converts sec → ms', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 1, 1) + 13 * 60 * 60, 10],
					[toSec(2024, 1, 2), 20]
				],
				groupBy: 'daily',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1) + 13 * 60 * 60 * 1e3, 10],
			[toMs(2024, 1, 2), 20]
		])
	})

	it('keeps same-day hourly points distinct in daily mode (regression: no midnight snapping)', () => {
		const h6 = toSec(2024, 1, 1) + 6 * 3600
		const h18 = toSec(2024, 1, 1) + 18 * 3600
		const result = formatBarChart({
			data: [
				[h6, 10],
				[h18, 20]
			],
			groupBy: 'daily',
			denominationPriceHistory: null
		})
		expect(result).toEqual([
			[h6 * 1e3, 10],
			[h18 * 1e3, 20]
		])
	})

	it('sums values into weekly buckets (lastDayOfWeek)', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 1, 15), 10], // Mon → Sun Jan 21
					[toSec(2024, 1, 17), 5], // Wed → Sun Jan 21
					[toSec(2024, 1, 22), 30] // Mon → Sun Jan 28
				],
				groupBy: 'weekly',
				denominationPriceHistory: null
			})
		).toEqual([
			[weekBucketJan21, 15],
			[weekBucketJan28, 30]
		])
	})

	it('sums values into monthly buckets', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 3, 10), 10],
					[toSec(2024, 3, 25), 20],
					[toSec(2024, 4, 5), 30]
				],
				groupBy: 'monthly',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 3, 1), 30],
			[toMs(2024, 4, 1), 30]
		])
	})

	it('sums values into quarterly buckets', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 3, 20), 20],
					[toSec(2024, 4, 5), 30]
				],
				groupBy: 'quarterly',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 30],
			[toMs(2024, 4, 1), 30]
		])
	})

	it('sums values into yearly buckets', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 2, 1), 10],
					[toSec(2024, 10, 1), 20],
					[toSec(2025, 1, 1), 30]
				],
				groupBy: 'yearly',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 30],
			[toMs(2025, 1, 1), 30]
		])
	})

	it('computes running total for cumulative mode', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 1, 1), 10],
					[toSec(2024, 1, 2), 5],
					[toSec(2024, 1, 3), 15]
				],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 10],
			[toMs(2024, 1, 2), 15],
			[toMs(2024, 1, 3), 30]
		])
	})

	it('sums duplicate timestamps before computing cumulative totals', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 1, 1), 10],
					[toSec(2024, 1, 1), 5],
					[toSec(2024, 1, 2), 7]
				],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 15],
			[toMs(2024, 1, 2), 22]
		])
	})

	it('keeps cumulative denomination totals unknown after a missing price', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 1, 1), 10],
					[toSec(2024, 1, 1), 6],
					[toSec(2024, 1, 2), 100],
					[toSec(2024, 1, 3), 8]
				],
				groupBy: 'cumulative',
				denominationPriceHistory: {
					[String(toSec(2024, 1, 1))]: 2,
					[String(toSec(2024, 1, 3))]: 4
				}
			})
		).toEqual([
			[toMs(2024, 1, 1), 8],
			[toMs(2024, 1, 2), null],
			[toMs(2024, 1, 3), null]
		])
	})

	it('supports millisecond input timestamps', () => {
		expect(
			formatBarChart({
				data: [
					[toMs(2024, 1, 15), 10],
					[toMs(2024, 2, 15), 20]
				],
				groupBy: 'quarterly',
				dateInMs: true,
				denominationPriceHistory: null
			})
		).toEqual([[toMs(2024, 1, 1), 30]])
	})

	it('accepts string dates', () => {
		expect(
			formatBarChart({
				data: [
					[String(toSec(2024, 1, 15)), 10],
					[String(toSec(2024, 2, 15)), 20]
				],
				groupBy: 'quarterly',
				denominationPriceHistory: null
			})
		).toEqual([[toMs(2024, 1, 1), 30]])
	})

	it('converts denominated values before grouped sums', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 2, 15), 20]
				],
				groupBy: 'quarterly',
				denominationPriceHistory: {
					[String(toSec(2024, 1, 15))]: 2,
					[String(toSec(2024, 2, 15))]: 4
				}
			})
		).toEqual([[toMs(2024, 1, 1), 10]]) // 10/2 + 20/4 = 5 + 5
	})

	it('does not fabricate a partial grouped total when a denomination price is missing', () => {
		expect(
			formatBarChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 2, 15), 20]
				],
				groupBy: 'quarterly',
				denominationPriceHistory: {
					[String(toSec(2024, 1, 15))]: 2
				}
			})
		).toEqual([[toMs(2024, 1, 1), null]])
	})

	it('applies denomination in daily mode', () => {
		expect(
			formatBarChart({
				data: [[toSec(2024, 1, 1), 100]],
				groupBy: 'daily',
				denominationPriceHistory: { [String(toSec(2024, 1, 1))]: 5 }
			})
		).toEqual([[toMs(2024, 1, 1), 20]]) // 100/5
	})

	it('returns null for daily entry with no matching denomination price', () => {
		expect(
			formatBarChart({
				data: [[toSec(2024, 1, 1), 100]],
				groupBy: 'daily',
				denominationPriceHistory: { '99999': 5 }
			})
		).toEqual([[toMs(2024, 1, 1), null]])
	})
})

describe('formatNullableBarChart', () => {
	it('preserves known zero and unknown observations in daily mode', () => {
		expect(
			formatNullableBarChart({
				data: [
					[toSec(2024, 1, 1), 0],
					[toSec(2024, 1, 2), null]
				],
				groupBy: 'daily',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 0],
			[toMs(2024, 1, 2), null]
		])
	})

	it('marks a grouped period unknown when any contributing observation is unknown', () => {
		expect(
			formatNullableBarChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 1, 16), null],
					[toSec(2024, 1, 22), 4]
				],
				groupBy: 'weekly',
				denominationPriceHistory: null
			})
		).toEqual([
			[weekBucketJan21, null],
			[weekBucketJan28, 4]
		])
	})

	it('keeps cumulative values unknown after the first unknown observation', () => {
		expect(
			formatNullableBarChart({
				data: [
					[toSec(2024, 1, 1), 10],
					[toSec(2024, 1, 2), null],
					[toSec(2024, 1, 3), 5]
				],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 10],
			[toMs(2024, 1, 2), null],
			[toMs(2024, 1, 3), null]
		])
	})

	it('does not fabricate partial denominated sums when a price is missing', () => {
		expect(
			formatNullableBarChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 1, 16), 20]
				],
				groupBy: 'weekly',
				denominationPriceHistory: { [String(toSec(2024, 1, 15))]: 2 }
			})
		).toEqual([[weekBucketJan21, null]])
	})

	it('preserves an all-unknown grouped series', () => {
		expect(
			formatNullableBarChart({
				data: [
					[toSec(2024, 1, 15), null],
					[toSec(2024, 1, 16), null]
				],
				groupBy: 'weekly',
				denominationPriceHistory: null
			})
		).toEqual([[weekBucketJan21, null]])
	})

	it('treats omitted sparse dates as zero contribution rather than unknown', () => {
		expect(
			formatNullableBarChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 1, 17), 5]
				],
				groupBy: 'weekly',
				denominationPriceHistory: null
			})
		).toEqual([[weekBucketJan21, 15]])

		expect(
			formatNullableBarChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 1, 17), 5]
				],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 15), 10],
			[toMs(2024, 1, 17), 15]
		])
	})
})

describe('formatLineChart', () => {
	it('preserves hourly timestamps in daily mode', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 1, 1) + 13 * 60 * 60, 10],
					[toSec(2024, 1, 2), 20]
				],
				groupBy: 'daily',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1) + 13 * 60 * 60 * 1e3, 10],
			[toMs(2024, 1, 2), 20]
		])
	})

	it('keeps same-day hourly points distinct in daily mode (regression: no midnight snapping)', () => {
		const h6 = toSec(2024, 1, 1) + 6 * 3600
		const h18 = toSec(2024, 1, 1) + 18 * 3600
		const result = formatLineChart({
			data: [
				[h6, 10],
				[h18, 20]
			],
			groupBy: 'daily',
			denominationPriceHistory: null
		})
		expect(result).toEqual([
			[h6 * 1e3, 10],
			[h18 * 1e3, 20]
		])
	})

	it('keeps the last value in weekly buckets', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 1, 15), 10], // Mon → Sun Jan 21
					[toSec(2024, 1, 17), 25], // Wed → Sun Jan 21 (overwrites 10)
					[toSec(2024, 1, 22), 30] // Mon → Sun Jan 28
				],
				groupBy: 'weekly',
				denominationPriceHistory: null
			})
		).toEqual([
			[weekBucketJan21, 25],
			[weekBucketJan28, 30]
		])
	})

	it('keeps the last value in monthly buckets', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 3, 1), 10],
					[toSec(2024, 3, 15), 20],
					[toSec(2024, 3, 31), 30]
				],
				groupBy: 'monthly',
				denominationPriceHistory: null
			})
		).toEqual([[toMs(2024, 3, 1), 30]])
	})

	it('keeps the last value in quarterly buckets', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 3, 20), 20],
					[toSec(2024, 4, 5), 30]
				],
				groupBy: 'quarterly',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 20],
			[toMs(2024, 4, 1), 30]
		])
	})

	it('keeps the last value in yearly buckets', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 2, 1), 10],
					[toSec(2024, 10, 1), 20],
					[toSec(2025, 1, 1), 30]
				],
				groupBy: 'yearly',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 20],
			[toMs(2025, 1, 1), 30]
		])
	})

	it('passes through daily for cumulative mode (no aggregation)', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 1, 1), 10],
					[toSec(2024, 1, 2), 20],
					[toSec(2024, 1, 3), 30]
				],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(2024, 1, 1), 10],
			[toMs(2024, 1, 2), 20],
			[toMs(2024, 1, 3), 30]
		])
	})

	it('supports millisecond input timestamps', () => {
		expect(
			formatLineChart({
				data: [
					[toMs(2024, 1, 15), 10],
					[toMs(2024, 3, 20), 20]
				],
				groupBy: 'quarterly',
				dateInMs: true,
				denominationPriceHistory: null
			})
		).toEqual([[toMs(2024, 1, 1), 20]])
	})

	it('converts denominated values (last wins per bucket)', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 2, 15), 20]
				],
				groupBy: 'quarterly',
				denominationPriceHistory: {
					[String(toSec(2024, 1, 15))]: 2,
					[String(toSec(2024, 2, 15))]: 4
				}
			})
		).toEqual([[toMs(2024, 1, 1), 5]]) // last entry: 20/4
	})

	it('emits null when denomination price is missing (last mode)', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 1, 15), 10],
					[toSec(2024, 2, 15), 20]
				],
				groupBy: 'quarterly',
				denominationPriceHistory: {
					[String(toSec(2024, 1, 15))]: 2
					// no price for Feb 15 → null overwrites the converted value
				}
			})
		).toEqual([[toMs(2024, 1, 1), null]])
	})

	it('last-wins with 3+ values in a single bucket', () => {
		expect(
			formatLineChart({
				data: [
					[toSec(2024, 1, 5), 100],
					[toSec(2024, 1, 15), 200],
					[toSec(2024, 2, 10), 300],
					[toSec(2024, 3, 20), 400]
				],
				groupBy: 'quarterly',
				denominationPriceHistory: null
			})
		).toEqual([[toMs(2024, 1, 1), 400]])
	})
})
