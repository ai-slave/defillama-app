// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { PriceChartTimeframe } from '~/utils/priceChartTimeframes'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { TokenOverviewChartLabel, TokenOverviewData } from '../tokenOverview'
import { useFetchTokenOverviewChartData } from '../useFetchTokenOverviewChartData'
const http = installFixtureFetch()

const overview: TokenOverviewData = {
	categories: [],
	website: null,
	twitter: null,
	telegram: null,
	discord: null,
	name: 'Bitcoin',
	displayName: 'Bitcoin',
	symbol: 'BTC',
	marketData: {
		currentPrice: 100,
		percentChange24h: null,
		ath: null,
		athDate: null,
		atl: null,
		atlDate: null,
		circulatingSupply: null,
		totalSupply: null,
		maxSupply: null,
		mcap: null,
		fdv: null,
		volume24h: { total: null, cex: null, dex: null }
	},
	treasury: null,
	raises: null,
	outstandingFDV: null,
	rawChartData: { 'Token Price': [[1000, 100]] }
}

function ChartDataProbe({ timeframe }: { timeframe: PriceChartTimeframe }) {
	const { rawChartData } = useFetchTokenOverviewChartData({
		geckoId: 'bitcoin',
		overview,
		activeCharts: ['Token Price'],
		timeframe,
		enabled: true
	})

	return <output>{JSON.stringify(rawChartData)}</output>
}

describe('useFetchTokenOverviewChartData', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	beforeEach(() => {
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		client.clear()
		container.remove()
	})

	async function render(timeframe: PriceChartTimeframe) {
		await act(async () => {
			root.render(
				<QueryClientProvider client={client}>
					<ChartDataProbe timeframe={timeframe} />
				</QueryClientProvider>
			)
		})
	}

	test('uses only 24H page data and isolates proxy results by timeframe', async () => {
		const rangeRequest = Promise.withResolvers<{ data: { prices: Array<[number, number]> } }>()
		http.serve({ '/api/public/tokens/charts/coingecko/bitcoin': () => rangeRequest.promise })

		await render('24H')
		expect(JSON.parse(container.textContent ?? '')).toEqual({ 'Token Price': [[1000, 100]] })
		expect(http.requests).toHaveLength(0)

		await render('7D')
		expect(JSON.parse(container.textContent ?? '')).toEqual({})
		expect(http.requests.map(({ url }) => url.searchParams.get('timeframe'))).toEqual(['7D'])

		await act(async () => rangeRequest.resolve({ data: { prices: [[2_000_000_000_000, 200]] } }))
		await waitForUi(async () => {
			await act(async () => {})
			expect(JSON.parse(container.textContent ?? '')).toEqual({ 'Token Price': [[2_000_000_000_000, 200]] })
		})

		await render('24H')
		expect(JSON.parse(container.textContent ?? '')).toEqual({ 'Token Price': [[1000, 100]] })
		expect(http.requests).toHaveLength(1)
	})

	test('a failed supply read stops counting once FDV is no longer charted', async () => {
		http.serve({
			'/api/public/tokens/charts/coingecko/bitcoin': (url: URL) =>
				url.searchParams.get('kind') === 'supply'
					? new Response('', { status: 500 })
					: { data: { prices: [[2_000_000_000_000, 200]] } }
		})
		let failedRead: ReturnType<typeof useFetchTokenOverviewChartData>['failedRead'] = null
		function FailedReadProbe({ activeCharts }: { activeCharts: Array<TokenOverviewChartLabel> }) {
			failedRead = useFetchTokenOverviewChartData({
				geckoId: 'bitcoin',
				overview,
				activeCharts,
				timeframe: '7D',
				enabled: true
			}).failedRead
			return null
		}
		const show = (activeCharts: Array<TokenOverviewChartLabel>) =>
			act(async () => {
				root.render(
					<QueryClientProvider client={client}>
						<FailedReadProbe activeCharts={activeCharts} />
					</QueryClientProvider>
				)
			})

		await show(['FDV'])
		await waitForUi(() => expect(failedRead).not.toBeNull())

		await show(['Mcap'])
		expect(failedRead).toBeNull()
	})
})
