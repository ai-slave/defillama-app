import { describe, expect, it } from 'vitest'
import { buildStablecoinVolumeChartPayload, groupStablecoinVolumeChartPayload } from '../volumeChart'

describe('buildStablecoinVolumeChartPayload', () => {
	it('formats total volume as a single MultiSeriesChart2 bar', () => {
		const payload = buildStablecoinVolumeChartPayload(
			[
				[1609459200, 100],
				[1609545600, 125]
			],
			{ chart: 'total' }
		)

		expect(payload.dataset).toEqual({
			source: [
				{ timestamp: 1609459200000, Volume: 100 },
				{ timestamp: 1609545600000, Volume: 125 }
			],
			dimensions: ['timestamp', 'Volume']
		})
		expect(payload.charts).toHaveLength(1)
		expect(payload.charts[0].type).toBe('bar')
		expect(payload.stacked).toBe(false)
	})

	it('trims trailing incomplete zero buckets without removing interior zeroes', () => {
		const payload = buildStablecoinVolumeChartPayload(
			[
				[1609459200, 100],
				[1609545600, 0],
				[1609632000, 125],
				[1609718400, 0]
			],
			{ chart: 'total', trimIncompleteTail: true }
		)

		expect(payload.dataset.source).toEqual([
			{ timestamp: 1609459200000, Volume: 100 },
			{ timestamp: 1609545600000, Volume: 0 },
			{ timestamp: 1609632000000, Volume: 125 }
		])
		expect(
			buildStablecoinVolumeChartPayload(
				[
					[1609459200, 100],
					[1609545600, 0]
				],
				{ chart: 'total' }
			).dataset.source
		).toHaveLength(2)
	})

	it('limits breakdown series and folds the rest into Others', () => {
		const payload = buildStablecoinVolumeChartPayload(
			[
				[1609459200, { ethereum: 100, tron: 80, base: 50, bsc: 25 }],
				[1609545600, { ethereum: 120, tron: 90, base: 60, bsc: 30 }]
			],
			{ chart: 'chain', limit: 2 }
		)

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'ethereum', 'tron', 'Others'])
		expect(payload.dataset.source[1]).toEqual({
			timestamp: 1609545600000,
			ethereum: 120,
			tron: 90,
			Others: 90
		})
		expect(payload.showTotalInTooltip).toBe(true)
		expect(payload.stacked).toBe(true)
		expect(payload.charts.every((chart) => chart.large === false)).toBe(true)
	})

	it('keeps zero and missing breakdown values exact while preserving input order', () => {
		const payload = buildStablecoinVolumeChartPayload(
			[
				[1609459200, { ethereum: 100, base: 5 }],
				[1609545600, { ethereum: 0, tron: 10, base: 0 }]
			],
			{ chart: 'chain', limit: 2 }
		)

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'tron', 'Others'])
		expect(payload.dataset.source).toEqual([
			{ timestamp: 1609459200000, tron: 0, Others: 105 },
			{ timestamp: 1609545600000, tron: 10, Others: 0 }
		])
		expect(payload.showTotalInTooltip).toBe(true)
		expect(payload.stacked).toBe(true)
		expect(payload.charts.every((chart) => chart.large === false)).toBe(true)
	})

	it('ranks from the latest non-empty breakdown when the current bucket is empty', () => {
		const payload = buildStablecoinVolumeChartPayload(
			[
				[1609459200, { ethereum: 100, tron: 80 }],
				[1609545600, {}]
			],
			{ chart: 'chain', limit: 2, trimIncompleteTail: true }
		)

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'ethereum', 'tron'])
		expect(payload.dataset.source).toEqual([{ timestamp: 1609459200000, ethereum: 100, tron: 80, Others: 0 }])
	})

	it('returns an empty breakdown payload when every bucket is empty', () => {
		const payload = buildStablecoinVolumeChartPayload(
			[
				[1609459200, {}],
				[1609545600, {}]
			],
			{ chart: 'chain', trimIncompleteTail: true }
		)

		expect(payload.dataset).toEqual({
			source: [],
			dimensions: ['timestamp']
		})
		expect(payload.charts).toEqual([])
	})

	it('groups volume payloads by the selected interval', () => {
		const payload = buildStablecoinVolumeChartPayload(
			[
				[1609459200, 100],
				[1609545600, 125]
			],
			{ chart: 'total' }
		)

		const grouped = groupStablecoinVolumeChartPayload(payload, 'yearly')

		expect(grouped.dataset.source).toEqual([{ timestamp: 1609459200000, Volume: 225 }])
		expect(grouped.charts[0].type).toBe('bar')
	})

	it('renders cumulative volume totals as lines without bar-only options', () => {
		const payload = buildStablecoinVolumeChartPayload(
			[
				[1609459200, 100],
				[1609545600, 25]
			],
			{ chart: 'total' }
		)

		const grouped = groupStablecoinVolumeChartPayload(payload, 'cumulative')

		expect(grouped.dataset.source).toEqual([
			{ timestamp: 1609459200000, Volume: 100 },
			{ timestamp: 1609545600000, Volume: 125 }
		])
		expect(grouped.charts[0]).toMatchObject({ type: 'line', name: 'Volume' })
		expect(grouped.charts[0]).not.toHaveProperty('barMinWidth')
		expect(grouped.charts[0]).not.toHaveProperty('barMaxWidth')
	})
})
