import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import type { NextRouter } from 'next/router'
import { useMemo } from 'react'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import { parseNumberInput, pushShallowQuery } from '~/utils/routerQuery'
import type { IRWAAssetsOverview, IRWAChartMetricRows, RWAChartMetricKey, RWAAssetChartTarget } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import {
	aggregateRwaMetricData,
	buildRwaCanonicalMetricDataset,
	type RWAChartAggregationMode
} from './chartAggregation'
import type { RwaChartAxis } from './chartBreakdown'
import type { RWAPositionalChartDataset } from './chartDataset'
import type { RWAOverviewInclusionDefaults, RWAOverviewMode } from './constants'
import {
	filterRwaOverviewDisplayRows,
	getRwaDisplayedDefiActiveTvlByChain,
	getRwaDisplayedMetricValue,
	getEmptyRwaFilteredRowsResult,
	hasActiveInclusionOverride,
	readRwaQueryFilters,
	resolveRWAOverviewInclusionFlag,
	type RWAAttributeFilterState,
	type RWASelectFilterOptions,
	getRwaInclusionQueryValue
} from './filterState'
import { getPrimaryRwaCategory } from './grouping'
import type { RWASection } from './layout/pageLayout'
import { readRwaVenueTypeChoice } from './perpsFilters'
import { rwaSlug } from './rwaSlug'

export { resolveRWAOverviewInclusionFlag } from './filterState'

type PieChartDatum = { name: string; value: number }

const UNKNOWN_SLICE = 'Unknown'

export const limitRwaPieChartData = (data: Array<PieChartDatum>, maxLabels: number): Array<PieChartDatum> => {
	if (data.length <= maxLabels) return data

	let othersValue = 0
	for (const [index, item] of data.entries()) {
		if (index >= maxLabels - 1) othersValue += item.value
	}
	const visible = data.slice(0, maxLabels - 1)
	if (othersValue > 0) visible.push({ name: 'Others', value: othersValue })
	return visible
}

const updateNumberRangeQuery = (
	minKey: string,
	maxKey: string,
	minValue: string | number | null | undefined,
	maxValue: string | number | null | undefined,
	router: NextRouter
) => {
	const parsedMin = parseNumberInput(minValue)
	const parsedMax = parseNumberInput(maxValue)
	void pushShallowQuery(router, {
		[minKey]: parsedMin == null ? undefined : String(parsedMin),
		[maxKey]: parsedMax == null ? undefined : String(parsedMax)
	})
}

const EMPTY_QUERY: NextRouter['query'] = {}

export const useRWATableQueryParams = ({
	options,
	mode,
	defaultInclusion,
	section
}: {
	options: RWASelectFilterOptions
	mode: RWAOverviewMode
	defaultInclusion: RWAOverviewInclusionDefaults
	/** The route decides the rows: /rwa/perps and its tree show perps, every other page spot. */
	section: RWASection
}) => {
	const router = useRouter()
	// The Perps tree filters its markets with perpsFilters.ts alone, so an Assets key in its URL (an old link) reads as
	// no filter there.
	const filterQuery = section === 'perps' ? EMPTY_QUERY : router.query
	const filters = useMemo(() => readRwaQueryFilters(filterQuery, options, mode), [filterQuery, options, mode])
	const {
		includeStablecoins: stablecoinsQ,
		includeGovernance: governanceQ,
		includeBridgeTvl: bridgeTvlQ,
		includeWrappers: wrappersQ
	} = router.query
	const includeStablecoins = resolveRWAOverviewInclusionFlag(stablecoinsQ, defaultInclusion.includeStablecoins)
	const includeGovernance = resolveRWAOverviewInclusionFlag(governanceQ, defaultInclusion.includeGovernance)
	// Venue Type keeps the CEX venues unless it reads DEX only.
	const includeCex = section === 'perps' && readRwaVenueTypeChoice(router.query) !== 'dex'
	const includeBridgeTvl = resolveRWAOverviewInclusionFlag(bridgeTvlQ, defaultInclusion.includeBridgeTvl ?? true)
	const includeWrappers = resolveRWAOverviewInclusionFlag(wrappersQ, defaultInclusion.includeWrappers ?? false)

	const setDefiActiveTvlToOnChainMcapPctRange = (minValue: string | number | null, maxValue: string | number | null) =>
		updateNumberRangeQuery(
			'minDefiActiveTvlToOnChainMcapPct',
			'maxDefiActiveTvlToOnChainMcapPct',
			minValue,
			maxValue,
			router
		)
	const setActiveMcapToOnChainMcapPctRange = (minValue: string | number | null, maxValue: string | number | null) =>
		updateNumberRangeQuery('minActiveMcapToOnChainMcapPct', 'maxActiveMcapToOnChainMcapPct', minValue, maxValue, router)
	const setDefiActiveTvlToActiveMcapPctRange = (minValue: string | number | null, maxValue: string | number | null) =>
		updateNumberRangeQuery(
			'minDefiActiveTvlToActiveMcapPct',
			'maxDefiActiveTvlToActiveMcapPct',
			minValue,
			maxValue,
			router
		)

	const setIncludeStablecoins = (value: boolean) => {
		void pushShallowQuery(router, {
			includeStablecoins: getRwaInclusionQueryValue(value, defaultInclusion.includeStablecoins)
		})
	}

	const setIncludeGovernance = (value: boolean) => {
		void pushShallowQuery(router, {
			includeGovernance: getRwaInclusionQueryValue(value, defaultInclusion.includeGovernance)
		})
	}

	const setIncludeBridgeTvl = (value: boolean) => {
		void pushShallowQuery(router, {
			includeBridgeTvl: getRwaInclusionQueryValue(value, defaultInclusion.includeBridgeTvl ?? true)
		})
	}

	const setIncludeWrappers = (value: boolean) => {
		void pushShallowQuery(router, {
			includeWrappers: getRwaInclusionQueryValue(value, defaultInclusion.includeWrappers ?? false)
		})
	}

	return {
		...filters,
		includeStablecoins,
		includeGovernance,
		includeCex,
		includeBridgeTvl,
		includeWrappers,
		setDefiActiveTvlToOnChainMcapPctRange,
		setActiveMcapToOnChainMcapPctRange,
		setDefiActiveTvlToActiveMcapPctRange,
		setIncludeStablecoins,
		setIncludeGovernance,
		setIncludeWrappers,
		setIncludeBridgeTvl
	}
}

type RWAAsset = IRWAAssetsOverview['assets'][number]

export const useFilteredRwaAssets = ({
	assets,
	isPlatformMode,
	selectedAssetNames,
	selectedTypes,
	selectedCategories,
	selectedPlatforms,
	selectedAssetGroups,
	selectedAssetClasses,
	selectedRwaClassifications,
	selectedAccessModels,
	selectedIssuers,
	selectedRedeemableStates,
	selectedAttestationsStates,
	selectedCexListedStates,
	selectedKycForMintRedeemStates,
	selectedKycAllowlistedWhitelistedToTransferHoldStates,
	selectedTransferableStates,
	selectedSelfCustodyStates,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl = true,
	includeWrappers = true,
	minDefiActiveTvlToOnChainMcapPct,
	maxDefiActiveTvlToOnChainMcapPct,
	minActiveMcapToOnChainMcapPct,
	maxActiveMcapToOnChainMcapPct,
	minDefiActiveTvlToActiveMcapPct,
	maxDefiActiveTvlToActiveMcapPct
}: {
	assets: Array<RWAAsset>
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
	includeBridgeTvl?: boolean
	includeWrappers?: boolean
	minDefiActiveTvlToOnChainMcapPct: number | null
	maxDefiActiveTvlToOnChainMcapPct: number | null
	minActiveMcapToOnChainMcapPct: number | null
	maxActiveMcapToOnChainMcapPct: number | null
	minDefiActiveTvlToActiveMcapPct: number | null
	maxDefiActiveTvlToActiveMcapPct: number | null
}) => {
	return useMemo(() => {
		// In platform mode, allow selecting "None" to show no assets.
		if (isPlatformMode && selectedAssetNames.length === 0) {
			return getEmptyRwaFilteredRowsResult()
		}

		return filterRwaOverviewDisplayRows(assets, {
			isPlatformMode,
			selectedAssetNames,
			selectedTypes,
			selectedCategories,
			selectedPlatforms,
			selectedAssetGroups,
			selectedAssetClasses,
			selectedRwaClassifications,
			selectedAccessModels,
			selectedIssuers,
			selectedRedeemableStates,
			selectedAttestationsStates,
			selectedCexListedStates,
			selectedKycForMintRedeemStates,
			selectedKycAllowlistedWhitelistedToTransferHoldStates,
			selectedTransferableStates,
			selectedSelfCustodyStates,
			includeStablecoins,
			includeGovernance,
			includeBridgeTvl,
			includeWrappers,
			minDefiActiveTvlToOnChainMcapPct,
			maxDefiActiveTvlToOnChainMcapPct,
			minActiveMcapToOnChainMcapPct,
			maxActiveMcapToOnChainMcapPct,
			minDefiActiveTvlToActiveMcapPct,
			maxDefiActiveTvlToActiveMcapPct
		})
	}, [
		assets,
		isPlatformMode,
		selectedAssetNames,
		selectedTypes,
		selectedCategories,
		selectedPlatforms,
		selectedAssetGroups,
		selectedAssetClasses,
		selectedRwaClassifications,
		selectedAccessModels,
		selectedIssuers,
		selectedRedeemableStates,
		selectedAttestationsStates,
		selectedCexListedStates,
		selectedKycForMintRedeemStates,
		selectedKycAllowlistedWhitelistedToTransferHoldStates,
		selectedTransferableStates,
		selectedSelfCustodyStates,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl,
		includeWrappers,
		minDefiActiveTvlToOnChainMcapPct,
		maxDefiActiveTvlToOnChainMcapPct,
		minActiveMcapToOnChainMcapPct,
		maxActiveMcapToOnChainMcapPct,
		minDefiActiveTvlToActiveMcapPct,
		maxDefiActiveTvlToActiveMcapPct
	])
}

/**
 * The pie, treemap and bar slices of the Assets chart: one value per group of the axis, positive only, largest first.
 * The assets are the page's filtered rows, so every filter, the Asset Name filter of a platform page included,
 * reaches the chart; one slice per asset draws every asset left.
 */
export function buildRwaBreakdownSlices({
	axis,
	assets,
	metric,
	selectedCategories,
	includeBridgeTvl
}: {
	axis: RwaChartAxis
	assets: IRWAAssetsOverview['assets']
	metric: RWAChartMetricKey
	selectedCategories: Array<string>
	includeBridgeTvl: boolean
}): Array<PieChartDatum> {
	const totals = new Map<string, { label: string; value: number }>()
	// Labels that differ only in case or spacing are one group; a known label wins over Unknown.
	const add = (rawLabel: string | null | undefined, value: number, bySlug: boolean) => {
		const label = rawLabel?.trim() || UNKNOWN_SLICE
		const key = bySlug ? rwaSlug(label) : label
		const prev = totals.get(key) ?? { label, value: 0 }
		if (prev.label === UNKNOWN_SLICE && label !== UNKNOWN_SLICE) prev.label = label
		prev.value += value
		totals.set(key, prev)
	}

	for (const asset of assets) {
		const value = () => getRwaDisplayedMetricValue(asset, metric, includeBridgeTvl)
		switch (axis) {
			case 'category': {
				// Each asset counts only toward its primary category.
				const primaryCategory = getPrimaryRwaCategory(asset.category)
				if (primaryCategory && selectedCategories.includes(primaryCategory)) add(primaryCategory, value(), false)
				break
			}
			case 'assetName':
				add(asset.assetName || asset.ticker, value(), false)
				break
			case 'assetGroup':
				add(normalizeRwaAssetGroup(asset.assetGroup), value(), false)
				break
			case 'platform':
				add(asset.parentPlatform, value(), true)
				break
			case 'chain': {
				// The per-chain breakdown, so a multi-chain asset splits across its chains.
				const breakdown =
					metric === 'defiActiveTvl'
						? asset.kind === 'spot'
							? getRwaDisplayedDefiActiveTvlByChain(asset, includeBridgeTvl)
							: []
						: (asset[metric]?.breakdown ?? [])
				for (const [chain, chainValue] of breakdown) if ((chainValue ?? 0) > 0) add(chain, chainValue ?? 0, true)
				break
			}
			default:
				assertNever(axis)
		}
	}

	const slices: Array<PieChartDatum> = []
	for (const { label, value } of totals.values()) if (value > 0) slices.push({ name: label, value })
	return slices.sort((a, b) => b.value - a.value)
}

/** True when an Include toggle differs from the page default. */
export function hasRwaInclusionOverrides(
	query: NextRouter['query'],
	defaultInclusion: RWAOverviewInclusionDefaults
): boolean {
	return (
		hasActiveInclusionOverride(query.includeStablecoins, defaultInclusion.includeStablecoins) ||
		hasActiveInclusionOverride(query.includeGovernance, defaultInclusion.includeGovernance) ||
		hasActiveInclusionOverride(query.includeBridgeTvl, defaultInclusion.includeBridgeTvl ?? true) ||
		hasActiveInclusionOverride(query.includeWrappers, defaultInclusion.includeWrappers ?? false)
	)
}

export function getRwaAssetChartQueryKey(
	target: RWAAssetChartTarget,
	selectedMetric: RWAChartMetricKey,
	includeStablecoins: boolean,
	includeGovernance: boolean,
	includeBridgeTvl: boolean
) {
	return [
		'rwa-asset-chart',
		target.kind,
		target.kind === 'all' ? 'all' : target.slug,
		selectedMetric,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl
	] as const
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message)
	}
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

export async function fetchRwaAssetChartData(params: {
	key: RWAChartMetricKey
	target: RWAAssetChartTarget
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
}): Promise<IRWAChartMetricRows> {
	const searchParams = new URLSearchParams({ key: params.key })
	searchParams.set('includeStablecoin', String(params.includeStablecoins))
	searchParams.set('includeGovernance', String(params.includeGovernance))
	searchParams.set('includeBridgeTvl', String(params.includeBridgeTvl))

	switch (params.target.kind) {
		case 'all':
			break
		case 'chain':
			searchParams.set('chain', params.target.slug)
			break
		case 'category':
			searchParams.set('category', params.target.slug)
			break
		case 'platform':
			searchParams.set('platform', params.target.slug)
			break
		case 'assetGroup':
			searchParams.set('assetGroup', params.target.slug)
			break
		default:
			assertNever(params.target)
	}

	return fetchJson<IRWAChartMetricRows>(`/api/public/rwa/asset-breakdown?${searchParams.toString()}`)
}

/** The spot time series for one metric: the page's per-asset history folded by `mode`, or the build-time dataset. */
export function useRwaChartDataset({
	selectedMetric,
	initialDataset,
	filteredAssets,
	mode,
	target,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl = true,
	useInitialDataset,
	enabled = true
}: {
	selectedMetric: RWAChartMetricKey
	initialDataset: RWAPositionalChartDataset | null
	filteredAssets: IRWAAssetsOverview['assets']
	mode: RWAChartAggregationMode
	target: RWAAssetChartTarget
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl?: boolean
	useInitialDataset: boolean
	enabled?: boolean
}): {
	chartDataset: RWAPositionalChartDataset
	assetRows: IRWAChartMetricRows | undefined
	isChartLoading: boolean
	chartError: string | null
} {
	const hasSpotAssets = filteredAssets.some((asset) => asset.kind === 'spot')
	const shouldFetchAssetRows = enabled && !useInitialDataset && hasSpotAssets
	const {
		data: assetRows,
		isLoading,
		error
	} = useQuery({
		queryKey: getRwaAssetChartQueryKey(target, selectedMetric, includeStablecoins, includeGovernance, includeBridgeTvl),
		queryFn: () =>
			fetchRwaAssetChartData({
				key: selectedMetric,
				target,
				includeStablecoins,
				includeGovernance,
				includeBridgeTvl
			}),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: shouldFetchAssetRows
	})
	assert(initialDataset == null || initialDataset.dimensions[0] === 'timestamp', 'Expected timestamp dimension')

	const chartDataset = useMemo<RWAPositionalChartDataset>(
		() =>
			enabled
				? buildRwaChartDataset({ useInitialDataset, initialDataset, assetRows, filteredAssets, mode, selectedMetric })
				: { source: [], dimensions: ['timestamp'] },
		[useInitialDataset, initialDataset, assetRows, filteredAssets, mode, selectedMetric, enabled]
	)

	return {
		chartDataset,
		assetRows,
		isChartLoading: shouldFetchAssetRows && isLoading,
		chartError: shouldFetchAssetRows && error ? getErrorMessage(error) : null
	}
}

/**
 * The spot chart for one metric: the build-time dataset when the page uses it (Total projects its hidden Total
 * column), otherwise the fetched per-asset rows folded by `mode`.
 */
export function buildRwaChartDataset({
	useInitialDataset,
	initialDataset,
	assetRows,
	filteredAssets,
	mode,
	selectedMetric
}: {
	useInitialDataset: boolean
	initialDataset: RWAPositionalChartDataset | null
	assetRows: IRWAChartMetricRows | undefined
	filteredAssets: IRWAAssetsOverview['assets']
	mode: RWAChartAggregationMode
	selectedMetric: RWAChartMetricKey
}): RWAPositionalChartDataset {
	if (useInitialDataset && initialDataset) {
		if (mode !== 'total') return initialDataset
		const totalDimension = initialDataset.dimensions[1]
		if (totalDimension === undefined) {
			return { dimensions: ['timestamp'], source: initialDataset.source.map((row) => [row[0]]) }
		}
		return {
			dimensions: ['timestamp', totalDimension],
			source: initialDataset.source.map((row) => [row[0], row[1] ?? null])
		}
	}
	if (!assetRows) return { source: [], dimensions: ['timestamp'] }
	const dataset = aggregateRwaMetricData(filteredAssets, assetRows, mode)
	return buildRwaCanonicalMetricDataset(dataset, selectedMetric, mode === 'total')
}
