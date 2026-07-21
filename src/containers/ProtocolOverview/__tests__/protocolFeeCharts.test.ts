import { describe, expect, it } from 'vitest'
import { buildProtocolFeeChartPresentation, buildProtocolFeeFamilyCharts } from '../protocolFeeCharts'

describe('buildProtocolFeeFamilyCharts', () => {
	it('returns base fee-family charts without enabled extras', () => {
		expect(
			buildProtocolFeeFamilyCharts({
				fees: [[1, 100]],
				revenue: [[1, 20]],
				holdersRevenue: [[1, 5]],
				bribes: null,
				tokenTaxes: null,
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual({
			fees: [[1000, 100]],
			revenue: [[1000, 20]],
			holdersRevenue: [[1000, 5]]
		})
	})

	it('fans enabled fee extras into every enabled fee-family base chart', () => {
		expect(
			buildProtocolFeeFamilyCharts({
				fees: [[1, 100]],
				revenue: [[1, 20]],
				holdersRevenue: [[1, 5]],
				bribes: [[1, 2]],
				tokenTaxes: [[86_400, 3]],
				groupBy: 'daily',
				denominationPriceHistory: null
			})
		).toEqual({
			fees: [
				[0, 102],
				[86_400_000, 3]
			],
			revenue: [
				[0, 22],
				[86_400_000, 3]
			],
			holdersRevenue: [
				[0, 7],
				[86_400_000, 3]
			]
		})
	})

	it('sums non-cumulative extras into daily and grouped bar buckets', () => {
		expect(
			buildProtocolFeeFamilyCharts({
				fees: [
					[100, 10],
					[200, 20]
				],
				revenue: null,
				holdersRevenue: null,
				bribes: [[300, 5]],
				tokenTaxes: null,
				groupBy: 'daily',
				denominationPriceHistory: null
			}).fees
		).toEqual([[0, 35]])

		expect(
			buildProtocolFeeFamilyCharts({
				fees: [[100, 10]],
				revenue: null,
				holdersRevenue: null,
				bribes: [[864_000, 5]],
				tokenTaxes: null,
				groupBy: 'monthly',
				denominationPriceHistory: null
			}).fees
		).toEqual([[0, 15]])
	})

	it('null-poisons non-cumulative buckets when an included extra lacks denomination price', () => {
		expect(
			buildProtocolFeeFamilyCharts({
				fees: [
					[100, 10],
					[86_500, 20]
				],
				revenue: null,
				holdersRevenue: null,
				bribes: [
					[200, 5],
					[86_600, 5]
				],
				tokenTaxes: null,
				groupBy: 'daily',
				denominationPriceHistory: { 100: 1, 86500: 1, 86600: 1 }
			}).fees
		).toEqual([
			[0, null],
			[86_400_000, 25]
		])
	})

	it('null-poisons denomination-missing buckets for enabled fee-family charts', () => {
		expect(
			buildProtocolFeeFamilyCharts({
				fees: [
					[1, 100],
					[2, 50],
					[3, 50]
				],
				revenue: [[1, 20]],
				holdersRevenue: null,
				bribes: [[2, 10]],
				tokenTaxes: null,
				groupBy: 'cumulative',
				denominationPriceHistory: { 1: 2, 3: 25 }
			})
		).toEqual({
			fees: [
				[1000, 50],
				[2000, null],
				[3000, 52]
			],
			revenue: [
				[1000, 10],
				[2000, null]
			],
			holdersRevenue: []
		})
	})

	it('preserves cumulative running totals for base charts and extras', () => {
		expect(
			buildProtocolFeeFamilyCharts({
				fees: [
					[1, 10],
					[2, 5]
				],
				revenue: null,
				holdersRevenue: null,
				bribes: [
					[1, 1],
					[2, 2]
				],
				tokenTaxes: null,
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual({
			fees: [
				[1000, 11],
				[2000, 18]
			],
			revenue: [],
			holdersRevenue: []
		})
	})

	it('carries cumulative extras through later unaligned base timestamps', () => {
		expect(
			buildProtocolFeeFamilyCharts({
				fees: [
					[100, 10],
					[300, 20]
				],
				revenue: null,
				holdersRevenue: null,
				bribes: [[200, 5]],
				tokenTaxes: null,
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual({
			fees: [
				[100_000, 10],
				[200_000, 15],
				[300_000, 35]
			],
			revenue: [],
			holdersRevenue: []
		})
	})

	it('does not create charts for disabled fee-family bases', () => {
		expect(
			buildProtocolFeeFamilyCharts({
				fees: null,
				revenue: [[1, 20]],
				holdersRevenue: null,
				bribes: [[1, 2]],
				tokenTaxes: null,
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual({
			fees: [],
			revenue: [[1000, 22]],
			holdersRevenue: []
		})
	})
})

describe('buildProtocolFeeChartPresentation', () => {
	it('skips all grouping when no chart is selected', () => {
		expect(
			buildProtocolFeeChartPresentation({
				fees: [[1, 100]],
				revenue: [[1, 20]],
				holdersRevenue: [[1, 5]],
				bribes: [[1, 2]],
				tokenTaxes: [[1, 3]],
				selectedCharts: [],
				groupBy: 'daily'
			})
		).toEqual({ dataset: { source: [], dimensions: ['timestamp'] }, charts: [] })
	})

	it('builds only selected series and fans enabled extras into them', () => {
		const result = buildProtocolFeeChartPresentation({
			fees: [[1, 100]],
			revenue: [[1, 20]],
			holdersRevenue: [[1, 5]],
			bribes: [[1, 2]],
			tokenTaxes: [[86_400, 3]],
			selectedCharts: ['Fees', 'Holders Revenue'],
			groupBy: 'daily'
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Fees', 'Holders Revenue'],
			source: [
				[1_000, 102, 7],
				[86_400_000, 3, 3]
			]
		})
		expect(result.charts).toMatchObject([
			{ type: 'bar', name: 'Fees', stack: 'Fees' },
			{ type: 'bar', name: 'Holders Revenue', stack: 'Holders Revenue' }
		])
	})

	it('preserves sparse starts between cumulative fee-family lines', () => {
		const result = buildProtocolFeeChartPresentation({
			fees: [
				[1, 10],
				[2, 5]
			],
			revenue: [[2, 3]],
			holdersRevenue: [],
			bribes: null,
			tokenTaxes: null,
			selectedCharts: ['Fees', 'Revenue'],
			groupBy: 'cumulative'
		})

		expect(result.dataset.source).toEqual([
			[1_000, 10, null],
			[2_000, 15, 3]
		])
		expect(result.charts.map((chart) => chart.type)).toEqual(['line', 'line'])
	})

	it('preserves exact daily timestamps and last-writes duplicates within each source', () => {
		const result = buildProtocolFeeChartPresentation({
			fees: [
				[1, 100],
				[1, 200],
				[2, 50]
			],
			revenue: [],
			holdersRevenue: [],
			bribes: [
				[1, 2],
				[1, 3],
				[2, 4]
			],
			tokenTaxes: null,
			selectedCharts: ['Fees'],
			groupBy: 'daily'
		})

		expect(result.dataset.source).toEqual([
			[1_000, 203],
			[2_000, 54]
		])
	})
})
