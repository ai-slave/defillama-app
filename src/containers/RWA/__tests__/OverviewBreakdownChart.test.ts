import { Writable } from 'node:stream'
import { createElement, type ReactElement } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IMultiSeriesChart2Props } from '~/components/ECharts/types'
import {
	buildOverviewBreakdownChartSeries,
	getOverviewBreakdownChartDatasetForSelectedStacks,
	getOverviewBreakdownRequestState,
	RWAOverviewBreakdownChart
} from '../OverviewBreakdownChart'

let routerQuery: Record<string, string | string[]> = {}
let queryState: { data: any; isLoading: boolean; error: any } = {
	data: null,
	isLoading: false,
	error: null
}
let lastChartProps: IMultiSeriesChart2Props | null = null
let lastTreemapProps: {
	nodes: Array<{ name: string; netFlowUsd: number | null }>
	sizeLabel: string
	periodLabel: string
} | null = null
let lastStackOptions: string[] | null = null

const mocks = vi.hoisted(() => ({
	buildRWAFlowRotationChart: vi.fn()
}))

vi.mock('next/router', () => ({
	useRouter: () => ({ query: routerQuery })
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: () => queryState
}))

vi.mock('../flows', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../flows')>()
	return {
		...actual,
		buildRWAFlowRotationChart: (...args: Parameters<typeof actual.buildRWAFlowRotationChart>) => {
			mocks.buildRWAFlowRotationChart(...args)
			return actual.buildRWAFlowRotationChart(...args)
		}
	}
})

vi.mock('~/components/ChartExport/ChartExportButtons', () => ({
	ChartExportButtons: () => null
}))

vi.mock('~/components/ECharts/MultiSeriesChart2', () => ({
	default: (props: IMultiSeriesChart2Props) => {
		lastChartProps = props
		return null
	}
}))

vi.mock('../FlowTreemapChart', () => ({
	RWAFlowTreemapChart: (props: typeof lastTreemapProps) => {
		lastTreemapProps = props
		return null
	}
}))

vi.mock('~/components/Select/SelectWithCombobox', () => ({
	SelectWithCombobox: ({ allValues }: { allValues: string[] }) => {
		lastStackOptions = allValues
		return null
	}
}))

vi.mock('~/hooks/useGetChartInstance', () => ({
	useGetChartInstance: () => ({
		chartInstance: null,
		handleChartReady: () => {}
	})
}))

function renderAll(element: ReactElement) {
	return new Promise<void>((resolve, reject) => {
		let settled = false
		const out = new Writable({
			write(_chunk, _encoding, callback) {
				callback()
			}
		})
		const stream = renderToPipeableStream(element, {
			onAllReady() {
				stream.pipe(out)
			},
			onError(error) {
				if (!settled) {
					settled = true
					reject(error)
				}
			}
		})

		out.on('finish', () => {
			if (!settled) {
				settled = true
				resolve()
			}
		})
	})
}

beforeEach(() => {
	routerQuery = {}
	queryState = { data: null, isLoading: false, error: null }
	lastChartProps = null
	lastTreemapProps = null
	lastStackOptions = null
	mocks.buildRWAFlowRotationChart.mockClear()
})

describe('getOverviewBreakdownRequestState', () => {
	it('uses the platform default state when there are no query params', () => {
		expect(getOverviewBreakdownRequestState({ kind: 'platform' }, 'activeMcap', {})).toEqual({
			request: {
				breakdown: 'platform',
				key: 'activeMcap',
				includeStablecoin: false,
				includeGovernance: false
			},
			isDefaultState: true
		})
	})

	it('reads both inclusion flags for platforms', () => {
		expect(
			getOverviewBreakdownRequestState({ kind: 'platform' }, 'activeMcap', {
				includeStablecoins: 'true',
				includeGovernance: 'true'
			})
		).toEqual({
			request: {
				breakdown: 'platform',
				key: 'activeMcap',
				includeStablecoin: true,
				includeGovernance: true
			},
			isDefaultState: false
		})
	})

	it('uses the same default state for categories and asset groups', () => {
		expect(getOverviewBreakdownRequestState({ kind: 'category' }, 'activeMcap', {})).toEqual({
			request: {
				breakdown: 'category',
				key: 'activeMcap',
				includeStablecoin: false,
				includeGovernance: false
			},
			isDefaultState: true
		})

		expect(getOverviewBreakdownRequestState({ kind: 'assetGroup' }, 'activeMcap', {})).toEqual({
			request: {
				breakdown: 'assetGroup',
				key: 'activeMcap',
				includeStablecoin: false,
				includeGovernance: false
			},
			isDefaultState: true
		})
	})

	it('renders supplied total series with requested aggregate breakdown charts', async () => {
		const dataset = {
			source: [{ timestamp: 1, 'Total Active Mcap': 15, Ethereum: 10, Solana: 5 }],
			dimensions: ['timestamp', 'Total Active Mcap', 'Ethereum', 'Solana']
		}

		await renderAll(
			createElement(RWAOverviewBreakdownChart, {
				page: { kind: 'chain' },
				initialChartDataset: dataset,
				stackLabel: 'Chains'
			})
		)

		expect(lastChartProps?.dataset).toBe(dataset)
		expect(lastChartProps?.hideDefaultLegend).toBe(false)
		expect(lastChartProps?.stacked).toBeUndefined()
		expect(lastChartProps?.showTotalInTooltip).toBe(false)
		expect(Array.from(lastChartProps?.selectedCharts ?? [])).toEqual(['Total Active Mcap', 'Ethereum', 'Solana'])
		expect(lastChartProps?.charts?.[0]).toMatchObject({
			name: 'Total Active Mcap',
			hideAreaStyle: true,
			excludeFromTooltipTotal: true
		})
	})

	it('leaves category breakdown charts unchanged', async () => {
		const dataset = {
			source: [{ timestamp: 1, Treasuries: 10, Credit: 5 }],
			dimensions: ['timestamp', 'Treasuries', 'Credit']
		}

		await renderAll(
			createElement(RWAOverviewBreakdownChart, {
				page: { kind: 'category' },
				initialChartDataset: dataset,
				stackLabel: 'Categories'
			})
		)

		expect(lastChartProps?.dataset).toBe(dataset)
		expect(Array.from(lastChartProps?.selectedCharts ?? [])).toEqual(['Treasuries', 'Credit'])
	})

	it('caps time-series selections supplied through the URL', async () => {
		const stacks = Array.from({ length: 35 }, (_, index) => `Platform ${index + 1}`)
		routerQuery = { stacks }

		await renderAll(
			createElement(RWAOverviewBreakdownChart, {
				page: { kind: 'platform' },
				initialChartDataset: {
					source: [{ timestamp: 1, ...Object.fromEntries(stacks.map((name, index) => [name, index + 1])) }],
					dimensions: ['timestamp', ...stacks]
				},
				stackLabel: 'Platforms'
			})
		)

		expect(Array.from(lastChartProps?.selectedCharts ?? [])).toEqual(stacks.slice(0, 30))
	})

	it('renders net flows on overview breakdown pages', async () => {
		routerQuery = { chartType: 'flows' }
		queryState = {
			data: [{ timestamp: 1, Ethereum: 10, Solana: -4 }],
			isLoading: false,
			error: null
		}

		await renderAll(
			createElement(RWAOverviewBreakdownChart, {
				page: { kind: 'chain' },
				initialChartDataset: { source: [], dimensions: ['timestamp'] },
				stackLabel: 'Chains'
			})
		)

		expect(lastChartProps?.groupBy).toBe('monthly')
		expect(lastChartProps?.charts?.map((chart) => chart.name)).toEqual(['Ethereum', 'Solana'])
		expect(lastChartProps?.charts?.every((chart) => chart.type === 'bar')).toBe(true)
		expect(mocks.buildRWAFlowRotationChart).toHaveBeenCalled()
	})

	it('renders a sized net-flow heatmap for the selected listing entities', async () => {
		routerQuery = { chartType: 'flows', flowRotationView: 'heatmap', flowHeatmapSize: 'activeMcap' }
		queryState = {
			data: [{ timestamp: 1, Ethereum: 10, Solana: -4 }],
			isLoading: false,
			error: null
		}

		await renderAll(
			createElement(RWAOverviewBreakdownChart, {
				page: { kind: 'chain' },
				initialChartDataset: { source: [], dimensions: ['timestamp'] },
				stackLabel: 'Chains',
				treemapSizeRows: [
					{ name: 'Ethereum', activeMcap: 100, onChainMcap: 120, defiActiveTvl: 10 },
					{ name: 'Solana', activeMcap: 50, onChainMcap: 60, defiActiveTvl: 5 },
					{ name: 'No Coverage', activeMcap: 25, onChainMcap: 30, defiActiveTvl: 0 }
				]
			})
		)

		expect(lastChartProps).toBeNull()
		expect(lastTreemapProps).toMatchObject({ sizeLabel: 'Active Mcap', periodLabel: '30d' })
		expect(lastTreemapProps?.nodes.map(({ name, netFlowUsd }) => ({ name, netFlowUsd }))).toEqual([
			{ name: 'Ethereum', netFlowUsd: 10 },
			{ name: 'Solana', netFlowUsd: -4 },
			{ name: 'No Coverage', netFlowUsd: null }
		])
		expect(lastStackOptions).toEqual(['Ethereum', 'Solana', 'No Coverage'])
		expect(mocks.buildRWAFlowRotationChart).not.toHaveBeenCalled()
	})

	it('slices selected stack charts to the first non-null selected value', async () => {
		routerQuery = { stacks: 'PreStocks' }
		const dataset = {
			source: [
				{ timestamp: 1, 'Total Active Mcap': 10, PreStocks: null, Securitize: 10 },
				{ timestamp: 2, 'Total Active Mcap': 11, PreStocks: null, Securitize: 11 },
				{ timestamp: 3, 'Total Active Mcap': 23, PreStocks: 12, Securitize: 11 },
				{ timestamp: 4, 'Total Active Mcap': 11, PreStocks: 0, Securitize: 11 }
			],
			dimensions: ['timestamp', 'Total Active Mcap', 'PreStocks', 'Securitize']
		}

		await renderAll(
			createElement(RWAOverviewBreakdownChart, {
				page: { kind: 'platform' },
				initialChartDataset: dataset,
				stackLabel: 'Platforms'
			})
		)

		expect(lastChartProps?.dataset.source).toEqual([
			{ timestamp: 3, 'Total Active Mcap': 23, PreStocks: 12, Securitize: 11 },
			{ timestamp: 4, 'Total Active Mcap': 11, PreStocks: 0, Securitize: 11 }
		])
		expect(Array.from(lastChartProps?.selectedCharts ?? [])).toEqual(['PreStocks'])
	})
})

describe('getOverviewBreakdownChartDatasetForSelectedStacks', () => {
	const dataset = {
		source: [
			{ timestamp: 1, PreStocks: null, Securitize: 10 },
			{ timestamp: 2, PreStocks: 12, Securitize: 11 },
			{ timestamp: 3, PreStocks: 0, Securitize: 12 }
		],
		dimensions: ['timestamp', 'PreStocks', 'Securitize']
	}

	it('keeps the full dataset when all stacks are selected', () => {
		expect(
			getOverviewBreakdownChartDatasetForSelectedStacks(
				dataset,
				['PreStocks', 'Securitize'],
				['PreStocks', 'Securitize']
			)
		).toBe(dataset)
	})

	it('preserves zero values after the selected stack starts', () => {
		expect(
			getOverviewBreakdownChartDatasetForSelectedStacks(dataset, ['PreStocks'], ['PreStocks', 'Securitize']).source
		).toEqual([
			{ timestamp: 2, PreStocks: 12, Securitize: 11 },
			{ timestamp: 3, PreStocks: 0, Securitize: 12 }
		])
	})
})

describe('buildOverviewBreakdownChartSeries', () => {
	it('uses total-series styling without excluding normal series', () => {
		expect(buildOverviewBreakdownChartSeries(['timestamp', 'Total Active Mcap', 'Ethereum'])).toEqual([
			expect.objectContaining({
				name: 'Total Active Mcap',
				hideAreaStyle: true,
				excludeFromTooltipTotal: true
			}),
			expect.objectContaining({
				name: 'Ethereum'
			})
		])
	})
})
