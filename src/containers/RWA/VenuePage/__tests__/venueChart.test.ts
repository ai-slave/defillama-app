import { describe, expect, test } from 'vitest'
import { buildRwaVenueEntityChart, buildRwaVenueOiShare } from '../venueChart'

describe('buildRwaVenueEntityChart', () => {
	const inputs = {
		openInterest: [
			[Date.UTC(2026, 0, 1), 100],
			[Date.UTC(2026, 0, 2), 120]
		] as Array<[number, number]>,
		volume: [
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 0, 2), 30]
		] as Array<[number, number]>,
		markets: [],
		totalOpenInterest: [],
		milestones: [{ date: '2025-06', event: 'Mainnet' }],
		period: 'daily' as const
	}

	test('draws one series per selected metric; cumulative volume runs the daily volume up', () => {
		const chart = buildRwaVenueEntityChart(['openInterest', 'cumulativeVolume'], inputs)
		expect(chart.series.map((series) => series.name)).toEqual(['Open Interest', 'Cumulative Volume'])
		expect(chart.series[1]?.data).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 0, 2), 40]
		])
		expect(chart.hallmarks).toEqual([])
	})

	test('Cumulative runs the volume up as a line and keeps open interest on its days', () => {
		const chart = buildRwaVenueEntityChart(['openInterest', 'volume'], { ...inputs, period: 'cumulative' })
		expect(chart.series.map((series) => [series.name, series.type])).toEqual([
			['Open Interest', 'line'],
			['Volume', 'line']
		])
		expect(chart.series[0]?.data).toEqual(inputs.openInterest)
		expect(chart.series[1]?.data).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 0, 2), 40]
		])
	})

	test('Share of RWA perps OI is a percent line on an axis of its own', () => {
		const chart = buildRwaVenueEntityChart(['openInterest', 'volume', 'markets', 'oiShare'], {
			...inputs,
			totalOpenInterest: [
				[Date.UTC(2026, 0, 1), 400],
				[Date.UTC(2026, 0, 2), 480]
			]
		})
		const share = chart.series.find((series) => series.name === 'Share of RWA Perps OI')
		expect(share?.valueSymbol).toBe('%')
		expect(share?.data).toEqual([
			[Date.UTC(2026, 0, 1), 25],
			[Date.UTC(2026, 0, 2), 25]
		])
		const otherAxes = chart.series.filter((series) => series !== share).map((series) => series.yAxisIndex)
		expect(otherAxes).not.toContain(share?.yAxisIndex)
	})

	test('Events marks the milestones on the time axis', () => {
		const chart = buildRwaVenueEntityChart(['openInterest', 'events'], inputs)
		expect(chart.hallmarks).toEqual([[Date.UTC(2025, 5, 1) / 1e3, 'Mainnet']])
	})
})

describe('buildRwaVenueOiShare', () => {
	test('divides the venue by the total per day, in percent, over the days the total is known and above zero', () => {
		expect(
			buildRwaVenueOiShare(
				[
					[1, 10],
					[2, 30],
					[3, 5],
					[4, 7]
				],
				[
					[1, 100],
					[2, 120],
					[3, 0]
				]
			)
		).toEqual([
			[1, 10],
			[2, 25]
		])
	})
})
