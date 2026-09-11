// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TokensWatchlistContainer } from '~/containers/TokensWatchlist'
import { useTokensChartDataset, useTokensPaginatedTable, useWatchlistTokensTable } from '../queries.client'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensChartResponse } from '../types'
import { buildTokensSortIndexes, getTokensPageFromRows } from '../utils'

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({ fetchJson }))
vi.mock('~/hooks/useBookmarks', () => ({
	useBookmarks: () => ({
		selectedPortfolio: 'Main',
		portfolios: ['Main'],
		savedProtocols: new Set(['bitcoin']),
		isLoadingWatchlist: false
	})
}))
vi.mock('~/contexts/LocalStorage', () => ({ DEFAULT_PORTFOLIO_NAME: 'Main' }))
vi.mock('~/components/DialogForm', () => ({ DialogForm: () => null }))
vi.mock('~/components/Menu', () => ({ Menu: () => null }))
vi.mock('~/components/Select/SelectWithCombobox', () => ({ SelectWithCombobox: () => null }))
vi.mock('~/containers/Yields/views/WatchlistView', () => ({ WatchListTabs: () => null }))
vi.mock('~/containers/Token/TokenMarketsSection', () => ({ TokenMarketsSection: () => null }))
vi.mock('~/containers/Tokens', () => ({
	EXPANDABLE_TOKENS_COLUMNS: [],
	getRankColumnWidth: () => 40,
	TOKENS_MARKETS_EXPANDER_COLUMN_WIDTH: 40,
	TOKENS_TABLE_WIDTH_EXCLUDING_RANK: 400
}))

const page = getTokensPageFromRows(
	[],
	buildTokensSortIndexes([]),
	{},
	{
		snapshotVersion: null,
		unavailableSources: [],
		updatedAt: null,
		chainOptions: [],
		categoryOptions: [],
		stats: {
			totalMarketCap: 0,
			marketCapWeightedChange24h: null,
			spotVolume24h: 0,
			perpsVolume24h: 0,
			openInterest24h: 0,
			unlock30dUsd: 0,
			upcomingUnlockUsd: 0
		}
	}
)
const chart: TokensChartResponse = {
	schemaVersion: TOKENS_PAGE_RESPONSE_SCHEMA_VERSION,
	unavailableSources: [],
	names: [],
	symbols: [],
	logoSources: [],
	hrefs: [],
	marketCaps: [],
	priceChanges: { '24h': [], '7d': [], '30d': [] },
	stablecoins: []
}
function TableProbe() {
	const result = useTokensPaginatedTable('?page=2', page)
	return <output>{result.isError ? 'error' : result.data ? result.data.stats.spotVolume24h : 'loading'}</output>
}
function WatchlistProbe() {
	const result = useWatchlistTokensTable(['bitcoin'])
	return (
		<output>
			{result.isError
				? 'error'
				: result.data
					? `${result.data.unavailableSources.filter(Boolean).join(',')}:${result.data.stats.spotVolume24h}`
					: 'loading'}
		</output>
	)
}
function ChartProbe() {
	const result = useTokensChartDataset('')
	return (
		<output>
			{result.isError
				? 'error'
				: result.data
					? `${result.data.unavailableSources.join(',')}:${result.data.marketCaps.length}`
					: 'loading'}
		</output>
	)
}

let root: Root
let element: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	fetchJson.mockReset()
	client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
	element = document.createElement('div')
	document.body.appendChild(element)
	root = createRoot(element)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	element.remove()
})
async function render(child: ReactNode) {
	await act(async () => root.render(<QueryClientProvider client={client}>{child}</QueryClientProvider>))
}
async function expectShows(text: string) {
	await vi.waitFor(async () => {
		await act(async () => {})
		expect(element.textContent).toContain(text)
	})
}

describe('Tokens response deployment compatibility', () => {
	test.each([
		['table', TableProbe],
		['watchlist', WatchlistProbe],
		['chart', ChartProbe]
	] as const)('rejects old %s responses before consuming new fields', async (_name, Probe) => {
		// An old deployed wire response deliberately has no availability field.
		fetchJson.mockResolvedValue({ schemaVersion: 13, rows: [], marketCaps: [] })
		await render(<Probe />)
		await expectShows('error')
		for (const [url] of fetchJson.mock.calls) {
			expect(new URL(url, 'http://localhost').searchParams.get('schemaVersion')).toBe(
				String(TOKENS_PAGE_RESPONSE_SCHEMA_VERSION)
			)
		}
	})
	test('retains measured zero and successful empty responses', async () => {
		fetchJson.mockResolvedValue(page)
		await render(<WatchlistProbe />)
		await expectShows(':0')
		expect(client.getQueryCache().getAll()[0]?.state.status).toBe('success')
	})
	test('accepts current chart availability with an empty dataset', async () => {
		fetchJson.mockResolvedValue({ ...chart, unavailableSources: ['unlocks'] })
		await render(<ChartProbe />)
		await expectShows('unlocks:0')
	})
	test('shows a retryable watchlist failure for an old response, then recovers without losing saved tokens', async () => {
		fetchJson.mockImplementation(async (url: string) =>
			url === '/api/public/markets/tokens' ? { last_updated: '', tokens: [] } : { schemaVersion: 13, rows: [] }
		)
		await render(<TokensWatchlistContainer tokenUniverse={[]} />)
		await expectShows('Token data is unavailable')
		expect(element.textContent).not.toContain('No tokens in your watchlist')
		fetchJson.mockResolvedValue(page)
		const retry = Array.from(element.querySelectorAll('button')).find((button) => button.textContent === 'Retry')
		if (!retry) throw new Error('Missing retry button')
		await act(async () => retry.click())
		await expectShows('No ranking data for your saved tokens')
		expect(element.querySelector('[role="alert"]')).toBeNull()
	})
})
