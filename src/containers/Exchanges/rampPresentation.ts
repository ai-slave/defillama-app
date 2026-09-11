import type { MasterExchangeRegionCatalogResponse } from './master.types'
import type {
	ExchangeRegionStatus,
	ExchangeVenueRankModel,
	RampCatalogModel,
	RampCurrencyCostModel,
	RampTradeLegsModel,
	RampVariantModel,
	RampVenueModel
} from './models'

/** One table row: a venue resolved for the selected country, currency and size. */
export interface RampRowModel {
	exchange: string
	/** Parent brand when this venue is a child entity. Carried for callers that want the
	 *  relationship; this table lists parent and child as separate rows. */
	parentSlug: string | null
	name: string
	profileHref: string
	website: string | null
	referralUrl: string | null
	variant: RampVariantModel
	status: ExchangeRegionStatus
	note: string | null
	/** True when the venue authored no record for this region and the global one applied. */
	usedFallback: boolean
	/** Priced legs in the selected currency; null when the venue has no rail in it. */
	cost: RampCurrencyCostModel | null
	trade: RampTradeLegsModel | null
	/** Execution alone: taker fee + book slippage. */
	tradeCostUsd: number | null
	/** In and back out at the same size; null unless both directions are complete. */
	roundTripUsd: number | null
	roundTripFraction: number | null
	/** REAL score, null for a venue not scored yet. The table's default order. */
	rank: ExchangeVenueRankModel | null
}

/** The record that best represents a venue when no country is selected: one that prices the
 *  selected currency, else one carrying rails, preferring `global`, in a stable region order.
 *
 *  Currency comes first because region order does not: Kraken authors rails in seven regions
 *  and the alphabetically-first is `ar`, so the unfiltered table used to present the world's
 *  larger fiat ramp as an Argentine ARS venue with no price under the USD default. */
function preferredVariant(venue: RampVenueModel, currency: string | null, size: number): RampVariantModel | null {
	const regions = Object.keys(venue.variants).sort()
	// A regional entity's own regions come before `global`. Its global record is the
	// "not available outside my region" marker and it carries the SAME cost block, so a
	// global-first order picked the unavailable twin of a venue that is perfectly
	// available where it operates — Binance.US, OKX EU, Bitvavo and 23 others read as
	// unavailable until a country was selected.
	const own = venue.scope.kind === 'regional' ? venue.scope.regions : []
	const ordered = [...own, 'global', ...regions.filter((region) => region !== 'global' && !own.includes(region))]
		.map((region) => venue.variants[region])
		.filter((variant): variant is RampVariantModel => Boolean(variant))
	const key = String(size)
	const pricesCurrency = (variant: RampVariantModel) => {
		const row = currency ? variant.cost[currency]?.[key] : undefined
		return row ? roundTrip(row) != null : false
	}
	// The last resort is `ordered[0]`, which is the global record for a global venue and
	// the venue's own region for a regional one. Reaching for `variants.global` directly
	// here sent five EEA venues whose own record carries no rails yet (Bitpanda, eToro,
	// Strike, Trading 212, Bitstamp EU) back to their unavailable global twin.
	return (
		ordered.find(pricesCurrency) ??
		ordered.find((variant) => currency && variant.cost[currency]?.[key]) ??
		ordered.find((variant) => variant.rails) ??
		ordered[0] ??
		null
	)
}

/**
 * Same resolution order as the profile surfaces' `resolveCountryAvailability`:
 * the exact region variant when the venue authored one, else its global record,
 * then that country's own carve-out on top.
 */
export function resolveRampVariant(
	venue: RampVenueModel,
	country: string | null,
	catalog: MasterExchangeRegionCatalogResponse | null,
	options: { currency?: string | null; size?: number } = {}
): { variant: RampVariantModel; status: ExchangeRegionStatus; note: string | null; usedFallback: boolean } | null {
	const region = country && catalog ? catalog.country_regions[country] : null
	// A regional entity is not an option outside its own regions. Its global record exists
	// (marked unavailable) so the profile can say so, but on a cost table it would render a
	// second row under the parent's name — "Bitstamp" and "Crypto.com" appeared twice for a
	// US reader, the EU entity carrying either blanks or EUR-only rails.
	if (region && venue.scope.kind === 'regional' && !venue.scope.regions.includes(region)) return null
	const exact = region ? venue.variants[region] : undefined
	// With no country picked there is nothing to resolve against, and the global
	// record is the wrong answer for two common shapes: an EU-only entity is
	// "unavailable" globally, and Coinbase/Kraken keep their rails on regional
	// records while their global one has none. Both would render an empty row. So the
	// unfiltered view shows the venue at its best — the record that actually prices the
	// selected currency — and the Access badge reports that record's own status.
	const variant =
		exact ?? (country ? venue.variants.global : preferredVariant(venue, options.currency ?? null, options.size ?? 0))
	if (!variant) return null
	const override = country ? variant.countryOverrides[country] : undefined
	const status =
		variant.status === 'unavailable' || override?.status === 'unavailable'
			? 'unavailable'
			: (override?.status ?? variant.status)
	return { variant, status, note: override?.note ?? variant.note, usedFallback: Boolean(country) && !exact }
}

const roundTrip = (row: RampCurrencyCostModel): number | null =>
	row.onRamp.totalUsd == null || row.offRamp.totalUsd == null ? null : row.onRamp.totalUsd + row.offRamp.totalUsd

/**
 * A selected currency is a filter, not a hint: the cost columns show that currency's
 * rails or nothing. This used to fall back to whichever currency priced the trip most
 * cheaply, flagged with a superscript — which put a EUR number in a USD-selected table
 * and made two venues incomparable at a glance. A venue with no rail in the selection
 * keeps its row (its rails and accepted currencies still answer "could I use it?") and
 * sinks to the bottom, where the sort puts every unpriced row.
 *
 * With no currency selected, the cheapest priced currency stands in — that is the state
 * `rampCurrencyOptions` reads to build the dropdown.
 */
export function selectRampCost(
	variant: RampVariantModel,
	currency: string | null,
	size: number
): RampCurrencyCostModel | null {
	const key = String(size)
	if (currency) return variant.cost[currency]?.[key] ?? null

	let best: RampCurrencyCostModel | null = null
	let bestTotal = Number.POSITIVE_INFINITY
	let partial: RampCurrencyCostModel | null = null
	for (const bySize of Object.values(variant.cost)) {
		const row = bySize?.[key]
		if (!row) continue
		const total = roundTrip(row)
		if (total == null) {
			// Remember a one-directional answer in case nothing prices both ways.
			if (!partial && (row.onRamp.totalUsd != null || row.offRamp.totalUsd != null)) partial = row
			continue
		}
		if (total < bestTotal) {
			best = row
			bestTotal = total
		}
	}
	return best ?? partial
}

function tradeCost(trade: RampTradeLegsModel | null): number | null {
	if (!trade || trade.tradeFeeUsd == null || trade.slippageBuyUsd == null) return null
	return trade.tradeFeeUsd + trade.slippageBuyUsd
}

const ACCESS_TIER: Record<ExchangeRegionStatus, number> = { available: 0, restricted: 1, leaving: 1, unavailable: 2 }

/**
 * Best REAL score first among venues the selected country can fully use, with the round
 * trip as the tiebreak: the cheapest quote is not the answer on its own, since a venue can
 * price a trip it cannot be trusted to deliver. Rows sink instead of being hidden —
 * restricted/leaving venues below the available ones, unavailable ones last, unscored
 * venues under the scored, and within each tier a venue we cannot price completely (blank
 * is not free) goes after the priced.
 *
 * Every listed entity is its own row, parents and regional children alike (Binance and
 * Binance.US, OKX and OKX EU). They price different rails in different currencies, so
 * folding a brand into one row — by collapse or by nesting — hid an answer the reader came
 * for. Their names differ on screen, which is enough to tell them apart.
 */
function byRampOrder(left: RampRowModel, right: RampRowModel): number {
	const tier = ACCESS_TIER[left.status] - ACCESS_TIER[right.status]
	if (tier !== 0) return tier
	const score = (right.rank?.score ?? -1) - (left.rank?.score ?? -1)
	if (score !== 0) return score
	if (left.roundTripUsd == null && right.roundTripUsd == null) return left.name.localeCompare(right.name)
	if (left.roundTripUsd == null) return 1
	if (right.roundTripUsd == null) return -1
	return left.roundTripUsd - right.roundTripUsd || left.name.localeCompare(right.name)
}

export function buildRampRows(
	catalog: RampCatalogModel,
	options: {
		country: string | null
		regionCatalog: MasterExchangeRegionCatalogResponse | null
		currency: string | null
		size: number
	}
): Array<RampRowModel> {
	const rows: Array<RampRowModel> = []
	for (const venue of catalog.venues) {
		const resolved = resolveRampVariant(venue, options.country, options.regionCatalog, {
			currency: options.currency,
			size: options.size
		})
		if (!resolved) continue
		const cost = selectRampCost(resolved.variant, options.currency, options.size)
		const trade = resolved.variant.trade[String(options.size)] ?? null
		const roundTripUsd = cost ? roundTrip(cost) : null
		rows.push({
			exchange: venue.exchange,
			parentSlug: venue.parentSlug,
			name: venue.name,
			profileHref: venue.profileHref,
			website: venue.website,
			referralUrl: venue.referralUrl,
			variant: resolved.variant,
			status: resolved.status,
			note: resolved.note,
			usedFallback: resolved.usedFallback,
			cost,
			trade,
			tradeCostUsd: tradeCost(trade),
			roundTripUsd,
			roundTripFraction: roundTripUsd == null ? null : roundTripUsd / options.size,
			rank: venue.rank
		})
	}
	return rows.sort(byRampOrder)
}

/** Currencies any visible venue prices at the selected size, for the currency select.
 *  Size-aware on purpose: a currency priced only at another size would be offered,
 *  selected, and then fall back on every row — a selection that appears to do nothing. */
export function rampCurrencyOptions(rows: Array<RampRowModel>, size: number): Array<string> {
	const key = String(size)
	const currencies = new Set<string>()
	for (const row of rows) {
		for (const [currency, bySize] of Object.entries(row.variant.cost)) {
			if (bySize?.[key]) currencies.add(currency)
		}
	}
	return [...currencies].sort()
}

/**
 * USD is the default rail currency everywhere: every column is denominated in USD,
 * it is the most widely published rail, and a per-country default made the same
 * venue's numbers change meaning as you moved the country selector. A venue with no
 * USD rail shows no cost rather than a number in another currency — the Fiat ccy column
 * says which currencies it does take, and picking EUR/GBP/… is one click.
 */
export const DEFAULT_RAMP_CURRENCY = 'USD'
