import { inRange } from '~/components/Filters/quickPicks'
import { getQueryUpdatesFromSelected, readSelectionFromQuery } from '~/components/Select/query'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { parseNumberInput, parseNumberQueryParam } from '~/utils/routerQuery'
import type { RWAOverviewDisplayRow, RWAPerpsContractOverlayRow } from './api.types'
import {
	getRwaExcludeQueryKey,
	getRwaRowFilterValues,
	resolveRWAOverviewInclusionFlag,
	UNKNOWN_RWA_FILTER_VALUE
} from './filterState'
import { getRwaPlatforms } from './grouping'
import { getRwaOwnDimensions, getRwaPerpsInlineFilters } from './layout/inlineFilters'
import type { RWAPageKind } from './layout/pageLayout'
import { annualizeFundingRate } from './table/rows'

/**
 * The Perps tree's filters: the market's own fields, never the spot groups (Include toggles, AUM
 * ratios, compliance flags, Platforms). Pickers over the market's values and ranges over its numbers, all in the
 * URL, so a link carries the filter and Reset all clears it. The page's strip filters are the same records flagged
 * inline; More filters holds the rest. A page leaves out its own dimension; a picker with one value or a range no
 * market carries is not offered. Venue Type never removes a picker's value: it grays the values it leaves out.
 */

type QueryLike = Readonly<Record<string, string | Array<string> | undefined>>

type RWAPerpsSelectFilterId =
	| 'venues'
	| 'oracleProviders'
	| 'marginAssets'
	| 'fundingIntervals'
	| 'baseAssets'
	| 'assetClasses'
	| 'assetGroups'
	| 'accessModels'
	| 'issuers'

type RWAPerpsRangeFilterId = 'openInterest' | 'volume24h' | 'maxLeverage' | 'fundingApr' | 'premium' | 'takerFee'

export type RWAPerpsFilterGroup = 'Market' | 'Classification' | 'Metrics'

/** How a range's bounds read: dollars, a multiple or a percent. */
export type RWAPerpsRangeUnit = 'usd' | 'x' | 'percent'

export type RWAPerpsFilterDefinition =
	| {
			id: 'venueType'
			kind: 'venueType'
			label: string
			group: 'Market'
			inline: true
			/** Markets per choice. */
			counts: Record<RWAVenueTypeChoice, number>
	  }
	| {
			id: RWAPerpsSelectFilterId
			kind: 'select'
			label: string
			group: RWAPerpsFilterGroup
			/** Drawn in the page's strip rather than in More filters. */
			inline: boolean
			/** Every value across the page's markets, ranked by open interest, largest first. Venue Type never removes one,
			    so "every value" means the same under each choice and a pick never turns into it. */
			values: Array<string>
			/** Markets per value among those Venue Type keeps; a value at 0 is drawn grayed. */
			counts: Record<string, number>
			includeKey: string
			excludeKey: ExcludeQueryKey
			read: (row: PerpsRow) => Array<string>
	  }
	| {
			id: RWAPerpsRangeFilterId
			kind: 'range'
			label: string
			group: 'Metrics'
			inline: false
			unit: RWAPerpsRangeUnit
			minKey: string
			maxKey: string
			read: (row: PerpsRow) => number | null
	  }

type PerpsRow = RWAPerpsContractOverlayRow

export const RWA_VENUE_TYPE_OPTIONS = [
	{ key: 'all', name: 'DEX and CEX' },
	{ key: 'dex', name: 'DEX only' },
	{ key: 'cex', name: 'CEX only' }
] as const
export type RWAVenueTypeChoice = (typeof RWA_VENUE_TYPE_OPTIONS)[number]['key']

/** Venue Type in the URL: DEX only is `includeCex=false` (the key older links carry), CEX only is `includeDex=false`. */
export function readRwaVenueTypeChoice(query: QueryLike): RWAVenueTypeChoice {
	if (!resolveRWAOverviewInclusionFlag(query.includeCex, true)) return 'dex'
	if (!resolveRWAOverviewInclusionFlag(query.includeDex, true)) return 'cex'
	return 'all'
}

export function getRwaVenueTypeQueryPatch(
	choice: RWAVenueTypeChoice
): Record<'includeCex' | 'includeDex', 'false' | undefined> {
	return { includeCex: choice === 'dex' ? 'false' : undefined, includeDex: choice === 'cex' ? 'false' : undefined }
}

const keepsVenueType = (row: PerpsRow, choice: RWAVenueTypeChoice) =>
	choice === 'all' || (row.venueType === 'CEX') === (choice === 'cex')

const orUnknown = (value: string | null | undefined) => value?.trim() || UNKNOWN_RWA_FILTER_VALUE

const SELECT_FILTERS: ReadonlyArray<{
	id: RWAPerpsSelectFilterId
	label: string
	group: RWAPerpsFilterGroup
	read: (row: PerpsRow) => Array<string>
}> = [
	// The venue as the Venue column names it.
	{
		id: 'venues',
		label: 'Venue',
		group: 'Market',
		read: (row) => [orUnknown(row.venue ?? getRwaPlatforms(row.parentPlatform)[0])]
	},
	{ id: 'oracleProviders', label: 'Oracle Provider', group: 'Market', read: (row) => [orUnknown(row.oracleProvider)] },
	{ id: 'marginAssets', label: 'Margin Asset', group: 'Market', read: (row) => [orUnknown(row.marginAsset)] },
	{
		id: 'fundingIntervals',
		label: 'Funding Interval',
		group: 'Market',
		read: (row) => [row.fundingIntervalHours != null ? `${row.fundingIntervalHours}h` : UNKNOWN_RWA_FILTER_VALUE]
	},
	{
		id: 'assetClasses',
		label: 'Asset Class',
		group: 'Classification',
		read: (row) => getRwaRowFilterValues(row, 'assetClasses')
	},
	{
		id: 'assetGroups',
		label: 'Asset Group',
		group: 'Classification',
		read: (row) => getRwaRowFilterValues(row, 'assetGroups')
	},
	// `baseAssets` keeps the key older Perps links carry, so they keep filtering.
	{ id: 'baseAssets', label: 'Base Asset', group: 'Market', read: (row) => getRwaRowFilterValues(row, 'assetNames') },
	{
		id: 'accessModels',
		label: 'Access Model',
		group: 'Classification',
		read: (row) => getRwaRowFilterValues(row, 'accessModels')
	},
	{ id: 'issuers', label: 'Issuer', group: 'Classification', read: (row) => getRwaRowFilterValues(row, 'issuers') }
]

const percentOf = (value: number | null | undefined) => (value == null ? null : value * 100)

const RANGE_FILTERS: ReadonlyArray<{
	id: RWAPerpsRangeFilterId
	label: string
	unit: RWAPerpsRangeUnit
	keySuffix: string
	read: (row: PerpsRow) => number | null
}> = [
	{
		id: 'openInterest',
		label: 'Open Interest',
		unit: 'usd',
		keySuffix: 'OpenInterest',
		read: (row) => row.openInterest
	},
	{ id: 'volume24h', label: 'Volume 24h', unit: 'usd', keySuffix: 'Volume24h', read: (row) => row.volume24h },
	{
		id: 'maxLeverage',
		label: 'Max Leverage',
		unit: 'x',
		keySuffix: 'MaxLeverage',
		read: (row) => row.maxLeverage ?? null
	},
	{
		id: 'fundingApr',
		label: 'Funding (annualized)',
		unit: 'percent',
		keySuffix: 'FundingApr',
		read: (row) => annualizeFundingRate(row.fundingRate ?? null, row.fundingIntervalHours ?? null)
	},
	{ id: 'premium', label: 'Premium', unit: 'percent', keySuffix: 'Premium', read: (row) => percentOf(row.premium) },
	{
		id: 'takerFee',
		label: 'Taker Fee',
		unit: 'percent',
		keySuffix: 'TakerFee',
		read: (row) => percentOf(row.takerFeeRate)
	}
]

const isPerps = (row: RWAOverviewDisplayRow): row is PerpsRow => row.kind === 'perps'

/**
 * Every filter a Perps tree page offers for its markets, inline or in More filters. The pickers list every value;
 * their counts follow Venue Type, so under DEX only a CEX venue stays listed with a 0 count.
 */
export function getRwaPerpsFilterDefinitions(
	rows: ReadonlyArray<RWAOverviewDisplayRow>,
	kind: RWAPageKind,
	query: QueryLike = {}
): Array<RWAPerpsFilterDefinition> {
	const markets = rows.filter(isPerps)
	const own = getRwaOwnDimensions(kind)
	const inline = new Set<string>(getRwaPerpsInlineFilters(kind))
	const definitions: Array<RWAPerpsFilterDefinition> = []
	const cex = markets.filter((market) => market.venueType === 'CEX').length
	if (inline.has('venueType') && cex > 0 && cex < markets.length) {
		definitions.push({
			id: 'venueType',
			kind: 'venueType',
			label: 'Venue Type',
			group: 'Market',
			inline: true,
			counts: { all: markets.length, dex: markets.length - cex, cex }
		})
	}
	// A page without the Venue Type control ignores includeCex/includeDex, as filterRwaPerpsRows does, so an old
	// link carrying them neither grays values nor zeroes counts the table does not drop.
	const choice = definitions.length > 0 ? readRwaVenueTypeChoice(query) : 'all'
	for (const filter of SELECT_FILTERS) {
		if (own.includes(filter.id)) continue
		const weights = new Map<string, number>()
		const counts: Record<string, number> = {}
		for (const market of markets) {
			const kept = keepsVenueType(market, choice)
			for (const value of filter.read(market)) {
				weights.set(value, (weights.get(value) ?? 0) + (market.openInterest ?? 0))
				if (kept) counts[value] = (counts[value] ?? 0) + 1
			}
		}
		if (weights.size < 2) continue
		definitions.push({
			id: filter.id,
			kind: 'select',
			label: filter.label,
			group: filter.group,
			inline: inline.has(filter.id),
			values: [...weights].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value]) => value),
			counts,
			includeKey: filter.id,
			excludeKey: getRwaExcludeQueryKey(filter.id),
			read: filter.read
		})
	}
	for (const filter of RANGE_FILTERS) {
		if (!markets.some((market) => filter.read(market) != null)) continue
		definitions.push({
			id: filter.id,
			kind: 'range',
			label: filter.label,
			group: 'Metrics',
			inline: false,
			unit: filter.unit,
			minKey: `min${filter.keySuffix}`,
			maxKey: `max${filter.keySuffix}`,
			read: filter.read
		})
	}
	return definitions
}

type SelectDefinition = Extract<RWAPerpsFilterDefinition, { kind: 'select' }>
type RangeDefinition = Extract<RWAPerpsFilterDefinition, { kind: 'range' }>

/** The picked values, or null when the picker keeps every value. */
function readSelect(query: QueryLike, definition: SelectDefinition): Array<string> | null {
	const picked = readSelectionFromQuery(query, definition.includeKey, definition.excludeKey, definition.values)
	return picked.length < definition.values.length ? picked : null
}

function readRwaPerpsRange(query: QueryLike, definition: RangeDefinition) {
	return {
		min: parseNumberQueryParam(query[definition.minKey]),
		max: parseNumberQueryParam(query[definition.maxKey])
	}
}

const isRangeSet = (range: { min: number | null; max: number | null }) => range.min != null || range.max != null

/** The markets that pass every filter the page offers; spot rows pass through. */
export function filterRwaPerpsRows<T extends RWAOverviewDisplayRow>(
	rows: ReadonlyArray<T>,
	query: QueryLike,
	definitions: ReadonlyArray<RWAPerpsFilterDefinition>
): Array<T> {
	const tests: Array<(row: PerpsRow) => boolean> = []
	for (const definition of definitions) {
		if (definition.kind === 'venueType') {
			const choice = readRwaVenueTypeChoice(query)
			if (choice !== 'all') tests.push((row) => keepsVenueType(row, choice))
		} else if (definition.kind === 'select') {
			const picked = readSelect(query, definition)
			if (picked == null) continue
			const set = new Set(picked)
			tests.push((row) => definition.read(row).some((value) => set.has(value)))
		} else {
			const { min, max } = readRwaPerpsRange(query, definition)
			if (min == null && max == null) continue
			tests.push((row) => inRange(definition.read(row), min, max))
		}
	}
	if (tests.length === 0) return [...rows]
	return rows.filter((row) => !isPerps(row) || tests.every((test) => test(row)))
}

type RWAPerpsFilterPill = {
	definition: RWAPerpsFilterDefinition
	/** A select pill's picked values. */
	picked?: Array<string>
	/** A range pill's bounds. */
	range?: { min: number | null; max: number | null }
	clearKeys: Array<string>
}

const clearKeysOf = (definition: RWAPerpsFilterDefinition) =>
	definition.kind === 'venueType'
		? ['includeCex', 'includeDex']
		: definition.kind === 'select'
			? [definition.includeKey, definition.excludeKey]
			: [definition.minKey, definition.maxKey]

const isFilterSet = (query: QueryLike, definition: RWAPerpsFilterDefinition) =>
	definition.kind === 'venueType'
		? readRwaVenueTypeChoice(query) !== 'all'
		: definition.kind === 'select'
			? readSelect(query, definition) != null
			: isRangeSet(readRwaPerpsRange(query, definition))

/** The filters More filters holds: all but Venue Type, and from sm all but the inline ones, which draw in the strip. */
export function getRwaPerpsDialogFilters(
	definitions: ReadonlyArray<RWAPerpsFilterDefinition>,
	isPhone: boolean
): Array<RWAPerpsFilterDefinition> {
	return definitions.filter((definition) => definition.kind !== 'venueType' && (isPhone || !definition.inline))
}

/** One pill per filter More filters holds (getRwaPerpsDialogFilters) that the URL sets, in the dialog's order; an
    inline picker shows its own on its trigger. */
export function getRwaPerpsFilterPills(
	query: QueryLike,
	dialogFilters: ReadonlyArray<RWAPerpsFilterDefinition>
): Array<RWAPerpsFilterPill> {
	const pills: Array<RWAPerpsFilterPill> = []
	for (const definition of dialogFilters) {
		if (definition.kind === 'venueType') continue
		if (definition.kind === 'select') {
			const picked = readSelect(query, definition)
			if (picked) pills.push({ definition, picked, clearKeys: clearKeysOf(definition) })
		} else {
			const range = readRwaPerpsRange(query, definition)
			if (isRangeSet(range)) pills.push({ definition, range, clearKeys: clearKeysOf(definition) })
		}
	}
	return pills
}

/** How many of the given filters the URL sets; a key the page does not read, or an empty one, counts as none. */
export function countRwaPerpsFilters(query: QueryLike, definitions: ReadonlyArray<RWAPerpsFilterDefinition>): number {
	return definitions.filter((definition) => isFilterSet(query, definition)).length
}

/** Every URL key the page's filters read: what Reset all clears. */
export function getRwaPerpsFilterQueryKeys(definitions: ReadonlyArray<RWAPerpsFilterDefinition>): Array<string> {
	return definitions.flatMap(clearKeysOf)
}

export type RWAPerpsFilterDraft = {
	activeIds: Array<RWAPerpsFilterDefinition['id']>
	selectValues: Record<string, Array<string>>
	ranges: Record<string, { min: string; max: string }>
}

/** The dialog opens on what the URL holds: every set filter active, every other one ready at its current value. */
export function createRwaPerpsFilterDraft(
	query: QueryLike,
	definitions: ReadonlyArray<RWAPerpsFilterDefinition>
): RWAPerpsFilterDraft {
	const draft: RWAPerpsFilterDraft = { activeIds: [], selectValues: {}, ranges: {} }
	for (const definition of definitions) {
		if (definition.kind === 'venueType') continue
		if (definition.kind === 'select') {
			const picked = readSelect(query, definition)
			draft.selectValues[definition.id] = picked ?? [...definition.values]
			if (picked) draft.activeIds.push(definition.id)
		} else {
			const range = readRwaPerpsRange(query, definition)
			draft.ranges[definition.id] = { min: String(range.min ?? ''), max: String(range.max ?? '') }
			if (isRangeSet(range)) draft.activeIds.push(definition.id)
		}
	}
	return draft
}

/** Apply: clears every key the dialog owns, then writes the active filters. */
export function serializeRwaPerpsFilterDraft(
	definitions: ReadonlyArray<RWAPerpsFilterDefinition>,
	draft: RWAPerpsFilterDraft
): Record<string, string | Array<string> | undefined> {
	const updates: Record<string, string | Array<string> | undefined> = {}
	const active = new Set(draft.activeIds)
	for (const definition of definitions) {
		for (const key of clearKeysOf(definition)) updates[key] = undefined
		if (definition.kind === 'venueType' || !active.has(definition.id)) continue
		if (definition.kind === 'select') {
			Object.assign(
				updates,
				getQueryUpdatesFromSelected(
					definition.includeKey,
					definition.excludeKey,
					definition.values,
					draft.selectValues[definition.id]
				)
			)
		} else {
			const min = parseNumberInput(draft.ranges[definition.id].min)
			const max = parseNumberInput(draft.ranges[definition.id].max)
			updates[definition.minKey] = min == null ? undefined : String(min)
			updates[definition.maxKey] = max == null ? undefined : String(max)
		}
	}
	return updates
}
