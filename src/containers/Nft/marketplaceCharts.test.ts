import { describe, expect, it } from 'vitest'
import { getNDistinctColors } from '~/utils'
import type { RawNftMarketplaceVolume } from './api.types'
import { buildNFTMarketplaceChartData, buildNFTMarketplaceRelativeChartData } from './marketplaceCharts'

const row = (day: string, exchangeName: string, sum: number | null, count: number): RawNftMarketplaceVolume => ({
	day,
	exchangeName,
	sum,
	sumUsd: sum == null ? null : sum * 2_000,
	count
})

const buildAll = (input: RawNftMarketplaceVolume[]) => {
	const absolute = buildNFTMarketplaceChartData(input)
	return { ...absolute, ...buildNFTMarketplaceRelativeChartData(absolute) }
}

describe('NFT marketplace chart data', () => {
	it('keeps the absolute base independent from the lazily derived relative presentation', () => {
		const absolute = buildNFTMarketplaceChartData([row('2024-01-01', 'OpenSea', 1, 2), row('2024-01-01', 'Blur', 3, 4)])

		expect(absolute).not.toHaveProperty('relativeVolumeDataset')
		expect(absolute).not.toHaveProperty('relativeTradesDataset')
		expect(buildNFTMarketplaceRelativeChartData(absolute).relativeVolumeDataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 25, 75]
		])
	})

	it('builds dense canonical datasets in chronological first-seen marketplace order', () => {
		const input = [
			row('2024-01-01', 'OpenSea', 1, 2),
			row('2024-01-01', 'Blur', 3, 4),
			row('2024-01-02', 'Blur', 2.3456, 2.3456),
			row('2024-01-03', 'Others', 0, 0)
		]
		const before = structuredClone(input)
		const result = buildAll(input)
		const dimensions = ['timestamp', 'OpenSea', 'Blur', 'Others']

		expect(result.absoluteVolumeDataset).toEqual({
			dimensions,
			source: [
				[Date.UTC(2024, 0, 1), 1, 3, 0],
				[Date.UTC(2024, 0, 2), 0, 2.346, 0],
				[Date.UTC(2024, 0, 3), 0, 0, 0]
			]
		})
		expect(result.absoluteTradesDataset).toEqual({
			dimensions,
			source: [
				[Date.UTC(2024, 0, 1), 2, 4, 0],
				[Date.UTC(2024, 0, 2), 0, 2.346, 0],
				[Date.UTC(2024, 0, 3), 0, 0, 0]
			]
		})
		expect(result.relativeVolumeDataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 25, 75, 0],
			[Date.UTC(2024, 0, 2), 0, 100.02, 0],
			[Date.UTC(2024, 0, 3), 0, 0, 0]
		])
		expect(result.relativeTradesDataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 33.33, 66.67, 0],
			[Date.UTC(2024, 0, 2), 0, 100.02, 0],
			[Date.UTC(2024, 0, 3), 0, 0, 0]
		])
		expect(result.relativeVolumeDataset.dimensions).toBe(result.absoluteVolumeDataset.dimensions)
		expect(result.relativeTradesDataset.dimensions).toBe(result.absoluteVolumeDataset.dimensions)
		expect(input).toEqual(before)
	})

	it('keeps positional pre-rounding totals as the relative denominator', () => {
		const absolute = buildNFTMarketplaceChartData([
			row('2024-01-01', 'OpenSea', 1.23456, 1.23456),
			row('2024-01-01', 'Blur', 2.34567, 2.34567)
		])
		const relative = buildNFTMarketplaceRelativeChartData(absolute)

		expect(absolute.dailyTotals).toEqual([[3.5802300000000002, 3.5802300000000002]])
		expect(absolute.absoluteVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 1.235, 2.346]])
		expect(relative.relativeVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 34.49, 65.53]])
	})

	it('builds matching bar and area series with stable colors and stacks', () => {
		const result = buildAll([
			row('2024-01-01', 'OpenSea', 1, 2),
			row('2024-01-01', 'Blur', 3, 4),
			row('2024-01-02', 'Others', 2, 3)
		])
		const colors = getNDistinctColors(3)

		expect(result.absoluteBarCharts).toEqual([
			{
				type: 'bar',
				name: 'OpenSea',
				encode: { x: 0, y: 1 },
				stack: 'stackA',
				color: colors[0],
				large: false
			},
			{
				type: 'bar',
				name: 'Blur',
				encode: { x: 0, y: 2 },
				stack: 'stackA',
				color: colors[1],
				large: false
			},
			{
				type: 'bar',
				name: 'Others',
				encode: { x: 0, y: 3 },
				stack: 'stackA',
				color: '#AAAAAA',
				large: false
			}
		])
		expect(result.relativeAreaCharts).toEqual(
			result.absoluteBarCharts.map(({ name, encode, color }) => ({ type: 'line', name, encode, color }))
		)
		expect(JSON.parse(JSON.stringify(result))).toEqual(result)
	})

	it('keeps the latest full-millisecond duplicate after grouping timestamps to seconds', () => {
		const result = buildAll([
			row('2024-01-01T00:00:00.100Z', 'OpenSea', 1, 2),
			row('2024-01-01T00:00:00.900Z', 'OpenSea', 9, 18)
		])

		expect(result.absoluteVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 10]])
		expect(result.absoluteTradesDataset.source).toEqual([[Date.UTC(2024, 0, 1), 20]])
		expect(result.relativeVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 100]])
		expect(result.relativeTradesDataset.source).toEqual([[Date.UTC(2024, 0, 1), 100]])
	})

	it('returns serializable empty canonical payloads', () => {
		const result = buildAll([])

		expect(result.absoluteVolumeDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.relativeVolumeDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.absoluteTradesDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.relativeTradesDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.absoluteBarCharts).toEqual([])
		expect(result.relativeAreaCharts).toEqual([])
	})

	it('preserves legacy zero-volume behavior for nullable live API rows', () => {
		const result = buildAll([row('2024-01-01', 'OpenSea', null, 2), row('2024-01-01', 'Blur', 0, 3)])

		expect(result.absoluteVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 0, 0]])
		expect(result.absoluteTradesDataset.source).toEqual([[Date.UTC(2024, 0, 1), 2, 3]])
		expect(result.relativeVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 0, 0]])
	})

	it('limits rendered marketplaces and aggregates every omitted value into Others', () => {
		const marketplaces = Array.from({ length: 31 }, (_, index) => `Marketplace ${index + 1}`)
		const result = buildAll(
			marketplaces.map((name, index) =>
				row('2024-01-01', name, marketplaces.length - index, marketplaces.length - index)
			)
		)

		expect(result.absoluteBarCharts).toHaveLength(30)
		expect(result.absoluteVolumeDataset.dimensions).toEqual(['timestamp', ...marketplaces.slice(0, 29), 'Others'])
		expect(result.absoluteVolumeDataset.source[0]?.[30]).toBe(3)
		expect(result.absoluteTradesDataset.source[0]?.[30]).toBe(3)
		expect(result.relativeVolumeDataset.source[0]?.[30]).toBe(0.6)
	})
})
