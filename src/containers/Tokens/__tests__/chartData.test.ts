import { describe, expect, it } from 'vitest'
import { buildTokensMovers, buildTokensTreemap, toExportSafeIconUrl, type TokensTreemapGroup } from '../chartData'
import { parseTokensChartState, TOKENS_CHART_DEFAULTS } from '../chartState'
import type { TokensTableRow } from '../types'

function row(overrides: Partial<TokensTableRow> & Pick<TokensTableRow, 'id' | 'name' | 'symbol'>): TokensTableRow {
	return {
		rank: null,
		rowNumber: 1,
		logo: null,
		href: null,
		tokenRightsHref: null,
		price: null,
		priceChange1h: null,
		priceChange24h: null,
		priceChange7d: null,
		priceChange30d: null,
		marketCap: null,
		fdv: null,
		outstandingFdv: null,
		unlockedPercent: null,
		spotVolume24h: null,
		perpsVolume24h: null,
		openInterest24h: null,
		fees24h: null,
		revenue24h: null,
		holdersRevenue24h: null,
		trsPercent: null,
		rights: null,
		unlock30dUsd: null,
		upcomingUnlockUsd: null,
		isStablecoin: false,
		display: {} as TokensTableRow['display'],
		...overrides
	}
}

const baseTreemapOptions = {
	colorWindow: '24h',
	mapMode: 'grouped',
	universe: 100
} as const

describe('buildTokensTreemap', () => {
	it('groups tokens and stablecoins into separate zones with summed sizes', () => {
		const result = buildTokensTreemap(
			[
				row({ id: 'btc', name: 'Bitcoin', symbol: 'BTC', marketCap: 100, priceChange24h: 2, logo: '/btc.png' }),
				row({ id: 'usdt', name: 'Tether', symbol: 'USDT', marketCap: 40, priceChange24h: 0.01, isStablecoin: true }),
				row({ id: 'eth', name: 'Ethereum', symbol: 'ETH', marketCap: 60, priceChange24h: -1 })
			],
			baseTreemapOptions
		)

		expect(result.treeData.map((node) => node.name)).toEqual(['Tokens', 'Stablecoins'])
		const tokens = result.treeData[0] as TokensTreemapGroup
		const stables = result.treeData[1] as TokensTreemapGroup
		expect(tokens.value[0]).toBe(160)
		expect(tokens.children.map((leaf) => leaf.name)).toEqual(['BTC', 'ETH'])
		expect(tokens.children[0]).toMatchObject({ companyName: 'Bitcoin', iconUrl: '/btc.png', value: [100, 2] })
		expect(stables.children.map((leaf) => leaf.name)).toEqual(['USDT'])
		expect(result.excludedCount).toBe(0)
		expect(result.stablecoinsHidden).toBe(0)
	})

	it('omits empty groups', () => {
		const result = buildTokensTreemap(
			[row({ id: 'btc', name: 'Bitcoin', symbol: 'BTC', marketCap: 100 })],
			baseTreemapOptions
		)
		expect(result.treeData.map((node) => node.name)).toEqual(['Tokens'])
	})

	it('drops stablecoins in flat mode and counts them separately', () => {
		const result = buildTokensTreemap(
			[
				row({ id: 'btc', name: 'Bitcoin', symbol: 'BTC', marketCap: 100 }),
				row({ id: 'usdt', name: 'Tether', symbol: 'USDT', marketCap: 40, isStablecoin: true }),
				row({ id: 'zero', name: 'Zero', symbol: 'ZERO', marketCap: 0 })
			],
			{ ...baseTreemapOptions, mapMode: 'flat' }
		)

		expect(result.treeData.map((node) => node.name)).toEqual(['BTC'])
		expect(result.stablecoinsHidden).toBe(1)
		expect(result.excludedCount).toBe(1)
	})

	it('excludes rows without a usable size and keeps null change as null', () => {
		const result = buildTokensTreemap(
			[
				row({ id: 'a', name: 'A', symbol: 'A', marketCap: null }),
				row({ id: 'b', name: 'B', symbol: 'B', marketCap: -5 }),
				row({ id: 'c', name: 'C', symbol: 'C', marketCap: 10, priceChange24h: null })
			],
			baseTreemapOptions
		)

		expect(result.excludedCount).toBe(2)
		const tokens = result.treeData[0] as TokensTreemapGroup
		expect(tokens.children[0].value).toEqual([10, null])
	})

	it('slices to the universe', () => {
		const rows = [
			row({ id: 'a', name: 'A', symbol: 'A', marketCap: 10 }),
			row({ id: 'b', name: 'B', symbol: 'B', marketCap: 20 }),
			row({ id: 'c', name: 'C', symbol: 'C', marketCap: 30 })
		]
		const result = buildTokensTreemap(rows, { ...baseTreemapOptions, universe: 2 })
		const tokens = result.treeData[0] as TokensTreemapGroup
		expect(tokens.children.map((leaf) => leaf.value[0])).toEqual([10, 20])
	})
})

describe('toExportSafeIconUrl', () => {
	it('proxies llamao icon hosts and passes everything else through', () => {
		expect(toExportSafeIconUrl('https://token-icons.llamao.fi/icons/tokens/gecko/bitcoin?w=48&h=48')).toBe(
			'/api/public/icon-proxy?url=https%3A%2F%2Ftoken-icons.llamao.fi%2Ficons%2Ftokens%2Fgecko%2Fbitcoin%3Fw%3D48%26h%3D48'
		)
		expect(toExportSafeIconUrl('https://icons.llamao.fi/icons/protocols/uniswap')).toBe(
			'/api/public/icon-proxy?url=https%3A%2F%2Ficons.llamao.fi%2Ficons%2Fprotocols%2Funiswap'
		)
		expect(toExportSafeIconUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png')
		expect(toExportSafeIconUrl('/local.png')).toBe('/local.png')
		expect(toExportSafeIconUrl(null)).toBe('')
	})
})

describe('buildTokensMovers', () => {
	const rows = [
		row({ id: 'a', name: 'A', symbol: 'A', priceChange24h: 12, priceChange7d: -3, href: '/token/A' }),
		row({ id: 'b', name: 'B', symbol: 'B', priceChange24h: -8, priceChange7d: 15 }),
		row({ id: 'c', name: 'C', symbol: 'C', priceChange24h: 4, priceChange7d: null }),
		row({ id: 'd', name: 'D', symbol: 'D', priceChange24h: null, priceChange7d: 2 }),
		row({ id: 'e', name: 'E', symbol: 'E', priceChange24h: -2, priceChange7d: 1 })
	]

	it('splits gainers desc and losers with the biggest drop first', () => {
		const result = buildTokensMovers(rows, { window: '24h', universe: 100 })
		expect(result.gainers.map((entry) => entry.name)).toEqual(['A', 'C'])
		expect(result.losers.map((entry) => entry.name)).toEqual(['B', 'E'])
		expect(result.gainers[0]).toMatchObject({ value: 12, href: '/token/A' })
	})

	it('reads the 7d window and skips null changes', () => {
		const result = buildTokensMovers(rows, { window: '7d', universe: 100 })
		expect(result.gainers.map((entry) => entry.name)).toEqual(['B', 'D', 'E'])
		expect(result.losers.map((entry) => entry.name)).toEqual(['A'])
	})

	it('respects the universe slice and the top-10 cap', () => {
		const many = Array.from({ length: 30 }, (_, index) =>
			row({ id: `t${index}`, name: `T${index}`, symbol: `T${index}`, priceChange24h: index + 1 })
		)
		const sliced = buildTokensMovers(many, { window: '24h', universe: 5 })
		expect(sliced.gainers.map((entry) => entry.name)).toEqual(['T4', 'T3', 'T2', 'T1', 'T0'])

		const capped = buildTokensMovers(many, { window: '24h', universe: 100 })
		expect(capped.gainers).toHaveLength(10)
		expect(capped.gainers[0].name).toBe('T29')
	})
})

describe('parseTokensChartState', () => {
	it('returns defaults for empty or garbage queries', () => {
		expect(parseTokensChartState({})).toEqual(TOKENS_CHART_DEFAULTS)
		expect(
			parseTokensChartState({
				chartView: 'nope',
				chartTop: '9000',
				colorBy: '1y',
				mapMode: 'x',
				moversWindow: '1y'
			})
		).toEqual(TOKENS_CHART_DEFAULTS)
	})

	it('accepts valid values and takes the first array entry', () => {
		expect(
			parseTokensChartState({
				chartView: 'movers',
				chartTop: ['300', '100'],
				colorBy: '7d',
				mapMode: 'flat',
				moversWindow: '7d'
			})
		).toEqual({
			view: 'movers',
			universe: '300',
			colorBy: '7d',
			mapMode: 'flat',
			moversWindow: '7d'
		})
	})
})
