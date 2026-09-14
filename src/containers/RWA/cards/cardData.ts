import type { RWAOverviewDisplayRow } from '../api.types'
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
export type RwaValueChange = RwaChange & { value: number | null }
export type RwaDefiProtocolCard = RwaValueChange & { bars: Array<RwaNamedBar> }
export type RwaChainChangeCard = RwaValueChange & { bars: Array<RwaChangeBar> }
export type RwaOpenInterestCard = { value: number | null; changePct: number | null; series: Array<[number, number]> }

/**
 * The three front page cards, folded at build time over the page's default assets. The toggles that change
 * a card carry their own variant; the attribute filters do not apply, which the card tooltip says.
 */
export type RwaOverviewCards = {
	defiByProtocol: { withBridges: RwaDefiProtocolCard; withoutBridges: RwaDefiProtocolCard }
	chainChange: RwaChainChangeCard
	perpsOpenInterest: { withCex: RwaOpenInterestCard; dexOnly: RwaOpenInterestCard }
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
	const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp)
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
	for (const chain of new Set([...Object.keys(latest), ...Object.keys(prior)])) {
		if (chain === 'timestamp') continue
		const now = latest[chain] ?? 0
		const then = prior[chain] ?? 0
		const changeUsd = now - then
		if (changeUsd === 0) continue
		changes.push({ name: chain, changeUsd, changePct: percentChange(now, then) })
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

/** Open interest and volume over the perps rows the CEX toggle allows; 24h priors from each row's own change. */
export function foldRwaPerpsTotals(assets: Array<RWAOverviewDisplayRow>, includeCex: boolean): RwaPerpsTotals {
	let openInterest: number | null = null
	let dexOpenInterest = 0
	let volume24h: number | null = null
	let current: number | null = null
	let prior: number | null = null
	for (const asset of assets) {
		if (asset.kind !== 'perps') continue
		if (!includeCex && asset.venueType === 'CEX') continue
		if (asset.openInterest != null) {
			openInterest = (openInterest ?? 0) + asset.openInterest
			if (asset.venueType === 'DEX') dexOpenInterest += asset.openInterest
			if (asset.openInterestChange24h != null && asset.openInterestChange24h > -100) {
				current = (current ?? 0) + asset.openInterest
				prior = (prior ?? 0) + asset.openInterest / (1 + asset.openInterestChange24h / 100)
			}
		}
		if (asset.volume24h != null) volume24h = (volume24h ?? 0) + asset.volume24h
	}
	return {
		openInterest,
		openInterestChange24h: { current, prior },
		dexShare: getRwaRatio(dexOpenInterest, openInterest),
		volume24h
	}
}

/** The value follows the Bridge TVL toggle; the bars leave bridges out either way (outline-final-final.pdf). */
function buildDefiProtocolCard(assets: Array<RWAOverviewDisplayRow>, includeBridgeTvl: boolean): RwaDefiProtocolCard {
	const totals = sumRwaKpiTotals(assets, includeBridgeTvl)
	const { current, prior } = totals.change['1m'].defiActiveTvl
	return {
		value: totals.defiActiveTvl,
		changeUsd: current == null || prior == null ? null : current - prior,
		changePct: percentChange(current, prior),
		bars: rankRwaDefiProtocols(assets, false)
	}
}

function buildOpenInterestCard(rows: Array<RWAChartRow>): RwaOpenInterestCard {
	const series = foldRwaSeriesTotal(rows)
	const latest = series[series.length - 1]
	return {
		value: latest ? latest[1] : null,
		changePct: changeOver(series, RWA_CARD_CHANGE_DAYS).changePct,
		series
	}
}

export function buildRwaOverviewCards({
	assets,
	chainRows,
	openInterestRows
}: {
	/** The page's assets after its default rules: no stablecoins, governance, wrappers or suspicious rows. */
	assets: Array<RWAOverviewDisplayRow>
	/** The server chain split for active mcap, timestamps in ms. */
	chainRows: Array<RWAChartRow>
	/** The perps venue split for open interest, timestamps in ms, per CEX toggle. */
	openInterestRows: { withCex: Array<RWAChartRow>; dexOnly: Array<RWAChartRow> }
}): RwaOverviewCards {
	const totals = sumRwaKpiTotals(assets, true)
	const { current, prior } = totals.change['1m'].activeMcap
	return {
		defiByProtocol: {
			withBridges: buildDefiProtocolCard(assets, true),
			withoutBridges: buildDefiProtocolCard(assets, false)
		},
		chainChange: {
			value: totals.activeMcap,
			changeUsd: current == null || prior == null ? null : current - prior,
			changePct: percentChange(current, prior),
			bars: rankRwaChainChanges(chainRows, { days: RWA_CARD_CHANGE_DAYS, each: RWA_CARD_CHAIN_EACH })
		},
		perpsOpenInterest: {
			withCex: buildOpenInterestCard(openInterestRows.withCex),
			dexOnly: buildOpenInterestCard(openInterestRows.dexOnly)
		}
	}
}
