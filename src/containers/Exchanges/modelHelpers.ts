import { resolveCountryAvailability } from './countryAvailability'
import type { MasterExchangeRegionCatalogResponse } from './master.types'
import type {
	ExchangeDepthLadder,
	ExchangeDirectoryRowModel,
	ExchangeNormalizedVolume,
	ExchangeSegment,
	ExchangeSegmentActivity,
	ExchangeVenueKind
} from './models'
import { EXCHANGE_SEGMENT_LABELS, EXCHANGE_SEGMENTS } from './models'
import { DIRECTORY_ALL_SEGMENTS, type DirectoryScope } from './queryState'

/** Base row order: internal quality score descending, tie-broken on rank. Score is
 * comparable across CEX and DEX; `rank` is the position within a venue's own kind and
 * only breaks ties here. Unranked venues sort last, by volume — the part a column sort
 * can't express, which is why this pre-sort stays even though the table now ALSO
 * exposes it: the Exchange column sorts on this same comparator, so a reader who
 * sorted by any other column can get the ranked order back. The pre-sort stays
 * because it supplies the tie and fallback order underneath TanStack's stable sort. */
export function byQualityRank(a: ExchangeDirectoryRowModel, b: ExchangeDirectoryRowModel): number {
	if (a.quality && b.quality) return b.quality.score - a.quality.score || a.quality.rank - b.quality.rank
	if (a.quality) return -1
	if (b.quality) return 1
	return (b.totalVolume24h ?? 0) - (a.totalVolume24h ?? 0)
}

/**
 * Right-aligned element-wise sum of two trailing-daily spark series. Each
 * series ends at its venue's most recent day, so align by the last element and
 * sum overlapping tails; where only one series reaches back that far, its value
 * carries through. Length = the longer of the two.
 */
export function sumSparks(base: Array<number>, add: Array<number>): Array<number> {
	const length = Math.max(base.length, add.length)
	const result = new Array<number>(length)
	for (let offset = 1; offset <= length; offset++) {
		result[length - offset] = (base[base.length - offset] ?? 0) + (add[add.length - offset] ?? 0)
	}
	return result
}

/**
 * Combine two normalized-volume figures for a brand aggregate. Reported and
 * normalized are additive; the discount is recomputed from the summed totals
 * and the unverified share is reported-weighted so the blend stays a true
 * fraction of the combined book.
 */
export function combineNormalizedVolume(
	base: ExchangeNormalizedVolume,
	add: ExchangeNormalizedVolume
): ExchangeNormalizedVolume {
	const reported = base.reported + add.reported
	const normalized = base.normalized + add.normalized
	return {
		reported,
		normalized,
		activeLiquidity: base.activeLiquidity + add.activeLiquidity,
		activeLiquidityForCap: base.activeLiquidityForCap + add.activeLiquidityForCap,
		discountFraction: reported > 0 ? 1 - normalized / reported : 0,
		unverifiedFraction:
			reported > 0 ? (base.unverifiedFraction * base.reported + add.unverifiedFraction * add.reported) / reported : 0,
		flag: base.flag ?? add.flag
	}
}

export type DirectoryKind = 'all' | ExchangeVenueKind

/** The segments a scope covers: itself, or spot + USD perps for the merged view. */
export function scopeSegments(scope: DirectoryScope): ReadonlyArray<ExchangeSegment> {
	return scope === 'all' ? DIRECTORY_ALL_SEGMENTS : [scope]
}

export function filterDirectoryRows(
	rows: Array<ExchangeDirectoryRowModel>,
	filters: {
		kind: DirectoryKind
		scope: DirectoryScope
		country?: string | null
		catalog?: MasterExchangeRegionCatalogResponse | null
	}
): Array<ExchangeDirectoryRowModel> {
	const segments = scopeSegments(filters.scope)
	const result: Array<ExchangeDirectoryRowModel> = []
	for (const row of rows) {
		if (filters.kind !== 'all' && row.kind !== filters.kind) continue
		// Tracked venues must have tracked activity in the scope; a regional
		// variant advertising a segment does not waive this gate. In the merged view
		// any covered segment qualifies, so a COIN-perp-only venue is left out —
		// there is nothing for it to fill a column with.
		if (row.tracked && !segments.some((segment) => activityForScope(row, segment) !== null)) continue
		if (!filters.country || !filters.catalog) {
			result.push(row)
			continue
		}
		if (!row.regional) continue

		const availability = resolveCountryAvailability(filters.catalog, row.regional, filters.country)
		// Available in ANY segment the scope covers — a venue offering only spot in a
		// country still belongs in the merged view, with its perp cells empty.
		if (
			availability.availability === 'unavailable' ||
			!segments.some((segment) => availability.segments.includes(segment))
		) {
			continue
		}
		// Funding is authored per region for several venues (Coinbase and Gemini keep
		// ALL their rails on regions.us/eea/gb and nothing at the root), so once a
		// country is chosen the row's root-derived funding is the wrong answer — it
		// reports "no fiat on-ramp" for exactly those venues. Prefer the region's own
		// figures; fall back to the root block when the cache predates them, so an
		// older cache degrades to today's behaviour rather than to blank cells.
		const regionFunding = availability.funding
		result.push({
			...row,
			funding:
				row.funding && regionFunding
					? {
							...row.funding,
							hasFiatOnramp: regionFunding.has_fiat_onramp,
							fiatCurrencies: row.funding.fiatCurrencies,
							rampCostRegion: regionFunding.ramp_cost_1k
								? {
										onRampUsd: regionFunding.ramp_cost_1k.on_ramp_usd,
										offRampUsd: regionFunding.ramp_cost_1k.off_ramp_usd,
										currency: regionFunding.ramp_cost_1k.currency,
										onRail: regionFunding.ramp_cost_1k.on_rail,
										offRail: regionFunding.ramp_cost_1k.off_rail
									}
								: null
						}
					: row.funding,
			selectedCountry: filters.country,
			selectedCountryStatus: availability.availability
		})
	}
	return result
}

export function sumNullable(values: Array<number | null>): number | null {
	let total = 0
	let hasValue = false
	for (const value of values) {
		if (value == null) continue
		total += value
		hasValue = true
	}
	return hasValue ? total : null
}

/** Segment scopes are exact: a segment's activity is surfaced as-is, never summed with another segment. */
export function activityForScope(
	row: ExchangeDirectoryRowModel,
	scope: ExchangeSegment
): ExchangeSegmentActivity | null {
	return row.segments[scope] ?? null
}

export function sparklineForScope(row: ExchangeDirectoryRowModel, scope: ExchangeSegment): Array<number> {
	return row.sparks[scope] ?? []
}

export function normalizedVolumeForScope(
	row: ExchangeDirectoryRowModel,
	scope: ExchangeSegment
): ExchangeNormalizedVolume | null {
	return row.normalizedVolume?.[scope] ?? null
}

export type DirectoryTreeRow = ExchangeDirectoryRowModel & { subRows?: Array<ExchangeDirectoryRowModel> }

/** A synthetic brand segment keeps only fields that remain valid after aggregation. */
function brandSegmentActivity(activity: ExchangeSegmentActivity): ExchangeSegmentActivity {
	return {
		marketCount: activity.marketCount,
		coinCount: null,
		volume24h: activity.volume24h,
		volumePrevious24h: activity.volumePrevious24h,
		openInterestUsd: activity.openInterestUsd,
		openInterestPreviousUsd: activity.openInterestPreviousUsd,
		depthBidUsd: activity.depthBidUsd,
		depthAskUsd: activity.depthAskUsd,
		depthPartial: activity.depthPartial,
		depthLadder: activity.depthLadder ? [...activity.depthLadder] : null,
		volumeUpdatedAt: null,
		supportsOpenInterest: activity.supportsOpenInterest,
		supportsDepth: activity.supportsDepth
	}
}

/** Band-wise sum of two ladders, matching how the ±2% depth column already adds a
 *  child's own book into its brand row. Coverage is volume-weighted, the same
 *  definition the backend uses across a segment's pairs, so a shallow child can't
 *  make a deep parent's band read unmeasured. */
function addDepthLadder(base: ExchangeSegmentActivity, added: ExchangeSegmentActivity): ExchangeDepthLadder | null {
	if (!base.depthLadder) return added.depthLadder ? [...added.depthLadder] : null
	if (!added.depthLadder) return [...base.depthLadder]
	if (base.depthLadder.length !== added.depthLadder.length) return [...base.depthLadder]
	const baseWeight = base.volume24h ?? 0
	const addedWeight = added.volume24h ?? 0
	const totalWeight = baseWeight + addedWeight
	return base.depthLadder.map((band, index) => {
		const other = added.depthLadder![index]
		return {
			band: band.band,
			bidUsd: sumNullable([band.bidUsd, other.bidUsd]),
			askUsd: sumNullable([band.askUsd, other.askUsd]),
			coverage:
				totalWeight > 0
					? (band.coverage * baseWeight + other.coverage * addedWeight) / totalWeight
					: (band.coverage + other.coverage) / 2
		}
	})
}

/** Sum a child's own-book contribution into a brand-row segment; identity fields stay the parent's. */
function addSegmentActivity(base: ExchangeSegmentActivity, added: ExchangeSegmentActivity): ExchangeSegmentActivity {
	return {
		marketCount: base.marketCount + added.marketCount,
		coinCount: null,
		volume24h: sumNullable([base.volume24h, added.volume24h]),
		volumePrevious24h: sumNullable([base.volumePrevious24h, added.volumePrevious24h]),
		openInterestUsd: sumNullable([base.openInterestUsd, added.openInterestUsd]),
		openInterestPreviousUsd: sumNullable([base.openInterestPreviousUsd, added.openInterestPreviousUsd]),
		depthBidUsd: sumNullable([base.depthBidUsd, added.depthBidUsd]),
		depthAskUsd: sumNullable([base.depthAskUsd, added.depthAskUsd]),
		depthPartial: base.depthPartial || added.depthPartial,
		depthLadder: addDepthLadder(base, added),
		volumeUpdatedAt: null,
		supportsOpenInterest: base.supportsOpenInterest || added.supportsOpenInterest,
		supportsDepth: base.supportsDepth || added.supportsDepth
	}
}

/**
 * Presentation-only brand aggregation: the parent venue's figures plus each
 * child's own-book segments. Shared segments (full or subset) are already
 * inside the parent's own book and are never added — e.g. the OKX brand adds
 * only OKX EU's linear_perp, never its shared EUR-quoted spot subset. Volume,
 * open interest, depth, normalized volume, and the volume trend all follow this
 * one rule; coin counts are distinct-coin figures and are not additive.
 */
function brandRow(
	parent: ExchangeDirectoryRowModel,
	children: Array<ExchangeDirectoryRowModel>
): ExchangeDirectoryRowModel {
	const segments: ExchangeDirectoryRowModel['segments'] = {}
	const sparks: ExchangeDirectoryRowModel['sparks'] = {}
	const normalizedVolume: Record<ExchangeSegment, ExchangeNormalizedVolume | null> = {
		spot: null,
		linear_perp: null,
		inverse_perp: null
	}
	// Seed from the parent (the brand's own global book) across every segment.
	for (const segment of EXCHANGE_SEGMENTS) {
		const activity = parent.segments[segment]
		if (activity) segments[segment] = brandSegmentActivity(activity)
		const spark = parent.sparks[segment]
		if (spark?.length) sparks[segment] = [...spark]
		normalizedVolume[segment] = parent.normalizedVolume?.[segment] ?? null
	}
	// Add only each child's independently-booked (own) segments.
	for (const child of children) {
		for (const segment of EXCHANGE_SEGMENTS) {
			if (child.liquidity[segment]?.mode !== 'own') continue
			const contribution = child.segments[segment]
			if (contribution) {
				const existing = segments[segment]
				segments[segment] = existing ? addSegmentActivity(existing, contribution) : brandSegmentActivity(contribution)
			}
			const spark = child.sparks[segment]
			if (spark?.length) sparks[segment] = sumSparks(sparks[segment] ?? [], spark)
			const nvol = child.normalizedVolume?.[segment]
			if (nvol) {
				const existing = normalizedVolume[segment]
				normalizedVolume[segment] = existing ? combineNormalizedVolume(existing, nvol) : nvol
			}
		}
	}
	const hasNormalizedVolume = EXCHANGE_SEGMENTS.some((segment) => normalizedVolume[segment] !== null)
	// Non-activity facts (reserves, fees, compliance, funding, profile, warnings) stay
	// the parent's own — they are brand-level facts, not sums, and blanking them made the
	// brand row read as "no data" and sort last in every non-activity view (Binance below
	// venues a thousandth its size in Transparency). Children keep their own values.
	//
	// Quality rank: the brand row wears the family's BEST rank (usually the parent's,
	// but a family is as strong as its strongest member); each child row keeps its own.
	let bestQuality: ExchangeDirectoryRowModel['quality'] = null
	for (const row of [parent, ...children]) {
		if (row.quality && (!bestQuality || row.quality.score > bestQuality.score)) bestQuality = row.quality
	}
	return {
		...parent,
		quality: bestQuality,
		segments,
		sparks,
		normalizedVolume: hasNormalizedVolume ? normalizedVolume : null
	}
}

/**
 * Nest venues under their parent entity when the parent is itself a listed row,
 * mirroring the protocol table's parent/child convention. Rows whose parent is
 * absent from the current row set stay at the top level. A parent with children
 * becomes the brand row — its figures aggregate the global venue plus each
 * child's own-book segments — and the global venue itself reappears as the
 * first child row with its own unmodified figures. Parents without children
 * render exactly as before.
 */
export function nestDirectoryRows(rows: Array<ExchangeDirectoryRowModel>): Array<DirectoryTreeRow> {
	const slugs = new Set(rows.map((row) => row.slug))
	const childrenByParent = new Map<string, Array<ExchangeDirectoryRowModel>>()
	const topLevel: Array<ExchangeDirectoryRowModel> = []
	for (const row of rows) {
		const parentSlug = row.parent?.slug
		if (parentSlug && slugs.has(parentSlug)) {
			const siblings = childrenByParent.get(parentSlug)
			if (siblings) siblings.push(row)
			else childrenByParent.set(parentSlug, [row])
		} else {
			topLevel.push(row)
		}
	}
	if (childrenByParent.size === 0) return topLevel
	return topLevel.map((row) => {
		const children = childrenByParent.get(row.slug)
		return children ? { ...brandRow(row, children), subRows: [row, ...children] } : row
	})
}

/**
 * Per-segment order-book relationship of a child venue to its parent, built
 * generically from liquidity modes and shared coverage — e.g. "Spot: shares
 * OKX's order book (subset of pairs, volume also counted under OKX). Linear
 * Perps: operates its own order book, separate from OKX."
 */
export function describeChildLiquidity(row: ExchangeDirectoryRowModel): string | null {
	if (!row.parent) return null
	const parts: Array<string> = []
	for (const segment of EXCHANGE_SEGMENTS) {
		const relation = row.liquidity[segment]
		if (!relation) continue
		const label = EXCHANGE_SEGMENT_LABELS[segment]
		if (relation.mode === 'shared') {
			parts.push(
				relation.coverage === 'full'
					? `${label}: presents ${relation.source.name}'s order book.`
					: `${label}: shares ${relation.source.name}'s order book (subset of pairs, volume also counted under ${relation.source.name}).`
			)
		} else {
			parts.push(`${label}: operates its own order book, separate from ${row.parent.name}.`)
		}
	}
	return parts.length > 0 ? parts.join('\n') : null
}

export function fractionChange(current: number | null | undefined, previous: number | null | undefined): number | null {
	if (current == null || previous == null || previous <= 0) return null
	return current / previous - 1
}

/** Raw 24h-volume ÷ open-interest ratio (turnover). Null unless the venue
 * supports OI and reports a positive value. */
export function volumeToOpenInterest(activity: ExchangeSegmentActivity | null): number | null {
	if (!activity?.supportsOpenInterest) return null
	const { volume24h, openInterestUsd } = activity
	if (volume24h == null || openInterestUsd == null || openInterestUsd <= 0) return null
	return volume24h / openInterestUsd
}

/** Raw 24h-volume ÷ ±2% depth ratio. Null unless depth is supported and positive. */
export function volumeToDepth(activity: ExchangeSegmentActivity | null): number | null {
	if (!activity?.supportsDepth) return null
	const depth = depthTotal(activity)
	if (activity.volume24h == null || depth == null || depth <= 0) return null
	return activity.volume24h / depth
}

export function depthTotal(activity: ExchangeSegmentActivity | null): number | null {
	if (!activity) return null
	return sumNullable([activity.depthBidUsd, activity.depthAskUsd])
}

export type DepthMetricState =
	| { state: 'unsupported' }
	| { state: 'missing' }
	| { state: 'observed'; value: number; partial: boolean }

export function depthMetricState(activity: ExchangeSegmentActivity | null): DepthMetricState {
	if (!activity || !activity.supportsDepth) return { state: 'unsupported' }
	const value = depthTotal(activity)
	if (value == null) return { state: 'missing' }
	return {
		state: 'observed',
		value,
		partial: activity.depthPartial || activity.depthBidUsd == null || activity.depthAskUsd == null
	}
}
