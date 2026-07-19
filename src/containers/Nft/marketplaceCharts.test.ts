import { describe, expect, it } from 'vitest'
import { getNDistinctColors } from '~/utils'
import type { RawNftMarketplaceVolume } from './api.types'
import { buildNFTMarketplaceChartData } from './marketplaceCharts'

const row = (day: string, exchangeName: string, sum: number | null, count: number): RawNftMarketplaceVolume => ({
	day,
	exchangeName,
	sum,
	sumUsd: sum == null ? null : sum * 2_000,
	count
})

describe('NFT marketplace chart data', () => {
	it('builds dense canonical datasets in chronological first-seen marketplace order', () => {
		const input = [
			row('2024-01-01', 'OpenSea', 1, 2),
			row('2024-01-01', 'Blur', 3, 4),
			row('2024-01-02', 'Blur', 2.3456, 2.3456),
			row('2024-01-03', 'Others', 0, 0)
		]
		const before = structuredClone(input)
		const result = buildNFTMarketplaceChartData(input)
		const dimensions = ['timestamp', 'OpenSea', 'Blur', 'Others']

		expect(result.absoluteVolumeDataset).toEqual({
			dimensions,
			source: [
				{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 1, Blur: 3, Others: 0 },
				{ timestamp: Date.UTC(2024, 0, 2), OpenSea: 0, Blur: 2.346, Others: 0 },
				{ timestamp: Date.UTC(2024, 0, 3), OpenSea: 0, Blur: 0, Others: 0 }
			]
		})
		expect(result.absoluteTradesDataset).toEqual({
			dimensions,
			source: [
				{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 2, Blur: 4, Others: 0 },
				{ timestamp: Date.UTC(2024, 0, 2), OpenSea: 0, Blur: 2.346, Others: 0 },
				{ timestamp: Date.UTC(2024, 0, 3), OpenSea: 0, Blur: 0, Others: 0 }
			]
		})
		expect(result.relativeVolumeDataset.source).toEqual([
			{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 25, Blur: 75, Others: 0 },
			{ timestamp: Date.UTC(2024, 0, 2), OpenSea: 0, Blur: 100.02, Others: 0 },
			{ timestamp: Date.UTC(2024, 0, 3), OpenSea: 0, Blur: 0, Others: 0 }
		])
		expect(result.relativeTradesDataset.source).toEqual([
			{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 33.33, Blur: 66.67, Others: 0 },
			{ timestamp: Date.UTC(2024, 0, 2), OpenSea: 0, Blur: 100.02, Others: 0 },
			{ timestamp: Date.UTC(2024, 0, 3), OpenSea: 0, Blur: 0, Others: 0 }
		])
		expect(result.relativeVolumeDataset.dimensions).toBe(result.absoluteVolumeDataset.dimensions)
		expect(result.relativeTradesDataset.dimensions).toBe(result.absoluteVolumeDataset.dimensions)
		expect(input).toEqual(before)
	})

	it('builds matching bar and area series with stable colors and stacks', () => {
		const result = buildNFTMarketplaceChartData([
			row('2024-01-01', 'OpenSea', 1, 2),
			row('2024-01-01', 'Blur', 3, 4),
			row('2024-01-02', 'Others', 2, 3)
		])
		const colors = getNDistinctColors(3)

		expect(result.absoluteBarCharts).toEqual([
			{
				type: 'bar',
				name: 'OpenSea',
				encode: { x: 'timestamp', y: 'OpenSea' },
				stack: 'stackA',
				color: colors[0],
				large: false
			},
			{
				type: 'bar',
				name: 'Blur',
				encode: { x: 'timestamp', y: 'Blur' },
				stack: 'stackA',
				color: colors[1],
				large: false
			},
			{
				type: 'bar',
				name: 'Others',
				encode: { x: 'timestamp', y: 'Others' },
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
		const result = buildNFTMarketplaceChartData([
			row('2024-01-01T00:00:00.100Z', 'OpenSea', 1, 2),
			row('2024-01-01T00:00:00.900Z', 'OpenSea', 9, 18)
		])

		expect(result.absoluteVolumeDataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 9 }])
		expect(result.absoluteTradesDataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 18 }])
		expect(result.relativeVolumeDataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 90 }])
		expect(result.relativeTradesDataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 90 }])
	})

	it('returns serializable empty canonical payloads', () => {
		const result = buildNFTMarketplaceChartData([])

		expect(result.absoluteVolumeDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.relativeVolumeDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.absoluteTradesDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.relativeTradesDataset).toEqual({ source: [], dimensions: ['timestamp'] })
		expect(result.absoluteBarCharts).toEqual([])
		expect(result.relativeAreaCharts).toEqual([])
	})

	it('preserves legacy zero-volume behavior for nullable live API rows', () => {
		const result = buildNFTMarketplaceChartData([
			row('2024-01-01', 'OpenSea', null, 2),
			row('2024-01-01', 'Blur', 0, 3)
		])

		expect(result.absoluteVolumeDataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 0, Blur: 0 }])
		expect(result.absoluteTradesDataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 2, Blur: 3 }])
		expect(result.relativeVolumeDataset.source).toEqual([{ timestamp: Date.UTC(2024, 0, 1), OpenSea: 0, Blur: 0 }])
	})

	it('keeps __proto__ as an own marketplace series value', () => {
		const result = buildNFTMarketplaceChartData([row('2024-01-01', '__proto__', 4, 2)])
		const volumeRow = result.absoluteVolumeDataset.source[0]

		expect(result.absoluteVolumeDataset.dimensions).toEqual(['timestamp', '__proto__'])
		expect(Object.hasOwn(volumeRow, '__proto__')).toBe(true)
		expect(volumeRow.__proto__).toBe(4)
	})

	it('limits rendered marketplaces and aggregates every omitted value into Others', () => {
		const marketplaces = Array.from({ length: 31 }, (_, index) => `Marketplace ${index + 1}`)
		const result = buildNFTMarketplaceChartData(
			marketplaces.map((name, index) =>
				row('2024-01-01', name, marketplaces.length - index, marketplaces.length - index)
			)
		)

		expect(result.absoluteBarCharts).toHaveLength(30)
		expect(result.absoluteVolumeDataset.dimensions).toEqual(['timestamp', ...marketplaces.slice(0, 29), 'Others'])
		expect(result.absoluteVolumeDataset.source[0]?.Others).toBe(3)
		expect(result.absoluteTradesDataset.source[0]?.Others).toBe(3)
		expect(result.relativeVolumeDataset.source[0]?.Others).toBe(0.6)
	})
})
