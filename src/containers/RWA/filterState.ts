import type { NextRouter } from 'next/router'
import { isTrueQueryParam, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { RWAAssetOverviewRow, RWAOverviewDisplayRow, RWAPerpsContractOverlayRow } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import { rwaSlug } from './rwaSlug'
import { RWA_WRAPPER_TYPE } from './wrappers'

export const RWA_ATTRIBUTE_FILTER_STATES = ['yes', 'no', 'unknown'] as const
export type RWAAttributeFilterState = (typeof RWA_ATTRIBUTE_FILTER_STATES)[number]

const RWA_ATTRIBUTE_FILTER_STATE_SET = new Set<RWAAttributeFilterState>(RWA_ATTRIBUTE_FILTER_STATES)

const RWA_PERPS_OVERLAY_BLOCKING_FILTER_KEYS = new Set([
	'assetNames',
	'excludeAssetNames',
	'redeemableStates',
	'attestationsStates',
	'cexListedStates',
	'kycForMintRedeemStates',
	'kycAllowlistedWhitelistedToTransferHoldStates',
	'transferableStates',
	'selfCustodyStates',
	'minDefiActiveTvlToOnChainMcapPct',
	'maxDefiActiveTvlToOnChainMcapPct',
	'minActiveMcapToOnChainMcapPct',
	'maxActiveMcapToOnChainMcapPct',
	'minDefiActiveTvlToActiveMcapPct',
	'maxDefiActiveTvlToActiveMcapPct'
])

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
	includeRwaPerps: boolean
	includeCex: boolean
	includeBridgeTvl: boolean
	includeWrappers: boolean
	hasPerpsOverlayBlockingFilters: boolean
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

export const parseAttributeFilterStatesParam = (
	param: string | Array<string> | undefined
): Array<RWAAttributeFilterState> => {
	if (!param) return [...RWA_ATTRIBUTE_FILTER_STATES]

	const values = toNonEmptyArrayParam(param).map((value) => value.toLowerCase())
	if (values.some((value) => value === 'none')) return []

	const selectedSet = new Set<RWAAttributeFilterState>()
	for (const value of values) {
		for (const state of RWA_ATTRIBUTE_FILTER_STATES) {
			if (value === state) selectedSet.add(state)
		}
	}

	if (selectedSet.size === 0) return [...RWA_ATTRIBUTE_FILTER_STATES]
	return RWA_ATTRIBUTE_FILTER_STATES.filter((value) => selectedSet.has(value))
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

export function hasPerpsOverlayBlockingFiltersFromQuery(query: NextRouter['query']): boolean {
	for (const key of RWA_PERPS_OVERLAY_BLOCKING_FILTER_KEYS) {
		if (key in query) return true
	}

	return false
}

export function updateAttributeFilterStatesQueryValue(
	values: Array<RWAAttributeFilterState>
): string | Array<string> | undefined {
	const selectedSet = new Set<RWAAttributeFilterState>()
	for (const value of values) {
		if (RWA_ATTRIBUTE_FILTER_STATE_SET.has(value)) selectedSet.add(value)
	}

	const normalizedStates = RWA_ATTRIBUTE_FILTER_STATES.filter((value) => selectedSet.has(value))
	if (normalizedStates.length === RWA_ATTRIBUTE_FILTER_STATES.length) return undefined
	if (normalizedStates.length === 0) return 'none'
	if (normalizedStates.length === 1) return normalizedStates[0]
	return normalizedStates
}

export function filterRwaPerpsContractOverlayRows(
	rows: Array<RWAPerpsContractOverlayRow>,
	filterState: RWAFilterState
): Array<RWAPerpsContractOverlayRow> {
	if (!filterState.includeRwaPerps || filterState.hasPerpsOverlayBlockingFilters) return []
	const preparedFilters = prepareRwaFilters(filterState)
	return rows.filter(
		(row) => (filterState.includeCex || row.venueType !== 'CEX') && matchesSharedRwaFilters(row, preparedFilters)
	)
}

export function filterRwaOverviewDisplayRows(
	assets: Array<RWAOverviewDisplayRow>,
	filterState: RWAFilterState
): RWAFilteredRowsResult {
	const preparedFilters = prepareRwaFilters(filterState)
	const filteredSpotRows: Array<RWAAssetOverviewRow> = []
	const filteredPerpsRows: Array<RWAPerpsContractOverlayRow> = []
	const includePerps = filterState.includeRwaPerps && !filterState.hasPerpsOverlayBlockingFilters
	for (const asset of assets) {
		if (asset.kind === 'spot') {
			if (matchesRwaAssetFilters(asset, filterState, preparedFilters)) filteredSpotRows.push(asset)
		} else if (
			includePerps &&
			(filterState.includeCex || asset.venueType !== 'CEX') &&
			matchesSharedRwaFilters(asset, preparedFilters)
		) {
			filteredPerpsRows.push(asset)
		}
	}
	const filteredAssets: Array<RWAOverviewDisplayRow> = [...filteredSpotRows, ...filteredPerpsRows]
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
	const assetGroup = normalizeRwaAssetGroup(asset.assetGroup)
	const platform = asset.parentPlatform?.trim()

	return (
		(asset.category?.length ? asset.category.some((category) => filters.selectedCategories.has(category)) : true) &&
		(platform ? filters.selectedPlatforms.has(platform) : true) &&
		filters.selectedAssetGroups.has(assetGroup) &&
		(asset.assetClass?.length
			? asset.assetClass.some((assetClass) => filters.selectedAssetClasses.has(assetClass))
			: true) &&
		(asset.rwaClassification ? filters.selectedRwaClassifications.has(asset.rwaClassification) : true) &&
		(asset.accessModel ? filters.selectedAccessModels.has(asset.accessModel) : true) &&
		filters.selectedIssuers.has(asset.issuer || 'Unknown')
	)
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
	if (filters.selectedAssetNames) {
		const name = asset.assetName || asset.ticker
		if (!filters.selectedAssetNames.has(name)) return false
	}
	if (!filterState.includeStablecoins && asset.stablecoin) return false
	if (!filterState.includeGovernance && asset.governance) return false
	if (!filterState.includeWrappers && asset.type === RWA_WRAPPER_TYPE) return false
	if (!matchesAssetAttributeFilters(asset, filters)) return false
	if (!matchesAssetRatioFilters(asset, filterState)) return false
	if (!filters.selectedTypes.has(asset.type || 'Unknown')) return false
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
