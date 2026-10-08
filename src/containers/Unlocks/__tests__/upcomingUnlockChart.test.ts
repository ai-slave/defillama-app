import { describe, expect, test } from 'vitest'
import { chartColor } from '~/constants/colors'
import type { EmissionEvent } from '../api.types'
import {
	buildUpcomingUnlockChart,
	buildUpcomingUnlockSeries,
	calculateUpcomingUnlockStatistics,
	type UpcomingUnlockChartProtocol
} from '../upcomingUnlockChart'

const day = (dayOfMonth: number) => Date.UTC(2024, 0, dayOfMonth) / 1e3

function cliff(timestamp: number, amount: number): EmissionEvent {
	return {
		description: 'Cliff',
		category: 'insiders',
		unlockType: 'cliff',
		timestamp,
		noOfTokens: [amount]
	}
}

function linear(timestamp: number, previousRate: number, newRate: number, rateDurationDays = 7): EmissionEvent {
	return {
		description: 'Linear rate change',
		category: 'farming',
		unlockType: 'linear',
		timestamp,
		noOfTokens: [previousRate, newRate],
		rateDurationDays
	}
}

const protocols: Array<UpcomingUnlockChartProtocol> = [
	{
		name: 'Zeta',
		tPrice: 2,
		events: [cliff(day(3), 1), cliff(day(20), 100)]
	},
	{
		name: 'Alpha',
		tPrice: 1,
		events: [cliff(day(2), 4), cliff(day(3), 0), cliff(day(3), -4)]
	}
]

describe('buildUpcomingUnlockChart', () => {
	const series = buildUpcomingUnlockSeries(protocols, day(1), day(10))

	test('compacts one-time cliffs', () => {
		expect(series).toEqual([
			{
				name: 'Zeta',
				cliffPoints: [[Date.UTC(2024, 0, 3), 2]],
				linearPoints: []
			},
			{
				name: 'Alpha',
				cliffPoints: [[Date.UTC(2024, 0, 2), 4]],
				linearPoints: []
			}
		])
	})

	test('spreads the new weekly rate across active days and adds same-day cliffs', () => {
		const result = buildUpcomingUnlockSeries(
			[
				{
					name: 'Linear',
					tPrice: 7,
					events: [linear(day(2), 100, 7, 2), cliff(day(3), 1)]
				}
			],
			day(1),
			day(5)
		)

		expect(result).toEqual([
			{
				name: 'Linear',
				cliffPoints: [[Date.UTC(2024, 0, 3), 7]],
				linearPoints: [
					[Date.UTC(2024, 0, 2), 7],
					[Date.UTC(2024, 0, 3), 7]
				]
			}
		])
	})

	test('prorates partial days and stops at the declared linear duration', () => {
		const result = buildUpcomingUnlockSeries(
			[
				{
					name: 'Partial',
					tPrice: 7,
					events: [linear(day(2) + 12 * 60 * 60, 0, 7, 1)]
				}
			],
			day(1),
			day(5)
		)

		expect(result).toEqual([
			{
				name: 'Partial',
				cliffPoints: [],
				linearPoints: [
					[Date.UTC(2024, 0, 2), 3.5],
					[Date.UTC(2024, 0, 3), 3.5]
				]
			}
		])
	})

	test('keeps adjacent linear intervals separate without double-counting their boundary', () => {
		const result = buildUpcomingUnlockSeries(
			[
				{
					name: 'Adjacent',
					tPrice: 1,
					events: [linear(day(2), 0, 7, 1), linear(day(3), 7, 14, 1)]
				}
			],
			day(1),
			day(5)
		)

		expect(result).toEqual([
			{
				name: 'Adjacent',
				cliffPoints: [],
				linearPoints: [
					[Date.UTC(2024, 0, 2), 1],
					[Date.UTC(2024, 0, 3), 2]
				]
			}
		])
	})

	test('includes the remaining current day while keeping the exact start and end bounds', () => {
		const startTimestampSec = day(1) + 60 * 60
		const bounded = buildUpcomingUnlockSeries(
			[
				{
					name: 'Bounded',
					tPrice: 1,
					events: [
						linear(day(1), 0, 7, 4),
						cliff(day(1) + 30 * 60, 10),
						cliff(day(1) + 2 * 60 * 60, 1),
						cliff(day(2), 2),
						cliff(day(3), 3)
					]
				}
			],
			startTimestampSec,
			day(3)
		)

		expect(bounded).toEqual([
			{
				name: 'Bounded',
				cliffPoints: [
					[Date.UTC(2024, 0, 1), 1],
					[Date.UTC(2024, 0, 2), 2]
				],
				linearPoints: [
					[Date.UTC(2024, 0, 1), 23 / 24],
					[Date.UTC(2024, 0, 2), 1]
				]
			}
		])
	})

	test('prorates both partial boundary days of the chart interval', () => {
		const result = buildUpcomingUnlockSeries(
			[{ name: 'Boundaries', tPrice: 7, events: [linear(day(1), 0, 7, 10)] }],
			day(1) + 12 * 60 * 60,
			day(2) + 6 * 60 * 60
		)

		expect(result).toEqual([
			{
				name: 'Boundaries',
				cliffPoints: [],
				linearPoints: [
					[Date.UTC(2024, 0, 1), 3.5],
					[Date.UTC(2024, 0, 2), 1.75]
				]
			}
		])
	})

	test('builds one unstacked total series and sums values by period', () => {
		const result = buildUpcomingUnlockChart({
			series,
			groupBy: 'weekly',
			viewMode: 'Total View',
			unlockType: 'all'
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Total Upcoming Unlock Value'],
			source: [[Date.UTC(2024, 0, 7), 6]]
		})
		expect(result.charts).toEqual([
			{
				type: 'bar',
				name: 'Total Upcoming Unlock Value',
				encode: { x: 0, y: 1 },
				color: chartColor(0)
			}
		])
	})

	test('builds alphabetized stacked protocol series without total data', () => {
		const result = buildUpcomingUnlockChart({
			series,
			groupBy: 'daily',
			viewMode: 'Breakdown View',
			unlockType: 'all'
		})

		expect(result.dataset.dimensions).toEqual(['timestamp', 'Alpha', 'Zeta'])
		expect(result.dataset.source).toEqual([
			[Date.UTC(2024, 0, 2), 4, null],
			[Date.UTC(2024, 0, 3), null, 2]
		])
		expect(result.charts.map(({ name, stack }) => ({ name, stack }))).toEqual([
			{ name: 'Alpha', stack: 'A' },
			{ name: 'Zeta', stack: 'A' }
		])
	})

	test('filters total and protocol views by unlock type', () => {
		const typedSeries = buildUpcomingUnlockSeries(
			[
				{
					name: 'Combined',
					tPrice: 7,
					events: [linear(day(1), 0, 7, 2), cliff(day(2), 1)]
				}
			],
			day(1),
			day(3)
		)

		const cliffTotal = buildUpcomingUnlockChart({
			series: typedSeries,
			groupBy: 'daily',
			viewMode: 'Total View',
			unlockType: 'cliff'
		})
		const linearBreakdown = buildUpcomingUnlockChart({
			series: typedSeries,
			groupBy: 'daily',
			viewMode: 'Breakdown View',
			unlockType: 'linear'
		})

		expect(cliffTotal.dataset.source).toEqual([[Date.UTC(2024, 0, 2), 7]])
		expect(cliffTotal.dataset.dimensions).toEqual(['timestamp', 'Upcoming Cliff Unlock Value'])
		expect(linearBreakdown.dataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 7],
			[Date.UTC(2024, 0, 2), 7]
		])
	})
})

describe('calculateUpcomingUnlockStatistics', () => {
	test('combines cliffs with linear flow already active at the start of each window', () => {
		const nowTimestampSec = day(2)
		const result = calculateUpcomingUnlockStatistics(
			[
				{
					name: 'Combined',
					tPrice: 7,
					events: [linear(day(1), 0, 7, 30), cliff(day(3), 1)]
				}
			],
			nowTimestampSec
		)

		expect(result).toEqual({
			upcomingUnlocks7d: {
				cliff: 7,
				linear: 49,
				total: 56,
				unknownEventCount: 0,
				missingPriceProtocolCount: 0
			},
			upcomingUnlocks30d: {
				cliff: 7,
				linear: 203,
				total: 210,
				unknownEventCount: 0,
				missingPriceProtocolCount: 0
			}
		})
	})

	test('matches the chart total across the same exact rolling interval', () => {
		const nowTimestampSec = day(1) + 6 * 60 * 60
		const data: Array<UpcomingUnlockChartProtocol> = [
			{
				name: 'Boundaries',
				tPrice: 7,
				events: [
					linear(day(1), 0, 7, 40),
					cliff(day(1) + 5 * 60 * 60, 100),
					cliff(day(1) + 8 * 60 * 60, 2),
					cliff(nowTimestampSec + 30 * 24 * 60 * 60, 200)
				]
			}
		]
		const statistics = calculateUpcomingUnlockStatistics(data, nowTimestampSec)
		const series = buildUpcomingUnlockSeries(data, nowTimestampSec, nowTimestampSec + 30 * 24 * 60 * 60)
		let cliffValue = 0
		let linearValue = 0
		for (const item of series) {
			for (const point of item.cliffPoints) cliffValue += point[1]
			for (const point of item.linearPoints) linearValue += point[1]
		}

		// Only the 2-token cliff after now is in the window; 30 days of a 7/week rate is 30 tokens.
		expect({ cliff: cliffValue, linear: linearValue }).toEqual({ cliff: 14, linear: 210 })
		expect(statistics.upcomingUnlocks30d).toMatchObject({ cliff: 14, linear: 210, total: 224 })
	})
})
