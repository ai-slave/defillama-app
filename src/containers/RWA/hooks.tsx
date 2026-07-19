import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import type { NextRouter } from 'next/router'
import { useMemo } from 'react'
import { createChartRecord } from '~/components/ECharts/dynamicRow'
import { CHART_COLORS } from '~/constants/colors'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import {
	toNonEmptyArrayParam,
	parseExcludeParam,
	parseNumberInput,
	parseNumberQueryParam,
	pushShallowQuery
} from '~/utils/routerQuery'
import type { IRWAAssetsOverview, IRWAChartMetricRows, RWAChartMetricKey, RWAAssetChartTarget } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import {
	aggregateRwaMetricData,
	appendRwaChartDatasetTotal,
	buildRwaOpenInterestDataset,
	emptyChartDataset,
	mergeRwaChartDatasets,
	renameRwaChartDatasetTotal,
	selectRwaChartDatasetSeries,
	type RWAChartDataset,
	type RWAChartAggregationMode
} from './chartAggregation'
import {
	getDefaultRWAOverviewInclusion,
	getDefaultSelectedTypes,
	type RWAOverviewInclusionContext,
	type RWAOverviewMode
} from './constants'
import {
	filterRwaOverviewDisplayRows,
	getEmptyRwaFilteredRowsResult,
	hasActiveInclusionOverride,
	hasPerpsOverlayBlockingFiltersFromQuery,
	parseAttributeFilterStatesParam,
	resolveRWAOverviewInclusionFlag,
	updateAttributeFilterStatesQueryValue,
	type RWAAttributeFilterState
} from './filterState'
import { computeWeightedGroups, getPrimaryRwaCategory } from './grouping'
import { rwaSlug } from './rwaSlug'

export { resolveRWAOverviewInclusionFlag } from './filterState'

type PieChartDatum = { name: string; value: number }

const limitPieChartData = (data: PieChartDatum[], maxLabels: number) => {
	if (data.length <= maxLabels) return data

	let othersValue = 0
	for (let index = maxLabels - 1; index < data.length; index++) {
		othersValue += data[index].value
	}
	data.length = maxLabels - 1
	if (othersValue > 0) data.push({ name: 'Others', value: othersValue })
	return data
}

const buildStackColors = (order: string[]) => {
	const stackColors = createChartRecord<string>()
	for (const [idx, key] of order.entries()) {
		stackColors[key] = CHART_COLORS[idx % CHART_COLORS.length]
	}
	return stackColors
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

const updateAttributeFilterStatesQuery = (queryKey: string, values: RWAAttributeFilterState[], router: NextRouter) => {
	void pushShallowQuery(router, {
		[queryKey]: updateAttributeFilterStatesQueryValue(values)
	})
}

export const useRWATableQueryParams = ({
	assetNames,
	types,
	categories,
	platforms,
	assetGroups,
	assetClasses,
	rwaClassifications,
	accessModels,
	issuers,
	chainSlug,
	categorySlug,
	platformSlug,
	assetGroupSlug,
	mode
}: {
	assetNames: string[]
	types: string[]
	categories: string[]
	platforms: string[]
	assetGroups: string[]
	assetClasses: string[]
	rwaClassifications: string[]
	accessModels: string[]
	issuers: string[]
	chainSlug?: string | null
	categorySlug?: string | null
	platformSlug?: string | null
	assetGroupSlug?: string | null
	mode: RWAOverviewMode
}) => {
	const router = useRouter()
	const {
		assetNames: assetNamesQ,
		excludeAssetNames: excludeAssetNamesQ,
		types: typesQ,
		excludeTypes: excludeTypesQ,
		categories: categoriesQ,
		excludeCategories: excludeCategoriesQ,
		platforms: platformsQ,
		excludePlatforms: excludePlatformsQ,
		assetGroups: assetGroupsQ,
		excludeAssetGroups: excludeAssetGroupsQ,
		assetClasses: assetClassesQ,
		excludeAssetClasses: excludeAssetClassesQ,
		rwaClassifications: rwaClassificationsQ,
		excludeRwaClassifications: excludeRwaClassificationsQ,
		accessModels: accessModelsQ,
		excludeAccessModels: excludeAccessModelsQ,
		issuers: issuersQ,
		excludeIssuers: excludeIssuersQ,
		minDefiActiveTvlToOnChainMcapPct: minDefiActiveTvlToOnChainMcapPctQ,
		maxDefiActiveTvlToOnChainMcapPct: maxDefiActiveTvlToOnChainMcapPctQ,
		minActiveMcapToOnChainMcapPct: minActiveMcapToOnChainMcapPctQ,
		maxActiveMcapToOnChainMcapPct: maxActiveMcapToOnChainMcapPctQ,
		minDefiActiveTvlToActiveMcapPct: minDefiActiveTvlToActiveMcapPctQ,
		maxDefiActiveTvlToActiveMcapPct: maxDefiActiveTvlToActiveMcapPctQ,
		includeStablecoins: stablecoinsQ,
		includeGovernance: governanceQ,
		includeRwaPerps: rwaPerpsQ,
		redeemableStates: redeemableStatesQ,
		attestationsStates: attestationsStatesQ,
		cexListedStates: cexListedStatesQ,
		kycForMintRedeemStates: kycForMintRedeemStatesQ,
		kycAllowlistedWhitelistedToTransferHoldStates: kycAllowlistedWhitelistedToTransferHoldStatesQ,
		transferableStates: transferableStatesQ,
		selfCustodyStates: selfCustodyStatesQ
	} = router.query
	const defaultInclusion = getDefaultRWAOverviewInclusion({
		mode,
		chainSlug,
		categorySlug,
		platformSlug,
		assetGroupSlug
	})

	const {
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
		minDefiActiveTvlToOnChainMcapPct,
		maxDefiActiveTvlToOnChainMcapPct,
		minActiveMcapToOnChainMcapPct,
		maxActiveMcapToOnChainMcapPct,
		minDefiActiveTvlToActiveMcapPct,
		maxDefiActiveTvlToActiveMcapPct,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps
	} = useMemo(() => {
		// If query param is 'None', return empty array. If no param, return all (default). Otherwise parse the array.
		const parseArrayParam = (
			param: string | string[] | undefined,
			allValues: string[],
			validSet: Set<string>
		): string[] => {
			if (param === 'None') return []
			if (!param) return allValues
			const arr = toNonEmptyArrayParam(param)
			return arr.filter((v) => validSet.has(v))
		}

		const assetNamesValidSet = new Set(assetNames)
		const typesValidSet = new Set(types)
		const categoriesValidSet = new Set(categories)
		const platformsValidSet = new Set(platforms)
		const assetGroupsValidSet = new Set(assetGroups)
		const assetClassesValidSet = new Set(assetClasses)
		const rwaClassificationsValidSet = new Set(rwaClassifications)
		const accessModelsValidSet = new Set(accessModels)
		const issuersValidSet = new Set(issuers)

		// Parse exclude sets
		const excludeAssetNamesSet = parseExcludeParam(excludeAssetNamesQ)
		const excludeTypesSet = parseExcludeParam(excludeTypesQ)
		const excludeCategoriesSet = parseExcludeParam(excludeCategoriesQ)
		const excludePlatformsSet = parseExcludeParam(excludePlatformsQ)
		const excludeAssetGroupsSet = parseExcludeParam(excludeAssetGroupsQ)
		const excludeAssetClassesSet = parseExcludeParam(excludeAssetClassesQ)
		const excludeRwaClassificationsSet = parseExcludeParam(excludeRwaClassificationsQ)
		const excludeAccessModelsSet = parseExcludeParam(excludeAccessModelsQ)
		const excludeIssuersSet = parseExcludeParam(excludeIssuersQ)

		const includeStablecoins = resolveRWAOverviewInclusionFlag(stablecoinsQ, defaultInclusion.includeStablecoins)
		const includeGovernance = resolveRWAOverviewInclusionFlag(governanceQ, defaultInclusion.includeGovernance)
		const includeRwaPerps = resolveRWAOverviewInclusionFlag(rwaPerpsQ, defaultInclusion.includeRwaPerps)

		// Build selected arrays with correct "exclude" semantics:
		// - if include param missing but exclude param exists, selection is (all - excluded), NOT "defaults - excluded"
		const baseAssetNames =
			assetNamesQ != null
				? parseArrayParam(assetNamesQ, assetNames, assetNamesValidSet)
				: excludeAssetNamesSet.size > 0
					? assetNames
					: assetNames
		const selectedAssetNames =
			excludeAssetNamesSet.size > 0 ? baseAssetNames.filter((a) => !excludeAssetNamesSet.has(a)) : baseAssetNames

		const baseTypes =
			typesQ != null
				? parseArrayParam(typesQ, types, typesValidSet)
				: excludeTypesSet.size > 0
					? types
					: getDefaultSelectedTypes(types, mode, categorySlug)
		const selectedTypes = excludeTypesSet.size > 0 ? baseTypes.filter((t) => !excludeTypesSet.has(t)) : baseTypes

		const baseCategories =
			categoriesQ != null
				? parseArrayParam(categoriesQ, categories, categoriesValidSet)
				: excludeCategoriesSet.size > 0
					? categories
					: categories
		const selectedCategories =
			excludeCategoriesSet.size > 0 ? baseCategories.filter((c) => !excludeCategoriesSet.has(c)) : baseCategories

		const basePlatforms =
			platformsQ != null
				? parseArrayParam(platformsQ, platforms, platformsValidSet)
				: excludePlatformsSet.size > 0
					? platforms
					: platforms
		const selectedPlatforms =
			excludePlatformsSet.size > 0 ? basePlatforms.filter((p) => !excludePlatformsSet.has(p)) : basePlatforms

		const baseAssetGroups =
			assetGroupsQ != null
				? parseArrayParam(assetGroupsQ, assetGroups, assetGroupsValidSet)
				: excludeAssetGroupsSet.size > 0
					? assetGroups
					: assetGroups
		const selectedAssetGroups =
			excludeAssetGroupsSet.size > 0
				? baseAssetGroups.filter((assetGroup) => !excludeAssetGroupsSet.has(assetGroup))
				: baseAssetGroups

		const baseAssetClasses =
			assetClassesQ != null
				? parseArrayParam(assetClassesQ, assetClasses, assetClassesValidSet)
				: excludeAssetClassesSet.size > 0
					? assetClasses
					: assetClasses
		const selectedAssetClasses =
			excludeAssetClassesSet.size > 0
				? baseAssetClasses.filter((a) => !excludeAssetClassesSet.has(a))
				: baseAssetClasses

		const baseRwaClassifications =
			rwaClassificationsQ != null
				? parseArrayParam(rwaClassificationsQ, rwaClassifications, rwaClassificationsValidSet)
				: excludeRwaClassificationsSet.size > 0
					? rwaClassifications
					: rwaClassifications
		const selectedRwaClassifications =
			excludeRwaClassificationsSet.size > 0
				? baseRwaClassifications.filter((r) => !excludeRwaClassificationsSet.has(r))
				: baseRwaClassifications

		const baseAccessModels = parseArrayParam(accessModelsQ, accessModels, accessModelsValidSet)
		const selectedAccessModels =
			excludeAccessModelsSet.size > 0
				? baseAccessModels.filter((a) => !excludeAccessModelsSet.has(a))
				: baseAccessModels

		const baseIssuers = parseArrayParam(issuersQ, issuers, issuersValidSet)
		const selectedIssuers =
			excludeIssuersSet.size > 0 ? baseIssuers.filter((i) => !excludeIssuersSet.has(i)) : baseIssuers

		const selectedRedeemableStates = parseAttributeFilterStatesParam(redeemableStatesQ)
		const selectedAttestationsStates = parseAttributeFilterStatesParam(attestationsStatesQ)
		const selectedCexListedStates = parseAttributeFilterStatesParam(cexListedStatesQ)
		const selectedKycForMintRedeemStates = parseAttributeFilterStatesParam(kycForMintRedeemStatesQ)
		const selectedKycAllowlistedWhitelistedToTransferHoldStates = parseAttributeFilterStatesParam(
			kycAllowlistedWhitelistedToTransferHoldStatesQ
		)
		const selectedTransferableStates = parseAttributeFilterStatesParam(transferableStatesQ)
		const selectedSelfCustodyStates = parseAttributeFilterStatesParam(selfCustodyStatesQ)

		const minDefiActiveTvlToOnChainMcapPct = parseNumberQueryParam(minDefiActiveTvlToOnChainMcapPctQ)
		const maxDefiActiveTvlToOnChainMcapPct = parseNumberQueryParam(maxDefiActiveTvlToOnChainMcapPctQ)
		const minActiveMcapToOnChainMcapPct = parseNumberQueryParam(minActiveMcapToOnChainMcapPctQ)
		const maxActiveMcapToOnChainMcapPct = parseNumberQueryParam(maxActiveMcapToOnChainMcapPctQ)
		const minDefiActiveTvlToActiveMcapPct = parseNumberQueryParam(minDefiActiveTvlToActiveMcapPctQ)
		const maxDefiActiveTvlToActiveMcapPct = parseNumberQueryParam(maxDefiActiveTvlToActiveMcapPctQ)

		return {
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
			minDefiActiveTvlToOnChainMcapPct,
			maxDefiActiveTvlToOnChainMcapPct,
			minActiveMcapToOnChainMcapPct,
			maxActiveMcapToOnChainMcapPct,
			minDefiActiveTvlToActiveMcapPct,
			maxDefiActiveTvlToActiveMcapPct,
			includeStablecoins,
			includeGovernance,
			includeRwaPerps
		}
	}, [
		assetNamesQ,
		excludeAssetNamesQ,
		typesQ,
		excludeTypesQ,
		categoriesQ,
		excludeCategoriesQ,
		platformsQ,
		excludePlatformsQ,
		assetGroupsQ,
		excludeAssetGroupsQ,
		assetClassesQ,
		excludeAssetClassesQ,
		rwaClassificationsQ,
		excludeRwaClassificationsQ,
		accessModelsQ,
		excludeAccessModelsQ,
		issuersQ,
		excludeIssuersQ,
		redeemableStatesQ,
		attestationsStatesQ,
		cexListedStatesQ,
		kycForMintRedeemStatesQ,
		kycAllowlistedWhitelistedToTransferHoldStatesQ,
		transferableStatesQ,
		selfCustodyStatesQ,
		minDefiActiveTvlToOnChainMcapPctQ,
		maxDefiActiveTvlToOnChainMcapPctQ,
		minActiveMcapToOnChainMcapPctQ,
		maxActiveMcapToOnChainMcapPctQ,
		minDefiActiveTvlToActiveMcapPctQ,
		maxDefiActiveTvlToActiveMcapPctQ,
		stablecoinsQ,
		governanceQ,
		rwaPerpsQ,
		defaultInclusion.includeStablecoins,
		defaultInclusion.includeGovernance,
		defaultInclusion.includeRwaPerps,
		assetNames,
		types,
		categories,
		platforms,
		assetGroups,
		assetClasses,
		rwaClassifications,
		accessModels,
		issuers,
		mode,
		categorySlug
	])

	const hasPerpsOverlayBlockingFilters = useMemo(
		() =>
			hasPerpsOverlayBlockingFiltersFromQuery(router.query, {
				mode,
				chainSlug,
				categorySlug,
				platformSlug,
				assetGroupSlug
			}),
		[router.query, mode, chainSlug, categorySlug, platformSlug, assetGroupSlug]
	)

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
			includeStablecoins: value === defaultInclusion.includeStablecoins ? undefined : value ? 'true' : 'false'
		})
	}

	const setIncludeGovernance = (value: boolean) => {
		void pushShallowQuery(router, {
			includeGovernance: value === defaultInclusion.includeGovernance ? undefined : value ? 'true' : 'false'
		})
	}

	const setIncludeRwaPerps = (value: boolean) => {
		void pushShallowQuery(router, {
			includeRwaPerps: value === defaultInclusion.includeRwaPerps ? undefined : value ? 'true' : 'false'
		})
	}

	const setRedeemableStates = (values: RWAAttributeFilterState[]) =>
		updateAttributeFilterStatesQuery('redeemableStates', values, router)
	const setAttestationsStates = (values: RWAAttributeFilterState[]) =>
		updateAttributeFilterStatesQuery('attestationsStates', values, router)
	const setCexListedStates = (values: RWAAttributeFilterState[]) =>
		updateAttributeFilterStatesQuery('cexListedStates', values, router)
	const setKycForMintRedeemStates = (values: RWAAttributeFilterState[]) =>
		updateAttributeFilterStatesQuery('kycForMintRedeemStates', values, router)
	const setKycAllowlistedWhitelistedToTransferHoldStates = (values: RWAAttributeFilterState[]) =>
		updateAttributeFilterStatesQuery('kycAllowlistedWhitelistedToTransferHoldStates', values, router)
	const setTransferableStates = (values: RWAAttributeFilterState[]) =>
		updateAttributeFilterStatesQuery('transferableStates', values, router)
	const setSelfCustodyStates = (values: RWAAttributeFilterState[]) =>
		updateAttributeFilterStatesQuery('selfCustodyStates', values, router)

	return {
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
		minDefiActiveTvlToOnChainMcapPct,
		maxDefiActiveTvlToOnChainMcapPct,
		minActiveMcapToOnChainMcapPct,
		maxActiveMcapToOnChainMcapPct,
		minDefiActiveTvlToActiveMcapPct,
		maxDefiActiveTvlToActiveMcapPct,
		includeStablecoins,
		includeGovernance,
		includeRwaPerps,
		hasPerpsOverlayBlockingFilters,
		setRedeemableStates,
		setAttestationsStates,
		setCexListedStates,
		setKycForMintRedeemStates,
		setKycAllowlistedWhitelistedToTransferHoldStates,
		setTransferableStates,
		setSelfCustodyStates,
		setDefiActiveTvlToOnChainMcapPctRange,
		setActiveMcapToOnChainMcapPctRange,
		setDefiActiveTvlToActiveMcapPctRange,
		setIncludeStablecoins,
		setIncludeGovernance,
		setIncludeRwaPerps
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
	includeRwaPerps,
	hasPerpsOverlayBlockingFilters,
	minDefiActiveTvlToOnChainMcapPct,
	maxDefiActiveTvlToOnChainMcapPct,
	minActiveMcapToOnChainMcapPct,
	maxActiveMcapToOnChainMcapPct,
	minDefiActiveTvlToActiveMcapPct,
	maxDefiActiveTvlToActiveMcapPct
}: {
	assets: RWAAsset[]
	isPlatformMode: boolean
	selectedAssetNames: string[]
	selectedTypes: string[]
	selectedCategories: string[]
	selectedPlatforms: string[]
	selectedAssetGroups: string[]
	selectedAssetClasses: string[]
	selectedRwaClassifications: string[]
	selectedAccessModels: string[]
	selectedIssuers: string[]
	selectedRedeemableStates: RWAAttributeFilterState[]
	selectedAttestationsStates: RWAAttributeFilterState[]
	selectedCexListedStates: RWAAttributeFilterState[]
	selectedKycForMintRedeemStates: RWAAttributeFilterState[]
	selectedKycAllowlistedWhitelistedToTransferHoldStates: RWAAttributeFilterState[]
	selectedTransferableStates: RWAAttributeFilterState[]
	selectedSelfCustodyStates: RWAAttributeFilterState[]
	includeStablecoins: boolean
	includeGovernance: boolean
	includeRwaPerps: boolean
	hasPerpsOverlayBlockingFilters: boolean
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
			includeRwaPerps,
			hasPerpsOverlayBlockingFilters,
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
		includeRwaPerps,
		hasPerpsOverlayBlockingFilters,
		minDefiActiveTvlToOnChainMcapPct,
		maxDefiActiveTvlToOnChainMcapPct,
		minActiveMcapToOnChainMcapPct,
		maxActiveMcapToOnChainMcapPct,
		minDefiActiveTvlToActiveMcapPct,
		maxDefiActiveTvlToActiveMcapPct
	])
}

export function useRWAAssetCategoryPieChartData({
	enabled,
	assets,
	categories,
	selectedCategories,
	metric
}: {
	enabled: boolean
	assets: IRWAAssetsOverview['assets']
	categories: string[]
	selectedCategories: string[]
	metric: RWAChartMetricKey
}) {
	return useMemo(() => {
		if (!enabled) {
			return {
				pieChartData: [] as PieChartDatum[],
				pieChartStackColors: {}
			}
		}
		const pieChartStackColors = buildStackColors(categories)
		const selectedCategoriesSet = new Set(selectedCategories)
		const categoryTotals = new Map<string, number>()

		for (const asset of assets) {
			const primaryCategory = getPrimaryRwaCategory(asset.category)
			if (!primaryCategory || !selectedCategoriesSet.has(primaryCategory)) continue

			categoryTotals.set(primaryCategory, (categoryTotals.get(primaryCategory) ?? 0) + (asset[metric]?.total ?? 0))
		}

		const pieChartData: PieChartDatum[] = []
		for (const [name, value] of categoryTotals) {
			if (value > 0) pieChartData.push({ name, value })
		}
		pieChartData.sort((a, b) => b.value - a.value)

		return {
			pieChartData,
			pieChartStackColors
		}
	}, [assets, categories, enabled, metric, selectedCategories])
}

export function useRwaCategoryAssetClassPieChartData({
	enabled,
	assets,
	assetClasses,
	selectedAssetClasses,
	metric
}: {
	enabled: boolean
	assets: IRWAAssetsOverview['assets']
	assetClasses: string[]
	selectedAssetClasses: string[]
	metric: RWAChartMetricKey
}) {
	return useMemo(() => {
		if (!enabled) {
			return {
				pieChartData: [] as PieChartDatum[],
				pieChartStackColors: {}
			}
		}

		const pieChartStackColors = buildStackColors(assetClasses)
		const selectedAssetClassesSet = new Set(selectedAssetClasses)
		const assetClassTotals = new Map<string, number>()

		for (const asset of assets) {
			for (const { value: assetClass, weight } of computeWeightedGroups(asset.assetClass)) {
				if (!assetClass || !selectedAssetClassesSet.has(assetClass)) continue

				assetClassTotals.set(assetClass, (assetClassTotals.get(assetClass) ?? 0) + (asset[metric]?.total ?? 0) * weight)
			}
		}

		const pieChartData: PieChartDatum[] = []
		for (const [name, value] of assetClassTotals) {
			if (value > 0) pieChartData.push({ name, value })
		}
		pieChartData.sort((a, b) => b.value - a.value)

		return {
			pieChartData,
			pieChartStackColors
		}
	}, [assetClasses, assets, enabled, metric, selectedAssetClasses])
}

export function useRwaAssetNamePieChartData({
	enabled,
	assets,
	selectedAssetNames,
	metric
}: {
	enabled: boolean
	assets: IRWAAssetsOverview['assets']
	selectedAssetNames: string[]
	metric: RWAChartMetricKey
}) {
	return useMemo(() => {
		const MAX_LABELS = 24

		if (!enabled) {
			return {
				pieChartData: [] as PieChartDatum[],
				pieChartStackColors: {}
			}
		}

		const selectedAssetNamesSet = new Set(selectedAssetNames)
		if (selectedAssetNamesSet.size === 0) {
			return {
				pieChartData: [] as PieChartDatum[],
				pieChartStackColors: {}
			}
		}

		const discoveredNames = new Set<string>()
		const totals = new Map<string, number>()
		for (const asset of assets) {
			const name = asset.assetName || asset.ticker
			if (!selectedAssetNamesSet.has(name)) continue
			discoveredNames.add(name)
			totals.set(name, (totals.get(name) ?? 0) + (asset[metric]?.total ?? 0))
		}

		const colorOrder = Array.from(discoveredNames)
		colorOrder.sort()
		// Keep existing label colors stable while ensuring "Others" exists.
		if (!colorOrder.includes('Others')) colorOrder.push('Others')
		const pieChartStackColors = buildStackColors(colorOrder)

		const pieChartData: PieChartDatum[] = []
		for (const [name, value] of totals) {
			if (value > 0) pieChartData.push({ name, value })
		}
		pieChartData.sort((a, b) => b.value - a.value)
		limitPieChartData(pieChartData, MAX_LABELS)

		return {
			pieChartData,
			pieChartStackColors
		}
	}, [assets, enabled, metric, selectedAssetNames])
}

export function useRwaAssetGroupPieChartData({
	enabled,
	assets,
	metric
}: {
	enabled: boolean
	assets: IRWAAssetsOverview['assets']
	metric: RWAChartMetricKey
}) {
	return useMemo(() => {
		const MAX_LABELS = 24

		if (!enabled || assets.length === 0) {
			return {
				pieChartData: [] as PieChartDatum[],
				pieChartStackColors: {}
			}
		}

		const totalsByGroup = new Map<string, number>()
		for (const asset of assets) {
			const assetGroup = normalizeRwaAssetGroup(asset.assetGroup)
			totalsByGroup.set(assetGroup, (totalsByGroup.get(assetGroup) ?? 0) + (asset[metric]?.total ?? 0))
		}

		const colorOrder = Array.from(totalsByGroup.keys()).sort()
		if (!colorOrder.includes('Others')) colorOrder.push('Others')
		const pieChartStackColors = buildStackColors(colorOrder)

		const pieChartData: PieChartDatum[] = []
		for (const [name, value] of totalsByGroup) {
			if (value > 0) pieChartData.push({ name, value })
		}
		pieChartData.sort((a, b) => b.value - a.value)
		limitPieChartData(pieChartData, MAX_LABELS)

		return {
			pieChartData,
			pieChartStackColors
		}
	}, [assets, enabled, metric])
}

export function useRwaAssetPlatformPieChartData({
	enabled,
	assets,
	metric
}: {
	enabled: boolean
	assets: IRWAAssetsOverview['assets']
	metric: RWAChartMetricKey
}) {
	return useMemo(() => {
		const MAX_LABELS = 24
		const UNKNOWN = 'Unknown'

		if (!enabled || assets.length === 0) {
			return {
				pieChartData: [] as PieChartDatum[],
				pieChartStackColors: {}
			}
		}

		// Coalesce by slug to avoid casing/spacing duplicates in platform names.
		const totalsBySlug = new Map<string, { label: string; value: number }>()
		for (const asset of assets) {
			const platformRaw = asset.parentPlatform as unknown
			const platformCandidates = Array.isArray(platformRaw) ? platformRaw : [platformRaw]
			const normalizedPlatforms = platformCandidates
				.map((platform) => (typeof platform === 'string' ? platform.trim() : ''))
				.filter((platform): platform is string => platform.length > 0)
			const platforms = normalizedPlatforms.length > 0 ? Array.from(new Set(normalizedPlatforms)) : [UNKNOWN]
			const platformWeight = 1 / platforms.length

			for (const platform of platforms) {
				const key = rwaSlug(platform)
				const prev = totalsBySlug.get(key) ?? { label: platform, value: 0 }

				// Prefer a non-Unknown label if we previously only had Unknown.
				if (prev.label === UNKNOWN && platform !== UNKNOWN) prev.label = platform

				prev.value += (asset[metric]?.total ?? 0) * platformWeight
				totalsBySlug.set(key, prev)
			}
		}

		const colorOrder: string[] = []
		for (const value of totalsBySlug.values()) {
			if (value.label) {
				colorOrder.push(value.label)
			}
		}
		colorOrder.sort()
		// Keep existing label colors stable while ensuring "Others" exists.
		if (!colorOrder.includes('Others')) colorOrder.push('Others')
		const pieChartStackColors = buildStackColors(colorOrder)

		const pieChartData: PieChartDatum[] = []
		for (const { label, value } of totalsBySlug.values()) {
			if (value > 0) pieChartData.push({ name: label || UNKNOWN, value })
		}
		pieChartData.sort((a, b) => b.value - a.value)
		limitPieChartData(pieChartData, MAX_LABELS)

		return {
			pieChartData,
			pieChartStackColors
		}
	}, [assets, enabled, metric])
}

export function useRwaChainBreakdownPieChartData({
	enabled,
	assets,
	metric
}: {
	enabled: boolean
	assets: IRWAAssetsOverview['assets']
	metric: RWAChartMetricKey
}) {
	return useMemo(() => {
		const MAX_LABELS = 10
		const UNKNOWN = 'Unknown'

		if (!enabled) {
			return {
				pieChartData: [] as PieChartDatum[],
				pieChartStackColors: {}
			}
		}

		if (assets.length === 0) {
			return {
				pieChartData: [] as PieChartDatum[],
				pieChartStackColors: {}
			}
		}

		// Aggregate using per-chain breakdowns (prevents "random" chain attribution on multi-chain assets).
		// We retain the union's insertion order so tied values and label colors stay stable across metric toggles.
		const totalsBySlug = new Map<string, { label: string; value: number }>()
		const upsert = (
			chainRaw: string | null | undefined,
			breakdownMetric: RWAChartMetricKey,
			valueRaw: number | null | undefined
		) => {
			const value = valueRaw ?? 0
			if (value <= 0) return

			const chain = (chainRaw ?? '').trim() || UNKNOWN
			const key = rwaSlug(chain)
			const prev = totalsBySlug.get(key) ?? { label: chain, value: 0 }
			// Prefer a non-Unknown label if we previously only had Unknown.
			if (prev.label === UNKNOWN && chain !== UNKNOWN) prev.label = chain
			if (breakdownMetric === metric) prev.value += value
			totalsBySlug.set(key, prev)
		}

		for (const asset of assets) {
			for (const [chain, value] of asset.onChainMcap?.breakdown ?? []) {
				upsert(chain, 'onChainMcap', value)
			}
			for (const [chain, value] of asset.activeMcap?.breakdown ?? []) {
				upsert(chain, 'activeMcap', value)
			}
			// New: chain-level TVL breakdown (fallback: none if missing).
			for (const [chain, value] of asset.defiActiveTvlByChain?.breakdown ?? []) {
				upsert(chain, 'defiActiveTvl', value)
			}
		}

		const colorOrder: string[] = []
		for (const value of totalsBySlug.values()) {
			if (value.label) {
				colorOrder.push(value.label)
			}
		}
		colorOrder.sort()
		// Keep existing label colors stable while ensuring "Others" exists.
		if (!colorOrder.includes('Others')) colorOrder.push('Others')
		const pieChartStackColors = buildStackColors(colorOrder)

		const pieChartData: PieChartDatum[] = []
		for (const { label, value } of totalsBySlug.values()) {
			if (value > 0) pieChartData.push({ name: label || UNKNOWN, value })
		}
		pieChartData.sort((a, b) => b.value - a.value)
		limitPieChartData(pieChartData, MAX_LABELS)

		return {
			pieChartData,
			pieChartStackColors
		}
	}, [assets, enabled, metric])
}

const CHART_FILTER_QUERY_KEYS = new Set([
	'assetNames',
	'types',
	'categories',
	'platforms',
	'assetGroups',
	'assetClasses',
	'rwaClassifications',
	'accessModels',
	'issuers',
	'excludeAssetNames',
	'excludeTypes',
	'excludeCategories',
	'excludePlatforms',
	'excludeAssetGroups',
	'excludeAssetClasses',
	'excludeRwaClassifications',
	'excludeAccessModels',
	'excludeIssuers',
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
	'maxDefiActiveTvlToActiveMcapPct',
	'includeStablecoins',
	'includeGovernance',
	'includeRwaPerps'
])

export function hasActiveChartFilters(
	query: NextRouter['query'],
	inclusionContext: RWAOverviewInclusionContext
): boolean {
	const defaultInclusion = getDefaultRWAOverviewInclusion(inclusionContext)

	for (const key of CHART_FILTER_QUERY_KEYS) {
		if (key === 'includeStablecoins') {
			if (hasActiveInclusionOverride(query.includeStablecoins, defaultInclusion.includeStablecoins)) return true
			continue
		}
		if (key === 'includeGovernance') {
			if (hasActiveInclusionOverride(query.includeGovernance, defaultInclusion.includeGovernance)) return true
			continue
		}
		if (key === 'includeRwaPerps') {
			continue
		}
		if (key in query) return true
	}
	return false
}

export function getRwaAssetChartQueryKey(
	target: RWAAssetChartTarget,
	selectedMetric: RWAChartMetricKey,
	includeStablecoins: boolean,
	includeGovernance: boolean
) {
	return [
		'rwa-asset-chart',
		target.kind,
		target.kind === 'all' ? 'all' : target.slug,
		selectedMetric,
		includeStablecoins,
		includeGovernance
	] as const
}

export function getRwaOpenInterestChartQueryKey() {
	return ['rwa-perps-open-interest-chart'] as const
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message)
	}
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

async function fetchRwaAssetChartData(params: {
	key: RWAChartMetricKey
	target: RWAAssetChartTarget
	includeStablecoins: boolean
	includeGovernance: boolean
}): Promise<IRWAChartMetricRows> {
	const searchParams = new URLSearchParams({ key: params.key })
	searchParams.set('includeStablecoin', String(params.includeStablecoins))
	searchParams.set('includeGovernance', String(params.includeGovernance))

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

async function fetchRwaOpenInterestChartData(): Promise<RWAChartDataset> {
	return fetchJson<RWAChartDataset>('/api/public/rwa/perps/contract-breakdown?key=openInterest')
}

export function useRwaChartDataset({
	selectedMetric,
	initialDataset,
	initialOpenInterestDataset,
	filteredAssets,
	mode,
	target,
	includeStablecoins,
	includeGovernance,
	includeRwaPerps,
	useInitialDataset,
	enabled = true
}: {
	selectedMetric: RWAChartMetricKey
	initialDataset: RWAChartDataset
	initialOpenInterestDataset: RWAChartDataset | null
	filteredAssets: IRWAAssetsOverview['assets']
	mode: RWAChartAggregationMode
	target: RWAAssetChartTarget
	includeStablecoins: boolean
	includeGovernance: boolean
	includeRwaPerps: boolean
	useInitialDataset: boolean
	enabled?: boolean
}): {
	chartDataset: RWAChartDataset
	isChartLoading: boolean
	chartError: string | null
} {
	const {
		data: assetRows,
		isLoading,
		error
	} = useQuery({
		queryKey: getRwaAssetChartQueryKey(target, selectedMetric, includeStablecoins, includeGovernance),
		queryFn: () =>
			fetchRwaAssetChartData({
				key: selectedMetric,
				target,
				includeStablecoins,
				includeGovernance
			}),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: enabled && !useInitialDataset && filteredAssets.some((asset) => asset.kind === 'spot')
	})
	const {
		data: openInterestRows,
		isLoading: isOpenInterestLoading,
		error: openInterestError
	} = useQuery({
		queryKey: getRwaOpenInterestChartQueryKey(),
		queryFn: () => fetchRwaOpenInterestChartData(),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: enabled && !useInitialDataset && includeRwaPerps && filteredAssets.some((asset) => asset.kind === 'perps')
	})

	assert(initialDataset.dimensions[0] === 'timestamp', 'Expected timestamp dimension')

	const chartDataset = useMemo(() => {
		if (!enabled) return emptyChartDataset()

		const spotDataset = (() => {
			if (useInitialDataset) {
				const dataset =
					mode === 'total'
						? selectRwaChartDatasetSeries(initialDataset, ['Total'])
						: appendRwaChartDatasetTotal(initialDataset)
				return renameRwaChartDatasetTotal(dataset, selectedMetric)
			}
			if (!assetRows) return emptyChartDataset()
			const dataset = aggregateRwaMetricData(filteredAssets, assetRows, mode)
			const datasetWithTotal = mode === 'total' ? dataset : appendRwaChartDatasetTotal(dataset)
			return renameRwaChartDatasetTotal(datasetWithTotal, selectedMetric)
		})()

		if (!includeRwaPerps) return spotDataset

		const openInterestDataset = useInitialDataset
			? (initialOpenInterestDataset ?? emptyChartDataset())
			: openInterestRows
				? buildRwaOpenInterestDataset(filteredAssets, openInterestRows)
				: emptyChartDataset()

		return mergeRwaChartDatasets(spotDataset, openInterestDataset)
	}, [
		useInitialDataset,
		initialDataset,
		initialOpenInterestDataset,
		assetRows,
		openInterestRows,
		filteredAssets,
		mode,
		selectedMetric,
		includeRwaPerps,
		enabled
	])

	return {
		chartDataset,
		isChartLoading: enabled && !useInitialDataset && (isLoading || isOpenInterestLoading),
		chartError: enabled
			? error
				? getErrorMessage(error)
				: openInterestError
					? getErrorMessage(openInterestError)
					: null
			: null
	}
}
