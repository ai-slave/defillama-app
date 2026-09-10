import type { MasterExchangeRegionCatalogResponse } from './master.types'
import type {
	ExchangeRegionStatus,
	RampCatalogModel,
	RampCurrencyCostModel,
	RampTradeLegsModel,
	RampVariantModel,
	RampVenueModel
} from './models'

/** One table row: a venue resolved for the selected country, currency and size. */
export interface RampRowModel {
	exchange: string
	/** Parent brand when this venue is a child entity, for the one-row-per-brand collapse. */
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
}

/** The record that best represents a venue when no country is selected: one that prices the
 *  selected currency, else one carrying rails, preferring `global`, in a stable region order.
 *
 *  Currency comes first because region order does not: Kraken authors rails in seven regions
 *  and the alphabetically-first is `ar`, so the unfiltered table used to present the world's
 *  larger fiat ramp as an Argentine ARS venue with no price under the USD default. */
function preferredVariant(venue: RampVenueModel, currency: string | null, size: number): RampVariantModel | null {
	const regions = Object.keys(venue.variants).sort()
	const ordered = ['global', ...regions.filter((region) => region !== 'global')]
		.map((region) => venue.variants[region])
		.filter((variant): variant is RampVariantModel => Boolean(variant))
	const key = String(size)
	const pricesCurrency = (variant: RampVariantModel) => {
		const row = currency ? variant.cost[currency]?.[key] : undefined
		return row ? roundTrip(row) != null : false
	}
	return (
		ordered.find(pricesCurrency) ??
		ordered.find((variant) => currency && variant.cost[currency]?.[key]) ??
		ordered.find((variant) => variant.rails) ??
		venue.variants.global ??
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

/** How well a row answers the current filter, for the brand collapse below. */
const brandRank = (row: RampRowModel) =>
	(row.status !== 'unavailable' ? 8 : 0) +
	(row.roundTripUsd != null ? 4 : 0) +
	(row.cost ? 2 : 0) +
	(row.variant.rails ? 1 : 0)

/**
 * One row per brand. A brand can be listed as several entities — Binance and Binance.US,
 * Bitstamp and Bitstamp EU — and on a cost table that reads as a duplicate: the same logo
 * and name twice, one of the two usually blank. The directory nests children under the
 * parent for this reason; a flat comparison table instead keeps the entity that best answers
 * the current filter, which is the one that actually prices the trip (so Binance.US wins for
 * a US reader and Binance elsewhere). Its own name and access badge still ride along, so the
 * row never claims to be an entity it isn't.
 */
function oneRowPerBrand(rows: Array<RampRowModel>): Array<RampRowModel> {
	const listed = new Set(rows.map((row) => row.exchange))
	const best = new Map<string, RampRowModel>()
	for (const row of rows) {
		// Group only when the parent is on the table too; an orphaned child stands alone.
		const brand = row.parentSlug && listed.has(row.parentSlug) ? row.parentSlug : row.exchange
		const current = best.get(brand)
		if (!current || brandRank(row) > brandRank(current)) best.set(brand, row)
	}
	return [...best.values()]
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
			roundTripFraction: roundTripUsd == null ? null : roundTripUsd / options.size
		})
	}
	// Cheapest round trip first. Two rows sink instead of being hidden: a venue we
	// cannot price completely (blank is not free) and one the selected country
	// cannot use (it stays visible so the Access badge can say why).
	return oneRowPerBrand(rows).sort((left, right) => {
		const blocked = Number(left.status === 'unavailable') - Number(right.status === 'unavailable')
		if (blocked !== 0) return blocked
		if (left.roundTripUsd == null && right.roundTripUsd == null) return left.name.localeCompare(right.name)
		if (left.roundTripUsd == null) return 1
		if (right.roundTripUsd == null) return -1
		return left.roundTripUsd - right.roundTripUsd || left.name.localeCompare(right.name)
	})
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
