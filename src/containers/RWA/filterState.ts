import type { NextRouter } from 'next/router'
import { type ExcludeQueryKey, readSelectionFromQuery } from '~/components/Select/query'
import { isTrueQueryParam, parseNumberQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import type { RWAAssetOverviewRow, RWAOverviewDisplayRow } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import type { RWAOverviewMode } from './constants'
import { toUniqueNonEmptyValues } from './grouping'
import { rwaSlug } from './rwaSlug'
import { RWA_WRAPPER_TYPE } from './wrappers'

export const RWA_ATTRIBUTE_FILTER_STATES = ['yes', 'no', 'unknown'] as const
export type RWAAttributeFilterState = (typeof RWA_ATTRIBUTE_FILTER_STATES)[number]

export const RWA_SELECT_FILTER_KEYS = [
	'types',
	'assetNames',
	'assetGroups',
	'categories',
	'platforms',
	'assetClasses',
	'rwaClassifications',
	'accessModels',
	'issuers'
] as const
export type RWASelectFilterKey = (typeof RWA_SELECT_FILTER_KEYS)[number]
export type RWASelectFilterOptions = Record<RWASelectFilterKey, ReadonlyArray<string>>

export const RWA_ATTRIBUTE_FILTER_KEYS = [
	'redeemableStates',
	'attestationsStates',
	'cexListedStates',
	'kycForMintRedeemStates',
	'kycAllowlistedWhitelistedToTransferHoldStates',
	'transferableStates',
	'selfCustodyStates'
] as const
export type RWAAttributeFilterKey = (typeof RWA_ATTRIBUTE_FILTER_KEYS)[number]

export const RWA_RATIO_FILTER_KEYS = [
	'minDefiActiveTvlToOnChainMcapPct',
	'maxDefiActiveTvlToOnChainMcapPct',
	'minActiveMcapToOnChainMcapPct',
	'maxActiveMcapToOnChainMcapPct',
	'minDefiActiveTvlToActiveMcapPct',
	'maxDefiActiveTvlToActiveMcapPct'
] as const

/** The option for rows that lack a field, so a picker never keeps or hides them out of sight. */
export const UNKNOWN_RWA_FILTER_VALUE = 'Unknown'

/** The exclude twin of a picker's key; the Perps tree's pickers (perpsFilters.ts) follow the same rule. */
export function getRwaExcludeQueryKey(key: string): ExcludeQueryKey {
	return `exclude${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

/** The inclusion toggles: Include in TVL and the dialog's Include group. */
const RWA_INCLUSION_QUERY_KEYS = [
	'includeStablecoins',
	'includeGovernance',
	'includeBridgeTvl',
	'includeWrappers'
] as const

/** Every URL key a filter or toggle writes; the view, Group by, period, column set and chart keys are not filters. */
export const RWA_FILTER_QUERY_KEYS: ReadonlyArray<string> = [
	...RWA_SELECT_FILTER_KEYS.flatMap((key) => [key, getRwaExcludeQueryKey(key)]),
	...RWA_ATTRIBUTE_FILTER_KEYS.flatMap((key) => [key, getRwaExcludeQueryKey(key)]),
	...RWA_RATIO_FILTER_KEYS,
	...RWA_INCLUSION_QUERY_KEYS
]

/** Removes the keys from the URL, as a filter pill or Reset all does; every other key stays. */
export function clearRwaFilterQueryKeys(router: NextRouter, keys: ReadonlyArray<string>) {
	const updates: Record<string, undefined> = {}
	for (const key of keys) updates[key] = undefined
	void pushShallowQuery(router, updates)
}

/** The picker options a row belongs to. The options list and the row filter both read it, so they cannot disagree. */
export function getRwaRowFilterValues(row: RWAOverviewDisplayRow, key: RWASelectFilterKey): Array<string> {
	switch (key) {
		case 'types':
			return [row.type || UNKNOWN_RWA_FILTER_VALUE]
		case 'assetNames':
			return [row.assetName || row.ticker]
		case 'assetGroups':
			return [normalizeRwaAssetGroup(row.assetGroup)]
		case 'categories':
			return valuesOrUnknown(toUniqueNonEmptyValues(row.category))
		case 'platforms':
			return [row.parentPlatform?.trim() || UNKNOWN_RWA_FILTER_VALUE]
		case 'assetClasses':
			return valuesOrUnknown(toUniqueNonEmptyValues(row.assetClass))
		case 'rwaClassifications':
			return [row.rwaClassification || UNKNOWN_RWA_FILTER_VALUE]
		case 'accessModels':
			return [row.accessModel || UNKNOWN_RWA_FILTER_VALUE]
		case 'issuers':
			return [row.issuer || UNKNOWN_RWA_FILTER_VALUE]
	}
}

function valuesOrUnknown(values: Array<string>): Array<string> {
	return values.length > 0 ? values : [UNKNOWN_RWA_FILTER_VALUE]
}

/** A picker shows when it has a choice to offer; a route never gets a picker for its own dimension (an asset group
    page gets Category and loses Asset Group). */
export function isRwaSelectFilterShown(key: RWASelectFilterKey, mode: RWAOverviewMode, optionCount: number): boolean {
	if (optionCount < 2) return false
	switch (key) {
		case 'assetNames':
			return mode === 'platform'
		case 'categories':
			return mode !== 'category'
		case 'assetGroups':
			return mode !== 'assetGroup'
		case 'platforms':
			return mode === 'chain' || mode === 'category'
		default:
			return true
	}
}

export type RWAQueryFilters = ReturnType<typeof readRwaQueryFilters>

/**
 * The Filters dialog selections, read from the URL with the shared picker rules. Keys for a picker the page does
 * not show are ignored, so a link from another page never filters invisibly.
 */
export function readRwaQueryFilters(
	query: NextRouter['query'],
	options: RWASelectFilterOptions,
	mode: RWAOverviewMode
) {
	let hasSelectFilter = false
	const select = (key: RWASelectFilterKey) => {
		const values = options[key]
		if (!isRwaSelectFilterShown(key, mode, values.length)) return [...values]
		const selected = readSelectionFromQuery(query, key, getRwaExcludeQueryKey(key), values)
		if (selected.length < values.length) hasSelectFilter = true
		return selected
	}
	let hasAttributeFilter = false
	const states = (key: RWAAttributeFilterKey) => {
		const selected = readSelectionFromQuery(query, key, getRwaExcludeQueryKey(key), RWA_ATTRIBUTE_FILTER_STATES)
		if (selected.length < RWA_ATTRIBUTE_FILTER_STATES.length) hasAttributeFilter = true
		return selected
	}

	const filters = {
		selectedAssetNames: select('assetNames'),
		selectedTypes: select('types'),
		selectedCategories: select('categories'),
		selectedPlatforms: select('platforms'),
		selectedAssetGroups: select('assetGroups'),
		selectedAssetClasses: select('assetClasses'),
		selectedRwaClassifications: select('rwaClassifications'),
		selectedAccessModels: select('accessModels'),
		selectedIssuers: select('issuers'),
		selectedRedeemableStates: states('redeemableStates'),
		selectedAttestationsStates: states('attestationsStates'),
		selectedCexListedStates: states('cexListedStates'),
		selectedKycForMintRedeemStates: states('kycForMintRedeemStates'),
		selectedKycAllowlistedWhitelistedToTransferHoldStates: states('kycAllowlistedWhitelistedToTransferHoldStates'),
		selectedTransferableStates: states('transferableStates'),
		selectedSelfCustodyStates: states('selfCustodyStates'),
		minDefiActiveTvlToOnChainMcapPct: parseNumberQueryParam(query.minDefiActiveTvlToOnChainMcapPct),
		maxDefiActiveTvlToOnChainMcapPct: parseNumberQueryParam(query.maxDefiActiveTvlToOnChainMcapPct),
		minActiveMcapToOnChainMcapPct: parseNumberQueryParam(query.minActiveMcapToOnChainMcapPct),
		maxActiveMcapToOnChainMcapPct: parseNumberQueryParam(query.maxActiveMcapToOnChainMcapPct),
		minDefiActiveTvlToActiveMcapPct: parseNumberQueryParam(query.minDefiActiveTvlToActiveMcapPct),
		maxDefiActiveTvlToActiveMcapPct: parseNumberQueryParam(query.maxDefiActiveTvlToActiveMcapPct)
	}
	const hasRatioFilter =
		filters.minDefiActiveTvlToOnChainMcapPct != null ||
		filters.maxDefiActiveTvlToOnChainMcapPct != null ||
		filters.minActiveMcapToOnChainMcapPct != null ||
		filters.maxActiveMcapToOnChainMcapPct != null ||
		filters.minDefiActiveTvlToActiveMcapPct != null ||
		filters.maxDefiActiveTvlToActiveMcapPct != null

	return {
		...filters,
		/** Any Filters dialog selection narrows the rows; the scope toggles and the view do not count. */
		hasDialogFilters: hasSelectFilter || hasAttributeFilter || hasRatioFilter
	}
}

export type RWAFilterState = {
	isPlatformMode: boolean
	selectedAssetNames: Array<string>
	selectedTypes: Array<string>
	selectedCategories: Array<string>
	selectedPlatforms: Array<string>
	selectedAssetGroups: Array<string>
	selectedAssetClasses: Array<string>
	selectedRwaClassifications: Array<string>
	selectedAccessModels: Array<string>
	selectedIssuers: Array<string>
	selectedRedeemableStates: Array<RWAAttributeFilterState>
	selectedAttestationsStates: Array<RWAAttributeFilterState>
	selectedCexListedStates: Array<RWAAttributeFilterState>
	selectedKycForMintRedeemStates: Array<RWAAttributeFilterState>
	selectedKycAllowlistedWhitelistedToTransferHoldStates: Array<RWAAttributeFilterState>
	selectedTransferableStates: Array<RWAAttributeFilterState>
	selectedSelfCustodyStates: Array<RWAAttributeFilterState>
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	includeWrappers: boolean
	minDefiActiveTvlToOnChainMcapPct: number | null
	maxDefiActiveTvlToOnChainMcapPct: number | null
	minActiveMcapToOnChainMcapPct: number | null
	maxActiveMcapToOnChainMcapPct: number | null
	minDefiActiveTvlToActiveMcapPct: number | null
	maxDefiActiveTvlToActiveMcapPct: number | null
}

/** The rows the page shows and the subset the tiles and charts sum over. */
export type RWAFilteredRowsResult = {
	filteredAssets: Array<RWAOverviewDisplayRow>
	aggregateAssets: Array<RWAOverviewDisplayRow>
}

type PreparedRwaFilters = {
	selectedAssetNames: Set<string> | null
	selectedTypes: Set<string>
	selectedCategories: Set<string>
	selectedPlatforms: Set<string>
	selectedAssetGroups: Set<string>
	selectedAssetClasses: Set<string>
	selectedRwaClassifications: Set<string>
	selectedAccessModels: Set<string>
	selectedIssuers: Set<string>
	selectedRedeemableStates: Set<RWAAttributeFilterState>
	selectedAttestationsStates: Set<RWAAttributeFilterState>
	selectedCexListedStates: Set<RWAAttributeFilterState>
	selectedKycForMintRedeemStates: Set<RWAAttributeFilterState>
	selectedKycAllowlistedWhitelistedToTransferHoldStates: Set<RWAAttributeFilterState>
	selectedTransferableStates: Set<RWAAttributeFilterState>
	selectedSelfCustodyStates: Set<RWAAttributeFilterState>
}

function prepareRwaFilters(filterState: RWAFilterState): PreparedRwaFilters {
	return {
		selectedAssetNames: filterState.isPlatformMode ? new Set(filterState.selectedAssetNames) : null,
		selectedTypes: new Set(filterState.selectedTypes),
		selectedCategories: new Set(filterState.selectedCategories),
		selectedPlatforms: new Set(filterState.selectedPlatforms),
		selectedAssetGroups: new Set(filterState.selectedAssetGroups),
		selectedAssetClasses: new Set(filterState.selectedAssetClasses),
		selectedRwaClassifications: new Set(filterState.selectedRwaClassifications),
		selectedAccessModels: new Set(filterState.selectedAccessModels),
		selectedIssuers: new Set(filterState.selectedIssuers),
		selectedRedeemableStates: new Set(filterState.selectedRedeemableStates),
		selectedAttestationsStates: new Set(filterState.selectedAttestationsStates),
		selectedCexListedStates: new Set(filterState.selectedCexListedStates),
		selectedKycForMintRedeemStates: new Set(filterState.selectedKycForMintRedeemStates),
		selectedKycAllowlistedWhitelistedToTransferHoldStates: new Set(
			filterState.selectedKycAllowlistedWhitelistedToTransferHoldStates
		),
		selectedTransferableStates: new Set(filterState.selectedTransferableStates),
		selectedSelfCustodyStates: new Set(filterState.selectedSelfCustodyStates)
	}
}

export function resolveRWAOverviewInclusionFlag(
	queryValue: string | Array<string> | undefined,
	defaultValue: boolean
): boolean {
	return queryValue != null ? isTrueQueryParam(queryValue) : defaultValue
}

/** Absent at the default, otherwise 'true' or 'false'. */
export function getRwaInclusionQueryValue(value: boolean, defaultValue: boolean): 'true' | 'false' | undefined {
	return value === defaultValue ? undefined : value ? 'true' : 'false'
}

export function hasActiveInclusionOverride(
	queryValue: string | Array<string> | undefined,
	defaultValue: boolean
): boolean {
	if (queryValue == null) return false
	if (Array.isArray(queryValue)) return true
	return resolveRWAOverviewInclusionFlag(queryValue, defaultValue) !== defaultValue
}

export function filterRwaOverviewDisplayRows(
	assets: Array<RWAOverviewDisplayRow>,
	filterState: RWAFilterState
): RWAFilteredRowsResult {
	const preparedFilters = prepareRwaFilters(filterState)
	// The Assets tree's rows; the Perps tree filters its markets with perpsFilters.ts alone.
	const filteredAssets: Array<RWAOverviewDisplayRow> = assets.filter(
		(asset) => asset.kind === 'spot' && matchesRwaAssetFilters(asset, filterState, preparedFilters)
	)
	const aggregateAssets = filterState.isPlatformMode
		? filteredAssets
		: filteredAssets.filter((asset) => asset.suspicious !== true)

	return { filteredAssets, aggregateAssets }
}

export function getEmptyRwaFilteredRowsResult(): RWAFilteredRowsResult {
	return { filteredAssets: [], aggregateAssets: [] }
}

export function getRwaDisplayedDefiActiveTvl(asset: RWAAssetOverviewRow, includeBridgeTvl = true): number {
	const total = asset.defiActiveTvl?.total ?? 0
	if (includeBridgeTvl) return total
	return total - (asset.bridgeTvl ?? 0)
}

export function getRwaDisplayedDefiActiveTvlByChain(
	asset: RWAAssetOverviewRow,
	includeBridgeTvl = true
): Array<[string, number]> {
	const breakdown = asset.defiActiveTvlByChain?.breakdown ?? []
	if (includeBridgeTvl) return breakdown

	const bridgeByChain = new Map<string, number>()
	for (const [chain, value] of asset.bridgeTvlByChain?.breakdown ?? []) {
		const key = rwaSlug(chain)
		bridgeByChain.set(key, (bridgeByChain.get(key) ?? 0) + value)
	}

	return breakdown.map(([chain, value]) => {
		const bridge = bridgeByChain.get(rwaSlug(chain)) ?? 0
		return [chain, value - bridge]
	})
}

export function getRwaDisplayedDefiActiveTvlByProtocol(
	asset: RWAAssetOverviewRow,
	includeBridgeTvl = true
): Array<[string, number]> | null {
	if (includeBridgeTvl) return asset.defiActiveTvl.breakdown
	if (asset.bridgeTvlByProtocol == null) return null

	const bridgeByProtocol = new Map(asset.bridgeTvlByProtocol.breakdown)
	const breakdown: Array<[string, number]> = []
	for (const [protocol, value] of asset.defiActiveTvl.breakdown) {
		const displayedValue = value - (bridgeByProtocol.get(protocol) ?? 0)
		if (displayedValue > 0) breakdown.push([protocol, displayedValue])
	}
	return breakdown
}

export function getRwaDisplayedMetricValue(
	asset: RWAOverviewDisplayRow,
	metric: 'onChainMcap' | 'activeMcap' | 'defiActiveTvl',
	includeBridgeTvl = true
): number {
	if (metric === 'defiActiveTvl' && asset.kind === 'spot') {
		return getRwaDisplayedDefiActiveTvl(asset, includeBridgeTvl)
	}
	return asset[metric]?.total ?? 0
}
function matchesSharedRwaFilters(asset: RWAOverviewDisplayRow, filters: PreparedRwaFilters): boolean {
	return (
		matchesRwaSelectFilter(asset, 'categories', filters.selectedCategories) &&
		matchesRwaSelectFilter(asset, 'platforms', filters.selectedPlatforms) &&
		matchesRwaSelectFilter(asset, 'assetGroups', filters.selectedAssetGroups) &&
		matchesRwaSelectFilter(asset, 'assetClasses', filters.selectedAssetClasses) &&
		matchesRwaSelectFilter(asset, 'rwaClassifications', filters.selectedRwaClassifications) &&
		matchesRwaSelectFilter(asset, 'accessModels', filters.selectedAccessModels) &&
		matchesRwaSelectFilter(asset, 'issuers', filters.selectedIssuers)
	)
}

/** A row with several values (categories, asset classes) passes when any of them is selected. */
function matchesRwaSelectFilter(asset: RWAOverviewDisplayRow, key: RWASelectFilterKey, selected: Set<string>): boolean {
	return getRwaRowFilterValues(asset, key).some((value) => selected.has(value))
}

function matchesAssetAttributeFilters(asset: RWAAssetOverviewRow, filters: PreparedRwaFilters): boolean {
	return (
		filters.selectedRedeemableStates.has(toAttributeFilterState(asset.redeemable)) &&
		filters.selectedAttestationsStates.has(toAttributeFilterState(asset.attestations)) &&
		filters.selectedCexListedStates.has(toAttributeFilterState(asset.cexListed)) &&
		filters.selectedKycForMintRedeemStates.has(toAttributeFilterState(asset.kycForMintRedeem)) &&
		filters.selectedKycAllowlistedWhitelistedToTransferHoldStates.has(
			toAttributeFilterState(asset.kycAllowlistedWhitelistedToTransferHold)
		) &&
		filters.selectedTransferableStates.has(toAttributeFilterState(asset.transferable)) &&
		filters.selectedSelfCustodyStates.has(toAttributeFilterState(asset.selfCustody))
	)
}

function matchesRwaAssetFilters(
	asset: RWAAssetOverviewRow,
	filterState: RWAFilterState,
	filters: PreparedRwaFilters
): boolean {
	if (filters.selectedAssetNames && !matchesRwaSelectFilter(asset, 'assetNames', filters.selectedAssetNames))
		return false
	if (!filterState.includeStablecoins && asset.stablecoin) return false
	if (!filterState.includeGovernance && asset.governance) return false
	if (!filterState.includeWrappers && asset.type === RWA_WRAPPER_TYPE) return false
	if (!matchesAssetAttributeFilters(asset, filters)) return false
	if (!matchesAssetRatioFilters(asset, filterState)) return false
	if (!matchesRwaSelectFilter(asset, 'types', filters.selectedTypes)) return false
	return matchesSharedRwaFilters(asset, filters)
}

function matchesAssetRatioFilters(asset: RWAAssetOverviewRow, filterState: RWAFilterState): boolean {
	const onChainMcap = asset.onChainMcap?.total ?? 0
	const activeMcap = asset.activeMcap?.total ?? 0
	const defiActiveTvl = getRwaDisplayedDefiActiveTvl(asset, filterState.includeBridgeTvl)

	return (
		meetsRatioPercent(
			defiActiveTvl,
			onChainMcap,
			filterState.minDefiActiveTvlToOnChainMcapPct,
			filterState.maxDefiActiveTvlToOnChainMcapPct
		) &&
		meetsRatioPercent(
			activeMcap,
			onChainMcap,
			filterState.minActiveMcapToOnChainMcapPct,
			filterState.maxActiveMcapToOnChainMcapPct
		) &&
		meetsRatioPercent(
			defiActiveTvl,
			activeMcap,
			filterState.minDefiActiveTvlToActiveMcapPct,
			filterState.maxDefiActiveTvlToActiveMcapPct
		)
	)
}

function meetsRatioPercent(
	numerator: number,
	denominator: number,
	minPercent: number | null,
	maxPercent: number | null
) {
	if (minPercent == null && maxPercent == null) return true
	// A zero denominator has no defined percentage and must not pass a bounded ratio.
	if (denominator <= 0) return false
	const percent = (numerator / denominator) * 100
	if (minPercent != null && percent < minPercent) return false
	if (maxPercent != null && percent > maxPercent) return false
	return true
}

function toAttributeFilterState(value: boolean | null | undefined): RWAAttributeFilterState {
	if (value == null) return 'unknown'
	return value ? 'yes' : 'no'
}
