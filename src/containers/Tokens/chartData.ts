import { getEquitiesTreemapColor } from '~/components/ECharts/EquitiesTreemapChart/colors'
import type { MarketTreemapGroup, MarketTreemapLeaf } from '~/components/ECharts/marketTreemapTypes'
import { geckoTokenIconUrl } from '~/utils/icons'
import type { TokensChangeWindow, TokensMapMode, TokensMoversWindow } from './chartState'
import { TOKENS_CHART_GECKO_LOGO_PREFIX, type TokensChartDataset } from './types'

export const TOKENS_MOVERS_COUNT = 10

const ICON_PROXY_PREFIXES = ['https://icons.llamao.fi/', 'https://token-icons.llamao.fi/'] as const

export function toExportSafeIconUrl(logo: string | null): string {
	if (!logo) return ''
	for (const prefix of ICON_PROXY_PREFIXES) {
		if (logo.startsWith(prefix)) return `/api/public/icon-proxy?url=${encodeURIComponent(logo)}`
	}
	return logo
}

export function resolveTokensChartLogo(source: string): string {
	return source.startsWith(TOKENS_CHART_GECKO_LOGO_PREFIX) ? geckoTokenIconUrl(source.slice(1)) : source
}

export type TokensTreemapLeaf = MarketTreemapLeaf

export interface TokensTreemapGroup extends Omit<MarketTreemapGroup, 'children'> {
	children: TokensTreemapLeaf[]
}

export type TokensTreemapNode = TokensTreemapLeaf | TokensTreemapGroup

export interface TokensTreemapOptions {
	colorWindow: TokensChangeWindow
	mapMode: TokensMapMode
	universe: number
}

export interface TokensTreemapResult {
	treeData: TokensTreemapNode[]
	leaves: TokensTreemapLeaf[]
	stablecoinsHidden: number
}

export function buildTokensTreemap(
	data: TokensChartDataset,
	{ colorWindow, mapMode, universe }: TokensTreemapOptions
): TokensTreemapResult {
	const priceChanges = data.priceChanges[colorWindow]
	const leaves: TokensTreemapLeaf[] = []
	const tokenLeaves: TokensTreemapLeaf[] = []
	const stablecoinLeaves: TokensTreemapLeaf[] = []
	let tokenMarketCap = 0
	let stablecoinMarketCap = 0
	let stablecoinsHidden = 0

	const rowCount = Math.min(data.marketCaps.length, universe)
	for (let index = 0; index < rowCount; index++) {
		const isStablecoin = data.stablecoins[index]
		if (mapMode === 'flat' && isStablecoin) {
			stablecoinsHidden++
			continue
		}
		const marketCap = data.marketCaps[index]
		const change = priceChanges[index]
		const leaf: TokensTreemapLeaf = {
			name: data.symbols[index],
			value: [marketCap, change],
			iconKey: leaves.length,
			itemStyle: { color: getEquitiesTreemapColor(change) },
			companyName: data.names[index],
			marketCap,
			iconUrl: toExportSafeIconUrl(resolveTokensChartLogo(data.logoSources[index]))
		}
		leaves.push(leaf)
		if (isStablecoin) {
			stablecoinMarketCap += marketCap
			stablecoinLeaves.push(leaf)
		} else {
			tokenMarketCap += marketCap
			tokenLeaves.push(leaf)
		}
	}

	if (mapMode === 'flat') {
		return { treeData: tokenLeaves, leaves, stablecoinsHidden }
	}

	const treeData: TokensTreemapNode[] = []
	if (tokenLeaves.length > 0) treeData.push({ name: 'Tokens', value: [tokenMarketCap, null], children: tokenLeaves })
	if (stablecoinLeaves.length > 0) {
		treeData.push({ name: 'Stablecoins', value: [stablecoinMarketCap, null], children: stablecoinLeaves })
	}
	return { treeData, leaves, stablecoinsHidden }
}

export function prepareTokensTreemapCsv({
	leaves,
	colorWindow,
	filename
}: {
	leaves: readonly TokensTreemapLeaf[]
	colorWindow: TokensChangeWindow
	filename: string
}) {
	const rows: Array<Array<string | number>> = [['Token', 'Name', 'Market Cap', `Price ${colorWindow.toUpperCase()}`]]
	for (const leaf of leaves) {
		rows.push([leaf.name, leaf.companyName, leaf.marketCap ?? '', leaf.value[1] ?? ''])
	}
	return { filename, rows }
}

export interface TokensMoverEntry {
	name: string
	value: number
	logo: string
	href: string | null
}

export interface TokensMoversResult {
	gainers: TokensMoverEntry[]
	losers: TokensMoverEntry[]
}

export function prepareTokensMoversCsv({
	movers,
	window,
	filename
}: {
	movers: TokensMoversResult
	window: TokensMoversWindow
	filename: string
}) {
	const rows: Array<Array<string | number>> = [
		['Direction', 'Rank', 'Token', `Price Change ${window.toUpperCase()} (%)`]
	]
	for (const [direction, entries] of [
		['Gainer', movers.gainers],
		['Loser', movers.losers]
	] as const) {
		for (let index = 0; index < entries.length; index++) {
			const entry = entries[index]
			rows.push([direction, index + 1, entry.name, entry.value])
		}
	}
	return { filename, rows }
}

export function buildTokensMovers(
	data: TokensChartDataset,
	{ window, universe }: { window: TokensMoversWindow; universe: number }
): TokensMoversResult {
	const priceChanges = data.priceChanges[window]
	const gainers: TokensMoverEntry[] = []
	const losers: TokensMoverEntry[] = []
	const rowCount = Math.min(data.marketCaps.length, universe)

	for (let index = 0; index < rowCount; index++) {
		const change = priceChanges[index]
		if (change == null || change === 0) continue
		const entry = {
			name: data.symbols[index],
			value: change,
			logo: resolveTokensChartLogo(data.logoSources[index]),
			href: data.hrefs[index]
		}
		insertMover(change > 0 ? gainers : losers, entry, change > 0)
	}

	return { gainers, losers }
}

function insertMover(entries: TokensMoverEntry[], entry: TokensMoverEntry, largestFirst: boolean): void {
	let index = entries.length
	while (index > 0) {
		const previous = entries[index - 1]
		if (largestFirst ? entry.value <= previous.value : entry.value >= previous.value) break
		index--
	}
	entries.splice(index, 0, entry)
	if (entries.length > TOKENS_MOVERS_COUNT) entries.pop()
}
