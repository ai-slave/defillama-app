import { describe, expect, test } from 'vitest'
import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { buildDexSpotShareDataset, buildDexSpotShareMethodology, parseDexSpotShareGrouping } from '../dexSpotShare'

const day = (date: string) => Date.parse(`${date}T00:00:00Z`)

function dexVolume(points: Array<[string, number | null]>): MultiSeriesTimeSeriesDataset {
	return {
		dimensions: ['timestamp', 'DEX Volume'],
		source: points.map(([date, value]) => [day(date), value])
	}
}

function cexVolume(points: Array<[string, number | null]>) {
	return {
		days: points.map(([date]) => day(date) / 1000),
		values: points.map(([, value]) => value)
	}
}

describe('DEX spot share', () => {
	test('states the formula, spot scope, and current coverage', () => {
		expect(buildDexSpotShareMethodology({ dexProtocolCount: 777, cexVenueCount: 29 })).toBe(
			'DEX share = DEX / (DEX + CEX) × 100. Spot volume only, including order-book DEXs such as Hyperliquid. Current coverage: 777 DEX protocols and 29 CEX venues.'
		)
		expect(buildDexSpotShareMethodology({ dexProtocolCount: 1234, cexVenueCount: null })).toContain(
			'Current coverage: 1,234 DEX protocols.'
		)
	})

	test('uses monthly volume totals instead of averaging daily percentages', () => {
		const dataset = buildDexSpotShareDataset({
			dexVolume: dexVolume([
				['2026-01-01', 1],
				['2026-01-02', 900]
			]),
			cexVolume: cexVolume([
				['2026-01-01', 99],
				['2026-01-02', 100]
			]),
			groupBy: 'monthly'
		})

		expect(dataset.source).toEqual([[day('2026-01-01'), (901 / 1100) * 100]])
	})

	test('preserves a measured zero and leaves a zero denominator unavailable', () => {
		const dataset = buildDexSpotShareDataset({
			dexVolume: dexVolume([
				['2026-01-01', 0],
				['2026-01-02', 0]
			]),
			cexVolume: cexVolume([
				['2026-01-01', 100],
				['2026-01-02', 0]
			]),
			groupBy: 'daily'
		})

		expect(dataset.source).toEqual([
			[day('2026-01-01'), 0],
			[day('2026-01-02'), null]
		])
	})

	test('keeps a bucket unavailable when either required daily leg is missing', () => {
		const dataset = buildDexSpotShareDataset({
			dexVolume: dexVolume([
				['2026-01-01', 10],
				['2026-01-02', 20],
				['2026-01-03', 30]
			]),
			cexVolume: cexVolume([
				['2026-01-01', 90],
				['2026-01-03', 70]
			]),
			groupBy: 'monthly'
		})

		expect(dataset.source).toEqual([[day('2026-01-01'), null]])
	})

	test('returns no points when the source histories do not overlap', () => {
		const dataset = buildDexSpotShareDataset({
			dexVolume: dexVolume([['2026-01-01', 10]]),
			cexVolume: cexVolume([['2026-02-01', 90]]),
			groupBy: 'monthly'
		})

		expect(dataset).toEqual({ dimensions: ['timestamp', 'DEX Share'], source: [] })
	})

	test('defaults invalid URL grouping to monthly', () => {
		expect(parseDexSpotShareGrouping(undefined)).toBe('monthly')
		expect(parseDexSpotShareGrouping('cumulative')).toBe('monthly')
		expect(parseDexSpotShareGrouping('weekly')).toBe('weekly')
	})
})
