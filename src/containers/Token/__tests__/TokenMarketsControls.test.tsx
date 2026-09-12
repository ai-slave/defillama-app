// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactTable } from '@tanstack/react-table'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import type { PairTableRow } from '~/containers/Exchanges/PairTable'
import type { MarketPair, TokenMarketsResponse } from '~/containers/Markets/api.types'
import { fetchTokenMarkets } from '../api'
import { TokenMarketsSection } from '../TokenMarketsSection'

vi.mock('../api', () => ({ fetchTokenMarkets: vi.fn() }))
vi.mock('~/containers/Exchanges/ExchangeAccessGate', () => ({
	ExchangeFeatureGate: () => null,
	useExchangeAccessState: () => 'unauthorized'
}))
vi.mock('../deferred/DeferredPairTable', async () => ({
	DeferredPairTable: (await import('~/containers/Exchanges/PairTable')).PairTable
}))
vi.mock('~/components/CsvDownloadButton', () => ({ CSVDownloadButton: () => <button type="button">Export</button> }))
vi.mock('~/components/Select/SelectWithCombobox', () => ({ SelectWithCombobox: () => null }))
vi.mock('~/components/Table/Table', () => ({
	VirtualTable: ({ table: instance }: { table: ReactTable<SearchTableFeatures, PairTableRow> }) => (
		<div
			data-table
			data-sort={JSON.stringify(instance.state.sorting)}
			data-columns={instance
				.getVisibleLeafColumns()
				.map((column) => column.id)
				.join(',')}
		>
			<button type="button" onClick={() => instance.getColumn('volume24h')!.toggleSorting(false)}>
				Sort ascending
			</button>
			<button type="button" onClick={() => instance.getColumn('price')!.toggleVisibility(false)}>
				Hide price
			</button>
			<output>
				{instance
					.getRowModel()
					.rows.map((row) => row.original.venue)
					.join(',')}
			</output>
		</div>
	)
}))

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
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	client.setQueryData(['token-markets', 'bitcoin'], data)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})
async function render(variant: 'section' | 'embedded') {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<TokenMarketsSection geckoId="bitcoin" tokenSymbol="BTC" variant={variant} />
			</QueryClientProvider>
		)
	)
}
function radio(group: string, value: string) {
	return container.querySelector<HTMLInputElement>(
		`[role="radiogroup"][aria-label="${group}"] input[value="${value}"]`
	)!
}
async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
async function click(element: HTMLElement) {
	await act(async () => element.click())
}
async function refresh(next: TokenMarketsResponse) {
	await act(async () => {
		client.setQueryData(['token-markets', 'bitcoin'], next)
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}

test.each(['section', 'embedded'] as const)('%s keeps filter focus while resetting table state', async (variant) => {
	await render(variant)
	const all = radio('Market venue', 'all')
	const cex = radio('Market venue', 'cex')
	const spot = radio('Market category', 'spot')
	const perp = radio('Market category', 'linear_perp')
	expect(all.checked).toBe(true)
	expect(spot.checked).toBe(true)
	expect(all.name).not.toBe(spot.name)
	expect(container.querySelector('[role="tablist"]')).toBeNull()
	expect(container.querySelector('output')!.textContent).toBe('Bybit,Binance,Curve,Uniswap')
	const search = container.querySelector<HTMLInputElement>('[placeholder="Search exchanges..."]')!
	const table = container.querySelector('[data-table]')!
	await act(async () => {
		search.value = 'no matching exchange'
		search.dispatchEvent(new Event('input', { bubbles: true }))
		container.querySelector<HTMLButtonElement>('[data-table] button')!.click()
		container.querySelectorAll<HTMLButtonElement>('[data-table] button')[1].click()
	})
	expect(container.querySelector('output')!.textContent).toBe('')
	expect(table.getAttribute('data-sort')).toContain('"desc":false')
	expect(table.getAttribute('data-columns')!.split(',')).not.toContain('price')
	await press(spot, 'ArrowRight')
	expect(document.activeElement).toBe(perp)
	expect(radio('Market category', 'linear_perp')).toBe(perp)
	expect(perp.checked).toBe(true)
	expect(spot.checked).toBe(false)
	expect(all.checked).toBe(true)
	expect(container.querySelector('[data-table]')).not.toBe(table)
	expect(container.querySelector<HTMLInputElement>('[placeholder="Search exchanges..."]')!.value).toBe('')
	expect(container.querySelector('[data-table]')!.getAttribute('data-sort')).toBe('[]')
	expect(container.querySelector('[data-table]')!.getAttribute('data-columns')!.split(',')).toContain('price')
	await press(perp, 'Home')
	expect(document.activeElement).toBe(spot)
	expect(spot.checked).toBe(true)
	await press(all, 'ArrowRight')
	expect(document.activeElement).toBe(cex)
	expect(cex.checked).toBe(true)
	expect(container.querySelector('output')!.textContent).toBe('Bybit,Binance')
	await press(cex, 'End')
	expect(radio('Market venue', 'dex').checked).toBe(true)
	expect(container.querySelector('[data-table]')!.getAttribute('data-sort')).toBe('[{"id":"volume24h","desc":true}]')
	expect(container.querySelector('output')!.textContent).toBe('Curve,Uniswap')
	expect(fetchTokenMarkets).not.toHaveBeenCalled()
})

test.each(['section', 'embedded'] as const)(
	'%s restores the preferred category when it becomes available again',
	async (variant) => {
		await render(variant)
		await press(radio('Market category', 'spot'), 'End')
		expect(radio('Market category', 'inverse_perp').checked).toBe(true)
		await click(radio('Market venue', 'dex'))
		expect(radio('Market category', 'inverse_perp')).toBeNull()
		expect(radio('Market category', 'spot').checked).toBe(true)
		await click(radio('Market venue', 'all'))
		expect(radio('Market category', 'inverse_perp').checked).toBe(true)
		await refresh({ ...data, cex: { ...data.cex, inverse_perp: [] } })
		expect(radio('Market category', 'inverse_perp')).toBeNull()
		expect(radio('Market category', 'spot').checked).toBe(true)
		expect(radio('Market category', 'spot').tabIndex).toBe(0)
		await refresh(data)
		expect(radio('Market category', 'inverse_perp').checked).toBe(true)
		expect(radio('Market category', 'inverse_perp').tabIndex).toBe(0)
		expect(fetchTokenMarkets).not.toHaveBeenCalled()
	}
)

test.each(['section', 'embedded'] as const)(
	'%s recovers the requested venue after an empty refresh',
	async (variant) => {
		await render(variant)
		await click(radio('Market venue', 'dex'))
		const empty = { spot: [], linear_perp: [], inverse_perp: [] }
		await refresh({ ...data, dex: empty })
		expect(radio('Market venue', 'dex')).toBeNull()
		expect(radio('Market venue', 'all').checked).toBe(true)
		expect(radio('Market venue', 'all').tabIndex).toBe(0)
		await refresh({ ...data, cex: empty, dex: empty })
		expect(container.querySelector('[role="radiogroup"]')).toBeNull()
		await refresh(data)
		expect(radio('Market venue', 'dex').checked).toBe(true)
		expect(radio('Market category', 'spot').checked).toBe(true)
		expect(container.querySelector('output')!.textContent).toBe('Curve,Uniswap')
	}
)
