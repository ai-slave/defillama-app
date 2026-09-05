import { describe, expect, it } from 'vitest'
import {
	buildTokensMovers,
	buildTokensTreemap,
	prepareTokensMoversCsv,
	prepareTokensTreemapCsv,
	resolveTokensChartLogo,
	toExportSafeIconUrl,
	type TokensTreemapGroup
} from '../chartData'
import { parseTokensChartState, TOKENS_CHART_DEFAULTS } from '../chartState'
import type { TokensChartDataset } from '../types'

interface ChartRowInput {
	name: string
	symbol: string
	logo: string | null
	href: string | null
	marketCap: number
	priceChange24h: number | null
	priceChange7d: number | null
	priceChange30d: number | null
	isStablecoin: boolean
}

function row(overrides: Partial<ChartRowInput> & Pick<ChartRowInput, 'name' | 'symbol'>): ChartRowInput {
	return {
		logo: null,
		href: null,
		marketCap: 1,
		priceChange24h: null,
		priceChange7d: null,
		priceChange30d: null,
		isStablecoin: false,
		...overrides
	}
}

function chartData(rows: ChartRowInput[]): TokensChartDataset {
	const data: TokensChartDataset = {
		names: [],
		symbols: [],
		logoSources: [],
		hrefs: [],
		marketCaps: [],
		priceChanges: { '24h': [], '7d': [], '30d': [] },
		stablecoins: []
	}
	for (const item of rows) {
		data.names.push(item.name)
		data.symbols.push(item.symbol)
		data.logoSources.push(item.logo ?? '')
		data.hrefs.push(item.href)
		data.marketCaps.push(item.marketCap)
		data.priceChanges['24h'].push(item.priceChange24h)
		data.priceChanges['7d'].push(item.priceChange7d)
		data.priceChanges['30d'].push(item.priceChange30d)
		data.stablecoins.push(item.isStablecoin)
	}
	return data
}

const baseTreemapOptions = {
	colorWindow: '24h',
	mapMode: 'grouped',
	universe: 100
} as const

describe('buildTokensTreemap', () => {
	it('builds canonical leaves once and groups tokens with running market-cap totals', () => {
		const result = buildTokensTreemap(
			chartData([
				row({ name: 'Bitcoin', symbol: 'BTC', marketCap: 100, priceChange24h: 2, logo: '/btc.png' }),
				row({ name: 'Tether', symbol: 'USDT', marketCap: 40, priceChange24h: 0.01, isStablecoin: true }),
				row({ name: 'Ethereum', symbol: 'ETH', marketCap: 60, priceChange24h: -1 })
			]),
			baseTreemapOptions
		)

		expect(result.treeData.map((node) => node.name)).toEqual(['Tokens', 'Stablecoins'])
		const tokens = result.treeData[0] as TokensTreemapGroup
		const stables = result.treeData[1] as TokensTreemapGroup
		expect(tokens.value[0]).toBe(160)
		expect(stables.value[0]).toBe(40)
		expect(tokens.children.map((leaf) => leaf.name)).toEqual(['BTC', 'ETH'])
		expect(result.leaves.map((leaf) => leaf.iconKey)).toEqual([0, 1, 2])
		expect(result.leaves[0]).toMatchObject({ companyName: 'Bitcoin', iconUrl: '/btc.png', value: [100, 2] })
		expect(stables.children[0]).toBe(result.leaves[1])
	})

	it('omits empty groups', () => {
		const result = buildTokensTreemap(
			chartData([row({ name: 'Bitcoin', symbol: 'BTC', marketCap: 100 })]),
			baseTreemapOptions
		)
		expect(result.treeData.map((node) => node.name)).toEqual(['Tokens'])
	})

	it('hides stablecoins inside the selected universe without backfilling lower-ranked rows', () => {
		const result = buildTokensTreemap(
			chartData([
				row({ name: 'Bitcoin', symbol: 'BTC', marketCap: 100 }),
				row({ name: 'Tether', symbol: 'USDT', marketCap: 90, isStablecoin: true }),
				row({ name: 'Ethereum', symbol: 'ETH', marketCap: 80 })
			]),
			{ ...baseTreemapOptions, mapMode: 'flat', universe: 2 }
		)

		expect(result.treeData.map((node) => node.name)).toEqual(['BTC'])
		expect(result.stablecoinsHidden).toBe(1)
	})

	it('uses the selected change window and caps work to the selected universe', () => {
		const result = buildTokensTreemap(
			chartData([
				row({ name: 'A', symbol: 'A', marketCap: 30, priceChange7d: 7 }),
				row({ name: 'B', symbol: 'B', marketCap: 20, priceChange7d: 6 }),
				row({ name: 'C', symbol: 'C', marketCap: 10, priceChange7d: 5 })
			]),
			{ ...baseTreemapOptions, colorWindow: '7d', universe: 2 }
		)

		expect(result.leaves.map((leaf) => leaf.value)).toEqual([
			[30, 7],
			[20, 6]
		])
	})
})

describe('tokens treemap export', () => {
	it('proxies known icon hosts without parsing every URL', () => {
		expect(resolveTokensChartLogo('@bitcoin')).toBe(
			'https://token-icons.llamao.fi/icons/tokens/gecko/bitcoin?w=48&h=48'
		)
		expect(resolveTokensChartLogo('/local.png')).toBe('/local.png')
		expect(toExportSafeIconUrl('https://token-icons.llamao.fi/icons/tokens/gecko/bitcoin?w=48&h=48')).toBe(
			'/api/public/icon-proxy?url=https%3A%2F%2Ftoken-icons.llamao.fi%2Ficons%2Ftokens%2Fgecko%2Fbitcoin%3Fw%3D48%26h%3D48'
		)
		expect(toExportSafeIconUrl('https://icons.llamao.fi/icons/protocols/uniswap')).toBe(
			'/api/public/icon-proxy?url=https%3A%2F%2Ficons.llamao.fi%2Ficons%2Fprotocols%2Funiswap'
		)
		expect(toExportSafeIconUrl('https://icons.llamao.fi.evil.example/logo.png')).toBe(
			'https://icons.llamao.fi.evil.example/logo.png'
		)
		expect(toExportSafeIconUrl('/local.png')).toBe('/local.png')
		expect(toExportSafeIconUrl(null)).toBe('')
	})

	it('exports the already-built leaves without reconstructing source rows', () => {
		const treemap = buildTokensTreemap(
			chartData([row({ name: 'Bitcoin', symbol: 'BTC', marketCap: 100, priceChange24h: 2 })]),
			baseTreemapOptions
		)
		expect(prepareTokensTreemapCsv({ leaves: treemap.leaves, colorWindow: '24h', filename: 'tokens' })).toEqual({
			filename: 'tokens',
			rows: [
				['Token', 'Name', 'Market Cap', 'Price 24H'],
				['BTC', 'Bitcoin', 100, 2]
			]
		})
	})
})

describe('buildTokensMovers', () => {
	const data = chartData([
		row({ name: 'A', symbol: 'A', priceChange24h: 12, priceChange7d: -3, href: '/token/A' }),
		row({ name: 'B', symbol: 'B', priceChange24h: -8, priceChange7d: 15 }),
		row({ name: 'C', symbol: 'C', priceChange24h: 4 }),
		row({ name: 'D', symbol: 'D', priceChange7d: 2 }),
		row({ name: 'E', symbol: 'E', priceChange24h: -2, priceChange7d: 1 })
	])

	it('maintains bounded gainers and losers in display order', () => {
		const result = buildTokensMovers(data, { window: '24h', universe: 100 })
		expect(result.gainers.map((entry) => entry.name)).toEqual(['A', 'C'])
		expect(result.losers.map((entry) => entry.name)).toEqual(['B', 'E'])
		expect(result.gainers[0]).toMatchObject({ value: 12, href: '/token/A' })
	})

	it('reads the selected window and skips null changes', () => {
		const result = buildTokensMovers(data, { window: '7d', universe: 100 })
		expect(result.gainers.map((entry) => entry.name)).toEqual(['B', 'D', 'E'])
		expect(result.losers.map((entry) => entry.name)).toEqual(['A'])
	})

	it('respects the universe and keeps only ten entries per side', () => {
		const many = chartData(
			Array.from({ length: 30 }, (_, index) =>
				row({ name: `T${index}`, symbol: `T${index}`, priceChange24h: index + 1 })
			)
		)
		expect(buildTokensMovers(many, { window: '24h', universe: 5 }).gainers.map((entry) => entry.name)).toEqual([
			'T4',
			'T3',
			'T2',
			'T1',
			'T0'
		])
		const capped = buildTokensMovers(many, { window: '24h', universe: 100 })
		expect(capped.gainers).toHaveLength(10)
		expect(capped.gainers[0]?.name).toBe('T29')
	})
})

describe('tokens movers export', () => {
	it('exports the visible mover order and selected change window', () => {
		const movers = buildTokensMovers(
			chartData([
				row({ name: 'Alpha', symbol: 'AAA', priceChange7d: 2.5 }),
				row({ name: 'Beta', symbol: 'BBB', priceChange7d: 8 }),
				row({ name: 'Gamma', symbol: 'CCC', priceChange7d: -3 })
			]),
			{ window: '7d', universe: 100 }
		)

		expect(prepareTokensMoversCsv({ movers, window: '7d', filename: 'tokens-movers' })).toEqual({
			filename: 'tokens-movers',
			rows: [
				['Direction', 'Rank', 'Token', 'Price Change 7D (%)'],
				['Gainer', 1, 'BBB', 8],
				['Gainer', 2, 'AAA', 2.5],
				['Loser', 1, 'CCC', -3]
			]
		})
	})
})

describe('parseTokensChartState', () => {
	it('returns defaults for empty or invalid queries', () => {
		expect(parseTokensChartState({})).toEqual(TOKENS_CHART_DEFAULTS)
		expect(
			parseTokensChartState({ view: 'nope', chartTop: '9000', colorBy: '1y', mapMode: 'x', moversWindow: '1y' })
		).toEqual(TOKENS_CHART_DEFAULTS)
	})

	it('accepts valid values and takes the first array entry', () => {
		expect(
			parseTokensChartState({
				view: 'movers',
				chartTop: ['300', '100'],
				colorBy: '7d',
				mapMode: 'flat',
				moversWindow: '7d'
			})
		).toEqual({ view: 'movers', universe: '300', colorBy: '7d', mapMode: 'flat', moversWindow: '7d' })
	})
})
