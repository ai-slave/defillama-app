import { describe, expect, it } from 'vitest'
import { parse as parseEChartsColor } from 'zrender/lib/tool/color'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { IProtocol } from '../types'
import {
	aggregateProtocolVersions,
	buildProtocolBreakdownNormalization,
	buildAdapterByChainBreakdownPresentation,
	buildAdapterByChainLatestValuePresentation,
	buildChainsByAdapterChartPresentation,
	getCategoryProtocolNameFilterForChart,
	leafProtocolNamesFromTableRows,
	mergeBreakdownCharts,
	mergeNamedDimensionChartDataset,
	mergeSingleDimensionChartDataset,
	normalizeProtocolBreakdownChartData,
	normalizeChainsByAdapterChartState,
	type ChainsByAdapterChartState
} from '../utils'

const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

type NamedChartRow = Record<string, string | number | null | undefined>

function toDataset({ dimensions, source }: { dimensions: string[]; source: NamedChartRow[] }): MultiSeriesChartDataset {
	return { dimensions, source: source.map((row) => dimensions.map((dimension) => row[dimension])) }
}

function datasetValue(dataset: MultiSeriesChartDataset, rowIndex: number, dimension: string) {
	return dataset.source[rowIndex][dataset.dimensions.indexOf(dimension)]
}

const baseChartData = toDataset({
	dimensions: ['timestamp', 'Ethereum', 'Solana', 'Base'],
	source: [
		{ timestamp: toMs(2024, 1, 1), Ethereum: 10, Solana: 0, Base: 0 },
		{ timestamp: toMs(2024, 1, 2), Ethereum: 10, Solana: 20, Base: 0 },
		{ timestamp: toMs(2024, 1, 3), Ethereum: 10, Solana: 0, Base: 30 }
	]
})

const nonMidnightDailyChartData = toDataset({
	dimensions: ['timestamp', 'Ethereum', 'Solana'],
	source: [
		{ timestamp: toMs(2024, 1, 1), Ethereum: 10, Solana: 20 },
		{ timestamp: toMs(2024, 1, 2) + 12 * 60 * 60 * 1000, Ethereum: 30, Solana: 40 }
	]
})

const shortGapDailyChartData = toDataset({
	dimensions: ['timestamp', 'Ethereum', 'Solana'],
	source: [
		{ timestamp: toMs(2024, 1, 1), Ethereum: 10, Solana: 20 },
		{ timestamp: toMs(2024, 1, 1) + 22 * 60 * 60 * 1000, Ethereum: 30, Solana: 40 }
	]
})

const singlePointDailyChartData = toDataset({
	dimensions: ['timestamp', 'Ethereum', 'Solana'],
	source: [{ timestamp: toMs(2024, 1, 1) + 12 * 60 * 60 * 1000, Ethereum: 30, Solana: 40 }]
})

const sparseChartData = toDataset({
	dimensions: ['timestamp', 'Ethereum', 'Solana'],
	source: [
		{ timestamp: toMs(2024, 1, 1), Ethereum: 10 },
		{ timestamp: toMs(2024, 1, 2), Ethereum: 10, Solana: 20 }
	]
})

const adapterBreakdownChartData = toDataset({
	dimensions: ['timestamp', 'Hyperliquid Perps', 'dYdX', 'GMX'],
	source: [
		{ timestamp: toMs(2024, 1, 1), 'Hyperliquid Perps': 10, dYdX: 20, GMX: 0 },
		{ timestamp: toMs(2024, 1, 2), 'Hyperliquid Perps': 20, dYdX: 10, GMX: 10 },
		{ timestamp: toMs(2024, 1, 3), 'Hyperliquid Perps': 30, dYdX: 0, GMX: 10 }
	]
})

describe('normalizeChainsByAdapterChartState', () => {
	it('returns the default bar state when no query params are present', () => {
		expect(
			normalizeChainsByAdapterChartState({
				chartKindParam: undefined,
				valueModeParam: undefined,
				barLayoutParam: undefined,
				groupByParam: undefined,
				legacyChartTypeParam: undefined
			})
		).toEqual({
			chartKind: 'bar',
			valueMode: 'absolute',
			barLayout: 'stacked',
			groupBy: 'daily'
		})
	})

	it('maps legacy dominance URLs to dominance mode and preserves cumulative grouping', () => {
		expect(
			normalizeChainsByAdapterChartState({
				legacyChartTypeParam: 'dominance'
			})
		).toEqual({ chartKind: 'dominance', groupBy: 'daily' })

		expect(
			normalizeChainsByAdapterChartState({
				groupByParam: 'cumulative'
			})
		).toEqual({
			chartKind: 'bar',
			valueMode: 'absolute',
			barLayout: 'stacked',
			groupBy: 'cumulative'
		})

		expect(
			normalizeChainsByAdapterChartState({
				chartKindParam: 'dominance',
				groupByParam: 'cumulative'
			})
		).toEqual({ chartKind: 'dominance', groupBy: 'cumulative' })
	})

	it('accepts legacy line chartKind params and ignores bar-only params for treemap and dominance modes', () => {
		expect(
			normalizeChainsByAdapterChartState({
				chartKindParam: 'treemap',
				valueModeParam: 'relative',
				barLayoutParam: 'separate',
				groupByParam: 'monthly'
			})
		).toEqual({ chartKind: 'treemap', groupBy: 'monthly' })

		expect(
			normalizeChainsByAdapterChartState({
				chartKindParam: 'line',
				valueModeParam: 'absolute',
				barLayoutParam: 'separate',
				groupByParam: 'yearly'
			})
		).toEqual({ chartKind: 'dominance', groupBy: 'yearly' })

		expect(
			normalizeChainsByAdapterChartState({
				chartKindParam: 'hbar',
				valueModeParam: 'relative',
				barLayoutParam: 'separate',
				groupByParam: 'monthly'
			})
		).toEqual({ chartKind: 'hbar', groupBy: 'monthly' })
	})
})

describe('buildChainsByAdapterChartPresentation', () => {
	it('builds absolute stacked bars with totals enabled', () => {
		const state: ChainsByAdapterChartState = {
			chartKind: 'bar',
			valueMode: 'absolute',
			barLayout: 'stacked',
			groupBy: 'daily'
		}

		const presentation = buildChainsByAdapterChartPresentation({
			chartData: baseChartData,
			selectedChains: ['Ethereum', 'Solana'],
			state
		})

		expect(presentation.kind).toBe('bar')
		if (presentation.kind !== 'bar') return

		expect(presentation.showTotalInTooltip).toBe(true)
		expect(presentation.valueMode).toBe('absolute')
		expect(presentation.barLayout).toBe('stacked')
		expect(presentation.groupBy).toBe('daily')
		expect(presentation.charts.every((chart) => chart.stack === 'chain')).toBe(true)
		expect(presentation.charts.every((chart) => chart.large === false)).toBe(true)
		expect(presentation.dataset.source).toEqual(
			toDataset({
				dimensions: presentation.dataset.dimensions,
				source: [
					{ timestamp: toMs(2024, 1, 1), Ethereum: 10, Solana: 0 },
					{ timestamp: toMs(2024, 1, 2), Ethereum: 10, Solana: 20 },
					{ timestamp: toMs(2024, 1, 3), Ethereum: 10, Solana: 0 }
				]
			}).source
		)
	})

	it('builds relative separate bars that sum to 100 per timestamp', () => {
		const state: ChainsByAdapterChartState = {
			chartKind: 'bar',
			valueMode: 'relative',
			barLayout: 'separate',
			groupBy: 'daily'
		}

		const presentation = buildChainsByAdapterChartPresentation({
			chartData: baseChartData,
			selectedChains: ['Ethereum', 'Solana'],
			state
		})

		expect(presentation.kind).toBe('bar')
		if (presentation.kind !== 'bar') return

		expect(presentation.showTotalInTooltip).toBe(false)
		expect(presentation.valueMode).toBe('relative')
		expect(presentation.barLayout).toBe('separate')
		expect(presentation.charts.every((chart) => chart.stack == null)).toBe(true)
		expect(presentation.charts.every((chart) => chart.large == null)).toBe(true)

		const [day1, day2, day3] = presentation.dataset.source
		expect(day1[1]).toBe(100)
		expect(day1[2]).toBe(0)
		expect(day2[1]).toBeCloseTo(33.3333333333)
		expect(day2[2]).toBeCloseTo(66.6666666667)
		expect(day3[1]).toBe(100)
		expect(day3[2]).toBe(0)
	})

	it('clamps negative values to zero when normalizing relative shares', () => {
		const state: ChainsByAdapterChartState = {
			chartKind: 'bar',
			valueMode: 'relative',
			barLayout: 'separate',
			groupBy: 'daily'
		}
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: toDataset({
				dimensions: ['timestamp', 'Ethereum', 'Solana', 'Base'],
				source: [
					{ timestamp: toMs(2024, 1, 1), Ethereum: -10, Solana: 20, Base: null },
					{ timestamp: toMs(2024, 1, 2), Ethereum: 0, Solana: 0, Base: 5 }
				]
			}),
			selectedChains: ['Ethereum', 'Solana', 'Base'],
			state
		})

		expect(presentation.kind).toBe('bar')
		if (presentation.kind !== 'bar') return

		expect(datasetValue(presentation.dataset, 0, 'Ethereum')).toBe(0)
		expect(datasetValue(presentation.dataset, 0, 'Solana')).toBe(100)
		expect(datasetValue(presentation.dataset, 0, 'Base')).toBeNull()
		expect(datasetValue(presentation.dataset, 1, 'Ethereum')).toBe(0)
		expect(datasetValue(presentation.dataset, 1, 'Solana')).toBe(0)
		expect(datasetValue(presentation.dataset, 1, 'Base')).toBe(100)
	})

	it('keeps missing chain values null so tooltips do not show fake zeroes', () => {
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: sparseChartData,
			selectedChains: ['Ethereum', 'Solana'],
			state: {
				chartKind: 'bar',
				valueMode: 'absolute',
				barLayout: 'stacked',
				groupBy: 'daily'
			}
		})

		expect(presentation.kind).toBe('bar')
		if (presentation.kind !== 'bar') return

		expect(presentation.dataset.source).toEqual(
			toDataset({
				dimensions: presentation.dataset.dimensions,
				source: [
					{ timestamp: toMs(2024, 1, 1), Ethereum: 10, Solana: null },
					{ timestamp: toMs(2024, 1, 2), Ethereum: 10, Solana: 20 }
				]
			}).source
		)
	})

	it('folds a real Others series into the overflow aggregate without duplicating the dimension', () => {
		const regularChains = Array.from({ length: 10 }, (_, index) => `Chain ${index + 1}`)
		const values = Object.fromEntries(regularChains.map((name, index) => [name, 90 - index]))
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: toDataset({
				dimensions: ['timestamp', 'Others', ...regularChains],
				source: [{ timestamp: toMs(2024, 1, 1), Others: 100, ...values }]
			}),
			selectedChains: ['Others', ...regularChains],
			state: {
				chartKind: 'bar',
				valueMode: 'absolute',
				barLayout: 'stacked',
				groupBy: 'daily'
			}
		})

		expect(presentation.kind).toBe('bar')
		if (presentation.kind !== 'bar') return

		expect(presentation.charts.filter((chart) => chart.name === 'Others')).toHaveLength(1)
		expect(presentation.dataset.dimensions.filter((name) => name === 'Others')).toHaveLength(1)
		expect(datasetValue(presentation.dataset, 0, 'Others')).toBe(181)
	})

	it('preserves tiny and signed overflow values when using the cached complement path', () => {
		const topChains = Array.from({ length: 10 }, (_, index) => `Top ${index + 1}`)
		const tailChains = Array.from({ length: 20 }, (_, index) => `Tail ${index + 1}`)
		for (const { firstTailValue, expectedOthers } of [
			{ firstTailValue: 1, expectedOthers: 20 },
			{ firstTailValue: -19, expectedOthers: 0 }
		]) {
			const chartData = toDataset({
				dimensions: ['timestamp', ...topChains, ...tailChains],
				source: [
					{
						timestamp: toMs(2024, 1, 1),
						...Object.fromEntries(topChains.map((name) => [name, 1e20])),
						...Object.fromEntries(tailChains.map((name, index) => [name, index === 0 ? firstTailValue : 1]))
					}
				]
			})
			const presentation = buildChainsByAdapterChartPresentation({
				chartData,
				selectedChains: chartData.dimensions.slice(1),
				state: { chartKind: 'bar', valueMode: 'absolute', barLayout: 'stacked', groupBy: 'daily' }
			})
			expect(presentation.kind).toBe('bar')
			if (presentation.kind !== 'bar') continue
			expect(datasetValue(presentation.dataset, 0, 'Others')).toBe(expectedOthers)
		}
	})

	it('renormalizes grouped dominance over the selected chains', () => {
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: baseChartData,
			selectedChains: ['Ethereum', 'Solana'],
			state: { chartKind: 'dominance', groupBy: 'weekly' }
		})

		expect(presentation.kind).toBe('dominance')
		if (presentation.kind !== 'dominance') return

		expect(presentation.groupBy).toBe('weekly')
		expect(presentation.charts.every((chart) => chart.type === 'line' && chart.hideAreaStyle == null)).toBe(true)

		const [week1] = presentation.dataset.source
		expect(week1[1]).toBeCloseTo(60)
		expect(week1[2]).toBeCloseTo(40)
	})

	it('applies negative adjustments before calculating narrowed grouped and cumulative dominance', () => {
		const chartData = toDataset({
			dimensions: ['timestamp', 'Adjusted', 'Selected'],
			source: [
				{ timestamp: toMs(2024, 1, 1), Adjusted: 100, Selected: 100 },
				{ timestamp: toMs(2024, 1, 2), Adjusted: -100, Selected: 0 }
			]
		})

		for (const groupBy of ['weekly', 'monthly', 'cumulative'] as const) {
			const presentation = buildChainsByAdapterChartPresentation({
				chartData,
				selectedChains: ['Selected'],
				state: { chartKind: 'dominance', groupBy }
			})

			expect(presentation.kind).toBe('dominance')
			if (presentation.kind !== 'dominance') continue
			expect(datasetValue(presentation.dataset, presentation.dataset.source.length - 1, 'Selected')).toBe(100)
		}
	})

	it('renormalizes narrowed dominance even when the full tail cancels out', () => {
		const topChains = Array.from({ length: 10 }, (_, index) => `Chain ${index + 1}`)
		const timestamp = toMs(2024, 1, 1)

		for (const overflow of [
			{ PositiveTail: 100, NegativeTail: -100 },
			{ Others: 100, NegativeTail: -100 }
		]) {
			const chartData = toDataset({
				dimensions: ['timestamp', ...topChains, ...Object.keys(overflow)],
				source: [
					{
						timestamp,
						...Object.fromEntries(topChains.map((name) => [name, 200])),
						...overflow
					}
				]
			})
			const full = buildChainsByAdapterChartPresentation({
				chartData,
				selectedChains: chartData.dimensions.slice(1),
				state: { chartKind: 'dominance', groupBy: 'daily' }
			})
			const narrowed = buildChainsByAdapterChartPresentation({
				chartData,
				selectedChains: ['Chain 1'],
				state: { chartKind: 'dominance', groupBy: 'daily' }
			})

			expect(full.kind).toBe('dominance')
			expect(narrowed.kind).toBe('dominance')
			if (full.kind !== 'dominance' || narrowed.kind !== 'dominance') continue
			expect(datasetValue(full.dataset, 0, 'Others')).toBe(0)
			expect(datasetValue(narrowed.dataset, 0, 'Chain 1')).toBe(100)
		}
	})

	it('uses dataset order to break tied top-N rankings regardless of selector order', () => {
		const chains = Array.from({ length: 12 }, (_, index) => `Chain ${index + 1}`)
		const chartData = toDataset({
			dimensions: ['timestamp', ...chains],
			source: [
				{
					timestamp: toMs(2024, 1, 1),
					...Object.fromEntries(chains.slice(0, 10).map((name) => [name, -100])),
					'Chain 11': 0,
					'Chain 12': 200
				},
				{
					timestamp: toMs(2024, 1, 2),
					...Object.fromEntries(chains.slice(0, 10).map((name) => [name, 200])),
					'Chain 11': 100,
					'Chain 12': -100
				}
			]
		})
		const full = buildChainsByAdapterChartPresentation({
			chartData,
			selectedChains: chains.toReversed(),
			state: { chartKind: 'dominance', groupBy: 'daily' }
		})
		const narrowed = buildChainsByAdapterChartPresentation({
			chartData,
			selectedChains: ['Chain 5'],
			state: { chartKind: 'dominance', groupBy: 'daily' }
		})

		expect(full.kind).toBe('dominance')
		expect(narrowed.kind).toBe('dominance')
		if (full.kind !== 'dominance' || narrowed.kind !== 'dominance') return
		expect(datasetValue(full.dataset, 1, 'Chain 5')).toBe(10)
		expect(datasetValue(narrowed.dataset, 1, 'Chain 5')).toBe(100)
	})

	it('keeps chain colors stable after filtering', () => {
		const chartData = toDataset({
			dimensions: ['timestamp', 'A', 'B', 'C'],
			source: [{ timestamp: toMs(2024, 1, 1), A: 30, B: 20, C: 10 }]
		})
		const state = { chartKind: 'dominance', groupBy: 'daily' } as const
		const full = buildChainsByAdapterChartPresentation({
			chartData,
			selectedChains: ['A', 'B', 'C'],
			state
		})
		const narrowed = buildChainsByAdapterChartPresentation({ chartData, selectedChains: ['B', 'C'], state })
		if (full.kind !== 'dominance' || narrowed.kind !== 'dominance') return
		const fullColors = new Map(full.charts.map((chart) => [chart.name, chart.color]))
		for (const chart of narrowed.charts) expect(chart.color).toBe(fullColors.get(chart.name))
	})

	it('uses ECharts-parseable colors for selected overflow chains', () => {
		const chains = Array.from({ length: 12 }, (_, index) => `Chain ${index + 1}`)
		const chartData = toDataset({
			dimensions: ['timestamp', ...chains],
			source: [
				Object.assign(
					{ timestamp: toMs(2024, 1, 1) },
					Object.fromEntries(chains.map((name, index) => [name, chains.length - index]))
				)
			]
		})
		buildChainsByAdapterChartPresentation({
			chartData,
			selectedChains: chains,
			state: { chartKind: 'dominance', groupBy: 'daily' }
		})
		const overflow = buildChainsByAdapterChartPresentation({
			chartData,
			selectedChains: ['Chain 12'],
			state: { chartKind: 'dominance', groupBy: 'daily' }
		})
		if (overflow.kind !== 'dominance') return
		const color = overflow.charts[0].color
		expect(color).toMatch(/^hsl\([^,]+, 68%, 48%\)$/)
		expect(parseEChartsColor(color!)).toBeDefined()
	})

	it('builds treemap data from the last complete daily chart timestamp', () => {
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: baseChartData,
			selectedChains: ['Ethereum', 'Solana', 'Base'],
			state: { chartKind: 'treemap', groupBy: 'daily' }
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Base', 'Ethereum'])
		expect(presentation.data[0].value).toBe(30)
		expect(presentation.data[0].share).toBe(75)
		expect(presentation.data[1].value).toBe(10)
		expect(presentation.data[1].share).toBe(25)
	})

	it('falls back to the previous daily timestamp when the latest point is not at UTC midnight', () => {
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: nonMidnightDailyChartData,
			selectedChains: ['Ethereum', 'Solana'],
			state: { chartKind: 'hbar', groupBy: 'daily' }
		})

		expect(presentation.kind).toBe('hbar')
		if (presentation.kind !== 'hbar') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Solana', 'Ethereum'])
		expect(presentation.data[0].value).toBe(20)
		expect(presentation.data[1].value).toBe(10)
	})

	it('falls back to the previous daily timestamp when the latest gap is less than 23 hours', () => {
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: shortGapDailyChartData,
			selectedChains: ['Ethereum', 'Solana'],
			state: { chartKind: 'treemap', groupBy: 'daily' }
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Solana', 'Ethereum'])
		expect(presentation.data[0].value).toBe(20)
		expect(presentation.data[1].value).toBe(10)
	})

	it('uses the last available daily timestamp when there is only one point', () => {
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: singlePointDailyChartData,
			selectedChains: ['Ethereum', 'Solana'],
			state: { chartKind: 'hbar', groupBy: 'daily' }
		})

		expect(presentation.kind).toBe('hbar')
		if (presentation.kind !== 'hbar') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Solana', 'Ethereum'])
		expect(presentation.data[0].value).toBe(40)
		expect(presentation.data[1].value).toBe(30)
	})

	it('keeps first-row selection for duplicate latest daily timestamps', () => {
		const timestamp = toMs(2024, 1, 2)
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: toDataset({
				dimensions: ['timestamp', 'Ethereum'],
				source: [
					{ timestamp, Ethereum: 10 },
					{ timestamp, Ethereum: 20 }
				]
			}),
			selectedChains: ['Ethereum'],
			state: { chartKind: 'treemap', groupBy: 'daily' }
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return

		expect(presentation.data).toEqual([
			{
				name: 'Ethereum',
				value: 10,
				share: 100,
				itemStyle: { color: expect.any(String) }
			}
		])
	})

	it('builds hbar data from the latest-value ranking and groups overflow into Others', () => {
		const extendedChainChartData = toDataset({
			dimensions: ['timestamp', ...Array.from({ length: 11 }, (_, index) => `Chain ${index + 1}`)],
			source: [
				{
					timestamp: toMs(2024, 1, 1),
					'Chain 1': 100,
					'Chain 2': 90,
					'Chain 3': 80,
					'Chain 4': 70,
					'Chain 5': 60,
					'Chain 6': 50,
					'Chain 7': 40,
					'Chain 8': 30,
					'Chain 9': 20,
					'Chain 10': 10,
					'Chain 11': 5
				}
			]
		})
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: extendedChainChartData,
			selectedChains: Array.from({ length: 11 }, (_, index) => `Chain ${index + 1}`),
			state: { chartKind: 'hbar', groupBy: 'daily' }
		})

		expect(presentation.kind).toBe('hbar')
		if (presentation.kind !== 'hbar') return

		expect(presentation.data.map((item) => item.name)).toEqual([
			'Chain 1',
			'Chain 2',
			'Chain 3',
			'Chain 4',
			'Chain 5',
			'Chain 6',
			'Chain 7',
			'Chain 8',
			'Chain 9',
			'Others'
		])
		expect(presentation.data[0].value).toBe(100)
		expect(presentation.data[8].value).toBe(20)
		expect(presentation.data[9].value).toBe(15)
		expect(presentation.data[9].share).toBeCloseTo((15 / 555) * 100)
	})

	it('keeps latest-value colors stable after filtering and across snapshot views', () => {
		const chartData = toDataset({
			dimensions: ['timestamp', 'A', 'B', 'C', 'Others'],
			source: [{ timestamp: toMs(2024, 1, 1), A: 1, B: 100, C: 10, Others: 5 }]
		})
		const hbar = buildChainsByAdapterChartPresentation({
			chartData,
			selectedChains: ['B', 'C'],
			state: { chartKind: 'hbar', groupBy: 'daily' }
		})
		const treemap = buildChainsByAdapterChartPresentation({
			chartData,
			selectedChains: ['A', 'B', 'C', 'Others'],
			state: { chartKind: 'treemap', groupBy: 'daily' }
		})
		expect(treemap.kind).toBe('treemap')
		expect(hbar.kind).toBe('hbar')
		if (treemap.kind !== 'treemap' || hbar.kind !== 'hbar') return
		const treemapB = treemap.data.find((item) => item.name === 'B')?.itemStyle.color
		expect(hbar.data.find((item) => item.name === 'B')?.itemStyle.color).toBe(treemapB)
		expect(treemap.data.find((item) => item.name === 'Others')?.itemStyle.color).not.toBe(treemapB)
	})

	it('folds a real Others value into one hbar remainder for chain and protocol snapshots', () => {
		for (const { othersValue, values, expectedOthers } of [
			{
				othersValue: 100,
				values: Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`Peer ${index + 1}`, 9 - index])),
				expectedOthers: 100
			},
			{
				othersValue: 1,
				values: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Peer ${index + 1}`, 20 - index])),
				expectedOthers: 12
			}
		]) {
			const peers = Object.keys(values)
			const chartData = toDataset({
				dimensions: ['timestamp', 'Others', ...peers],
				source: [{ timestamp: toMs(2024, 1, 1), Others: othersValue, ...values }]
			})
			const chain = buildChainsByAdapterChartPresentation({
				chartData,
				selectedChains: ['Others', ...peers],
				state: { chartKind: 'hbar', groupBy: 'daily' }
			})
			const protocol = buildAdapterByChainLatestValuePresentation({
				chartKind: 'hbar',
				selectedProtocols: ['Others', ...peers],
				groupBy: 'daily',
				chartData
			})

			for (const presentation of [chain, protocol]) {
				expect(presentation.kind).toBe('hbar')
				if (presentation.kind !== 'hbar') continue
				expect(presentation.data.filter((item) => item.name === 'Others')).toEqual([
					expect.objectContaining({ value: expectedOthers })
				])
			}
		}
	})

	it('builds treemap from rolling weekly sums (last 7 days from latest row)', () => {
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: baseChartData,
			selectedChains: ['Ethereum', 'Solana', 'Base'],
			state: { chartKind: 'treemap', groupBy: 'weekly' }
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Ethereum', 'Base', 'Solana'])
		expect(presentation.data[0].value).toBe(30)
		expect(presentation.data[1].value).toBe(30)
		expect(presentation.data[2].value).toBe(20)
	})

	it('builds cumulative latest-value treemap data from running totals', () => {
		const presentation = buildChainsByAdapterChartPresentation({
			chartData: baseChartData,
			selectedChains: ['Ethereum', 'Solana', 'Base'],
			state: { chartKind: 'treemap', groupBy: 'cumulative' }
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Ethereum', 'Base', 'Solana'])
		expect(presentation.data[0].value).toBe(30)
		expect(presentation.data[1].value).toBe(30)
		expect(presentation.data[2].value).toBe(20)
	})

	it('keeps zero cumulative totals distinct from missing selected series for ranking', () => {
		const presentation = buildAdapterByChainBreakdownPresentation({
			chartData: toDataset({
				dimensions: ['timestamp', 'Positive', 'Missing', 'Zero'],
				source: [
					{ timestamp: toMs(2024, 1, 1), Positive: 5, Zero: 0 },
					{ timestamp: toMs(2024, 1, 2), Positive: 10, Zero: 0 }
				]
			}),
			selectedProtocols: ['Positive', 'Missing', 'Zero'],
			state: {
				chartKind: 'bar',
				valueMode: 'absolute',
				barLayout: 'stacked',
				groupBy: 'cumulative'
			}
		})

		expect(presentation.kind).toBe('bar')
		expect(presentation.charts.map((chart) => chart.name)).toEqual(['Positive', 'Zero', 'Missing'])
		expect(presentation.charts.every((chart) => chart.type === 'line' && chart.stack == null)).toBe(true)
		expect(presentation.dataset.source.at(-1)).toEqual([toMs(2024, 1, 2), 15, 0, null])
	})

	it('sums rolling-window values for dominance-backed latest-value charts (weekly = last 7 days)', () => {
		const lineBackedChartData = toDataset({
			dimensions: ['timestamp', 'Hyperliquid', 'dYdX'],
			source: [
				{ timestamp: toMs(2024, 1, 1), Hyperliquid: 10, dYdX: 5 },
				{ timestamp: toMs(2024, 1, 2), Hyperliquid: 20, dYdX: 15 },
				{ timestamp: toMs(2024, 1, 3), Hyperliquid: 15, dYdX: 25 }
			]
		})

		const presentation = buildAdapterByChainLatestValuePresentation({
			chartKind: 'hbar',
			selectedProtocols: ['Hyperliquid', 'dYdX'],
			groupBy: 'weekly',
			chartData: lineBackedChartData,
			seriesType: 'dominance'
		})

		expect(presentation.kind).toBe('hbar')
		if (presentation.kind !== 'hbar') return

		expect(presentation.data).toHaveLength(2)
		expect(presentation.data.map((item) => item.name).toSorted()).toEqual(['Hyperliquid', 'dYdX'])
		expect(presentation.data.every((item) => item.value === 45)).toBe(true)
	})

	it('excludes protocols with no data in the yearly rolling window from treemap', () => {
		const latest = toMs(2026, 3, 15)
		const olderThanOneYear = latest - 400 * 24 * 60 * 60 * 1000
		const yearlyStoppedProtocolChartData = toDataset({
			dimensions: ['timestamp', 'Active', 'StoppedLongAgo'],
			source: [
				{ timestamp: olderThanOneYear, Active: 1, StoppedLongAgo: 999 },
				{ timestamp: latest, Active: 100 }
			]
		})

		const presentation = buildChainsByAdapterChartPresentation({
			chartData: yearlyStoppedProtocolChartData,
			selectedChains: ['Active', 'StoppedLongAgo'],
			state: { chartKind: 'treemap', groupBy: 'yearly' }
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Active'])
		expect(presentation.data[0].value).toBe(100)
	})

	it('sums only points inside the yearly rolling window for treemap', () => {
		const t0 = toMs(2025, 1, 1)
		const t1 = toMs(2025, 6, 1)
		const t2 = toMs(2026, 3, 1)
		const yearlyRollingChartData = toDataset({
			dimensions: ['timestamp', 'Ethereum', 'Solana'],
			source: [
				{ timestamp: t0, Ethereum: 10, Solana: 5 },
				{ timestamp: t1, Ethereum: 20, Solana: 10 },
				{ timestamp: t2, Ethereum: 30, Solana: 15 }
			]
		})

		const presentation = buildChainsByAdapterChartPresentation({
			chartData: yearlyRollingChartData,
			selectedChains: ['Ethereum', 'Solana'],
			state: { chartKind: 'treemap', groupBy: 'yearly' }
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return

		const cutoff = t2 - 365 * 24 * 60 * 60 * 1000
		const ethereumSum = (t0 >= cutoff ? 10 : 0) + (t1 >= cutoff ? 20 : 0) + (t2 >= cutoff ? 30 : 0)
		const solanaSum = (t0 >= cutoff ? 5 : 0) + (t1 >= cutoff ? 10 : 0) + (t2 >= cutoff ? 15 : 0)

		const eth = presentation.data.find((d) => d.name === 'Ethereum')
		const sol = presentation.data.find((d) => d.name === 'Solana')
		expect(eth?.value).toBe(ethereumSum)
		expect(sol?.value).toBe(solanaSum)
	})
})

describe('buildAdapterByChainBreakdownPresentation', () => {
	it('keeps protocol colors stable after filtering', () => {
		const state = { chartKind: 'bar', valueMode: 'absolute', barLayout: 'stacked', groupBy: 'daily' } as const
		const full = buildAdapterByChainBreakdownPresentation({
			chartData: adapterBreakdownChartData,
			selectedProtocols: ['Hyperliquid Perps', 'dYdX', 'GMX'],
			state
		})
		const narrowed = buildAdapterByChainBreakdownPresentation({
			chartData: adapterBreakdownChartData,
			selectedProtocols: ['dYdX', 'GMX'],
			state
		})
		const fullColors = new Map(full.charts.map((chart) => [chart.name, chart.color]))
		for (const chart of narrowed.charts) expect(chart.color).toBe(fullColors.get(chart.name))
	})

	it('renormalizes protocol dominance after deselection', () => {
		const presentation = buildAdapterByChainBreakdownPresentation({
			chartData: adapterBreakdownChartData,
			selectedProtocols: ['Hyperliquid Perps'],
			state: { chartKind: 'dominance', groupBy: 'daily' }
		})

		expect(presentation.kind).toBe('dominance')
		if (presentation.kind !== 'dominance') return

		expect(presentation.dataset.source).toEqual([
			[toMs(2024, 1, 1), 100],
			[toMs(2024, 1, 2), 100],
			[toMs(2024, 1, 3), 100]
		])
	})

	it('builds relative separate bars from selected protocol breakdown series', () => {
		const presentation = buildAdapterByChainBreakdownPresentation({
			chartData: adapterBreakdownChartData,
			selectedProtocols: ['Hyperliquid Perps', 'dYdX'],
			state: {
				chartKind: 'bar',
				valueMode: 'relative',
				barLayout: 'separate',
				groupBy: 'daily'
			}
		})

		expect(presentation.kind).toBe('bar')
		if (presentation.kind !== 'bar') return

		expect(presentation.charts.every((chart) => chart.stack == null)).toBe(true)
		expect(presentation.charts.every((chart) => chart.large == null)).toBe(true)
		expect(presentation.dataset.source).toEqual([
			[toMs(2024, 1, 1), 33.33333333333333, 66.66666666666666],
			[toMs(2024, 1, 2), 66.66666666666666, 33.33333333333333],
			[toMs(2024, 1, 3), 100, 0]
		])
	})

	it('ranks visible protocol series by the latest selected window instead of lifetime totals', () => {
		const recentLeaderChartData = toDataset({
			dimensions: ['timestamp', ...Array.from({ length: 10 }, (_, index) => `Protocol ${index + 1}`), 'Hyperliquid'],
			source: [
				Object.assign(
					{ timestamp: toMs(2024, 1, 1), Hyperliquid: 0 },
					Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Protocol ${index + 1}`, 100]))
				),
				Object.assign(
					{ timestamp: toMs(2024, 1, 2), Hyperliquid: 50 },
					Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Protocol ${index + 1}`, 1]))
				)
			]
		})

		const presentation = buildAdapterByChainBreakdownPresentation({
			chartData: recentLeaderChartData,
			selectedProtocols: ['Hyperliquid', ...Array.from({ length: 10 }, (_, index) => `Protocol ${index + 1}`)],
			state: {
				chartKind: 'bar',
				valueMode: 'absolute',
				barLayout: 'stacked',
				groupBy: 'daily'
			}
		})

		expect(presentation.kind).toBe('bar')
		if (presentation.kind !== 'bar') return

		expect(presentation.charts.map((chart) => chart.name)).toEqual([
			'Hyperliquid',
			...Array.from({ length: 10 }, (_, index) => `Protocol ${index + 1}`)
		])
		expect(datasetValue(presentation.dataset, 1, 'Hyperliquid')).toBe(50)
		expect(datasetValue(presentation.dataset, 1, 'Protocol 10')).toBe(1)
	})

	it('ranks cumulative dominance series by cumulative totals without collapsing overflow into Others', () => {
		const selectedProtocols = ['History Giant', ...Array.from({ length: 10 }, (_, index) => `Protocol ${index + 1}`)]
		const cumulativeLineChartData = toDataset({
			dimensions: ['timestamp', 'History Giant', ...Array.from({ length: 10 }, (_, index) => `Protocol ${index + 1}`)],
			source: [
				Object.assign(
					{ timestamp: toMs(2024, 1, 1), 'History Giant': 100 },
					Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Protocol ${index + 1}`, 0]))
				),
				Object.assign(
					{ timestamp: toMs(2024, 1, 2), 'History Giant': 1 },
					Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Protocol ${index + 1}`, 10]))
				)
			]
		})

		const presentation = buildAdapterByChainBreakdownPresentation({
			chartData: cumulativeLineChartData,
			selectedProtocols,
			state: {
				chartKind: 'dominance',
				groupBy: 'cumulative'
			}
		})

		expect(presentation.kind).toBe('dominance')
		if (presentation.kind !== 'dominance') return

		expect(presentation.charts.map((chart) => chart.name)).toEqual(selectedProtocols)
		expect(presentation.charts).toHaveLength(11)
		expect(datasetValue(presentation.dataset, 1, 'History Giant')).toBeCloseTo((101 / 201) * 100)
		expect(datasetValue(presentation.dataset, 1, 'Protocol 1')).toBeCloseTo((10 / 201) * 100)
		expect(datasetValue(presentation.dataset, 1, 'Protocol 10')).toBeCloseTo((10 / 201) * 100)
	})

	it('carries sparse cumulative flows into absolute and dominance rows', () => {
		const chartData = toDataset({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				{ timestamp: toMs(2024, 1, 1), A: 100, B: 100 },
				{ timestamp: toMs(2024, 1, 2), A: 10 }
			]
		})
		const absolute = buildAdapterByChainBreakdownPresentation({
			chartData,
			selectedProtocols: ['A', 'B'],
			state: {
				chartKind: 'bar',
				valueMode: 'absolute',
				barLayout: 'stacked',
				groupBy: 'cumulative'
			}
		})
		const dominance = buildAdapterByChainBreakdownPresentation({
			chartData,
			selectedProtocols: ['A', 'B'],
			state: { chartKind: 'dominance', groupBy: 'cumulative' }
		})

		expect(absolute.dataset.source).toEqual([
			[toMs(2024, 1, 1), 100, 100],
			[toMs(2024, 1, 2), 110, 100]
		])
		expect(dominance.dataset.source[1]).toEqual([toMs(2024, 1, 2), (110 / 210) * 100, (100 / 210) * 100])
	})

	it('limits oversized protocol breakdowns and aggregates the remaining values into Others', () => {
		const protocolNames = Array.from({ length: 32 }, (_, index) => `Protocol ${index + 1}`)
		const timestamp = toMs(2024, 1, 1)
		const chartData = toDataset({
			dimensions: ['timestamp', ...protocolNames],
			source: [
				Object.assign(
					{ timestamp },
					Object.fromEntries(protocolNames.map((name, index) => [name, protocolNames.length - index]))
				)
			]
		})

		const presentation = buildAdapterByChainBreakdownPresentation({
			chartData,
			selectedProtocols: protocolNames,
			state: {
				chartKind: 'bar',
				valueMode: 'absolute',
				barLayout: 'stacked',
				groupBy: 'daily'
			}
		})

		expect(presentation.charts).toHaveLength(30)
		expect(presentation.charts.at(-1)?.name).toBe('Others')
		expect(presentation.dataset.dimensions).toEqual(['timestamp', ...protocolNames.slice(0, 29), 'Others'])
		expect(presentation.dataset.source).toEqual([
			[timestamp, ...protocolNames.slice(0, 29).map((_, index) => protocolNames.length - index), 6]
		])
	})

	it('keeps a narrow selection exact when the source has many sparse dimensions', () => {
		const timestamp = toMs(2024, 1, 1)
		const chartData = toDataset({
			dimensions: ['timestamp', 'Selected', ...Array.from({ length: 9 }, (_, index) => `Other ${index + 1}`)],
			source: [
				{ timestamp, Selected: 10, 'Other 1': 100 },
				{ timestamp: toMs(2024, 1, 2), Selected: 20, 'Other 2': 200 }
			]
		})

		const presentation = buildAdapterByChainBreakdownPresentation({
			chartData,
			selectedProtocols: ['Selected'],
			state: {
				chartKind: 'bar',
				valueMode: 'absolute',
				barLayout: 'stacked',
				groupBy: 'daily'
			}
		})

		expect(presentation.kind).toBe('bar')
		if (presentation.kind !== 'bar') return
		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'Selected'],
			source: [
				[timestamp, 10],
				[toMs(2024, 1, 2), 20]
			]
		})
	})
})

describe('buildAdapterByChainLatestValuePresentation', () => {
	it('uses the last complete daily chart timestamp', () => {
		const chartData = toDataset({
			dimensions: ['timestamp', 'Hyperliquid', 'dYdX', 'GMX'],
			source: [
				{ timestamp: toMs(2024, 1, 1), Hyperliquid: 20, dYdX: 10, GMX: 0 },
				{ timestamp: toMs(2024, 1, 2), Hyperliquid: 70, dYdX: 30, GMX: 10 }
			]
		})

		const presentation = buildAdapterByChainLatestValuePresentation({
			chartKind: 'treemap',
			selectedProtocols: ['Hyperliquid', 'dYdX'],
			groupBy: 'daily',
			chartData
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Hyperliquid', 'dYdX'])
		expect(presentation.data[0].value).toBe(70)
		expect(presentation.data[1].value).toBe(30)
	})

	it('returns no rows when selected protocols are missing from the chosen daily timestamp', () => {
		const chartData = toDataset({
			dimensions: ['timestamp', 'Hyperliquid', 'dYdX'],
			source: [{ timestamp: toMs(2024, 1, 2), Hyperliquid: 70, dYdX: 30 }]
		})

		const presentation = buildAdapterByChainLatestValuePresentation({
			chartKind: 'hbar',
			selectedProtocols: [],
			groupBy: 'daily',
			chartData
		})

		expect(presentation.kind).toBe('hbar')
		if (presentation.kind !== 'hbar') return

		expect(presentation.data).toEqual([])
	})

	it('builds hbar data from selected protocols and groups overflow into Others', () => {
		const manyProtocolChartData = toDataset({
			dimensions: ['timestamp', ...Array.from({ length: 11 }, (_, index) => `Protocol ${index + 1}`)],
			source: [
				Object.assign(
					{ timestamp: toMs(2024, 1, 2) },
					Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`Protocol ${index + 1}`, 110 - index * 10]))
				)
			]
		})

		const presentation = buildAdapterByChainLatestValuePresentation({
			chartKind: 'hbar',
			selectedProtocols: Array.from({ length: 11 }, (_, index) => `Protocol ${index + 1}`),
			groupBy: 'daily',
			chartData: manyProtocolChartData
		})

		expect(presentation.kind).toBe('hbar')
		if (presentation.kind !== 'hbar') return

		expect(presentation.data).toHaveLength(10)
		expect(presentation.data.at(-1)?.name).toBe('Others')
		expect(presentation.data.at(-1)?.value).toBe(30)
	})

	it('uses the selected daily chart protocols directly', () => {
		const chartData = toDataset({
			dimensions: ['timestamp', 'Hyperliquid', 'dYdX', 'GMX'],
			source: [{ timestamp: toMs(2024, 1, 2), Hyperliquid: 70, dYdX: 30, GMX: 10 }]
		})

		const presentation = buildAdapterByChainLatestValuePresentation({
			chartKind: 'hbar',
			selectedProtocols: ['Hyperliquid', 'dYdX', 'GMX'],
			groupBy: 'daily',
			chartData
		})

		expect(presentation.kind).toBe('hbar')
		if (presentation.kind !== 'hbar') return

		expect(presentation.data.map((item) => item.name)).toEqual(['Hyperliquid', 'dYdX', 'GMX'])
		expect(presentation.data[0].value).toBe(70)
		expect(presentation.data[1].value).toBe(30)
		expect(presentation.data[2].value).toBe(10)
	})

	it('renders every selected treemap item without synthesizing an Others tile', () => {
		const protocols = Array.from({ length: 102 }, (_, index) => `Protocol ${index + 1}`)
		const chartData = toDataset({
			dimensions: ['timestamp', ...protocols],
			source: [
				Object.assign(
					{ timestamp: toMs(2024, 1, 1) },
					Object.fromEntries(protocols.map((name, index) => [name, protocols.length - index]))
				)
			]
		})
		const filteredFirst = buildAdapterByChainLatestValuePresentation({
			chartKind: 'hbar',
			selectedProtocols: ['Protocol 1', 'Protocol 101'],
			groupBy: 'cumulative',
			chartData
		})
		const presentation = buildAdapterByChainLatestValuePresentation({
			chartKind: 'treemap',
			selectedProtocols: protocols,
			groupBy: 'cumulative',
			chartData
		})

		expect(presentation.kind).toBe('treemap')
		if (presentation.kind !== 'treemap') return
		expect(presentation.data).toHaveLength(102)
		expect(presentation.data.at(-1)?.name).toBe('Protocol 102')
		expect(presentation.data.at(-1)?.value).toBe(1)
		expect(presentation.data.at(-1)?.share).toBeCloseTo((1 / 5_253) * 100)
		expect(presentation.data.some((item) => item.name === 'Others')).toBe(false)
		expect(filteredFirst.kind).toBe('hbar')
		if (filteredFirst.kind !== 'hbar') return
		const firstColor = filteredFirst.data.find((item) => item.name === 'Protocol 1')?.itemStyle.color
		const hiddenPeerColor = filteredFirst.data.find((item) => item.name === 'Protocol 101')?.itemStyle.color
		expect(hiddenPeerColor).not.toBe(firstColor)
		expect(presentation.data.find((item) => item.name === 'Protocol 1')?.itemStyle.color).toBe(firstColor)

		const hbar = buildAdapterByChainLatestValuePresentation({
			chartKind: 'hbar',
			selectedProtocols: protocols,
			groupBy: 'cumulative',
			chartData
		})
		expect(hbar.kind).toBe('hbar')
		if (hbar.kind !== 'hbar') return
		expect(hbar.data.at(-1)).toEqual(expect.objectContaining({ name: 'Others', value: 4_371 }))
		expect(hbar.data.at(-1)?.share).toBeCloseTo((4_371 / 5_253) * 100)
		expect(hbar.data.at(-1)?.itemStyle.color).not.toBe(hbar.data[8].itemStyle.color)
	})
})

describe('mergeSingleDimensionChartDataset', () => {
	it('adds bribes and token tax data into the base series', () => {
		expect(
			mergeSingleDimensionChartDataset({
				chartData: toDataset({
					dimensions: ['timestamp', 'Fees'],
					source: [
						{ timestamp: toMs(2024, 1, 1), Fees: 10 },
						{ timestamp: toMs(2024, 1, 2), Fees: 20 }
					]
				}),
				extraCharts: [
					[
						[Math.floor(toMs(2024, 1, 1) / 1e3), 1],
						[Math.floor(toMs(2024, 1, 2) / 1e3), 2]
					],
					[
						[Math.floor(toMs(2024, 1, 1) / 1e3), 3],
						[Math.floor(toMs(2024, 1, 2) / 1e3), 4]
					]
				]
			}).source
		).toEqual([
			[toMs(2024, 1, 1), 14],
			[toMs(2024, 1, 2), 26]
		])
	})

	it('keeps extra-only timestamps when fee extras are enabled', () => {
		expect(
			mergeSingleDimensionChartDataset({
				chartData: toDataset({
					dimensions: ['timestamp', 'Fees'],
					source: [{ timestamp: toMs(2024, 1, 1), Fees: 10 }]
				}),
				extraCharts: [[[Math.floor(toMs(2024, 1, 2) / 1e3), 2]], [[Math.floor(toMs(2024, 1, 2) / 1e3), 4]]]
			}).source
		).toEqual([
			[toMs(2024, 1, 1), 10],
			[toMs(2024, 1, 2), 6]
		])
	})
})

describe('mergeBreakdownCharts', () => {
	it('adds extra protocol values by timestamp and protocol name', () => {
		expect(
			mergeBreakdownCharts({
				chart: [
					[1, { A: 10, B: 20 }],
					[2, { A: 30 }]
				],
				extraCharts: [
					[
						[1, { A: 1, C: 2 }],
						[2, { B: 3 }]
					],
					[[2, { A: 4 }]]
				]
			})
		).toEqual([
			[1, { A: 11, B: 20, C: 2 }],
			[2, { A: 34, B: 3 }]
		])
	})

	it('keeps extra-only timestamps when merging breakdown charts', () => {
		expect(
			mergeBreakdownCharts({
				chart: [[1, { A: 10 }]],
				extraCharts: [[[2, { A: 1 }]], [[2, { A: 3, B: 4 }]]]
			})
		).toEqual([
			[1, { A: 10 }],
			[2, { A: 4, B: 4 }]
		])
	})
})

describe('mergeNamedDimensionChartDataset', () => {
	it('adds extra chain values into the matching named dimensions', () => {
		expect(
			mergeNamedDimensionChartDataset({
				chartData: toDataset({
					dimensions: ['timestamp', 'Ethereum', 'Solana'],
					source: [
						{ timestamp: toMs(2024, 1, 1), Ethereum: 10, Solana: 20 },
						{ timestamp: toMs(2024, 1, 2), Ethereum: 30, Solana: 40 }
					]
				}),
				extraCharts: [
					[
						[Math.floor(toMs(2024, 1, 1) / 1e3), { ethereum: 1, solana: 2 }],
						[Math.floor(toMs(2024, 1, 2) / 1e3), { Ethereum: 3 }]
					],
					[[Math.floor(toMs(2024, 1, 2) / 1e3), { Solana: 4 }]]
				]
			}).source
		).toEqual([
			[toMs(2024, 1, 1), 10, 20],
			[toMs(2024, 1, 2), 33, 44]
		])
	})

	it('keeps extra-only timestamps for known named dimensions', () => {
		const result = mergeNamedDimensionChartDataset({
			chartData: toDataset({
				dimensions: ['timestamp', 'Ethereum', 'Solana'],
				source: [{ timestamp: toMs(2024, 1, 1), Ethereum: 10, Solana: 20 }]
			}),
			allowedDimensions: ['Ethereum', 'Solana', 'Base'],
			extraCharts: [
				[[Math.floor(toMs(2024, 1, 2) / 1e3), { ethereum: 100, Ethereum: 2 }]],
				[[Math.floor(toMs(2024, 1, 2) / 1e3), { Solana: 4, Base: 99, Ignored: 200 }]]
			]
		})

		expect(result.dimensions).toEqual(['timestamp', 'Ethereum', 'Solana', 'Base'])
		expect(result.source).toEqual([
			[toMs(2024, 1, 1), 10, 20, null],
			[toMs(2024, 1, 2), 2, 4, 99]
		])
	})
})

const protocol = (name: string, category: string | null, options: Partial<IProtocol> = {}): IProtocol =>
	({
		name,
		slug: name.toLowerCase(),
		logo: '',
		chains: [],
		category,
		total24h: null,
		total7d: null,
		total30d: null,
		total1y: null,
		totalAllTime: null,
		mcap: null,
		...options
	}) as IProtocol

describe('buildProtocolBreakdownNormalization', () => {
	it('maps parent-normalized rows back to raw breakdown aliases', () => {
		const normalization = buildProtocolBreakdownNormalization([
			protocol('Hyperliquid', null, { breakdownAliases: ['Hyperliquid Perps'] }),
			protocol('tradeXYZ', null)
		])

		expect(normalization.canonicalBySeriesName.Hyperliquid).toBe('Hyperliquid')
		expect(normalization.canonicalBySeriesName['Hyperliquid Perps']).toBe('Hyperliquid')
		expect(normalization.canonicalBySeriesName.tradeXYZ).toBe('tradeXYZ')
		expect(normalization.aliasesByCanonicalName.Hyperliquid).toEqual(['Hyperliquid', 'Hyperliquid Perps'])
	})

	it('maps child protocols to the parent canonical name', () => {
		const normalization = buildProtocolBreakdownNormalization([
			protocol('Aster', null, {
				childProtocols: [protocol('Aster Perps', null), protocol('Aster Legacy', null)]
			})
		])

		expect(normalization.canonicalBySeriesName.Aster).toBe('Aster')
		expect(normalization.canonicalBySeriesName['Aster Perps']).toBe('Aster')
		expect(normalization.canonicalBySeriesName['Aster Legacy']).toBe('Aster')
	})
})

describe('normalizeProtocolBreakdownChartData', () => {
	it('aggregates aliased series into the canonical parent protocol', () => {
		const normalization = buildProtocolBreakdownNormalization([
			protocol('Hyperliquid', null, { breakdownAliases: ['Hyperliquid Perps'] })
		])

		const result = normalizeProtocolBreakdownChartData({
			chart: [
				[1704067200, { 'Hyperliquid Perps': 10 }],
				[1704153600, { 'Hyperliquid Perps': 20 }]
			],
			normalization
		})

		expect(result.protocolDimensions).toEqual(['Hyperliquid'])
		expect(result.chartData.source).toEqual([
			[1704067200 * 1e3, 10],
			[1704153600 * 1e3, 20]
		])
	})

	it('keeps missing protocol values sparse until the visible series are selected', () => {
		const normalization = buildProtocolBreakdownNormalization([protocol('Alpha', null), protocol('Beta', null)])

		const result = normalizeProtocolBreakdownChartData({
			chart: [
				[1704067200, { Alpha: 20 }],
				[1704153600, { Beta: 10 }]
			],
			normalization
		})

		expect(result.protocolDimensions).toEqual(['Alpha', 'Beta'])
		expect(result.chartData.source).toEqual([
			[1704067200 * 1e3, 20, null],
			[1704153600 * 1e3, null, 10]
		])
	})

	it('aggregates multiple child protocols into the parent canonical protocol', () => {
		const normalization = buildProtocolBreakdownNormalization([
			protocol('Aster', null, {
				childProtocols: [protocol('Aster Perps', null), protocol('Aster Legacy', null)]
			})
		])

		const result = normalizeProtocolBreakdownChartData({
			chart: [
				[1704067200, { 'Aster Perps': 10, 'Aster Legacy': 5 }],
				[1704153600, { 'Aster Perps': 20 }]
			],
			normalization
		})

		expect(result.protocolDimensions).toEqual(['Aster'])
		expect(result.chartData.source).toEqual([
			[1704067200 * 1e3, 15],
			[1704153600 * 1e3, 20]
		])
	})

	it('drops unmatched breakdown series', () => {
		const normalization = buildProtocolBreakdownNormalization([protocol('Hyperliquid', null)])

		const result = normalizeProtocolBreakdownChartData({
			chart: [[1704067200, { tradeXYZ: 10 }]],
			normalization
		})

		expect(result.protocolDimensions).toEqual([])
		expect(result.chartData).toEqual({ source: [], dimensions: ['timestamp'] })
	})
})

describe('getCategoryProtocolNameFilterForChart', () => {
	it('returns unrestricted when the page has no categories', () => {
		expect(
			getCategoryProtocolNameFilterForChart({
				categories: [],
				protocols: [protocol('Uniswap', 'Dex')],
				categoryParam: undefined,
				excludeCategoryParam: undefined,
				hasCategoryParam: false
			})
		).toEqual({ kind: 'unrestricted' })
	})

	it('returns restricted names matching selected categories (parent + children)', () => {
		const parent = {
			...protocol('Parent', 'Dex'),
			childProtocols: [protocol('Child A', 'Lending'), protocol('Child B', 'Dex')]
		} as IProtocol

		const result = getCategoryProtocolNameFilterForChart({
			categories: ['Dex', 'Lending'],
			protocols: [parent],
			categoryParam: 'Lending',
			excludeCategoryParam: undefined,
			hasCategoryParam: true
		})

		expect(result.kind).toBe('restricted')
		if (result.kind === 'restricted') {
			expect([...result.names].sort()).toEqual(['Child A'])
		}
	})

	it('returns no-rows when category param clears the selection', () => {
		expect(
			getCategoryProtocolNameFilterForChart({
				categories: ['Dex'],
				protocols: [protocol('A', 'Dex')],
				categoryParam: '',
				excludeCategoryParam: undefined,
				hasCategoryParam: true
			})
		).toEqual({ kind: 'no-rows' })
	})

	it('returns restricted leaf names when the filtered row is a parent with all children matching', () => {
		const parent = {
			...protocol('Parent', 'Dex'),
			childProtocols: [protocol('Child A', 'Dex'), protocol('Child B', 'Lending')]
		} as IProtocol

		const result = getCategoryProtocolNameFilterForChart({
			categories: ['Dex', 'Lending'],
			protocols: [parent],
			categoryParam: undefined,
			excludeCategoryParam: undefined,
			hasCategoryParam: false
		})

		expect(result.kind).toBe('restricted')
		if (result.kind === 'restricted') {
			expect([...result.names].sort()).toEqual(['Child A', 'Child B'])
		}
	})
})

describe('leafProtocolNamesFromTableRows', () => {
	it('returns each standalone protocol name', () => {
		expect(leafProtocolNamesFromTableRows([protocol('A', 'Dex')])).toEqual(['A'])
	})

	it('returns child names sorted by total24h descending', () => {
		const parent = {
			...protocol('Parent', 'Dex'),
			childProtocols: [
				{ ...protocol('C1', 'Dex'), total24h: 10 },
				{ ...protocol('C2', 'Dex'), total24h: 100 }
			]
		} as IProtocol
		expect(leafProtocolNamesFromTableRows([parent])).toEqual(['C2', 'C1'])
	})
})

describe('aggregateProtocolVersions', () => {
	it('keeps all-missing period totals null instead of zero-seeding them', () => {
		const result = aggregateProtocolVersions([
			{
				name: 'Version A',
				displayName: 'Version A',
				parentProtocol: 'Parent Protocol',
				linkedProtocols: ['Parent Protocol', 'Version A'],
				chains: ['Base']
			},
			{
				name: 'Version B',
				displayName: 'Version B',
				parentProtocol: 'Parent Protocol',
				linkedProtocols: ['Parent Protocol', 'Version B'],
				chains: ['Optimism']
			}
		] as any)

		expect(result).toMatchObject({
			name: 'Parent Protocol',
			displayName: 'Parent Protocol',
			slug: 'parent-protocol',
			total24h: null,
			total7d: null,
			total30d: null,
			annualized1y: null,
			totalAllTime: null
		})
		expect(result.chains).toEqual(expect.arrayContaining(['Base', 'Optimism']))
		expect(result.chains).toHaveLength(2)
	})
})
