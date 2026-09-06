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
	name: string
	profileHref: string
	website: string | null
	referralUrl: string | null
	variant: RampVariantModel
	status: ExchangeRegionStatus
	note: string | null
	/** True when the venue authored no record for this region and the global one applied. */
	usedFallback: boolean
	/** Priced legs for the selected currency, or the cheapest currency with a rail. */
	cost: RampCurrencyCostModel | null
	/** True when `cost` is not in the selected currency (it doesn't price the full round trip). */
	costIsFallback: boolean
	trade: RampTradeLegsModel | null
	/** Execution alone: taker fee + book slippage. */
	tradeCostUsd: number | null
	/** In and back out at the same size; null unless both directions are complete. */
	roundTripUsd: number | null
	roundTripFraction: number | null
}

/** The record that best represents a venue when no country is selected: the one
 *  carrying rails, preferring `global`, in a stable region order. */
function preferredVariant(venue: RampVenueModel): RampVariantModel | null {
	if (venue.variants.global?.rails) return venue.variants.global
	const withRails = Object.keys(venue.variants)
		.sort()
		.map((region) => venue.variants[region])
		.find((variant) => variant?.rails)
	return withRails ?? venue.variants.global ?? null
}

/**
 * Same resolution order as the profile surfaces' `resolveCountryAvailability`:
 * the exact region variant when the venue authored one, else its global record,
 * then that country's own carve-out on top.
 */
export function resolveRampVariant(
	venue: RampVenueModel,
	country: string | null,
	catalog: MasterExchangeRegionCatalogResponse | null
): { variant: RampVariantModel; status: ExchangeRegionStatus; note: string | null; usedFallback: boolean } | null {
	const region = country && catalog ? catalog.country_regions[country] : null
	const exact = region ? venue.variants[region] : undefined
	// With no country picked there is nothing to resolve against, and the global
	// record is the wrong answer for two common shapes: an EU-only entity is
	// "unavailable" globally, and Coinbase/Kraken keep their rails on regional
	// records while their global one has none. Both would render an empty row. So the
	// unfiltered view shows the venue at its best — the record that actually has
	// rails — and the Access badge reports that record's own status.
	const variant = exact ?? (country ? venue.variants.global : preferredVariant(venue))
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
 * The selected currency's priced legs, else the cheapest currency that actually
 * prices the trip — flagged, so a EUR number never reads as a USD one.
 *
 * "Has a rail in that currency" is not the test; "prices the trip in it" is. A venue
 * can publish a USD deposit rail and no USD withdrawal, which leaves the USD row
 * half-priced while its EUR row is complete. Keeping the requested currency there
 * blanked most of the table under the USD default while a full EUR answer sat one
 * key away. The requested currency still wins whenever it prices the trip, even if
 * another currency is cheaper — the reader picked it.
 */
export function selectRampCost(
	variant: RampVariantModel,
	currency: string | null,
	size: number
): { cost: RampCurrencyCostModel | null; isFallback: boolean } {
	const key = String(size)
	const wanted = currency ? variant.cost[currency]?.[key] : undefined
	if (wanted && roundTrip(wanted) != null) return { cost: wanted, isFallback: false }

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
	if (best) return { cost: best, isFallback: best.currency !== currency }
	// Nothing prices the full trip: keep the requested currency's row when it exists
	// (its legs and rail names are still the ones the reader asked about).
	if (wanted) return { cost: wanted, isFallback: false }
	return { cost: partial, isFallback: partial !== null && partial.currency !== currency }
}

function tradeCost(trade: RampTradeLegsModel | null): number | null {
	if (!trade || trade.tradeFeeUsd == null || trade.slippageBuyUsd == null) return null
	return trade.tradeFeeUsd + trade.slippageBuyUsd
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
		const resolved = resolveRampVariant(venue, options.country, options.regionCatalog)
		if (!resolved) continue
		const { cost, isFallback } = selectRampCost(resolved.variant, options.currency, options.size)
		const trade = resolved.variant.trade[String(options.size)] ?? null
		const roundTripUsd = cost ? roundTrip(cost) : null
		rows.push({
			exchange: venue.exchange,
			name: venue.name,
			profileHref: venue.profileHref,
			website: venue.website,
			referralUrl: venue.referralUrl,
			variant: resolved.variant,
			status: resolved.status,
			note: resolved.note,
			usedFallback: resolved.usedFallback,
			cost,
			costIsFallback: isFallback,
			trade,
			tradeCostUsd: tradeCost(trade),
			roundTripUsd,
			roundTripFraction: roundTripUsd == null ? null : roundTripUsd / options.size
		})
	}
	// Cheapest round trip first. Two rows sink instead of being hidden: a venue we
	// cannot price completely (blank is not free) and one the selected country
	// cannot use (it stays visible so the Access badge can say why).
	return rows.sort((left, right) => {
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
 * USD rail still prices — `selectRampCost` falls back to its cheapest currency and
 * the cell says which. Picking EUR/GBP/… is one click.
 */
export const DEFAULT_RAMP_CURRENCY = 'USD'
