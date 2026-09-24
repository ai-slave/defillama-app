// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import type { ChartConfig } from '../types'
import { ChartCard } from './ChartCard'

const mocks = vi.hoisted(() => ({ charts: [] as Array<Array<{ name: string; type: string }>> }))
vi.mock('../queries', async () => {
	const { createContext } = await import('react')
	return {
		ProxyAuthTokenContext: createContext(null),
		StreamDoneContext: createContext(true),
		useChartData: () => ({
			data: [
				[1_789_516_800, 40],
				[1_790_121_600, 50]
			],
			isLoading: false,
			isError: false,
			refetch: vi.fn()
		})
	}
})
vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({
		getChainInfo: () => undefined,
		getProtocolInfo: () => undefined,
		parentMapping: {},
		protocolBySlug: new Map(),
		protocolCatalog: { status: 'ready' }
	}),
	useProDashboardTime: () => ({ timePeriod: 'all', customTimePeriod: null }),
	useProDashboardEditorActions: () => ({ handleGroupingChange: vi.fn(), handleCumulativeChange: vi.fn() }),
	useProDashboardAnnotations: () => ({ annotations: [] }),
	useProDashboardVariables: () => ({ variables: [] }),
	useProDashboardPermissions: () => ({ isReadOnly: false, hideDuplicateButton: true }),
	useProDashboardDashboard: () => ({ currentDashboard: null, dashboardId: null }),
	useProDashboardItemsState: () => ({ items: [] })
}))
vi.mock('./useChartSyncGroup', () => ({ useChartSyncGroup: () => undefined }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/example' }) }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, hasActiveSubscription: true, isTrial: false })
}))
vi.mock('~/hooks/useIsClient', () => ({ useIsClient: () => true }))
vi.mock('~/components/ChartExport/useChartPngExport', () => ({
	useChartPngExport: () => ({ isExporting: false, downloadImage: vi.fn(), copyImage: vi.fn() })
}))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: ({ charts }: { charts: Array<{ name: string; type: string }> }) => {
		mocks.charts.push(charts)
		return null
	}
}))

async function render(chart: Partial<ChartConfig>) {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.charts.length = 0
	const container = document.createElement('div')
	const root = createRoot(container)
	await act(async () =>
		root.render(
			<ChartCard
				chart={
					{
						id: 'c',
						kind: 'chart',
						subjectType: 'chain',
						chain: 'Ethereum',
						type: 'activeUsers',
						...chart
					} as ChartConfig
				}
			/>
		)
	)
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
	return { container, unmount: () => act(async () => root.unmount()) }
}

test('titles grouped active addresses as a daily average', async () => {
	const { container, unmount } = await render({ grouping: 'week' })

	expect(container.textContent).toContain('Ethereum Active Addresses (daily average)')
	expect(mocks.charts.at(-1)?.map((chart) => chart.name)).toEqual(['Active Addresses (daily average)'])
	await unmount()
})

test('ignores a saved cumulative setting and offers no cumulative control', async () => {
	const { container, unmount } = await render({ showCumulative: true })

	expect(mocks.charts.at(-1)?.map((chart) => chart.type)).toEqual(['bar'])
	expect(container.textContent).not.toContain('Cumulative')
	expect(container.textContent).not.toContain('Individual')
	await unmount()
})

test('keeps the cumulative control for metrics that add up', async () => {
	const { container, unmount } = await render({ type: 'newUsers', showCumulative: true })

	expect(mocks.charts.at(-1)?.map((chart) => chart.type)).toEqual(['line'])
	expect(container.textContent).toContain('Cumulative')
	await unmount()
})
