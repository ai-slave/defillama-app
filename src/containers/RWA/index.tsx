import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SummaryCardGrid } from '~/ui/SummaryStats'
import { formatCompactNumber } from '~/utils/numberFormat'
import { pushShallowQuery, toQueryString } from '~/utils/routerQuery'
import type { IRWAAssetsOverview } from './api.types'
import { foldRwaPerpsTotals, rankRwaDefiProtocols } from './cards/cardData'
import { RWAOverviewCards } from './cards/OverviewCards'
import type { RWAOverviewMode } from './constants'
import { definitions } from './definitions'
import { RWAOverviewFilters } from './Filters'
import { RWAHighlights } from './highlights/Highlights'
import {
	useFilteredRwaAssets,
	useRWATableQueryParams,
	hasActiveChartFilters,
	hasActiveRwaAttributeFilters
} from './hooks'
import { formatRwaKpiUsd } from './kpi/format'
import { RWAKeyMetrics } from './kpi/KeyMetrics'
import { sumRwaKpiTotals } from './kpi/kpiTotals'
import { getAssetChartTarget, RWAOverviewChartPanel } from './OverviewChartPanel'
import { perpsDefinitions } from './Perps/definitions'
import { RWAPlatformDataViews, RWAPlatformHeader, type RWAPlatformListedTotal } from './PlatformPage'
import { getRankedRwaFilterValues } from './rankedFilterValues'
import {
	getRwaChangePeriodQueryValue,
	parseRwaChangePeriod,
	RWA_CHANGE_PERIOD_QUERY_KEY,
	type RWAChangePeriod
} from './table/change'
import { getRwaGroupByQueryValue, parseRwaGroupBy, type RWAGroupByScope, type RWATableView } from './table/groupBy'
import { RWATable } from './table/RWATable'
import { RWATableControls } from './table/toolbar/TableControls'

/** `hideEntityNav`: a protocol's own RWA tab fixes the entity, so the platform and chain switcher row is dead weight there. */
export function RWAOverview(props: IRWAAssetsOverview & { hideEntityNav?: boolean }) {
	const rankedFilterValues = useMemo(
		() =>
			getRankedRwaFilterValues({
				typeOptions: props.typeOptions,
				categoriesOptions: props.categoriesOptions,
				assetClassOptions: props.assetClassOptions,
				rwaClassificationOptions: props.rwaClassificationOptions,
				accessModelOptions: props.accessModelOptions
			}),
		[
			props.typeOptions,
			props.categoriesOptions,
			props.assetClassOptions,
			props.rwaClassificationOptions,
			props.accessModelOptions
		]
	)
	const router = useRouter()

	const mode = getRWAOverviewMode(props)
	const isChainMode = mode === 'chain'
	const isCategoryMode = mode === 'category'
	const isPlatformMode = mode === 'platform'
	const isAssetGroupMode = mode === 'assetGroup'

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
		includeRwaPerps,
		includeCex,
		includeBridgeTvl,
		includeWrappers,
		hasPerpsOverlayBlockingFilters,
		setDefiActiveTvlToOnChainMcapPctRange,
		setActiveMcapToOnChainMcapPctRange,
		setDefiActiveTvlToActiveMcapPctRange,
		setIncludeRwaPerps,
		setIncludeCex,
		setRedeemableStates,
		setAttestationsStates,
		setCexListedStates,
		setKycForMintRedeemStates,
		setKycAllowlistedWhitelistedToTransferHoldStates,
		setTransferableStates,
		setSelfCustodyStates
	} = useRWATableQueryParams({
		assetNames: props.assetNames,
		types: rankedFilterValues.types,
		categories: rankedFilterValues.categories,
		platforms: props.platforms,
		assetClasses: rankedFilterValues.assetClasses,
		rwaClassifications: rankedFilterValues.rwaClassifications,
		accessModels: rankedFilterValues.accessModels,
		issuers: props.issuers,
		assetGroups: props.assetGroups,
		defaultInclusion: props.defaultInclusion
	})

	const { filteredAssets, aggregateAssets } = useFilteredRwaAssets({
		assets: props.assets,
		isPlatformMode,
		selectedAssetNames,
		selectedCategories,
		selectedPlatforms,
		selectedAssetGroups,
		selectedAssetClasses,
		selectedRwaClassifications,
		selectedAccessModels,
		selectedIssuers,
		selectedTypes,
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
		includeCex,
		includeBridgeTvl,
		includeWrappers,
		hasPerpsOverlayBlockingFilters,
		minDefiActiveTvlToOnChainMcapPct,
		maxDefiActiveTvlToOnChainMcapPct,
		minActiveMcapToOnChainMcapPct,
		maxActiveMcapToOnChainMcapPct,
		minDefiActiveTvlToActiveMcapPct,
		maxDefiActiveTvlToActiveMcapPct
	})

	const activeFilters = hasActiveChartFilters(router.query, props.defaultInclusion)
	const activeAttributeFilters = hasActiveRwaAttributeFilters(router.query)
	const tableView: RWATableView = includeRwaPerps ? 'perps' : 'assets'
	const groupByScope: RWAGroupByScope = getAssetChartTarget(props).kind
	const tableGroupBy = parseRwaGroupBy(router.query.groupBy, tableView, { scope: groupByScope })
	const handleTableViewChange = useCallback(
		(view: RWATableView) => setIncludeRwaPerps(view === 'perps'),
		[setIncludeRwaPerps]
	)
	const handleGroupByChange = useCallback(
		(groupBy: Parameters<typeof getRwaGroupByQueryValue>[0]) => {
			void pushShallowQuery(router, { groupBy: getRwaGroupByQueryValue(groupBy, tableView, { scope: groupByScope }) })
		},
		[groupByScope, router, tableView]
	)
	const changePeriod = parseRwaChangePeriod(router.query[RWA_CHANGE_PERIOD_QUERY_KEY])
	const handlePeriodChange = useCallback(
		(period: RWAChangePeriod) => {
			void pushShallowQuery(router, { [RWA_CHANGE_PERIOD_QUERY_KEY]: getRwaChangePeriodQueryValue(period) })
		},
		[router]
	)

	// Preserve filter/toggle query params only in chain mode.
	// (The chain/category/platform itself is in the pathname, so we strip the dynamic param from the query object.)
	const baseNavLinks = getModeLinks(
		mode,
		props.chainLinks,
		props.categoryLinks,
		props.platformLinks,
		props.assetGroupLinks
	)
	let navLinks = baseNavLinks
	if (isChainMode) {
		const { chain: _chain, category: _category, platform: _platform, ...restQuery } = router.query
		const qs = toQueryString(restQuery)
		if (qs) navLinks = baseNavLinks.map((link) => ({ ...link, to: `${link.to}${qs}` }))
	}

	const selectedModeLabel = getSelectedModeLabel(mode, props)
	const showFilters = props.assets.length > 0

	const kpiTotals = useMemo(
		() => sumRwaKpiTotals(aggregateAssets, includeBridgeTvl),
		[aggregateAssets, includeBridgeTvl]
	)
	/* The CEX toggle lives in the Perps view; the Assets view reads the panel and the cards with CEX venues in. */
	const panelIncludeCex = includeRwaPerps ? includeCex : true
	/* The Perps view reads the filtered rows like every other number; the Assets view has no perps rows in its
	   fold, so it reads the page's perps rows under the page rules (no suspicious markets). */
	const perpsRows = useMemo(
		() =>
			includeRwaPerps ? aggregateAssets : props.assets.filter((asset) => asset.kind === 'perps' && !asset.suspicious),
		[aggregateAssets, includeRwaPerps, props.assets]
	)
	const perpsTotals = useMemo(() => foldRwaPerpsTotals(perpsRows, panelIncludeCex), [perpsRows, panelIncludeCex])
	const largestProtocol = useMemo(
		() => rankRwaDefiProtocols(aggregateAssets, includeBridgeTvl, 1)[0] ?? null,
		[aggregateAssets, includeBridgeTvl]
	)
	const keyMetrics = <RWAKeyMetrics metrics={kpiTotals} perps={perpsTotals} largestProtocol={largestProtocol} />
	const overviewCards = props.cards ? (
		<RWAOverviewCards cards={props.cards} includeBridgeTvl={includeBridgeTvl} includeCex={panelIncludeCex} />
	) : null

	/* Platform pages already headline the platform's own AUM and DeFi TVL, so the
	   same aggregates recomputed over the *filtered* asset set join the identity
	   card as their own group rather than competing as a row of big cards. */
	const platformListedTotals: Array<RWAPlatformListedTotal> = [
		{
			// Names the scope the money rows below are summed over: without it the
			// group's numbers silently disagree with the platform's own asset count.
			label: 'Assets shown',
			tooltip: 'Assets matching the current filters, and the scope of the totals below.',
			value: formatCompactNumber(filteredAssets.length)
		},
		{
			label: definitions.totalActiveMcap.label,
			tooltip: definitions.totalActiveMcap.description,
			value: formatRwaKpiUsd(kpiTotals.activeMcap)
		},
		{
			label: definitions.totalOnChainMcap.label,
			tooltip: definitions.totalOnChainMcap.description,
			value: formatRwaKpiUsd(kpiTotals.onChainMcap)
		},
		{
			label: definitions.totalDefiActiveTvl.label,
			tooltip: definitions.totalDefiActiveTvl.description,
			value: formatRwaKpiUsd(kpiTotals.defiActiveTvl)
		},
		...(includeRwaPerps
			? [
					{
						label: 'RWA Perps OI',
						tooltip: perpsDefinitions.totalOpenInterest.description,
						value: formatRwaKpiUsd(kpiTotals.openInterest)
					}
				]
			: []),
		{
			label: definitions.totalAssetIssuers.label,
			tooltip: definitions.totalAssetIssuers.description,
			value: formatCompactNumber(kpiTotals.issuerCount, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		}
	]

	const chartSection = (
		<RWAOverviewChartPanel
			overview={props}
			mode={mode}
			selectedModeLabel={selectedModeLabel}
			aggregateAssets={aggregateAssets}
			view={tableView}
			groupBy={tableGroupBy}
			rankedFilterValues={rankedFilterValues}
			selectedAssetNames={selectedAssetNames}
			selectedCategories={selectedCategories}
			includeStablecoins={includeStablecoins}
			includeGovernance={includeGovernance}
			includeCex={includeCex}
			includeBridgeTvl={includeBridgeTvl}
			activeFilters={activeFilters}
			activeAttributeFilters={activeAttributeFilters}
		/>
	)

	const filterProps = {
		enabled: showFilters,
		defaultInclusion: props.defaultInclusion,
		modes: {
			mode,
			isChainMode,
			isCategoryMode,
			isPlatformMode,
			isAssetGroupMode
		},
		options: {
			assetNames: props.assetNames,
			typeOptions: props.typeOptions,
			categoriesOptions: props.categoriesOptions,
			platforms: props.platforms,
			assetGroups: props.assetGroups,
			assetClassOptions: props.assetClassOptions,
			rwaClassificationOptions: props.rwaClassificationOptions,
			accessModelOptions: props.accessModelOptions,
			issuers: props.issuers,
			chainSlug: props.chainSlug,
			categorySlug: props.categorySlug,
			platformSlug: props.platformSlug,
			assetGroupSlug: props.assetGroupSlug
		},
		selections: {
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
			includeBridgeTvl,
			includeWrappers
		},
		actions: {
			setDefiActiveTvlToOnChainMcapPctRange,
			setActiveMcapToOnChainMcapPctRange,
			setDefiActiveTvlToActiveMcapPctRange,
			setRedeemableStates,
			setAttestationsStates,
			setCexListedStates,
			setKycForMintRedeemStates,
			setKycAllowlistedWhitelistedToTransferHoldStates,
			setTransferableStates,
			setSelfCustodyStates
		}
	}

	const tableControls = (
		<RWATableControls
			view={tableView}
			onViewChange={handleTableViewChange}
			groupBy={tableGroupBy}
			groupByScope={groupByScope}
			onGroupByChange={handleGroupByChange}
			includeCex={includeCex}
			onIncludeCexChange={setIncludeCex}
		/>
	)

	const tableProps = {
		assets: filteredAssets,
		view: tableView,
		groupBy: tableGroupBy,
		includeCex,
		period: changePeriod,
		onPeriodChange: handlePeriodChange,
		selectedChain: props.selectedChain,
		includeBridgeTvl,
		platformLogos: props.platformLogos,
		...(tableView === 'perps' && hasPerpsOverlayBlockingFilters
			? { emptyMessage: 'Perps rows are hidden while asset-only filters are active. Clear them or switch to Assets.' }
			: {})
	}

	return (
		<>
			{/* <Announcement>
				Stablecoins, Governance are not included by default. To include them, toggle the corresponding filters.
			</Announcement> */}
			{props.hideEntityNav ? null : <RowLinksWithDropdown links={navLinks} activeLink={selectedModeLabel} />}
			<RWAOverviewFilters {...filterProps} leading={tableControls} />
			{props.platformPage ? (
				<SummaryCardGrid>
					<RWAPlatformHeader
						data={props.platformPage}
						includeBridgeTvl={includeBridgeTvl}
						listedTotals={platformListedTotals}
					/>
					<div className="col-span-2 flex flex-col gap-2">{chartSection}</div>
				</SummaryCardGrid>
			) : (
				<>
					<SummaryCardGrid>
						{keyMetrics}
						<div className="col-span-2 flex flex-col gap-2">{chartSection}</div>
					</SummaryCardGrid>
					{overviewCards}
				</>
			)}
			{props.platformPage ? (
				<RWAPlatformDataViews data={props.platformPage} renderAssetsTable={() => <RWATable {...tableProps} />} />
			) : (
				<>
					<RWATable {...tableProps} />
					{includeRwaPerps ? null : (
						<RWAHighlights assets={aggregateAssets} seriesLatestTimestamp={props.seriesLatestTimestamp} />
					)}
				</>
			)}
		</>
	)
}

const getRWAOverviewMode = (props: IRWAAssetsOverview): RWAOverviewMode => {
	if (props.assetGroupLinks.length > 0) return 'assetGroup'
	if (props.categoryLinks.length > 0) return 'category'
	if (props.platformLinks.length > 0) return 'platform'
	return 'chain'
}

const getModeLinks = (
	mode: RWAOverviewMode,
	chainLinks: IRWAAssetsOverview['chainLinks'],
	categoryLinks: IRWAAssetsOverview['categoryLinks'],
	platformLinks: IRWAAssetsOverview['platformLinks'],
	assetGroupLinks: IRWAAssetsOverview['assetGroupLinks']
) => {
	if (mode === 'assetGroup') return assetGroupLinks
	if (mode === 'category') return categoryLinks
	if (mode === 'platform') return platformLinks
	return chainLinks
}

const getSelectedModeLabel = (mode: RWAOverviewMode, props: IRWAAssetsOverview) => {
	if (mode === 'assetGroup') return props.selectedAssetGroup
	if (mode === 'category') return props.selectedCategory
	if (mode === 'platform') return props.selectedPlatform
	return props.selectedChain
}
