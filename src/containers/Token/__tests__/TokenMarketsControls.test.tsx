// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { MarketPair, TokenMarketsResponse } from '~/containers/Markets/api.types'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { TokenMarketsSection } from '../TokenMarketsSection'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/token/[token]', push: vi.fn() }) }))
// The order-book chart is an ECharts child the assertions never read.
vi.mock('~/containers/Exchanges/TokenDepthChart', () => ({ TokenDepthChart: () => null }))
// Render the real table eagerly instead of through its lazy chunk.
vi.mock('../deferred/DeferredTokenMarketsTable', async () => ({
	DeferredTokenMarketsTable: (await import('../TokenMarketsTable')).TokenMarketsTable
}))

const http = installFixtureFetch()

function marketPair(slug: string, displayName: string, volume24h: number): MarketPair {
	return {
		slug,
		display_name: displayName,
		type: 'cex',
		market_type: 'spot',
		contract_type: '',
		base: 'btc',
		quote: 'usdt',
		base_coingecko_id: 'bitcoin',
		quote_coingecko_id: 'tether',
		settle_asset: '',
		pair_id: 'BTCUSDT',
		market_id: `${slug}:cex:spot:btcusdt`,
		pair_url: `https://example.com/${slug}/btcusdt`,
		symbol: 'btc/usdt',
		price: 62_900,
		mark_price: null,
		index_price: null,
		price_change_24h: -0.0156,
		volume_24h: volume24h,
		volume_prev_24h: volume24h * 0.9,
		volume_change_24h: 1 / 9,
		oi: null,
		oi_usd: null,
		oi_prev_usd: null,
		oi_change_24h: null,
		funding_rate_8h: null,
		funding_period_h: null,
		next_funding_ts: null,
		max_leverage: null,
		maker_fee: null,
		taker_fee: null,
		amount_precision: null,
		price_precision: null,
		contract_size: 1,
		expiry_ts: null,
		listed_ts: null,
		min_order_cost: null,
		best_bid: 62_899,
		best_ask: 62_901,
		depth_bid_usd: [100, 200],
		depth_ask_usd: [300, 400],
		depth_bid_max_dist: 0.03,
		depth_ask_max_dist: 0.04,
		nvol: {
			reported: volume24h,
			normalized: volume24h * 0.8,
			active_liquidity: 1_000_000,
			active_liquidity_measured: 1_000_000,
			band: 0.05,
			daily_vol: 0.03,
			coverage: 0.03,
			status: 'covered',
			category: 'normal',
			flag: null
		},
		freshness: { volume: '2026-07-17T09:17:00.000Z', oi: null, funding: null, depth: null }
	}
}

const totals = {
	spot: { pair_count: 2, total_volume_24h: 110, total_oi_usd: null },
	linear_perp: { pair_count: 1, total_volume_24h: 100, total_oi_usd: 100 },
	inverse_perp: { pair_count: 1, total_volume_24h: 50, total_oi_usd: 100 }
}
const data: TokenMarketsResponse = {
	symbol: 'BTC',
	last_updated: '',
	depth_bands: [0.01, 0.02],
	exchange_count: 4,
	market_count: 6,
	segments: {},
	tags: [],
	total_oi_usd: 200,
	total_volume_24h: 370,
	cex: {
		spot: [marketPair('binance', 'Binance', 100), marketPair('bybit', 'Bybit', 10)],
		linear_perp: [marketPair('bybit', 'Bybit', 100)],
		inverse_perp: [marketPair('bybit', 'Bybit', 50)]
	},
	dex: {
		spot: [
			{ ...marketPair('uniswap', 'Uniswap', 20), type: 'dex' },
			{ ...marketPair('curve', 'Curve', 90), type: 'dex' }
		],
		linear_perp: [],
		inverse_perp: []
	},
	totals: { cex: totals, dex: totals }
}
let container: HTMLDivElement
let root: Root
let client: QueryClient
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	http.serve({ '/api/public/exchanges/execution-slippage': { venues: {} } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	// Page data seeds the markets query, so the section never fetches it.
	client.setQueryData(['token-markets', 'bitcoin'], data)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})

function radio(group: string, value: string) {
	return container.querySelector<HTMLInputElement>(
		`[role="radiogroup"][aria-label="${group}"] input[value="${value}"]`
	)!
}
const search = () => container.querySelector<HTMLInputElement>('[placeholder="Search exchanges..."]')
async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
	})
}

test('arrow keys move through market filters without losing focus while the table resets', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<TokenMarketsSection geckoId="bitcoin" tokenSymbol="BTC" />
			</QueryClientProvider>
		)
	)
	const all = radio('Market venue', 'all')
	const spot = radio('Market category', 'spot')
	expect(all.checked).toBe(true)
	expect(spot.checked).toBe(true)
	expect(all.name).not.toBe(spot.name)

	await act(async () => {
		search()!.value = 'binance'
		search()!.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await press(spot, 'ArrowRight')
	const perp = radio('Market category', 'linear_perp')
	expect(document.activeElement).toBe(perp)
	expect(perp.checked).toBe(true)
	expect(all.checked).toBe(true)
	expect(search()!.value).toBe('')

	await press(perp, 'Home')
	expect(document.activeElement).toBe(spot)
	expect(spot.checked).toBe(true)

	await press(all, 'End')
	expect(document.activeElement).toBe(radio('Market venue', 'dex'))
	expect(radio('Market venue', 'dex').checked).toBe(true)
})

test('shows open interest and funding only on perps and hides normalized volume on inverse perps', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<TokenMarketsSection geckoId="bitcoin" tokenSymbol="BTC" />
			</QueryClientProvider>
		)
	)
	const headers = () => [...container.querySelectorAll('thead th')].map((th) => th.textContent).join(' | ')
	const showCategory = (category: string) => act(async () => radio('Market category', category).click())

	expect(headers()).toContain('Norm Volume')
	expect(headers()).not.toContain('Open Interest')
	expect(headers()).not.toContain('Funding 8h')

	await showCategory('linear_perp')
	expect(headers()).toContain('Norm Volume')
	expect(headers()).toContain('Open Interest')
	expect(headers()).toContain('Funding 8h')

	await showCategory('inverse_perp')
	expect(headers()).not.toContain('Norm Volume')
	expect(headers()).toContain('Open Interest')
	expect(headers()).toContain('Funding 8h')
})
