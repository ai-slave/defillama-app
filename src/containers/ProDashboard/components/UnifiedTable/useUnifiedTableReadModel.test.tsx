// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { fetchJson } from '~/utils/async'
import { DashboardTestProvider } from '~/utils/test/dashboardContext'
import type { UnifiedTableConfig } from '../../unifiedTable/config/current'
import type { FilteredShareMetricKey } from '../../unifiedTable/config/filteredShareColumns'
import type { ProtocolsUnifiedTableResponse } from '../../unifiedTable/contracts'
import { getUnifiedTableQueryIdentity } from '../../unifiedTableQuery'
import { useUnifiedTableReadModel } from './useUnifiedTableReadModel'

vi.mock('~/utils/async', () => ({ fetchJson: vi.fn() }))
const config: UnifiedTableConfig = {
	id: 'data-test',
	kind: 'unified-table',
	configVersion: 3,
	strategy: 'protocols',
	rowHeaders: ['protocol'],
	columnOrder: ['name', 'tvl'],
	columnVisibility: { name: true, tvl: true },
	defaultSorting: [],
	colSpan: 2
}
const queryKey = getUnifiedTableQueryIdentity(config, config.rowHeaders).queryKey
const metrics: Array<FilteredShareMetricKey> = ['tvl']
const noMetrics: Array<FilteredShareMetricKey> = []
function response(alphaTvl: number): ProtocolsUnifiedTableResponse {
	return {
		strategy: 'protocols',
		parentMetrics: {},
		rows: ['Alpha', 'Beta'].map((name, index) => ({
			rowType: 'protocol',
			id: name,
			name,
			protocolId: name,
			displayName: name,
			logo: '',
			category: 'Lending',
			chains: ['Ethereum'],
			oracles: [],
			parentProtocolId: null,
			parentProtocolName: null,
			parentProtocolLogo: null,
			metrics: { tvl: index === 0 ? alphaTvl : 100 },
			chain: null
		}))
	}
}
function DataView({ searchTerm, shares }: { searchTerm: string; shares: boolean }) {
	const data = useUnifiedTableReadModel({
		config,
		rowHeaders: config.rowHeaders,
		searchTerm,
		filteredShareMetricKeys: shares ? metrics : noMetrics
	})
	return (
		<output>
			{JSON.stringify({
				loading: data.isLoading,
				error: data.hasInitialError,
				rows: data.rows.map((row) => ({ name: row.displayName, tvl: row.metrics.tvl, share: row.filteredShares.tvl })),
				leaves: data.leaves.length
			})}
		</output>
	)
}

test('refreshes cached metrics and recalculates filtered shares without fetching for search or columns', async () => {
	const client = new QueryClient()
	client.setQueryData(queryKey, response(100))
	const container = document.createElement('div')
	const root = createRoot(container)
	const render = (searchTerm: string, shares: boolean) =>
		root.render(
			<QueryClientProvider client={client}>
				<DashboardTestProvider>
					<DataView searchTerm={searchTerm} shares={shares} />
				</DashboardTestProvider>
			</QueryClientProvider>
		)
	vi.mocked(fetchJson).mockClear()
	try {
		await act(async () => render('', true))
		expect(JSON.parse(container.textContent!)).toEqual({
			loading: false,
			error: false,
			rows: [
				{ name: 'Alpha', tvl: 100, share: 50 },
				{ name: 'Beta', tvl: 100, share: 50 }
			],
			leaves: 2
		})
		await act(async () => {
			client.setQueryData(queryKey, response(300))
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(JSON.parse(container.textContent!).rows).toEqual([
			{ name: 'Alpha', tvl: 300, share: 75 },
			{ name: 'Beta', tvl: 100, share: 25 }
		])
		await act(async () => render('Beta', true))
		expect(JSON.parse(container.textContent!)).toEqual({
			loading: false,
			error: false,
			rows: [{ name: 'Beta', tvl: 100, share: 100 }],
			leaves: 1
		})
		await act(async () => render('', false))
		expect(JSON.parse(container.textContent!).rows).toEqual([
			{ name: 'Alpha', tvl: 300 },
			{ name: 'Beta', tvl: 100 }
		])
		expect(fetchJson).not.toHaveBeenCalled()
	} finally {
		await act(async () => root.unmount())
		client.clear()
	}
})

test('waits for dashboard streaming before making the initial request', async () => {
	const client = new QueryClient()
	const container = document.createElement('div')
	const root = createRoot(container)
	vi.mocked(fetchJson).mockClear().mockResolvedValue(response(100))
	const render = (done: boolean) =>
		root.render(
			<QueryClientProvider client={client}>
				<DashboardTestProvider streamDone={done}>
					<DataView searchTerm="" shares={false} />
				</DashboardTestProvider>
			</QueryClientProvider>
		)
	try {
		await act(async () => render(false))
		expect(JSON.parse(container.textContent!)).toEqual({ loading: true, error: false, rows: [], leaves: 0 })
		expect(fetchJson).not.toHaveBeenCalled()
		await act(async () => {
			render(true)
		})
		expect(fetchJson).toHaveBeenCalledTimes(1)
		expect(vi.mocked(fetchJson).mock.calls[0][0]).toContain('/api/public/pro-dashboard/unified-table/protocols?')
	} finally {
		await act(async () => root.unmount())
		client.clear()
	}
})
