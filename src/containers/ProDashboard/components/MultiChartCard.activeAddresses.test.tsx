// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import type { MultiChartConfig } from '../types'
import MultiChartCard from './MultiChartCard'

const mocks = vi.hoisted(() => ({
	seriesNames: [] as Array<Array<string>>,
	handleCumulativeChange: vi.fn()
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, hasActiveSubscription: true, isTrial: false })
}))
vi.mock('~/hooks/useIsClient', () => ({ useIsClient: () => true }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/example' }) }))
vi.mock('../queries', async () => {
	const { createContext } = await import('react')
	const series = { data: [[1_789_516_800, 40]], isLoading: false, isError: false, refetch: vi.fn() }
	return {
		ProxyAuthTokenContext: createContext(null),
		StreamDoneContext: createContext(true),
		useChartsData: (items: Array<unknown>) => items.map(() => series)
	}
})
vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({
		getProtocolInfo: () => undefined,
		parentMapping: {},
		protocolBySlug: new Map(),
		protocolCatalog: { status: 'ready' }
	}),
	useProDashboardTime: () => ({ timePeriod: 'all', customTimePeriod: null }),
	useProDashboardEditorActions: () => ({ handleCumulativeChange: mocks.handleCumulativeChange }),
	useProDashboardPermissions: () => ({ isReadOnly: false, hideDuplicateButton: true }),
	useProDashboardDashboard: () => ({ currentDashboard: null, dashboardId: null }),
	useProDashboardItemsState: () => ({ items: [] }),
	useProDashboardVariables: () => ({ variables: [] }),
	useProDashboardAnnotations: () => ({ annotations: [] })
}))
vi.mock('~/components/ChartExport/useChartPngExport', () => ({
	useChartPngExport: () => ({ isExporting: false, downloadImage: vi.fn(), copyImage: vi.fn() })
}))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: ({ charts }: { charts: Array<{ name: string }> }) => {
		mocks.seriesNames.push(charts.map((chart) => chart.name))
		return null
	}
}))

async function render(overrides: Partial<MultiChartConfig>) {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.seriesNames.length = 0
	const container = document.createElement('div')
	const root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<MultiChartCard
					multi={{
						id: 'activity',
						kind: 'multi',
						name: 'Activity',
						items: [
							{ id: 'a', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'activeUsers' },
							{ id: 'b', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'txs' }
						],
						...overrides
					}}
				/>
			</QueryClientProvider>
		)
	)
	return { container, unmount: () => act(async () => root.unmount()) }
}

test('names grouped active addresses as a daily average', async () => {
	const { unmount } = await render({ grouping: 'week' })

	expect(mocks.seriesNames.at(-1)).toEqual(['Ethereum Active Addresses (daily average)', 'Ethereum Transactions'])
	await unmount()
})

test('leaves active addresses out of a cumulative chart, explains why, and offers individual values', async () => {
	const { container, unmount } = await render({ showCumulative: true })

	expect(mocks.seriesNames.at(-1)).toEqual(['Ethereum Transactions'])
	expect(container.textContent).toContain("Cumulative isn't available for Active Addresses.")
	const action = [...container.querySelectorAll('button')].find(
		(button) => button.textContent === 'Show individual values'
	)!
	await act(async () => action.click())
	expect(mocks.handleCumulativeChange).toHaveBeenCalledWith('activity', false)
	await unmount()
})

test('shows only the explanation when active addresses are the only series of a cumulative chart', async () => {
	const { container, unmount } = await render({
		showCumulative: true,
		items: [{ id: 'a', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'activeUsers' }]
	})

	expect(container.textContent).toContain("Cumulative isn't available for Active Addresses.")
	expect(mocks.seriesNames).toEqual([])
	await unmount()
})
