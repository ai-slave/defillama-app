import { describe, expect, test } from 'vitest'
import {
	applyProtocolTaxonomyTvlSettings,
	applyProtocolsCategoriesTvlSettings,
	buildProtocolsCategoriesTvlCharts,
	getEnabledProtocolTaxonomyTvls,
	getEnabledProtocolsCategoriesTvls
} from '../tvl'
import type {
	IProtocolTaxonomyPageData,
	IProtocolsCategoriesExtraTvlPoint,
	IProtocolsCategoriesTableRow
} from '../types'

function only<T>(values: Array<T>): T {
	const value = values[0]
	if (value === undefined) throw new Error('Expected one row')
	return value
}

const makeProtocol = ({
	name = 'Protocol',
	tvl,
	extraTvls = {},
	subRows
}: {
	name?: string
	tvl: number | null
	extraTvls?: IProtocolTaxonomyPageData['protocols'][number]['extraTvls']
	subRows?: IProtocolTaxonomyPageData['protocols']
}): IProtocolTaxonomyPageData['protocols'][number] => ({
	name,
	slug: name.toLowerCase(),
	logo: '',
	chains: ['Ethereum'],
	tvl,
	extraTvls,
	mcap: null,
	tags: [],
	...(subRows === undefined ? {} : { subRows })
})

const makeCharts = (): IProtocolTaxonomyPageData['charts'] => ({
	dataset: {
		dimensions: ['timestamp', 'TVL', 'Active Loans'],
		source: [
			[1000, 100, 5],
			[2000, 200, 10]
		]
	},
	charts: [
		{
			type: 'line',
			name: 'TVL',
			encode: { x: 0, y: 1 }
		}
	]
})

const makeExtraTvlPoint = ({
	tvl,
	tvlPrevDay,
	tvlPrevWeek,
	tvlPrevMonth
}: IProtocolsCategoriesExtraTvlPoint): IProtocolsCategoriesExtraTvlPoint => ({
	tvl,
	tvlPrevDay,
	tvlPrevWeek,
	tvlPrevMonth
})

const makeCategoryRow = ({
	name = 'Dexes',
	tvl,
	tvlPrevDay,
	tvlPrevWeek,
	tvlPrevMonth,
	extraTvls = {},
	subRows
}: {
	name?: string
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	extraTvls?: IProtocolsCategoriesTableRow['extraTvls']
	subRows?: Array<IProtocolsCategoriesTableRow>
}): IProtocolsCategoriesTableRow => ({
	name,
	protocols: 1,
	tvl,
	tvlPrevDay,
	tvlPrevWeek,
	tvlPrevMonth,
	revenue: 0,
	extraTvls,
	change_1d: null,
	change_7d: null,
	change_1m: null,
	description: '',
	...(subRows === undefined ? {} : { subRows })
})

describe('ProtocolTaxonomy TVL helpers', () => {
	test('returns no enabled extras when all TVL settings are disabled', () => {
		expect(getEnabledProtocolTaxonomyTvls({ staking: false, borrowed: false })).toEqual([])
	})

	test('leaves protocol and chart TVL unchanged when a present extra is disabled', () => {
		const result = applyProtocolTaxonomyTvlSettings({
			protocols: [makeProtocol({ tvl: 100, extraTvls: { staking: 25 } })],
			charts: makeCharts(),
			extraTvlCharts: { staking: { 1000: 25, 2000: 30 } },
			tvlSettings: { staking: false }
		})

		expect(only(result.finalProtocols).tvl).toBe(100)
		expect(result.charts.dataset.source).toEqual([
			[1000, 100, 5],
			[2000, 200, 10]
		])
	})

	test('adds enabled extra TVL to protocol rows, subrows, and chart TVL series', () => {
		const result = applyProtocolTaxonomyTvlSettings({
			protocols: [
				makeProtocol({
					tvl: 100,
					extraTvls: { staking: 25, borrowed: 50 },
					subRows: [makeProtocol({ name: 'Child', tvl: null, extraTvls: { staking: 10 } })]
				})
			],
			charts: makeCharts(),
			extraTvlCharts: {
				staking: { 1000: 25, 2000: 30 },
				borrowed: { 1000: 50, 2000: 60 }
			},
			tvlSettings: { staking: true }
		})

		const protocol = only(result.finalProtocols)
		expect(protocol.tvl).toBe(125)
		expect(only(protocol.subRows ?? []).tvl).toBeNull()
		expect(result.charts.dataset.source).toEqual([
			[1000, 125, 5],
			[2000, 230, 10]
		])
	})

	test('lets present-null extras poison exact periods while absent extras contribute zero', () => {
		const result = applyProtocolTaxonomyTvlSettings({
			protocols: [makeProtocol({ tvl: 100, extraTvls: { staking: null } })],
			charts: makeCharts(),
			extraTvlCharts: { staking: { 1000: null } },
			tvlSettings: { staking: true }
		})

		expect(only(result.finalProtocols).tvl).toBeNull()
		expect(result.charts.dataset.source).toEqual([
			[1000, null, 5],
			[2000, 200, 10]
		])
	})

	test('keeps the producer Active Loans series independent from composite TVL settings', () => {
		const result = applyProtocolTaxonomyTvlSettings({
			protocols: [makeProtocol({ tvl: 100, extraTvls: { borrowed: 50 } })],
			charts: makeCharts(),
			extraTvlCharts: { borrowed: { 1000: 50, 2000: 60 } },
			tvlSettings: { borrowed: true }
		})

		expect(result.charts.dataset.source[0]).toEqual([1000, 150, 5])
	})

	test('excludes double counted and liquid staking from categories page enabled extras', () => {
		expect(
			getEnabledProtocolsCategoriesTvls({
				staking: true,
				borrowed: true,
				doublecounted: true,
				liquidstaking: true
			})
		).toEqual(['staking', 'borrowed'])
	})

	test('builds canonical category charts with enabled extras', () => {
		const result = buildProtocolsCategoriesTvlCharts({
			categories: ['Dexes', 'Lending'],
			categoryColors: { Dexes: '#f00', Lending: '#0f0' },
			chartSource: [{ timestamp: 1000, Dexes: 100, Lending: 200 }],
			extraTvlCharts: {
				Dexes: {
					staking: { 1000: 25 },
					borrowed: { 1000: 50 }
				},
				Lending: {
					staking: { 1000: 75 }
				}
			},
			enabledTvls: ['staking']
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Dexes', 'Lending'],
			source: [[1000, 125, 275]]
		})
		expect(result.charts).toEqual([
			{
				type: 'line',
				name: 'Dexes',
				encode: { x: 0, y: 1 },
				stack: 'stackA',
				color: '#f00'
			},
			{
				type: 'line',
				name: 'Lending',
				encode: { x: 0, y: 2 },
				stack: 'stackA',
				color: '#0f0'
			}
		])
	})

	test('preserves null category chart extras per timestamp without poisoning absent timestamps', () => {
		const result = buildProtocolsCategoriesTvlCharts({
			categories: ['Dexes'],
			categoryColors: { Dexes: '#f00' },
			chartSource: [
				{ timestamp: 1000, Dexes: 100 },
				{ timestamp: 2000, Dexes: 200 }
			],
			extraTvlCharts: { Dexes: { staking: { 1000: null } } },
			enabledTvls: ['staking']
		})

		expect(result.dataset.source).toEqual([
			[1000, null],
			[2000, 200]
		])
	})

	test('recalculates categories table rows with enabled extras and leaves excluded extras out', () => {
		const enabledTvls = getEnabledProtocolsCategoriesTvls({
			staking: true,
			doublecounted: true,
			liquidstaking: true
		})

		const result = applyProtocolsCategoriesTvlSettings({
			tableData: [
				makeCategoryRow({
					tvl: 100,
					tvlPrevDay: 90,
					tvlPrevWeek: 80,
					tvlPrevMonth: 70,
					extraTvls: {
						staking: makeExtraTvlPoint({ tvl: 20, tvlPrevDay: 10, tvlPrevWeek: 5, tvlPrevMonth: 0 }),
						doublecounted: makeExtraTvlPoint({ tvl: 30, tvlPrevDay: 30, tvlPrevWeek: 30, tvlPrevMonth: 30 })
					},
					subRows: [
						makeCategoryRow({
							name: 'Dex tag',
							tvl: 50,
							tvlPrevDay: 40,
							tvlPrevWeek: 30,
							tvlPrevMonth: 20,
							extraTvls: {
								staking: makeExtraTvlPoint({ tvl: 5, tvlPrevDay: 4, tvlPrevWeek: 3, tvlPrevMonth: 2 })
							}
						})
					]
				})
			],
			enabledTvls
		})

		const row = only(result)
		expect(row.tvl).toBe(120)
		expect(row.tvlPrevDay).toBe(100)
		expect(row.change_1d).toBe(20)
		expect(row.change_7d).toBeCloseTo(41.176470588)
		expect(only(row.subRows ?? [])).toMatchObject({
			tvl: 55,
			tvlPrevDay: 44,
			tvlPrevWeek: 33,
			tvlPrevMonth: 22
		})
	})

	test('poisons only category table periods whose enabled extra is explicitly null', () => {
		const result = applyProtocolsCategoriesTvlSettings({
			tableData: [
				makeCategoryRow({
					tvl: 100,
					tvlPrevDay: 90,
					tvlPrevWeek: 80,
					tvlPrevMonth: 70,
					extraTvls: {
						staking: makeExtraTvlPoint({ tvl: null, tvlPrevDay: 10, tvlPrevWeek: null, tvlPrevMonth: 0 })
					}
				})
			],
			enabledTvls: ['staking']
		})

		expect(only(result)).toMatchObject({
			tvl: null,
			tvlPrevDay: 100,
			tvlPrevWeek: null,
			tvlPrevMonth: 70,
			change_1d: null,
			change_7d: null
		})
	})
})
