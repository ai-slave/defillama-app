// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { getChainChartApiUrl } from '../chainChartData'
import type { ChainChartLabels } from '../constants'
import { useFetchChainChartData } from '../useFetchChainChartData'

const http = installFixtureFetch()

// Each chart gets its own value, so a response routed to the wrong chart shows up as a wrong number.
const charts = [
	['Chain Fees', 1],
	['Chain Revenue', 2],
	['Holders Revenue', 11],
	['App Fees', 3],
	['App Revenue', 4],
	['DEXs Volume', 5],
	['Perps Volume', 6],
	['Active Addresses', 7],
	['New Addresses', 8],
	['Transactions', 9],
	['Token Incentives', 10]
] as const
const daySec = Date.UTC(2026, 0, 1) / 1e3

test('each toggled chain chart shows the response of its own endpoint', async () => {
	expect(getChainChartApiUrl('Holders Revenue', 'Ethereum')).toBe(
		'/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=fees&protocol=Ethereum&dataType=dailyHoldersRevenue'
	)
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	const fixtures: Record<string, unknown> = {}
	for (const [label, value] of charts)
		fixtures[`http://localhost:3000${getChainChartApiUrl(label, 'Base')}`] = [[daySec, value]]
	http.serve(fixtures)

	const probe: { result: ReturnType<typeof useFetchChainChartData> | null } = { result: null }
	function Probe() {
		probe.result = useFetchChainChartData({
			denomination: 'USD',
			selectedChain: 'Base',
			tvlChart: [],
			tvlChartSummary: {
				totalValueUSD: null,
				tvlPrevDay: null,
				valueChange24hUSD: null,
				change24h: null,
				computedAtMs: daySec * 1000
			},
			extraTvlCharts: {},
			tvlSettings: {},
			chainGeckoId: null,
			gasTokenGeckoId: null,
			toggledCharts: charts.map(([label]) => label) as Array<ChainChartLabels>,
			groupBy: 'daily'
		})
		return null
	}

	const client = new QueryClient()
	const root = createRoot(document.createElement('div'))
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Probe />
			</QueryClientProvider>
		)
	)
	await waitForUi(() => expect(probe.result?.isFetchingChartData).toBe(false))

	const expected: Record<string, Array<[number, number]>> = {}
	for (const [label, value] of charts) expected[label] = [[daySec * 1e3, value]]
	expect(probe.result?.finalCharts).toEqual(expected)
	expect(probe.result?.failedMetrics).toEqual([])
	await act(async () => root.unmount())
	client.clear()
})
