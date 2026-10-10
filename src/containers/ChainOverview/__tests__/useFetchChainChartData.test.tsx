// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
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
			extraTvlCharts: null,
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

const EXTRA_TVL_URL = 'http://localhost:3000/api/public/chains/charts?kind=extra-tvl&chain=Base'

// Renders the hook for Base with the given TVL settings and charts, and returns its latest result.
async function renderTvlSettings(tvlSettings: Record<string, boolean>, toggledCharts: Array<ChainChartLabels>) {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	const probe: { result: ReturnType<typeof useFetchChainChartData> | null } = { result: null }
	function Probe() {
		probe.result = useFetchChainChartData({
			denomination: 'USD',
			selectedChain: 'Base',
			tvlChart: [[daySec * 1000, 100]],
			tvlChartSummary: {
				totalValueUSD: 100,
				tvlPrevDay: null,
				valueChange24hUSD: null,
				change24h: null,
				computedAtMs: daySec * 1000
			},
			extraTvlCharts: null,
			tvlSettings,
			chainGeckoId: null,
			gasTokenGeckoId: null,
			toggledCharts,
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
	return {
		probe,
		cleanup: async () => {
			await act(async () => root.unmount())
			client.clear()
		}
	}
}

test('gov tokens alone loads no TVL setting series, since it has none', async () => {
	const { probe, cleanup } = await renderTvlSettings({ govtokens: true }, ['TVL'])

	expect(http.urls()).not.toContain(EXTRA_TVL_URL)
	expect(probe.result?.loadingCharts).toEqual([])
	expect(probe.result?.totalValueUSD).toBe(100)
	await cleanup()
})

test('a chart without TVL does not wait for the TVL setting series', async () => {
	let release = () => {}
	http.serve({
		[`http://localhost:3000${getChainChartApiUrl('Chain Fees', 'Base')}`]: [[daySec, 1]],
		[EXTRA_TVL_URL]: () =>
			new Promise<Response>((resolve) => {
				release = () => resolve(fixtureStatus(502)())
			})
	})
	const { probe, cleanup } = await renderTvlSettings({ staking: true }, ['Chain Fees'])
	await waitForUi(() => expect(http.urls()).toContain(EXTRA_TVL_URL))

	expect(probe.result?.loadingCharts).not.toContain('TVL')
	release()
	await cleanup()
})

test('when the TVL setting series fail to load, TVL keeps the page default and reports the failure', async () => {
	http.serve({ [EXTRA_TVL_URL]: fixtureStatus(502, { error: 'Failed to load chain chart data' }) })
	const { probe, cleanup } = await renderTvlSettings({ staking: true }, ['TVL'])

	await waitForUi(() => expect(probe.result?.tvlSettingsFailed).toBe(true))
	expect(probe.result?.totalValueUSD).toBe(100)
	expect(probe.result?.loadingCharts).toEqual([])
	await cleanup()
})
