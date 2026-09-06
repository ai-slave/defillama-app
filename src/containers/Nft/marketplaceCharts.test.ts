import { describe, expect, test } from 'vitest'
import { getNDistinctColors } from '~/utils'
import type { RawNftMarketplaceVolume } from './api.types'
import {
	buildNFTMarketplaceChartData,
	buildNFTMarketplaceChartPresentation,
	buildNFTMarketplaceCsvDataset,
	buildNFTMarketplaceRelativeChartData
} from './marketplaceCharts'

const row = (day: string, exchangeName: string, sum: number | null, count: number): RawNftMarketplaceVolume => ({
	day,
	exchangeName,
	sum,
	sumUsd: sum == null ? null : sum * 2000,
	count
})

const buildAll = (input: Array<RawNftMarketplaceVolume>) => {
	const absolute = buildNFTMarketplaceChartData(input)
	const presentation = buildNFTMarketplaceChartPresentation(absolute, absolute.availableSeries, true)
	return { ...presentation, ...buildNFTMarketplaceRelativeChartData(presentation) }
}

describe('NFT marketplace chart data', () => {
	test('keeps the absolute base independent from the lazily derived relative presentation', () => {
		const absolute = buildNFTMarketplaceChartData([row('2024-01-01', 'OpenSea', 1, 2), row('2024-01-01', 'Blur', 3, 4)])

		expect(absolute).not.toHaveProperty('relativeVolumeDataset')
		expect(absolute).not.toHaveProperty('relativeTradesDataset')
		expect(buildNFTMarketplaceRelativeChartData(absolute).relativeVolumeDataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 75, 25]
		])
	})

	test('builds dense canonical datasets in ranked marketplace order', () => {
		const input = [
			row('2024-01-01', 'OpenSea', 1, 2),
			row('2024-01-01', 'Blur', 3, 4),
			row('2024-01-02', 'Blur', 2.3456, 2.3456),
			row('2024-01-03', 'Others', 0, 0)
		]
		const before = structuredClone(input)
		const result = buildAll(input)
		const dimensions = ['timestamp', 'Blur', 'OpenSea']

		expect(result.absoluteVolumeDataset).toEqual({
			dimensions,
			source: [
				[Date.UTC(2024, 0, 1), 3, 1],
				[Date.UTC(2024, 0, 2), 2.3456, 0],
				[Date.UTC(2024, 0, 3), 0, 0]
			]
		})
		expect(result.absoluteTradesDataset).toEqual({
			dimensions,
			source: [
				[Date.UTC(2024, 0, 1), 4, 2],
				[Date.UTC(2024, 0, 2), 2.3456, 0],
				[Date.UTC(2024, 0, 3), 0, 0]
			]
		})
		expect(result.relativeVolumeDataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 75, 25],
			[Date.UTC(2024, 0, 2), 100, 0],
			[Date.UTC(2024, 0, 3), 0, 0]
		])
		expect(result.relativeTradesDataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 66.67, 33.33],
			[Date.UTC(2024, 0, 2), 100, 0],
			[Date.UTC(2024, 0, 3), 0, 0]
		])
		expect(result.relativeVolumeDataset.dimensions).toBe(result.absoluteVolumeDataset.dimensions)
		expect(result.relativeTradesDataset.dimensions).toBe(result.absoluteVolumeDataset.dimensions)
		expect(input).toEqual(before)
	})

	test('uses the same unrounded values for series and dominance totals', () => {
		const absolute = buildNFTMarketplaceChartData([
			row('2024-01-01', 'OpenSea', 1.23456, 1.23456),
			row('2024-01-01', 'Blur', 2.34567, 2.34567)
		])
		const presentation = buildNFTMarketplaceChartPresentation(absolute, absolute.availableSeries, true)
		const relative = buildNFTMarketplaceRelativeChartData(presentation)

		expect(absolute.dailyTotals).toEqual([[3.5802300000000002, 3.5802300000000002]])
		expect(absolute.absoluteVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 2.34567, 1.23456]])
		expect(relative.relativeVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 65.52, 34.48]])
	})

	test('builds matching bar and area series with stable colors and stacks', () => {
		const result = buildAll([row('2024-01-01', 'OpenSea', 1, 2), row('2024-01-01', 'Blur', 3, 4)])
		const colors = getNDistinctColors(2)

		expect(result.absoluteBarCharts).toEqual([
			{
				type: 'bar',
				name: 'Blur',
				encode: { x: 0, y: 1 },
				stack: 'stackA',
				color: colors[0],
				large: false
			},
			{
				type: 'bar',
				name: 'OpenSea',
				encode: { x: 0, y: 2 },
				stack: 'stackA',
				color: colors[1],
				large: false
			}
		])
		expect(result.relativeAreaCharts).toEqual(
			result.absoluteBarCharts.map(({ name, encode, color }) => ({ type: 'line', name, encode, color }))
		)
		expect(JSON.parse(JSON.stringify(result))).toEqual(result)
	})

	test('keeps the latest full-millisecond duplicate after grouping timestamps to seconds', () => {
		const result = buildAll([
			row('2024-01-01T00:00:00.100Z', 'OpenSea', 1, 2),
			row('2024-01-01T00:00:00.900Z', 'OpenSea', 9, 18)
		])

		expect(result.absoluteVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 10]])
		expect(result.absoluteTradesDataset.source).toEqual([[Date.UTC(2024, 0, 1), 20]])
		expect(result.relativeVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 100]])
		expect(result.relativeTradesDataset.source).toEqual([[Date.UTC(2024, 0, 1), 100]])
	})

	test('returns serializable empty canonical payloads', () => {
		const result = buildAll([])

		expect(result.absoluteVolumeDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.relativeVolumeDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.absoluteTradesDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.relativeTradesDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.absoluteBarCharts).toEqual([])
		expect(result.relativeAreaCharts).toEqual([])
	})

	test('preserves legacy zero-volume behavior for nullable live API rows', () => {
		const result = buildAll([row('2024-01-01', 'OpenSea', null, 2), row('2024-01-01', 'Blur', 0, 3)])

		expect(result.absoluteVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 0, 0]])
		expect(result.absoluteTradesDataset.source).toEqual([[Date.UTC(2024, 0, 1), 2, 3]])
		expect(result.relativeVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 0, 0]])
	})

	test('limits rendered marketplaces and aggregates every omitted value into Others', () => {
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
		const canonical = buildNFTMarketplaceChartData(
			marketplaces.map((name, index) =>
				row('2024-01-01', name, marketplaces.length - index, marketplaces.length - index)
			)
		)
		const csvDataset = buildNFTMarketplaceCsvDataset({ canonical, metric: 'volume', relative: false })
		expect(csvDataset.dimensions).toEqual(['timestamp', ...marketplaces])
		expect(csvDataset.dimensions).not.toContain('Others')
	})

	test('uses the full market denominator and retains only a real upstream Others in relative exports', () => {
		const canonical = buildNFTMarketplaceChartData([
			row('2024-01-01', 'OpenSea', 60, 6),
			row('2024-01-01', 'Blur', 30, 3),
			row('2024-01-01', 'Others', 10, 1)
		])

		expect(buildNFTMarketplaceCsvDataset({ canonical, metric: 'volume', relative: true })).toEqual({
			dimensions: ['timestamp', 'OpenSea', 'Blur', 'Others'],
			source: [[Date.UTC(2024, 0, 1), 60, 30, 10]]
		})
	})

	test('aggregates only the selected tail and renormalizes the selected set', () => {
		const canonical = buildNFTMarketplaceChartData([
			row('2024-01-01', 'OpenSea', 60, 6),
			row('2024-01-01', 'Blur', 30, 3),
			row('2024-01-01', 'LooksRare', 10, 1)
		])
		const presentation = buildNFTMarketplaceChartPresentation(canonical, ['Blur', 'LooksRare'], false)
		const relative = buildNFTMarketplaceRelativeChartData(presentation)

		expect(presentation.absoluteVolumeDataset).toEqual({
			dimensions: ['timestamp', 'Blur', 'LooksRare'],
			source: [[Date.UTC(2024, 0, 1), 30, 10]]
		})
		expect(relative.relativeVolumeDataset.source).toEqual([[Date.UTC(2024, 0, 1), 75, 25]])
	})

	test('keeps the upstream Others remainder only for the all-series intent', () => {
		const canonical = buildNFTMarketplaceChartData([
			row('2024-01-01', 'OpenSea', 60, 6),
			row('2024-01-01', 'Blur', 30, 3),
			row('2024-01-01', 'Others', 10, 1)
		])
		const full = buildNFTMarketplaceChartPresentation(canonical, canonical.availableSeries, true)
		const selected = buildNFTMarketplaceChartPresentation(canonical, ['Blur'], false)

		expect(canonical.availableSeries).toEqual(['OpenSea', 'Blur'])
		expect(full.absoluteVolumeDataset).toEqual({
			dimensions: ['timestamp', 'OpenSea', 'Blur', 'Others'],
			source: [[Date.UTC(2024, 0, 1), 60, 30, 10]]
		})
		expect(buildNFTMarketplaceRelativeChartData(full).relativeVolumeDataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 60, 30, 10]
		])
		expect(selected.absoluteVolumeDataset).toEqual({
			dimensions: ['timestamp', 'Blur'],
			source: [[Date.UTC(2024, 0, 1), 30]]
		})
		expect(buildNFTMarketplaceRelativeChartData(selected).relativeVolumeDataset.source).toEqual([
			[Date.UTC(2024, 0, 1), 100]
		])
	})

	test('renders a valid remainder series when the API only returns Others', () => {
		const canonical = buildNFTMarketplaceChartData([row('2024-01-01', 'Others', 10, 2)])
		const presentation = buildNFTMarketplaceChartPresentation(canonical, [], true)

		expect(presentation.absoluteVolumeDataset).toEqual({
			dimensions: ['timestamp', 'Others'],
			source: [[Date.UTC(2024, 0, 1), 10]]
		})
		expect(presentation.absoluteBarCharts).toEqual([
			{
				type: 'bar',
				name: 'Others',
				encode: { x: 0, y: 1 },
				stack: 'stackA',
				large: false,
				color: '#AAAAAA'
			}
		])
	})
})
