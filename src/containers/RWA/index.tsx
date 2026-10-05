import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SummaryCardGrid } from '~/ui/SummaryStats'
import { Tabs } from '~/ui/Tabs'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { IRWAAssetsOverview } from './api.types'
import { foldRwaPerpsTotals, rankRwaDefiProtocols } from './cards/cardData'
import { RWAOverviewCards } from './cards/OverviewCards'
import type { RWAOverviewMode } from './constants'
import { RWAOverviewFilters } from './Filters'
import { useRWAFlowSummary } from './flows.hooks'
import { RWAHighlights } from './highlights/Highlights'
import { useFilteredRwaAssets, useRWATableQueryParams, hasRwaInclusionOverrides } from './hooks'
import { RWAKeyMetrics } from './kpi/KeyMetrics'
import { sumRwaKpiTotals } from './kpi/kpiTotals'
import { RWAPlatformKeyMetrics } from './kpi/PlatformKeyMetrics'
import { foldRwaPlatformKpi } from './kpi/platformKpi'
import { getAssetChartTarget, RWAOverviewChartPanel } from './OverviewChartPanel'
import { RWAPlatformEntityChartPanel } from './platformChart/PlatformEntityChartPanel'
import { RWAPlatformViews } from './PlatformPage/PlatformViews'
import {
	getRwaPlatformViewQuery,
	parseRwaPlatformView,
	RWA_PLATFORM_VIEW_OPTIONS,
	RWA_PLATFORM_VIEW_QUERY_KEY,
	RWA_PLATFORM_VIEWS
} from './PlatformPage/view'
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

	const selectFilterOptions = useMemo(
		() => ({
			...rankedFilterValues,
			assetNames: props.assetNames,
			platforms: props.platforms,
			assetGroups: props.assetGroups,
			issuers: props.issuers
		}),
		[rankedFilterValues, props.assetNames, props.platforms, props.assetGroups, props.issuers]
	)
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
		hasDialogFilters,
		setDefiActiveTvlToOnChainMcapPctRange,
		setActiveMcapToOnChainMcapPctRange,
		setDefiActiveTvlToActiveMcapPctRange,
		setIncludeRwaPerps,
		setIncludeCex
	} = useRWATableQueryParams({
		options: selectFilterOptions,
		mode,
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

	const activeFilters = hasDialogFilters || hasRwaInclusionOverrides(router.query, props.defaultInclusion)
	/* A platform page is spot only: its perps live on the venue page, whatever a shared link says. */
	const tableView: RWATableView = includeRwaPerps && !props.platformPage ? 'perps' : 'assets'
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

	// Switching chain starts a clean page: filter values from one chain may not exist on another.
	const navLinks = getModeLinks(mode, props.chainLinks, props.categoryLinks, props.platformLinks, props.assetGroupLinks)

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

	/* The platform header reads the same fold as the table's rows; nothing on it comes from the index's own totals. */
	const { data: flowSummary } = useRWAFlowSummary()
	const platformKpi = useMemo(
		() => (props.platformPage ? foldRwaPlatformKpi(aggregateAssets, { includeBridgeTvl, flowSummary }) : null),
		[aggregateAssets, flowSummary, includeBridgeTvl, props.platformPage]
	)

	/* A platform page has its own views in the strip and no Perps switch. */
	const platformView = parseRwaPlatformView(router.query[RWA_PLATFORM_VIEW_QUERY_KEY])
	const handlePlatformViewChange = useCallback(
		(view: ReturnType<typeof parseRwaPlatformView>) => {
			void pushShallowQuery(router, { [RWA_PLATFORM_VIEW_QUERY_KEY]: getRwaPlatformViewQuery(view) })
		},
		[router]
	)
	/* Under Information a platform page draws itself as one entity with Add Metrics; the table views keep the breakdown. */
	const chartSection =
		props.platformPage && platformView === 'information' ? (
			<RWAPlatformEntityChartPanel
				overview={props}
				meta={props.platformPage.meta}
				aggregateAssets={aggregateAssets}
				includeStablecoins={includeStablecoins}
				includeGovernance={includeGovernance}
				includeBridgeTvl={includeBridgeTvl}
				activeFilters={activeFilters}
			/>
		) : (
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
				activeAttributeFilters={hasDialogFilters}
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
			setDefiActiveTvlToActiveMcapPctRange
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
			{...(props.platformPage
				? {
						// First in the strip, where the overview's Assets or Perps switch sits.
						viewSwitch: (
							<SegmentedControl
								semantics="tabs"
								options={RWA_PLATFORM_VIEW_OPTIONS}
								label="Platform view"
								variant="default"
								size="md"
							/>
						),
						showPerpsSwitch: false,
						showGroupBy: platformView !== 'information'
					}
				: {})}
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

	const page = (
		<>
			{/* <Announcement>
				Stablecoins, Governance are not included by default. To include them, toggle the corresponding filters.
			</Announcement> */}
			{props.hideEntityNav ? null : (
				<RowLinksWithDropdown heading={MODE_LINKS_HEADING[mode]} links={navLinks} activeLink={selectedModeLabel} />
			)}
			<RWAOverviewFilters {...filterProps} leading={tableControls} />
			{props.platformPage && platformKpi ? (
				<SummaryCardGrid>
					<RWAPlatformKeyMetrics meta={props.platformPage.meta} kpi={platformKpi} />
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
			{props.platformPage && platformKpi ? (
				<RWAPlatformViews
					meta={props.platformPage.meta}
					kpi={platformKpi}
					view={platformView}
					renderTable={(view) => <RWATable {...tableProps} preset={view} />}
				/>
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
	/* A platform page's views are tabs: the provider spans the strip, which holds the tab list, and RWAPlatformViews. */
	return props.platformPage ? (
		<Tabs value={platformView} values={RWA_PLATFORM_VIEWS} onValueChange={handlePlatformViewChange}>
			{page}
		</Tabs>
	) : (
		page
	)
}

const getRWAOverviewMode = (props: IRWAAssetsOverview): RWAOverviewMode => {
	if (props.assetGroupLinks.length > 0) return 'assetGroup'
	if (props.categoryLinks.length > 0) return 'category'
	if (props.platformLinks.length > 0) return 'platform'
	return 'chain'
}

const MODE_LINKS_HEADING: Record<RWAOverviewMode, string> = {
	chain: 'Chains',
	category: 'Categories',
	platform: 'Platforms',
	assetGroup: 'Asset groups'
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
