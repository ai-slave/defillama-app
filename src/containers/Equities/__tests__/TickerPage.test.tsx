// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
const session = installSubscriberSession('equity-ticker')
const downloads = installDownloadSink()
import type { EquitiesPriceHistory } from '../api.types'
import { EquityTickerPage } from '../TickerPage'
import { getAvailableEquityTabs } from '../tickerPageState'
import type { IEquityTickerPageProps } from '../types'

const router = {
	query: {} as Record<string, string>,
	pathname: '/equities/[ticker]',
	asPath: '/equities/NVDA:US',
	push: vi.fn()
}

vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('../FinancialsTable', () => ({ EquitiesFinancialsTable: () => null }))
vi.mock('../FilingsTable', () => ({ EquitiesFilingsTable: () => null }))
vi.mock('../OnchainTables', () => ({ EquitiesMarketsTable: () => null, EquitiesTokensTable: () => null }))
// The chart renderer is a heavy child; the exported CSV shows which prices the page charts.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const defaultHistory: EquitiesPriceHistory = [
	['2026-08-27T13:35:00Z', 223],
	['2026-08-27T13:30:00Z', 222]
]
const dailyHistory: EquitiesPriceHistory = [
	['2026-08-27', 225],
	['2026-08-26', 220]
]
const emptyStatement = {
	labels: [],
	children: { quarterly: {}, annual: {} },
	quarterly: { periodEnding: [], values: [], children: {} },
	annual: { periodEnding: [], values: [], children: {} }
}
const pageProps: IEquityTickerPageProps = {
	ticker: 'NVDA',
	country: 'US',
	slug: 'NVDA:US',
	name: 'NVIDIA',
	metadata: {
		ticker: 'NVDA',
		country: 'US',
		name: 'NVIDIA',
		sector: 'Technology',
		industry: 'Semiconductors',
		employeeCount: null,
		website: '',
		description: '',
		startDate: ''
	},
	summary: {
		currentPrice: null,
		volume: null,
		marketCap: null,
		circulatingMarketCap: null,
		enterpriseValue: null,
		fiftyTwoWeekHigh: null,
		fiftyTwoWeekLow: null,
		dividendYield: null,
		trailingPE: null,
		priceToRevenue: null,
		priceChangePercentage1d: null,
		priceChangePercentage7d: null,
		priceChangePercentage1m: null,
		priceChange1d: null,
		marketCapChange1d: null,
		priceToBook: null,
		enterpriseValueToEbitda: null,
		holdersYield: null,
		updatedAt: '2026-08-27T00:00:00Z',
		revenueTTM: null,
		grossProfitTTM: null,
		earningsTTM: null,
		ebitdaTTM: null,
		operatingProfitMarginTTM: null,
		holdersRevenueTTM: null,
		holderEarningsTTM: null,
		dividendsTTM: null,
		stockRepurchaseTTM: null,
		stockIssuanceTTM: null,
		stockBasedCompensationTTM: null,
		cashAndCashEquivalents: null,
		totalAssets: null,
		totalLiabilities: null,
		totalShareholdersEquity: null,
		totalDebt: null,
		circulatingSupply: null,
		totalSupply: null,
		employeeCount: null
	},
	priceHistory: defaultHistory,
	statements: { incomeStatement: emptyStatement, balanceSheet: emptyStatement, cashflow: emptyStatement },
	dimensions: {
		revenue: { quarterly: [], annual: [] },
		holdersRevenue: { quarterly: [], annual: [] },
		earnings: { quarterly: [], annual: [] },
		basicSharesOutstanding: { quarterly: [], annual: [] }
	},
	filings: [],
	filingForms: [],
	onchain: null,
	unlocksSlug: null
}

describe('EquityTickerPage availability', () => {
	test('keeps successful empty optional sources visible', () => {
		expect(getAvailableEquityTabs({ hasFilings: true, hasOnchain: true, hasUnlocks: false })).toEqual([
			'financials',
			'overview',
			'filings',
			'tokens',
			'markets'
		])
	})

	test('hides only unavailable optional sources', () => {
		expect(getAvailableEquityTabs({ hasFilings: false, hasOnchain: false, hasUnlocks: true })).toEqual([
			'financials',
			'overview',
			'unlocks'
		])
	})
})

describe('EquityTickerPage price history', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	beforeEach(() => {
		router.query = {}
		router.push.mockReset()
		session.serve({ '/api/public/equities/price-history': dailyHistory })
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

	async function render(props = pageProps) {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<QueryClientProvider client={client}>
						<EquityTickerPage {...props} />
					</QueryClientProvider>
				</session.Wrapper>
			)
		)
	}

	function button(label: string) {
		return [...container.querySelectorAll('button')].find((element) => element.textContent === label)!
	}

	const DAILY_CSV = 'Timestamp,Date,Close\n1787702400000,2026-08-26,220\n1787788800000,2026-08-27,225'
	const DEFAULT_CSV = 'Timestamp,Date,Close\n1787837400000,2026-08-27,222\n1787837700000,2026-08-27,223'

	async function waitForExportedCsv(expected: string) {
		await waitForUi(async () => {
			await act(async () => {})
			expect(button('.csv').disabled).toBe(false)
		})
		await act(async () => button('.csv').click())
		expect(await downloads.at(-1)!.blob.text()).toContain(expected)
	}

	function priceHistoryRequests() {
		return session.requests
			.filter((request) => request.url.pathname === '/api/public/equities/price-history')
			.map((request) => request.url.searchParams.get('timeframe'))
	}

	test('section focus does not navigate; URL changes select the panel without another route write', async () => {
		router.query = { tab: 'overview', country: 'US' }
		await render()
		const overview = button('Overview')
		const financials = button('Financials')
		expect(overview.getAttribute('aria-selected')).toBe('true')
		await act(async () => overview.focus())
		await act(async () => {
			overview.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }))
			await new Promise((resolve) => setTimeout(resolve, 30))
		})
		expect(document.activeElement).toBe(financials)
		expect(router.push).not.toHaveBeenCalled()
		await act(async () => {
			financials.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
		})
		expect(router.push).toHaveBeenCalledExactlyOnceWith(
			{ pathname: '/equities/NVDA:US', query: { country: 'US' } },
			undefined,
			{ shallow: true }
		)
		router.push.mockClear()
		// Back/forward supplies a new query; focus changes must never write over it.
		router.query = { tab: 'financials' }
		await render()
		const panel = container.querySelector('[role="tabpanel"]')!
		expect(panel.getAttribute('aria-labelledby')).toBe(financials.id)
		expect(financials.getAttribute('aria-controls')).toBe(panel.id)
		router.query = { tab: 'unlocks' }
		await render({ ...pageProps, unlocksSlug: null })
		expect(financials.getAttribute('aria-selected')).toBe('true')
		expect(router.push).not.toHaveBeenCalled()
	})

	test.each(['7D', 'MAX'])('fetches a bookmarked %s timeframe through the proxy', async (timeframe) => {
		router.query = { timeframe }
		await render()
		await waitForExportedCsv(DAILY_CSV)

		expect(priceHistoryRequests()).toEqual([timeframe])
	})

	test('uses generated default prices and fetches other ranges without mixing cached data', async () => {
		const pending = Promise.withResolvers<EquitiesPriceHistory>()
		session.serve({ '/api/public/equities/price-history': () => pending.promise })
		await render()
		await waitForExportedCsv(DEFAULT_CSV)
		expect(downloads.at(-1)?.filename).toContain('nvda-price-history-24h')
		expect(priceHistoryRequests()).toEqual([])

		await act(async () => container.querySelector<HTMLInputElement>('input[type="radio"][value="1M"]')!.click())
		expect(router.push).toHaveBeenCalledWith({ pathname: '/equities/NVDA:US', query: { timeframe: '1M' } }, undefined, {
			shallow: true
		})
		router.query = { timeframe: '1M' }
		await render()
		expect(container.textContent).toContain('Loading price history')
		expect(button('.csv').disabled).toBe(true)
		expect(button('.png').disabled).toBe(true)
		await act(async () => button('.csv').click())
		expect(downloads).toHaveLength(1)

		await act(async () => pending.resolve(dailyHistory))
		await waitForExportedCsv(DAILY_CSV)
		expect(downloads.at(-1)?.filename).toContain('nvda-price-history-1m')

		router.query = {}
		await render()
		await waitForExportedCsv(DEFAULT_CSV)
		router.query = { timeframe: '1M' }
		await render()
		await waitForExportedCsv(DAILY_CSV)
		expect(priceHistoryRequests()).toEqual(['1M'])
	})

	test.each(['empty', 'error'])(
		'keeps timeframe controls after an %s response without showing default data',
		async (result) => {
			router.query = { timeframe: 'MAX' }
			session.serve({
				'/api/public/equities/price-history': () => (result === 'empty' ? [] : new Response(null, { status: 404 }))
			})
			await render()
			await waitForUi(async () => {
				await act(async () => {})
				// Empty says so without an alert; a failure is an alert, never the empty line.
				expect([container.textContent.includes('No price history available'), alertTexts(container).length]).toEqual(
					result === 'empty' ? [true, 0] : [false, 1]
				)
			})
			expect(container.textContent).not.toContain('Loading price history')
			expect(container.textContent).toContain('24H')
			expect(button('.csv').disabled).toBe(true)
			router.query = {}
			await render()
			await waitForExportedCsv(DEFAULT_CSV)
		}
	)

	test('recovers through the proxy when the default history failed during page generation', async () => {
		session.serve({ '/api/public/equities/price-history': defaultHistory })
		await render({ ...pageProps, priceHistory: null })
		await waitForExportedCsv(DEFAULT_CSV)
		expect(priceHistoryRequests()).toEqual(['24H'])
	})

	test('keeps a successful empty default response without refetching and allows another timeframe', async () => {
		await render({ ...pageProps, priceHistory: [] })
		expect(container.textContent).toContain('No price history available')
		expect(priceHistoryRequests()).toEqual([])
		router.query = { timeframe: '1M' }
		await render({ ...pageProps, priceHistory: [] })
		await waitForExportedCsv(DAILY_CSV)
		expect(priceHistoryRequests()).toEqual(['1M'])
	})
})
