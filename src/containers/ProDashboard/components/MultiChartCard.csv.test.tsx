// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { serializeCsv } from '~/utils/csv'
import MultiChartCard from './MultiChartCard'

const mocks = vi.hoisted(() => ({
	download: vi.fn(),
	second: { data: undefined as Array<[number, number]> | undefined, isLoading: true, isError: false, refetch: vi.fn() }
}))
vi.mock('~/utils/download', () => ({ downloadCSV: mocks.download }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, hasActiveSubscription: true, isTrial: false })
}))
vi.mock('~/hooks/useIsClient', () => ({ useIsClient: () => true }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/example' }) }))
vi.mock('../queries', async () => {
	const { createContext } = await import('react')
	return {
		ProxyAuthTokenContext: createContext(null),
		StreamDoneContext: createContext(true),
		useChartsData: () => [
			{ data: [[1_704_067_200, 12]], isLoading: false, isError: false, refetch: vi.fn() },
			mocks.second
		]
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
	useProDashboardEditorActions: () => ({}),
	useProDashboardPermissions: () => ({ isReadOnly: true, hideDuplicateButton: true })
}))
vi.mock('~/components/ChartExport/ChartPngExportButton', () => ({ ChartPngExportButton: () => null }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => <div>Chart canvas</div> }))

test('waits for every series, blocks failed partial exports, then exports both series after recovery', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const client = new QueryClient()
	const render = () =>
		act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<MultiChartCard
						multi={{
							id: 'comparison',
							kind: 'multi',
							name: 'Comparison',
							items: [
								{ id: 'a', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' },
								{ id: 'b', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl' }
							]
						}}
					/>
				</QueryClientProvider>
			)
		)
	const exportButton = () => {
		const button = [...container.querySelectorAll('button')].find(
			(element) => element.textContent?.trim() === '.csv' || element.textContent?.trim() === 'Preparing…'
		)
		if (!button) throw new Error('Missing CSV button')
		return button
	}
	try {
		await render()
		expect(exportButton().getAttribute('aria-disabled')).toBe('true')
		await act(async () => exportButton().click())
		expect(mocks.download).not.toHaveBeenCalled()
		Object.assign(mocks.second, { isLoading: false, isError: true })
		await render()
		expect(exportButton().getAttribute('aria-disabled')).toBe('true')
		expect(container.textContent).toContain('1 series is unavailable.')
		Object.assign(mocks.second, { isError: false, data: [[1_704_067_200, -7]] })
		await render()
		expect(exportButton().disabled).toBe(false)
		await act(async () => exportButton().click())
		await vi.waitFor(() => expect(mocks.download).toHaveBeenCalledOnce())
		expect(serializeCsv(mocks.download.mock.calls[0][1])).toBe('Date,Ethereum TVL,Solana TVL\n2024-01-01,12,-7')
	} finally {
		await act(async () => root.unmount())
		client.clear()
		container.remove()
	}
})
