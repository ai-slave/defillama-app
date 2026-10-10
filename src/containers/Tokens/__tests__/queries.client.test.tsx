// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TokensWatchlistContainer } from '~/containers/TokensWatchlist'
import { waitForUi } from '~/utils/testing/waitForUi'
import { fetchTokensResponse } from '../queries.client'
import { buildTokensSortIndexes, getTokensPageFromRows } from '../utils'

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({ fetchJson }))
// Heavy children the watchlist mounts; nothing below reads their output.
vi.mock('~/components/NewPortfolioDialog', () => ({ NewPortfolioDialog: () => null }))
vi.mock('~/components/Menu', () => ({ Menu: () => null }))
vi.mock('~/components/Select/SelectWithCombobox', () => ({ SelectWithCombobox: () => null }))
vi.mock('~/containers/Yields/views/WatchlistView', () => ({ WatchListTabs: () => null }))
vi.mock('~/containers/Token/TokenMarketsSection', () => ({ TokenMarketsSection: () => null }))

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
let root: Root
let element: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	fetchJson.mockReset()
	localStorage.setItem('DEFILLAMA', JSON.stringify({ TOKENS_WATCHLIST: { main: { bitcoin: 'bitcoin' } } }))
	client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
	element = document.createElement('div')
	document.body.appendChild(element)
	root = createRoot(element)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	element.remove()
	localStorage.clear()
})
async function render(child: ReactNode) {
	await act(async () => root.render(<QueryClientProvider client={client}>{child}</QueryClientProvider>))
}
async function expectShows(text: string) {
	await waitForUi(async () => {
		await act(async () => {})
		expect(element.textContent).toContain(text)
	})
}

describe('fetchTokensResponse', () => {
	const signal = new AbortController().signal

	test('rejects a response from an older deployment and accepts a current one, even with no rows', async () => {
		fetchJson.mockResolvedValue({ schemaVersion: 13, rows: [] })
		await expect(fetchTokensResponse('/api/public/tokens', signal)).rejects.toThrow('Token data is updating')
		fetchJson.mockResolvedValue(page)
		await expect(fetchTokensResponse('/api/public/tokens', signal)).resolves.toBe(page)
	})
})

describe('Tokens watchlist', () => {
	test('shows a retryable watchlist failure for an old response, then recovers without losing saved tokens', async () => {
		fetchJson.mockImplementation(async (url: string) =>
			url === '/api/public/markets/tokens' ? { last_updated: '', tokens: [] } : { schemaVersion: 13, rows: [] }
		)
		await render(<TokensWatchlistContainer tokenUniverse={[]} />)
		await expectShows('Token data is unavailable')
		expect(element.textContent).not.toContain('No tokens in your watchlist')
		fetchJson.mockResolvedValue(page)
		const retry = Array.from(element.querySelectorAll('button')).find((button) => button.textContent === 'Try again')
		if (!retry) throw new Error('Missing retry button')
		await act(async () => retry.click())
		await expectShows('No ranking data for your saved tokens')
		expect(element.querySelector('[role="alert"]')).toBeNull()
	})
})
