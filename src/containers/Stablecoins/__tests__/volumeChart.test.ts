import { describe, expect, test } from 'vitest'
import type { StablecoinVolumeBreakdownChartPoint } from '../api.types'
import { buildStablecoinVolumeChartPayload, groupStablecoinVolumeChartPayload } from '../volumeChart'

describe('buildStablecoinVolumeChartPayload', () => {
	test('formats total volume as a single MultiSeriesChart bar', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1_609_459_200, 100],
				[1_609_545_600, 125]
			],
			chart: 'total'
		})

		expect(payload.dataset).toEqual({
			source: [
				[1_609_459_200_000, 100],
				[1_609_545_600_000, 125]
			],
			dimensions: ['timestamp', 'Volume']
		})
		expect(payload.charts).toHaveLength(1)
		expect(payload.charts.at(0)?.type).toBe('bar')
		expect(payload.stacked).toBe(false)
	})

	test('trims trailing incomplete zero buckets without removing interior zeroes', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1_609_459_200, 100],
				[1_609_545_600, 0],
				[1_609_632_000, 125],
				[1_609_718_400, 0]
			],
			chart: 'total',
			trimIncompleteTail: true
		})

		expect(payload.dataset.source).toEqual([
			[1_609_459_200_000, 100],
			[1_609_545_600_000, 0],
			[1_609_632_000_000, 125]
		])
		expect(
			buildStablecoinVolumeChartPayload({
				data: [
					[1_609_459_200, 100],
					[1_609_545_600, 0]
				],
				chart: 'total'
			}).dataset.source
		).toHaveLength(2)
	})

	test('limits breakdown series and folds the rest into Others', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1_609_459_200, { ethereum: 100, tron: 80, base: 50, bsc: 25 }],
				[1_609_545_600, { ethereum: 120, tron: 90, base: 60, bsc: 30 }]
			],
			chart: 'chain',
			limit: 2
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'ethereum', 'tron', 'Others'])
		expect(payload.dataset.source[1]).toEqual([1_609_545_600_000, 120, 90, 90])
		expect(payload.showTotalInTooltip).toBe(true)
		expect(payload.stacked).toBe(true)
		expect(payload.charts.every((chart) => chart.large === false)).toBe(true)
		expect(payload.charts.find((chart) => chart.name === 'Others')?.color).toBe('#AAAAAA')
	})

	test('keeps every breakdown series when a complete export explicitly disables the limit', () => {
		const names = Array.from({ length: 55 }, (_, index) => `chain-${index + 1}`)
		const payload = buildStablecoinVolumeChartPayload({
			data: [[1_609_459_200, Object.fromEntries(names.map((name, index) => [name, names.length - index]))]],
			chart: 'chain',
			limit: null
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', ...names])
		expect(payload.dataset.dimensions).not.toContain('Others')
	})

	test('keeps zero and missing breakdown values exact while preserving input order', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1_609_459_200, { ethereum: 100, base: 5 }],
				[1_609_545_600, { ethereum: 0, tron: 10, base: 0 }]
			],
			chart: 'chain',
			limit: 2
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'tron', 'ethereum', 'Others'])
		expect(payload.dataset.source).toEqual([
			[1_609_459_200_000, 0, 100, 5],
			[1_609_545_600_000, 10, 0, 0]
		])
		expect(payload.availableSeries).toEqual(['tron', 'ethereum', 'base'])
		expect(payload.showTotalInTooltip).toBe(true)
		expect(payload.stacked).toBe(true)
		expect(payload.charts.every((chart) => chart.large === false)).toBe(true)
	})

	test('a pick list that names no chain in the data shows every chain', () => {
		const data: Array<StablecoinVolumeBreakdownChartPoint> = [
			[1_609_459_200, { ethereum: 100, base: 5 }],
			[1_609_545_600, { ethereum: 0, tron: 10, base: 7 }]
		]
		const payload = buildStablecoinVolumeChartPayload({ data, chart: 'chain', limit: 5, selectedNames: ['polygon'] })
		expect(payload.dataset.dimensions.slice(1).sort()).toEqual(['base', 'ethereum', 'tron'])
	})

	test('an exclusion that leaves no chain shows every chain', () => {
		const data: Array<StablecoinVolumeBreakdownChartPoint> = [[1_609_459_200, { ethereum: 100, base: 5 }]]
		const payload = buildStablecoinVolumeChartPayload({
			data,
			chart: 'chain',
			limit: 5,
			excludedNames: ['ethereum', 'base']
		})
		expect(payload.dataset.dimensions.slice(1).sort()).toEqual(['base', 'ethereum'])
	})

	test('projects explicit historical peers and aggregates only the selected tail', () => {
		const data: Array<StablecoinVolumeBreakdownChartPoint> = [
			[1_609_459_200, { ethereum: 100, base: 5 }],
			[1_609_545_600, { ethereum: 0, tron: 10, base: 7 }]
		]
		const selected = buildStablecoinVolumeChartPayload({
			data,
			chart: 'chain',
			limit: 2,
			selectedNames: ['base']
		})
		expect(selected.dataset.dimensions).toEqual(['timestamp', 'base'])
		expect(selected.dataset.source).toEqual([
			[1_609_459_200_000, 5],
			[1_609_545_600_000, 7]
		])

		const overflow = buildStablecoinVolumeChartPayload({
			data,
			chart: 'chain',
			limit: 1,
			selectedNames: ['tron', 'base']
		})
		expect(overflow.dataset.dimensions).toEqual(['timestamp', 'tron', 'Others'])
		expect(overflow.dataset.source).toEqual([
			[1_609_459_200_000, 0, 5],
			[1_609_545_600_000, 10, 7]
		])

		const excluded = buildStablecoinVolumeChartPayload({
			data,
			chart: 'chain',
			limit: 1,
			excludedNames: ['ethereum']
		})
		expect(excluded.dataset.dimensions).toEqual(['timestamp', 'tron', 'Others'])
		expect(excluded.dataset.source).toEqual([
			[1_609_459_200_000, 0, 5],
			[1_609_545_600_000, 10, 7]
		])
	})

	test('ranks from the latest non-empty breakdown when the current bucket is empty', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1_609_459_200, { ethereum: 100, tron: 80 }],
				[1_609_545_600, {}]
			],
			chart: 'chain',
			limit: 2,
			trimIncompleteTail: true
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'ethereum', 'tron'])
		expect(payload.dataset.source).toEqual([[1_609_459_200_000, 100, 80]])
	})

	test('returns an empty breakdown payload when every bucket is empty', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1_609_459_200, {}],
				[1_609_545_600, {}]
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

	test('groups volume payloads by the selected interval', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1_609_459_200, 100],
				[1_609_545_600, 125]
			],
			chart: 'total'
		})

		const grouped = groupStablecoinVolumeChartPayload(payload, 'yearly')

		expect(grouped.dataset.source).toEqual([[1_609_459_200_000, 225]])
		expect(grouped.charts.at(0)?.type).toBe('bar')
	})

	test('renders cumulative volume totals as lines without bar-only options', () => {
		const payload = buildStablecoinVolumeChartPayload({
			data: [
				[1_609_459_200, 100],
				[1_609_545_600, 25]
			],
			chart: 'total'
		})

		const grouped = groupStablecoinVolumeChartPayload(payload, 'cumulative')
		const groupedChart = grouped.charts.at(0)

		expect(grouped.dataset.source).toEqual([
			[1_609_459_200_000, 100],
			[1_609_545_600_000, 125]
		])
		expect(groupedChart).toMatchObject({ type: 'line', name: 'Volume' })
		expect(groupedChart).not.toHaveProperty('barMinWidth')
		expect(groupedChart).not.toHaveProperty('barMaxWidth')
	})
})
