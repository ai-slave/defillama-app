import type { RWAOverviewDisplayRow, RWAPerpsContractOverlayRow } from '../api.types'
import type { RWAChartRow } from '../chartDataset'
import { getRwaDisplayedDefiActiveTvlByProtocol } from '../filterState'
import { sumRwaRowValues } from '../flowSplit'
import { sumRwaKpiTotals } from '../kpi/kpiTotals'
import { percentChange, type RWAValueWithPrior } from '../table/change'

const DAY_MS = 24 * 60 * 60 * 1000

/** The cards change over this window; the panel keeps the page's period switch. */
export const RWA_CARD_CHANGE_DAYS = 30
export const RWA_CARD_BARS = 10
/** Change by Chain shows this many gains and this many losses. */
export const RWA_CARD_CHAIN_EACH = 5

export type RwaNamedBar = { name: string; value: number }
export type RwaChangeBar = { name: string; changeUsd: number; changePct: number | null }
export type RwaChange = { changeUsd: number | null; changePct: number | null }
export type RwaDefiProtocolCard = { value: number | null; changeUsd: number | null; bars: Array<RwaNamedBar> }
/** A total's 30d change and the names' own changes, as Change by Chain and Change by Venue draw them. */
export type RwaChangeCard = RwaChange & { bars: Array<RwaChangeBar> }
export type RwaOpenInterestCard = { value: number | null; changePct: number | null; series: Array<[number, number]> }
/** The perps venue split of open interest as a change card, one variant per Venue Type choice. */
export type RwaPerpsSplitCards = { withCex: RwaChangeCard; dexOnly: RwaChangeCard }

/**
 * The parts of the front page cards the browser cannot fold: the server chain split's bars, read while no filter is
 * set, and the perps venue split behind the RWA Perps Open Interest line. The rest folds the page's rows.
 */
export type RwaOverviewCards = {
	chainChange: { bars: Array<RwaChangeBar> }
	perpsOpenInterest: RwaOpenInterestCard
}

export type RwaPerpsTotals = {
	openInterest: number | null
	openInterestChange24h: RWAValueWithPrior
	/** DEX open interest over all open interest, in percent. */
	dexShare: number | null
	volume24h: number | null
}

/** A ratio in percent; a zero or missing denominator is a gap, never 0. */
export function getRwaRatio(
	numerator: number | null | undefined,
	denominator: number | null | undefined
): number | null {
	if (numerator == null || denominator == null || denominator <= 0) return null
	return (numerator / denominator) * 100
}

/** The latest point against the last point at or before `days` earlier; a gap when the series is shorter. */
export function changeOver(series: ReadonlyArray<readonly [number, number]>, days: number): RwaChange {
	const latest = series[series.length - 1]
	if (!latest) return { changeUsd: null, changePct: null }
	const windowStart = latest[0] - days * DAY_MS
	let prior: readonly [number, number] | undefined
	for (const point of series) {
		if (point[0] <= windowStart) prior = point
		else break
	}
	if (!prior) return { changeUsd: null, changePct: null }
	return { changeUsd: latest[1] - prior[1], changePct: percentChange(latest[1], prior[1]) }
}

/** DeFi Active TVL per protocol over the assets, largest first. Without bridge data a protocol list stays as published. */
export function rankRwaDefiProtocols(
	assets: Array<RWAOverviewDisplayRow>,
	includeBridgeTvl: boolean,
	max = RWA_CARD_BARS
): Array<RwaNamedBar> {
	const totals = new Map<string, number>()
	for (const asset of assets) {
		if (asset.kind !== 'spot') continue
		const breakdown = getRwaDisplayedDefiActiveTvlByProtocol(asset, includeBridgeTvl) ?? asset.defiActiveTvl.breakdown
		for (const [protocol, value] of breakdown) {
			if (value > 0) totals.set(protocol, (totals.get(protocol) ?? 0) + value)
		}
	}
	return Array.from(totals.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, max)
		.map(([name, value]) => ({ name, value }))
}

const byChangeDesc = (a: RwaChangeBar, b: RwaChangeBar) => b.changeUsd - a.changeUsd || a.name.localeCompare(b.name)

/** Per chain, the latest value against `days` earlier: the `each` largest gains, then the `each` largest losses. */
export function rankRwaChainChanges(
	rows: Array<RWAChartRow>,
	{ days, each }: { days: number; each: number }
): Array<RwaChangeBar> {
	/* The two days come from rows that have a total, as the card's own total does. */
	const sorted = rows.filter((row) => sumRwaRowValues(row) != null).sort((a, b) => a.timestamp - b.timestamp)
	const latest = sorted[sorted.length - 1]
	if (!latest) return []
	const windowStart = latest.timestamp - days * DAY_MS
	let prior: RWAChartRow | undefined
	for (const row of sorted) {
		if (row.timestamp <= windowStart) prior = row
		else break
	}
	if (!prior) return []
	const changes: Array<RwaChangeBar> = []
	for (const name of Object.keys(latest)) {
		const now = latest[name]
		const then = prior[name]
		/* A name missing on either day is a gap in the data (a late publish, a renamed chain), never a fall to zero. */
		if (name === 'timestamp' || now == null || then == null) continue
		const changeUsd = now - then
		if (changeUsd === 0) continue
		changes.push({ name, changeUsd, changePct: percentChange(now, then) })
	}
	const gains = changes
		.filter((change) => change.changeUsd > 0)
		.sort(byChangeDesc)
		.slice(0, each)
	/* The largest losses, shown from the smallest of them down to the largest. */
	const losses = changes
		.filter((change) => change.changeUsd < 0)
		.sort((a, b) => a.changeUsd - b.changeUsd || a.name.localeCompare(b.name))
		.slice(0, each)
		.sort(byChangeDesc)
	return [...gains, ...losses]
}

/** One total per row over every series column; a row with no value is left out. Ascending by time. */
export function foldRwaSeriesTotal(rows: Array<RWAChartRow>): Array<[number, number]> {
	const series: Array<[number, number]> = []
	for (const row of rows) {
		const total = sumRwaRowValues(row)
		if (total != null) series.push([row.timestamp, total])
	}
	return series.sort((a, b) => a[0] - b[0])
}

/** The perps rows the Venue Type choice allows. */
export function getRwaPerpsMarkets(
	assets: ReadonlyArray<RWAOverviewDisplayRow>,
	includeCex: boolean
): Array<RWAPerpsContractOverlayRow> {
	return assets.filter(
		(asset): asset is RWAPerpsContractOverlayRow => asset.kind === 'perps' && (includeCex || asset.venueType !== 'CEX')
	)
}

/** Open interest and volume over the given perps rows; 24h priors from each row's own change. */
export function foldRwaPerpsTotals(markets: Array<RWAPerpsContractOverlayRow>): RwaPerpsTotals {
	let openInterest: number | null = null
	let dexOpenInterest = 0
	let volume24h: number | null = null
	let current: number | null = null
	let prior: number | null = null
	for (const market of markets) {
		if (market.openInterest != null) {
			openInterest = (openInterest ?? 0) + market.openInterest
			if (market.venueType === 'DEX') dexOpenInterest += market.openInterest
			if (market.openInterestChange24h != null && market.openInterestChange24h > -100) {
				current = (current ?? 0) + market.openInterest
				prior = (prior ?? 0) + market.openInterest / (1 + market.openInterestChange24h / 100)
			}
		}
		if (market.volume24h != null) volume24h = (volume24h ?? 0) + market.volume24h
	}
	return {
		openInterest,
		openInterestChange24h: { current, prior },
		dexShare: getRwaRatio(dexOpenInterest, openInterest),
		volume24h
	}
}

/** The value follows the Bridge TVL toggle; the bars leave bridges out either way. */
export function buildRwaDefiProtocolCard(
	assets: Array<RWAOverviewDisplayRow>,
	includeBridgeTvl: boolean
): RwaDefiProtocolCard {
	const totals = sumRwaKpiTotals(assets, includeBridgeTvl)
	const { current, prior } = totals.change['1m'].defiActiveTvl
	return {
		value: totals.defiActiveTvl,
		changeUsd: current == null || prior == null ? null : current - prior,
		bars: rankRwaDefiProtocols(assets, false)
	}
}

/** A split's total now against 30 days ago, and the split's largest gains and losses. */
export function buildRwaSplitCard(rows: Array<RWAChartRow>): RwaChangeCard {
	return {
		...changeOver(foldRwaSeriesTotal(rows), RWA_CARD_CHANGE_DAYS),
		bars: rankRwaChainChanges(rows, { days: RWA_CARD_CHANGE_DAYS, each: RWA_CARD_CHAIN_EACH })
	}
}

/** A split's total now, its change over 30 days and its line. */
export function buildRwaOpenInterestCard(rows: Array<RWAChartRow>): RwaOpenInterestCard {
	const series = foldRwaSeriesTotal(rows)
	const latest = series[series.length - 1]
	return {
		value: latest ? latest[1] : null,
		changePct: changeOver(series, RWA_CARD_CHANGE_DAYS).changePct,
		series
	}
}
