import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '../constants'

const mocks = vi.hoisted(() => ({
	presentationInputs: [] as Array<{
		chartData: MultiSeriesTimeSeriesDataset
		selectedChains: string[]
	}>,
	csvPreparers: [] as Array<
		() => {
			filename: string
			rows: Array<Array<string | number | boolean>>
		}
	>
}))

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, push: vi.fn() })
}))

vi.mock('@tanstack/react-query', () => ({
	skipToken: Symbol('skipToken'),
	useQuery: () => ({ data: undefined, error: null, isLoading: false })
}))

vi.mock('~/components/ChartExport/ChartExportButtons', () => ({
	ChartExportButtons: (props: { prepareCsvDirect?: (typeof mocks.csvPreparers)[number] }) => {
		if (props.prepareCsvDirect) mocks.csvPreparers.push(props.prepareCsvDirect)
		return null
	}
}))
vi.mock('~/components/ChartExport/ChartRestoreButton', () => ({ ChartRestoreButton: () => null }))
vi.mock('~/components/ECharts/shared/ChartGroupingSelector', () => ({
	ChartGroupingSelector: () => null,
	DWMC_GROUPING_OPTIONS_LOWERCASE: [{ label: 'Daily', value: 'daily' }]
}))
vi.mock('~/components/ECharts/HBarChart', () => ({ default: () => null }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))
vi.mock('~/components/ECharts/TreemapChart/Builder', () => ({ default: () => null }))
vi.mock('~/ui/Loaders', () => ({ LocalLoader: () => null }))
vi.mock('~/components/Select/Select', () => ({ Select: () => null }))
vi.mock('~/components/Select/SelectWithCombobox', () => ({ SelectWithCombobox: () => null }))
vi.mock('~/hooks/useGetChartInstance', () => ({
	useGetChartInstance: () => ({ chartInstance: null, handleChartReady: () => {} })
}))

vi.mock('../utils', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../utils')>()
	return {
		...actual,
		buildChainsByAdapterChartPresentation: (input: {
			chartData: MultiSeriesTimeSeriesDataset
			selectedChains: string[]
		}) => {
			mocks.presentationInputs.push(input)
			return {
				kind: 'bar',
				dataset: input.chartData,
				charts: [],
				valueMode: 'absolute',
				barLayout: 'stacked',
				showTotalInTooltip: true,
				groupBy: 'daily'
			}
		}
	}
})

import { ChainsByAdapterChart } from '../ChainChart'

const baseChartData: MultiSeriesTimeSeriesDataset = {
	dimensions: ['timestamp', 'Base', 'Ethereum'],
	source: [[Date.UTC(2024, 0, 1), 100, 50]]
}

describe('ChainsByAdapterChart', () => {
	beforeEach(() => {
		mocks.presentationInputs = []
		mocks.csvPreparers = []
	})

	it('passes the fetched chart dataset directly to the presentation builder', () => {
		renderToStaticMarkup(
			<ChainsByAdapterChart
				adapterType={ADAPTER_TYPES.FEES}
				dataType={ADAPTER_DATA_TYPES.DAILY_APP_FEES}
				chartData={baseChartData}
				allChains={['Base', 'Ethereum']}
				chartName="App Fees"
			/>
		)

		expect(mocks.presentationInputs.map(({ chartData }) => chartData)).toEqual([baseChartData])
	})

	it('exports logical timestamp, date, and chain headers instead of private renderer dimensions', () => {
		renderToStaticMarkup(
			<ChainsByAdapterChart
				adapterType={ADAPTER_TYPES.FEES}
				dataType={ADAPTER_DATA_TYPES.DAILY_APP_REVENUE}
				chartData={baseChartData}
				allChains={['Base', 'Ethereum']}
				chartName="App Revenue"
			/>
		)

		expect(mocks.csvPreparers).toHaveLength(1)
		expect(mocks.csvPreparers[0]!().rows).toEqual([
			['Timestamp', 'Date', 'Base', 'Ethereum'],
			[Date.UTC(2024, 0, 1), '2024-01-01', 100, 50]
		])
	})
})
