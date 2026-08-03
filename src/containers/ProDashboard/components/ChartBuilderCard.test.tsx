import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { StreamDoneContext } from '../queries'
import type { ChartBuilderConfig } from '../types'
import { ChartBuilderCard } from './ChartBuilderCard'

vi.mock('~/hooks/useChartImageExport', () => ({
	useChartImageExport: () => ({ chartInstance: null, handleChartReady: vi.fn() })
}))

vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({ getProtocolInfo: () => null }),
	useProDashboardEditorActions: () => ({
		handlePercentageChange: vi.fn(),
		handleGroupingChange: vi.fn(),
		handleHideOthersChange: vi.fn(),
		handleChartTypeChange: vi.fn(),
		handleEditItem: vi.fn(),
		handleDuplicateChartBuilder: vi.fn()
	}),
	useProDashboardPermissions: () => ({ isReadOnly: true, hideDuplicateButton: true }),
	useProDashboardTime: () => ({ timePeriod: '3y', customTimePeriod: null })
}))

const config: ChartBuilderConfig['config'] = {
	categories: [],
	chainCategories: [],
	chainCategoryFilterMode: 'include',
	chainFilterMode: 'include',
	chains: ['All'],
	chartType: 'stackedBar',
	displayAs: 'timeSeries',
	categoryFilterMode: 'include',
	groupBy: 'protocol',
	groupByParent: true,
	hideOthers: true,
	limit: 10,
	metric: 'revenue',
	mode: 'chains',
	protocolCategories: [],
	protocolCategoryFilterMode: 'include'
}

const builder: ChartBuilderConfig = {
	id: 'builder-revenue',
	kind: 'builder',
	name: 'Top Revenue Protocols',
	grouping: 'week',
	config
}

const queryKey = [
	'pro-dashboard',
	'chartBuilder',
	config.mode,
	config.metric,
	undefined,
	config.chains,
	config.limit,
	config.categories,
	config.chainCategories,
	config.protocolCategories,
	config.hideOthers,
	config.groupByParent,
	config.chainFilterMode,
	config.categoryFilterMode,
	config.chainCategoryFilterMode,
	config.protocolCategoryFilterMode
]

function renderCard(queryClient: QueryClient) {
	return renderToStaticMarkup(
		<QueryClientProvider client={queryClient}>
			<StreamDoneContext.Provider value={false}>
				<ChartBuilderCard builder={builder} />
			</StreamDoneContext.Provider>
		</QueryClientProvider>
	)
}

describe('ChartBuilderCard streamed loading state', () => {
	it('shows loading before the stream has provided a cache entry', () => {
		const html = renderCard(new QueryClient())

		expect(html).toContain('Loading chart...')
		expect(html).not.toContain('No data available')
	})

	it('shows no data after the stream provides a completed empty result', () => {
		const queryClient = new QueryClient()
		queryClient.setQueryData(queryKey, { series: [] })
		const html = renderCard(queryClient)

		expect(html).not.toContain('Loading chart...')
		expect(html).toContain('No data available')
	})
})
