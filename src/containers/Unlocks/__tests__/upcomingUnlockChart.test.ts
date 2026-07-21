import { describe, expect, it } from 'vitest'
import {
	buildUpcomingUnlockChart,
	buildUpcomingUnlockSeries,
	type UpcomingUnlockChartProtocol
} from '../upcomingUnlockChart'

const day = (dayOfMonth: number) => Date.UTC(2024, 0, dayOfMonth) / 1e3

const protocols: UpcomingUnlockChartProtocol[] = [
	{
		name: 'Zeta',
		tPrice: 2,
		events: [
			{ timestamp: day(2), noOfTokens: [2, 3] },
			{ timestamp: day(3), noOfTokens: [1] },
			{ timestamp: day(20), noOfTokens: [100] }
		]
	},
	{
		name: 'Alpha',
		tPrice: 1,
		events: [
			{ timestamp: day(2), noOfTokens: [4] },
			{ timestamp: day(3), noOfTokens: [0] }
		]
	}
]

describe('buildUpcomingUnlockChart', () => {
	const series = buildUpcomingUnlockSeries(protocols, day(1), day(10))

	it('compacts eligible raw events into daily USD points', () => {
		expect(series).toEqual([
			{
				name: 'Zeta',
				points: [
					[Date.UTC(2024, 0, 2), 10],
					[Date.UTC(2024, 0, 3), 2]
				]
			},
			{ name: 'Alpha', points: [[Date.UTC(2024, 0, 2), 4]] }
		])
	})

	it('preserves current-day exclusion and the exclusive end bound used by the page', () => {
		const startTimestampSec = day(1) + 60 * 60
		const bounded = buildUpcomingUnlockSeries(
			[
				{
					name: 'Bounded',
					tPrice: 1,
					events: [
						{ timestamp: day(1) + 2 * 60 * 60, noOfTokens: [1] },
						{ timestamp: day(2), noOfTokens: [2] },
						{ timestamp: day(3), noOfTokens: [3] }
					]
				}
			],
			startTimestampSec,
			day(3)
		)

		expect(bounded).toEqual([{ name: 'Bounded', points: [[Date.UTC(2024, 0, 2), 2]] }])
	})

	it('builds one unstacked total series and sums values by period', () => {
		const result = buildUpcomingUnlockChart({
			series,
			groupBy: 'weekly',
			viewMode: 'Total View'
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Total Upcoming Unlock Value'],
			source: [[Date.UTC(2024, 0, 7), 16]]
		})
		expect(result.charts).toEqual([
			{
				type: 'bar',
				name: 'Total Upcoming Unlock Value',
				encode: { x: 0, y: 1 },
				color: '#8884d8'
			}
		])
	})

	it('builds alphabetized stacked protocol series without total data', () => {
		const result = buildUpcomingUnlockChart({
			series,
			groupBy: 'daily',
			viewMode: 'Breakdown View'
		})

		expect(result.dataset.dimensions).toEqual(['timestamp', 'Alpha', 'Zeta'])
		expect(result.dataset.source).toEqual([
			[Date.UTC(2024, 0, 2), 4, 10],
			[Date.UTC(2024, 0, 3), null, 2]
		])
		expect(result.charts.map(({ name, stack }) => ({ name, stack }))).toEqual([
			{ name: 'Alpha', stack: 'A' },
			{ name: 'Zeta', stack: 'A' }
		])
	})
})
