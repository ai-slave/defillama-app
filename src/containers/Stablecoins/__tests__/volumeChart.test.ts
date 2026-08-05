import { describe, expect, it } from 'vitest'
import type { StablecoinVolumeBreakdownChartPoint } from '../api.types'
import { buildStablecoinVolumeChartPayload, groupStablecoinVolumeChartPayload } from '../volumeChart'

describe('buildStablecoinVolumeChartPayload', () => {
	it('formats total volume as a single MultiSeriesChart bar', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1609459200, 100],
				[1609545600, 125]
			],
			chart: 'total'
		})

		expect(payload.dataset).toEqual({
			source: [
				[1609459200000, 100],
				[1609545600000, 125]
			],
			dimensions: ['timestamp', 'Volume']
		})
		expect(payload.charts).toHaveLength(1)
		expect(payload.charts.at(0)?.type).toBe('bar')
		expect(payload.stacked).toBe(false)
	})

	it('trims trailing incomplete zero buckets without removing interior zeroes', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1609459200, 100],
				[1609545600, 0],
				[1609632000, 125],
				[1609718400, 0]
			],
			chart: 'total',
			trimIncompleteTail: true
		})

		expect(payload.dataset.source).toEqual([
			[1609459200000, 100],
			[1609545600000, 0],
			[1609632000000, 125]
		])
		expect(
			buildStablecoinVolumeChartPayload({
				data: [
					[1609459200, 100],
					[1609545600, 0]
				],
				chart: 'total'
			}).dataset.source
		).toHaveLength(2)
	})

	it('limits breakdown series and folds the rest into Others', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1609459200, { ethereum: 100, tron: 80, base: 50, bsc: 25 }],
				[1609545600, { ethereum: 120, tron: 90, base: 60, bsc: 30 }]
			],
			chart: 'chain',
			limit: 2
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'ethereum', 'tron', 'Others'])
		expect(payload.dataset.source[1]).toEqual([1609545600000, 120, 90, 90])
		expect(payload.showTotalInTooltip).toBe(true)
		expect(payload.stacked).toBe(true)
		expect(payload.charts.every((chart) => chart.large === false)).toBe(true)
		expect(payload.charts.find((chart) => chart.name === 'Others')?.color).toBe('#AAAAAA')
	})

	it('keeps every breakdown series when a complete export explicitly disables the limit', () => {
		const names = Array.from({ length: 55 }, (_, index) => `chain-${index + 1}`)
		const payload = buildStablecoinVolumeChartPayload({
			data: [[1609459200, Object.fromEntries(names.map((name, index) => [name, names.length - index]))]],
			chart: 'chain',
			limit: null
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', ...names])
		expect(payload.dataset.dimensions).not.toContain('Others')
	})

	it('keeps zero and missing breakdown values exact while preserving input order', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1609459200, { ethereum: 100, base: 5 }],
				[1609545600, { ethereum: 0, tron: 10, base: 0 }]
			],
			chart: 'chain',
			limit: 2
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'tron', 'ethereum', 'Others'])
		expect(payload.dataset.source).toEqual([
			[1609459200000, 0, 100, 5],
			[1609545600000, 10, 0, 0]
		])
		expect(payload.availableSeries).toEqual(['tron', 'ethereum', 'base'])
		expect(payload.showTotalInTooltip).toBe(true)
		expect(payload.stacked).toBe(true)
		expect(payload.charts.every((chart) => chart.large === false)).toBe(true)
	})

	it('projects explicit historical peers and aggregates only the selected tail', () => {
		const data: StablecoinVolumeBreakdownChartPoint[] = [
			[1609459200, { ethereum: 100, base: 5 }],
			[1609545600, { ethereum: 0, tron: 10, base: 7 }]
		]
		const selected = buildStablecoinVolumeChartPayload({
			data,
			chart: 'chain',
			limit: 2,
			selectedNames: ['base']
		})
		expect(selected.dataset.dimensions).toEqual(['timestamp', 'base'])
		expect(selected.dataset.source).toEqual([
			[1609459200000, 5],
			[1609545600000, 7]
		])

		const overflow = buildStablecoinVolumeChartPayload({
			data,
			chart: 'chain',
			limit: 1,
			selectedNames: ['tron', 'base']
		})
		expect(overflow.dataset.dimensions).toEqual(['timestamp', 'tron', 'Others'])
		expect(overflow.dataset.source).toEqual([
			[1609459200000, 0, 5],
			[1609545600000, 10, 7]
		])

		const excluded = buildStablecoinVolumeChartPayload({
			data,
			chart: 'chain',
			limit: 1,
			excludedNames: ['ethereum']
		})
		expect(excluded.dataset.dimensions).toEqual(['timestamp', 'tron', 'Others'])
		expect(excluded.dataset.source).toEqual([
			[1609459200000, 0, 5],
			[1609545600000, 10, 7]
		])
	})

	it('ranks from the latest non-empty breakdown when the current bucket is empty', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1609459200, { ethereum: 100, tron: 80 }],
				[1609545600, {}]
			],
			chart: 'chain',
			limit: 2,
			trimIncompleteTail: true
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'ethereum', 'tron'])
		expect(payload.dataset.source).toEqual([[1609459200000, 100, 80]])
	})

	it('returns an empty breakdown payload when every bucket is empty', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1609459200, {}],
				[1609545600, {}]
			],
			chart: 'chain',
			trimIncompleteTail: true
		})

		expect(payload.dataset).toEqual({
			source: [],
			dimensions: ['timestamp']
		})
		expect(payload.charts).toEqual([])
	})

	it('groups volume payloads by the selected interval', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1609459200, 100],
				[1609545600, 125]
			],
			chart: 'total'
		})

		const grouped = groupStablecoinVolumeChartPayload(payload, 'yearly')

		expect(grouped.dataset.source).toEqual([[1609459200000, 225]])
		expect(grouped.charts.at(0)?.type).toBe('bar')
	})

	it('renders cumulative volume totals as lines without bar-only options', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1609459200, 100],
				[1609545600, 25]
			],
			chart: 'total'
		})

		const grouped = groupStablecoinVolumeChartPayload(payload, 'cumulative')
		const groupedChart = grouped.charts.at(0)

		expect(grouped.dataset.source).toEqual([
			[1609459200000, 100],
			[1609545600000, 125]
		])
		expect(groupedChart).toMatchObject({ type: 'line', name: 'Volume' })
		expect(groupedChart).not.toHaveProperty('barMinWidth')
		expect(groupedChart).not.toHaveProperty('barMaxWidth')
	})
})
