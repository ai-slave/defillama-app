// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { downloadCSV } from '~/utils/download'
import type { EquitiesPriceHistory } from '../api.types'
import { fetchEquitiesPriceHistoryFromProxy } from '../priceHistoryClient'
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
vi.mock('../priceHistoryClient', () => ({ fetchEquitiesPriceHistoryFromProxy: vi.fn() }))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => null }))
vi.mock('~/components/WebsiteGlobeLink', () => ({ WebsiteGlobeLink: () => null }))
vi.mock('../FinancialsTable', () => ({ EquitiesFinancialsTable: () => null }))
vi.mock('../FilingsTable', () => ({ EquitiesFilingsTable: () => null }))
vi.mock('../OnchainTables', () => ({ EquitiesMarketsTable: () => null, EquitiesTokensTable: () => null }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: ({ dataset }: { dataset: MultiSeriesChartDataset }) => (
		<output data-chart={dataset.dimensions[1]}>{JSON.stringify(dataset.source.map((point) => point[1]))}</output>
	)
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, hasActiveSubscription: true })
}))
vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false] }))
vi.mock('~/utils/download', () => ({ downloadCSV: vi.fn(), downloadDataURL: vi.fn() }))

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
	const fetchHistory = vi.mocked(fetchEquitiesPriceHistoryFromProxy)

	beforeEach(() => {
		router.query = {}
		router.push.mockReset()
		fetchHistory.mockReset()
		vi.mocked(downloadCSV).mockClear()
		fetchHistory.mockResolvedValue(dailyHistory)
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
				<QueryClientProvider client={client}>
					<EquityTickerPage {...props} />
				</QueryClientProvider>
			)
		)
	}

	function chart() {
		return container.querySelector('[data-chart="Close"]')
	}

	function button(label: string) {
		return [...container.querySelectorAll('button')].find((element) => element.textContent === label)!
	}

	async function waitForPrices(values: Array<number>) {
		await vi.waitFor(async () => {
			await act(async () => {})
			expect(JSON.parse(chart()?.textContent ?? 'null')).toEqual(values)
		})
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
		await waitForPrices([220, 225])

		expect(fetchHistory).toHaveBeenCalledExactlyOnceWith('NVDA', 'US', timeframe)
	})

	test('uses generated default prices and fetches other ranges without mixing cached data', async () => {
		const pending = Promise.withResolvers<EquitiesPriceHistory>()
		fetchHistory.mockReturnValue(pending.promise)
		await render()
		await waitForPrices([222, 223])
		expect(fetchHistory).not.toHaveBeenCalled()
		const csvButton = button('.csv')
		const pngButton = button('.png')
		await act(async () => csvButton.click())
		expect(downloadCSV).toHaveBeenLastCalledWith(
			expect.stringContaining('nvda-price-history-24h'),
			[
				['Timestamp', 'Date', 'Close'],
				[Date.parse('2026-08-27T13:30:00Z'), '2026-08-27', 222],
				[Date.parse('2026-08-27T13:35:00Z'), '2026-08-27', 223]
			],
			{ addTimestamp: false }
		)
		await act(async () => pngButton.click())
		await vi.waitFor(async () => {
			await act(async () => {})
			expect(document.querySelector('[data-umami-event="export-image"]')).not.toBeNull()
		})

		await act(async () => container.querySelector<HTMLInputElement>('input[type="radio"][value="1M"]')!.click())
		expect(router.push).toHaveBeenCalledWith({ pathname: '/equities/NVDA:US', query: { timeframe: '1M' } }, undefined, {
			shallow: true
		})
		router.query = { timeframe: '1M' }
		await render()
		expect(container.querySelector('[aria-label="Loading price history"]')).not.toBeNull()
		expect(chart()).toBeNull()
		expect(button('.csv')).toBe(csvButton)
		expect(button('.png')).toBe(pngButton)
		expect(csvButton.disabled).toBe(true)
		expect(pngButton.disabled).toBe(true)
		expect(document.querySelector<HTMLButtonElement>('[data-umami-event="export-image"]')!.disabled).toBe(true)
		expect(document.querySelector<HTMLButtonElement>('[data-umami-event="copy-image"]')!.disabled).toBe(true)
		await act(async () => csvButton.click())
		expect(downloadCSV).toHaveBeenCalledTimes(1)

		await act(async () => pending.resolve(dailyHistory))
		await waitForPrices([220, 225])
		expect(csvButton.disabled).toBe(false)
		expect(pngButton.disabled).toBe(false)
		await act(async () => button('.csv').click())
		expect(downloadCSV).toHaveBeenLastCalledWith(
			expect.stringContaining('nvda-price-history-1m'),
			[
				['Timestamp', 'Date', 'Close'],
				[Date.parse('2026-08-26'), '2026-08-26', 220],
				[Date.parse('2026-08-27'), '2026-08-27', 225]
			],
			{ addTimestamp: false }
		)
		router.query = {}
		await render()
		await waitForPrices([222, 223])
		router.query = { timeframe: '1M' }
		await render()
		await waitForPrices([220, 225])
		expect(fetchHistory).toHaveBeenCalledExactlyOnceWith('NVDA', 'US', '1M')
	})

	test.each(['empty', 'error'])(
		'keeps timeframe controls after an %s response without showing default data',
		async (result) => {
			router.query = { timeframe: 'MAX' }
			if (result === 'empty') fetchHistory.mockResolvedValue([])
			else fetchHistory.mockRejectedValue(new Error('upstream unavailable'))
			await render()
			await vi.waitFor(async () => {
				await act(async () => {})
				expect(container.textContent).toContain(
					result === 'empty' ? 'No price history available' : 'Failed to load price history'
				)
			})
			expect(chart()).toBeNull()
			expect(container.querySelector('[aria-label="Loading price history"]')).toBeNull()
			expect(container.textContent).toContain('24H')
			expect(button('.csv').disabled).toBe(true)
			expect(button('.png').disabled).toBe(true)
			router.query = {}
			await render()
			await waitForPrices([222, 223])
			expect(button('.csv').disabled).toBe(false)
			expect(button('.png').disabled).toBe(false)
		}
	)

	test('recovers through the proxy when the default history failed during page generation', async () => {
		fetchHistory.mockResolvedValue(defaultHistory)
		await render({ ...pageProps, priceHistory: null })
		await waitForPrices([222, 223])
		expect(fetchHistory).toHaveBeenCalledExactlyOnceWith('NVDA', 'US', '24H')
	})

	test('keeps a successful empty default response without refetching and allows another timeframe', async () => {
		await render({ ...pageProps, priceHistory: [] })
		expect(container.textContent).toContain('No price history available')
		expect(fetchHistory).not.toHaveBeenCalled()
		router.query = { timeframe: '1M' }
		await render({ ...pageProps, priceHistory: [] })
		await waitForPrices([220, 225])
		expect(fetchHistory).toHaveBeenCalledExactlyOnceWith('NVDA', 'US', '1M')
	})
})
