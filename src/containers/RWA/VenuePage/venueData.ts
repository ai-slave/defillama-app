import type { RWAOverviewDisplayRow, RWAPerpsContractOverlayRow } from '../api.types'
import { normalizeRwaAssetGroup } from '../assetGroup'
import { getPrimaryRwaCategory } from '../grouping'
import type { RWAPlatformMeta } from '../PlatformPage/api.types'

/* The venue page's pure reads: its profile from the platforms index and the Markets panel folded over its rows. */

const SHOWN_ASSET_GROUPS = 5
const SHOWN_ORACLE_PROVIDERS = 2
/** Where a methodology string stops naming its provider and starts describing it. */
const ORACLE_DETAIL_START = /,|;| \(| \/ /

export type RwaVenueOracleProviders = {
	/** The short provider names the row shows, the most used first. */
	shown: Array<string>
	/** How many more short names the "+N more" stands for. */
	more: number
	/** Every methodology as the data spells it, in the same order, for the hover card. */
	full: Array<string>
}

export type RwaVenueMarketsSummary = {
	openInterestByAssetGroup: {
		/** Share is the group's open interest over the venue's, in percent: the width of its bar. */
		shown: Array<{ name: string; value: number; share: number }>
		others: { count: number; value: number; share: number } | null
	}
	assetClasses: Array<{ name: string; count: number }>
	marginAssets: Array<string>
	oracleProviders: RwaVenueOracleProviders
	maxLeverage: { min: number; max: number } | null
	fundingIntervalHours: Array<number>
	accessModels: Array<string>
}

export type RwaPerpsVenueType = RWAPerpsContractOverlayRow['venueType']
/** All open interest per venue type, the denominator of a venue's share. */
type RwaOpenInterestByVenueType = Record<RwaPerpsVenueType, number | null>

function distinct(values: Array<string | null | undefined>): Array<string> {
	return Array.from(new Set(values.filter((value): value is string => !!value?.trim()))).sort((a, b) =>
		a.localeCompare(b)
	)
}

/** The provider a methodology names: the text before its first comma, semicolon, bracket or slash. */
function getRwaOracleProviderName(methodology: string): string {
	return methodology.split(ORACLE_DETAIL_START)[0]!.trim()
}

/** Short distinct provider names ranked by how many markets use them, ties by name; the full methodologies follow
    the same order. A venue with one or two methodologies shows them whole: there is room, and a cut loses a source. */
function summarizeOracleProviders(methodologies: Array<string | null | undefined>): RwaVenueOracleProviders {
	const byFull = new Map<string, number>()
	for (const methodology of methodologies) {
		const full = methodology?.trim()
		if (full) byFull.set(full, (byFull.get(full) ?? 0) + 1)
	}
	if (byFull.size <= SHOWN_ORACLE_PROVIDERS) {
		const whole = Array.from(byFull)
			.sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
			.map(([full]) => full)
		return { shown: whole, more: 0, full: whole }
	}
	const byName = new Map<string, { count: number; full: Set<string> }>()
	for (const methodology of methodologies) {
		const full = methodology?.trim()
		if (!full) continue
		const name = getRwaOracleProviderName(full) || full
		const entry = byName.get(name) ?? { count: 0, full: new Set<string>() }
		entry.count += 1
		entry.full.add(full)
		byName.set(name, entry)
	}
	const ranked = Array.from(byName).sort(([a, x], [b, y]) => y.count - x.count || a.localeCompare(b))
	return {
		shown: ranked.slice(0, SHOWN_ORACLE_PROVIDERS).map(([name]) => name),
		more: Math.max(0, ranked.length - SHOWN_ORACLE_PROVIDERS),
		full: ranked.flatMap(([, entry]) => Array.from(entry.full).sort((a, b) => a.localeCompare(b)))
	}
}

/** What the venue lists, in the Markets panel's order: where the open interest sits, the asset classes, the terms. */
export function summarizeRwaVenueMarkets(rows: Array<RWAOverviewDisplayRow>): RwaVenueMarketsSummary {
	const markets = rows.filter((row): row is RWAPerpsContractOverlayRow => row.kind === 'perps')
	const oiByGroup = new Map<string, number>()
	const classCounts = new Map<string, number>()
	let minLeverage: number | null = null
	let maxLeverage: number | null = null
	const intervals = new Set<number>()
	for (const market of markets) {
		const group = normalizeRwaAssetGroup(market.assetGroup)
		if (market.openInterest != null) oiByGroup.set(group, (oiByGroup.get(group) ?? 0) + market.openInterest)
		const assetClass = getPrimaryRwaCategory(market.assetClass)
		if (assetClass) classCounts.set(assetClass, (classCounts.get(assetClass) ?? 0) + 1)
		if (market.maxLeverage != null) {
			minLeverage = minLeverage == null ? market.maxLeverage : Math.min(minLeverage, market.maxLeverage)
			maxLeverage = maxLeverage == null ? market.maxLeverage : Math.max(maxLeverage, market.maxLeverage)
		}
		if (market.fundingIntervalHours != null) intervals.add(market.fundingIntervalHours)
	}
	const ranked = Array.from(oiByGroup, ([name, value]) => ({ name, value })).sort(
		(a, b) => b.value - a.value || a.name.localeCompare(b.name)
	)
	const total = ranked.reduce((sum, entry) => sum + entry.value, 0)
	const share = (value: number) => (total > 0 ? (value * 100) / total : 0)
	const rest = ranked.slice(SHOWN_ASSET_GROUPS)
	const restValue = rest.reduce((sum, entry) => sum + entry.value, 0)
	return {
		openInterestByAssetGroup: {
			shown: ranked.slice(0, SHOWN_ASSET_GROUPS).map((entry) => ({ ...entry, share: share(entry.value) })),
			others: rest.length > 0 ? { count: rest.length, value: restValue, share: share(restValue) } : null
		},
		assetClasses: Array.from(classCounts, ([name, count]) => ({ name, count })).sort(
			(a, b) => b.count - a.count || a.name.localeCompare(b.name)
		),
		marginAssets: distinct(markets.map((market) => market.marginAsset)),
		oracleProviders: summarizeOracleProviders(markets.map((market) => market.oracleProvider)),
		maxLeverage: minLeverage == null || maxLeverage == null ? null : { min: minLeverage, max: maxLeverage },
		fundingIntervalHours: Array.from(intervals).sort((a, b) => a - b),
		accessModels: distinct(markets.map((market) => market.accessModel))
	}
}

/** Open interest per venue type over every market the card would count: suspicious markets stay out. */
export function sumRwaPerpsOpenInterestByVenueType(
	markets: Array<RWAPerpsContractOverlayRow>
): RwaOpenInterestByVenueType {
	const out: RwaOpenInterestByVenueType = { DEX: null, CEX: null }
	for (const market of markets) {
		if (market.suspicious || market.openInterest == null) continue
		out[market.venueType] = (out[market.venueType] ?? 0) + market.openInterest
	}
	return out
}

/** The markets the card and the Information panels count: suspicious ones stay in the table only. */
export function getRwaVenueCountedMarkets<T extends RWAOverviewDisplayRow>(rows: Array<T>): Array<T> {
	return rows.filter((row) => !row.suspicious)
}

/** One venue, one type: the type its markets name. */
export function getRwaVenueType(rows: Array<RWAOverviewDisplayRow>): RwaPerpsVenueType | null {
	for (const row of rows) if (row.kind === 'perps' && row.venueType) return row.venueType
	return null
}

/** The platform page holds the venue's spot assets; link it only when the index counts spot AUM there. */
export function getRwaVenueSpotHref(meta: RWAPlatformMeta | null): string | null {
	if (!meta) return null
	const hasSpot = meta.onchainAum > 0 || (meta.activeAum ?? 0) > 0
	return hasSpot && meta.slug ? `/rwa/platform/${meta.slug}` : null
}
