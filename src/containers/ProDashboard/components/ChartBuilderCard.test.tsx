// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { getChartBuilderQueryKey } from '../chartBuilderQueryKey'
import { StreamDoneContext } from '../queries'
import type { ChartBuilderConfig } from '../types'
import { ChartBuilderCard } from './ChartBuilderCard'

const mocks = vi.hoisted(() => ({ fetchProtocolBreakdownData: vi.fn() }))
vi.mock('../services/ProtocolChartBuilderData', () => ({
	fetchProtocolBreakdownData: mocks.fetchProtocolBreakdownData,
	fetchProtocolChainBreakdownData: vi.fn()
}))

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))

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
	useProDashboardPermissions: () => ({
		isReadOnly: true,
		hideDuplicateButton: true
	}),
	useProDashboardTime: () => ({ timePeriod: '3y', customTimePeriod: null }),
	useProDashboardDashboard: () => ({
		currentDashboard: null,
		dashboardId: null
	}),
	useProDashboardItemsState: () => ({ items: [] }),
	useProDashboardVariables: () => ({ variables: [] }),
	useProDashboardAnnotations: () => ({ annotations: [] })
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

const queryKey = getChartBuilderQueryKey(config)

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
	test('shows loading before the stream has provided a cache entry', () => {
		const html = renderCard(new QueryClient())

		expect(html).toContain('Loading chart…')
		expect(html).not.toContain('No data available')
	})

	test('shows no data after the stream provides a completed empty result', () => {
		const queryClient = new QueryClient()
		queryClient.setQueryData(queryKey, { series: [] })
		const html = renderCard(queryClient)

		expect(html).not.toContain('Loading chart…')
		expect(html).toContain('No data available')
	})

	test('shows an error with retry when the series query fails', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.fetchProtocolBreakdownData.mockRejectedValue(new Error('network down'))
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)

		await act(async () =>
			root.render(
				<QueryClientProvider client={queryClient}>
					<StreamDoneContext.Provider value>
						<ChartBuilderCard builder={builder} />
					</StreamDoneContext.Provider>
				</QueryClientProvider>
			)
		)
		await vi.waitFor(() => {
			if (!container.querySelector('[role="alert"]')) throw new Error('Expected the card error')
		})

		const alert = container.querySelector('[role="alert"]')
		expect(alert?.textContent).toContain("Couldn't load this card")
		expect(alert?.textContent).not.toContain('network down')
		expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Try again')).toBe(true)

		await act(async () => root.unmount())
		container.remove()
	})
})
