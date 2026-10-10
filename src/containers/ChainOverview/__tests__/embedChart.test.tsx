// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ChainChartPage from '~/pages/chart/chain/[chain]'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { IChainOverviewData } from '../types'

vi.mock('next/router', () => ({
	useRouter: () => ({
		isReady: true,
		asPath: '/chart/chain/ethereum?include_staking_in_tvl=true',
		pathname: '/chart/chain/[chain]',
		query: { chain: 'ethereum', include_staking_in_tvl: 'true' },
		push: vi.fn()
	})
}))
// The ECharts renderer cannot draw in happy-dom, and the test asserts nothing about its output.
vi.mock('~/containers/ChainOverview/Chart', () => ({ default: () => null }))

const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement

beforeEach(() => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const dayMs = Date.UTC(2026, 6, 14)
const props = {
	chain: 'Ethereum',
	metadata: { name: 'Ethereum', id: 'ethereum' },
	charts: ['TVL'],
	chainTokenInfo: null,
	tvlChart: [[dayMs, 100]],
	tvlChartSummary: {
		totalValueUSD: 100,
		tvlPrevDay: null,
		valueChange24hUSD: null,
		change24h: null,
		computedAtMs: dayMs
	}
} as unknown as Omit<IChainOverviewData, 'extraTvlCharts'>

test('an embed whose requested TVL settings fail to load says the chart leaves them out', async () => {
	http.serve({
		'http://localhost:3000/api/public/chains/charts?kind=extra-tvl&chain=Ethereum': fixtureStatus(502, {
			error: 'Failed to load chain chart data'
		})
	})

	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<ChainChartPage {...props} />
			</QueryClientProvider>
		)
	)

	await waitForUi(() =>
		expect(alertTexts(container)).toEqual(["Couldn't load your TVL settings. TVL leaves them out."])
	)
})
