import type { TokensChangeWindow, TokensMapMode, TokensMoversWindow } from './chartState'
import type { TokensTableRow } from './types'

export const TOKENS_MOVERS_COUNT = 10

const CHANGE_FIELD = {
	'24h': 'priceChange24h',
	'7d': 'priceChange7d',
	'30d': 'priceChange30d'
} as const satisfies Record<TokensChangeWindow, keyof TokensTableRow>

const ICON_PROXY_HOSTS = new Set(['icons.llamao.fi', 'token-icons.llamao.fi'])

export function toExportSafeIconUrl(logo: string | null): string {
	if (!logo) return ''
	if (!logo.startsWith('https://')) return logo
	try {
		const parsed = new URL(logo)
		if (!ICON_PROXY_HOSTS.has(parsed.hostname)) return logo
	} catch {
		return logo
	}
	return `/api/public/icon-proxy?url=${encodeURIComponent(logo)}`
}

export interface TokensTreemapLeaf {
	name: string
	value: [number, number | null]
	companyName: string
	marketCap: number | null
	iconUrl: string
}

export interface TokensTreemapGroup {
	name: string
	value: [number, null]
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
	excludedCount: number
	stablecoinsHidden: number
}

export function buildTokensTreemap(
	rows: TokensTableRow[],
	{ colorWindow, mapMode, universe }: TokensTreemapOptions
): TokensTreemapResult {
	const changeField = CHANGE_FIELD[colorWindow]
	const tokenLeaves: TokensTreemapLeaf[] = []
	const stablecoinLeaves: TokensTreemapLeaf[] = []
	let excludedCount = 0
	let stablecoinsHidden = 0

	for (const row of (rows ?? []).slice(0, universe)) {
		const size = row.marketCap
		if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
			excludedCount++
			continue
		}
		if (mapMode === 'flat' && row.isStablecoin) {
			stablecoinsHidden++
			continue
		}
		const change = row[changeField]
		const leaf: TokensTreemapLeaf = {
			name: row.symbol,
			value: [size, typeof change === 'number' && Number.isFinite(change) ? change : null],
			companyName: row.name,
			marketCap: row.marketCap,
			iconUrl: toExportSafeIconUrl(row.logo)
		}
		if (row.isStablecoin) stablecoinLeaves.push(leaf)
		else tokenLeaves.push(leaf)
	}

	if (mapMode === 'flat') {
		return { treeData: tokenLeaves, excludedCount, stablecoinsHidden }
	}

	const treeData: TokensTreemapNode[] = []
	for (const [name, children] of [
		['Tokens', tokenLeaves],
		['Stablecoins', stablecoinLeaves]
	] as const) {
		if (children.length === 0) continue
		treeData.push({
			name,
			value: [children.reduce((sum, leaf) => sum + leaf.value[0], 0), null],
			children
		})
	}
	return { treeData, excludedCount, stablecoinsHidden }
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

export function buildTokensMovers(
	rows: TokensTableRow[],
	{ window, universe }: { window: TokensMoversWindow; universe: number }
): TokensMoversResult {
	const changeField = CHANGE_FIELD[window]
	const changed: Array<{ row: TokensTableRow; change: number }> = []

	for (const row of (rows ?? []).slice(0, universe)) {
		const change = row[changeField]
		if (typeof change === 'number' && Number.isFinite(change) && change !== 0) {
			changed.push({ row, change })
		}
	}

	changed.sort((a, b) => b.change - a.change)

	const toEntry = ({ row, change }: { row: TokensTableRow; change: number }): TokensMoverEntry => ({
		name: row.symbol,
		value: change,
		logo: row.logo ?? '',
		href: row.href
	})

	return {
		gainers: changed
			.filter(({ change }) => change > 0)
			.slice(0, TOKENS_MOVERS_COUNT)
			.map(toEntry),
		losers: changed
			.filter(({ change }) => change < 0)
			.slice(-TOKENS_MOVERS_COUNT)
			.reverse()
			.map(toEntry)
	}
}
