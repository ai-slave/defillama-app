import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { Card } from '~/ui/Card'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SummaryCardGrid } from '~/ui/SummaryStats'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { IRWAAssetsOverview, RWAOverviewFrame } from './api.types'
import { getRwaPerpsMarkets, rankRwaDefiProtocols } from './cards/cardData'
import { RWAOverviewCards } from './cards/OverviewCards'
import type { RwaPerpsCards } from './cards/perpsCardData'
import { RWAPerpsCards } from './cards/PerpsCards'
import { RWA_FILTER_QUERY_KEYS } from './filterState'
import { RWAOverviewFilters } from './FilterStrip'
import { useRWAFlowSummary } from './flows.hooks'
import { RWAHighlights } from './highlights/Highlights'
import { useFilteredRwaAssets, useRWATableQueryParams, hasRwaInclusionOverrides } from './hooks'
import { RWAKeyMetrics } from './kpi/KeyMetrics'
import { sumRwaKpiTotals } from './kpi/kpiTotals'
import { RWAPerpsKeyMetrics } from './kpi/PerpsKeyMetrics'
import { foldRwaPerpsKpi } from './kpi/perpsKpi'
import { RWAPlatformKeyMetrics } from './kpi/PlatformKeyMetrics'
import { foldRwaPlatformKpi, getRwaPlatformFold } from './kpi/platformKpi'
import { getRwaAssetsInlineFilters } from './layout/inlineFilters'
import { getRwaPageHeadline } from './layout/pageCopy'
import { getRwaPageLayout, type RWAPageKind } from './layout/pageLayout'
import { RWA_QUERY_ZONE } from './layout/QueryZoneGuard'
import { getRwaQuestionsEntityName, getRwaQuestionsEntitySlug } from './layout/questions'
import { RWAPageTabs } from './layout/SectionTabs'
import { RWAOverviewChartPanel } from './OverviewChartPanel'
import { RWAPerpsBreakdownChartPanel } from './PerpsBreakdownChartPanel'
import {
	countRwaPerpsFilters,
	readRwaVenueTypeChoice,
	filterRwaPerpsRows,
	getRwaPerpsFilterDefinitions,
	getRwaPerpsFilterQueryKeys
} from './perpsFilters'
import { useRwaPerpsHistoryFold } from './perpsHistoryFold'
import { RWAPlatformEntityChartPanel } from './platformChart/PlatformEntityChartPanel'
import { RWAPlatformViews } from './PlatformPage/PlatformViews'
import {
	getRwaEntityViewOptions,
	getRwaEntityViewQueryPatch,
	parseRwaEntityView,
	RWA_ENTITY_VIEW_QUERY_KEY
} from './PlatformPage/view'
import { getRankedRwaFilterValues } from './rankedFilterValues'
import { rwaSlug } from './rwaSlug'
import { RWA_SERIES_PICK_CLEARED } from './seriesPick'
import {
	getRwaChangePeriodQueryValue,
	parseRwaChangePeriod,
	RWA_CHANGE_PERIOD_QUERY_KEY,
	type RWAChangePeriod
} from './table/change'
import { getRwaGroupByQueryValue, parseRwaGroupBy } from './table/groupBy'
import { RWATable } from './table/RWATable'
import { RWATableGroupBySelect } from './table/toolbar/GroupBySelect'
import { getRwaPerpsChartScope } from './usePerpsChartDataset'

/**
 * `hideEntityNav`: a protocol's own RWA tab fixes the entity, so the top tab row, the switcher row, the Ask strip and
 * the page h1 are dead weight there. `pageKind`: every page names its kind; the layout record gives its section, rows
 * and filter mode. `perpsCards`: the three cards of /rwa/perps. `perpsAsset`: the underlying of /rwa/perps/asset/:key.
 * `entityQuestions`: the Ask strip's questions, fetched at build. `perpsVenueHref`: the platform's venue page, linked
 * from its About panel.
 */
export function RWAOverview(
	props: RWAOverviewFrame & {
		hideEntityNav?: boolean
		pageKind: RWAPageKind
		perpsCards?: RwaPerpsCards | null
		perpsAsset?: string
		entityQuestions?: Array<string>
		perpsVenueHref?: string | null
	}
) {
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

	const { section, mode } = getRwaPageLayout(props.pageKind)
	const pageKind = props.pageKind
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
		includeCex,
		includeBridgeTvl,
		includeWrappers,
		hasDialogFilters,
		setDefiActiveTvlToOnChainMcapPctRange,
		setActiveMcapToOnChainMcapPctRange,
		setDefiActiveTvlToActiveMcapPctRange
	} = useRWATableQueryParams({
		options: selectFilterOptions,
		mode,
		defaultInclusion: props.defaultInclusion,
		section
	})

	const { filteredAssets: spotFilteredAssets, aggregateAssets: spotAggregateAssets } = useFilteredRwaAssets({
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
		includeBridgeTvl,
		includeWrappers,
		minDefiActiveTvlToOnChainMcapPct,
		maxDefiActiveTvlToOnChainMcapPct,
		minActiveMcapToOnChainMcapPct,
		maxActiveMcapToOnChainMcapPct,
		minDefiActiveTvlToActiveMcapPct,
		maxDefiActiveTvlToActiveMcapPct
	})

	/* The Perps tree filters its markets through its filter records alone (perpsFilters.ts), inline and in More
	   filters; the Assets tree through the readers above. */
	// Keyed on props.pageKind: the compiler can prove a prop.
	const perpsFilters = useMemo(
		() =>
			getRwaPageLayout(props.pageKind).section === 'perps'
				? getRwaPerpsFilterDefinitions(props.assets, props.pageKind, router.query)
				: null,
		[props.pageKind, props.assets, router.query]
	)
	const filteredAssets = useMemo(
		() => (perpsFilters ? filterRwaPerpsRows(props.assets, router.query, perpsFilters) : spotFilteredAssets),
		[perpsFilters, props.assets, router.query, spotFilteredAssets]
	)
	// The totals leave out suspicious markets, as they leave out suspicious assets.
	const aggregateAssets = useMemo(
		() => (perpsFilters ? filteredAssets.filter((market) => !market.suspicious) : spotAggregateAssets),
		[perpsFilters, filteredAssets, spotAggregateAssets]
	)
	/* One count decides Reset all and the cards' and charts' filter flags, so a key the page does not read, or an
	   empty one, never shows a reset with nothing to reset. */
	const hasPerpsFilters = perpsFilters != null && countRwaPerpsFilters(router.query, perpsFilters) > 0
	const activeFilters = perpsFilters
		? hasPerpsFilters
		: hasDialogFilters || hasRwaInclusionOverrides(router.query, props.defaultInclusion)
	const perpsFiltersButVenueType = useMemo(
		() => perpsFilters?.filter((definition) => definition.kind !== 'venueType') ?? null,
		[perpsFilters]
	)
	/* The split routes honour Venue Type DEX only (`includeCex=false`); CEX only and every other filter fold the
	   per-market history in the browser (the chart, Change by Venue and the Volume card). */
	const hasPerpsHistoryFilters =
		perpsFiltersButVenueType != null &&
		(countRwaPerpsFilters(router.query, perpsFiltersButVenueType) > 0 || readRwaVenueTypeChoice(router.query) === 'cex')
	const tableGroupBy = parseRwaGroupBy(router.query.groupBy, pageKind)
	// No useCallback: the page kind comes from a call, so the compiler cannot prove a manual memo; it memoizes this itself.
	const handleGroupByChange = (groupBy: Parameters<typeof getRwaGroupByQueryValue>[0]) => {
		void pushShallowQuery(router, {
			groupBy: getRwaGroupByQueryValue(groupBy, pageKind),
			...RWA_SERIES_PICK_CLEARED
		})
	}
	const changePeriod = parseRwaChangePeriod(router.query[RWA_CHANGE_PERIOD_QUERY_KEY])
	const handlePeriodChange = useCallback(
		(period: RWAChangePeriod) => {
			void pushShallowQuery(router, {
				[RWA_CHANGE_PERIOD_QUERY_KEY]: getRwaChangePeriodQueryValue(period)
			})
		},
		[router]
	)

	const showFilters = props.assets.length > 0
	const scopeName = getRwaScopeName(pageKind, props)
	const scopeSlug = scopeName ? rwaSlug(scopeName) : null
	/* One h1 per page: the headline metric here, the name on the platform card; inside a protocol page, neither. */
	const headline = props.hideEntityNav ? undefined : (getRwaPageHeadline(pageKind, scopeName) ?? undefined)

	const kpiTotals = useMemo(
		() => (section === 'assets' ? sumRwaKpiTotals(aggregateAssets, includeBridgeTvl) : null),
		[section, aggregateAssets, includeBridgeTvl]
	)
	/* A Perps page folds its filtered markets into its own card; an Assets page ships no perps rows, so its perps
	   section reads the totals the server folded over the page's markets (no suspicious markets). */
	/* The DEX share row reads over both venue types whatever Venue Type says, so it never reads 100% or 0%. */
	const everyVenueTypeAssets = useMemo(
		() =>
			perpsFiltersButVenueType
				? filterRwaPerpsRows(props.assets, router.query, perpsFiltersButVenueType).filter(
						(market) => !market.suspicious
					)
				: aggregateAssets,
		[perpsFiltersButVenueType, props.assets, router.query, aggregateAssets]
	)
	const perpsKpi = useMemo(
		() => (section === 'perps' ? foldRwaPerpsKpi(aggregateAssets, includeCex, everyVenueTypeAssets) : null),
		[aggregateAssets, everyVenueTypeAssets, includeCex, section]
	)
	const perpsTotals = section === 'perps' ? null : (props.perpsTotals ?? null)
	const largestProtocol = useMemo(
		() => (section === 'assets' ? (rankRwaDefiProtocols(aggregateAssets, includeBridgeTvl, 1)[0] ?? null) : null),
		[section, aggregateAssets, includeBridgeTvl]
	)
	const keyMetrics = perpsKpi ? (
		<RWAPerpsKeyMetrics kpi={perpsKpi} headline={headline} pageKind={pageKind} scopeName={scopeName} />
	) : perpsTotals && kpiTotals ? (
		<RWAKeyMetrics
			metrics={kpiTotals}
			perps={perpsTotals}
			largestProtocol={largestProtocol}
			headline={headline}
			pageKind={pageKind}
			scopeName={scopeName}
		/>
	) : null
	/* The cards fold the page's filtered rows; where a card needs a history, a filter swaps the server split for the
	   per-chain or per-market history folded over those rows. */
	/* Change by Venue and the Volume card under a filter: the per-market history folded by venue, loaded only on
	   /rwa/perps with a filter set. */
	const historyMarketIds = useMemo(
		() => getRwaPerpsMarkets(aggregateAssets, includeCex).map((market) => market.id),
		[aggregateAssets, includeCex]
	)
	const perpsVenueHistory = useRwaPerpsHistoryFold({
		metric: 'openInterest',
		marketIds: historyMarketIds,
		rows: aggregateAssets,
		includeCex,
		enabled: section === 'perps' && hasPerpsHistoryFilters && props.perpsCards != null
	})
	const perpsVolumeHistory = useRwaPerpsHistoryFold({
		metric: 'volume',
		marketIds: historyMarketIds,
		rows: aggregateAssets,
		includeCex,
		enabled: section === 'perps' && hasPerpsHistoryFilters && props.perpsCards != null
	})
	const overviewCards =
		section === 'perps' ? (
			props.perpsCards && perpsKpi ? (
				<RWAPerpsCards
					filtered={hasPerpsHistoryFilters}
					venueHistory={perpsVenueHistory}
					volumeHistory={perpsVolumeHistory}
					cards={props.perpsCards}
					markets={aggregateAssets}
					kpi={perpsKpi}
					includeCex={includeCex}
				/>
			) : null
		) : props.cards ? (
			<RWAOverviewCards
				cards={props.cards}
				assets={aggregateAssets}
				filtered={activeFilters}
				includeStablecoins={includeStablecoins}
				includeGovernance={includeGovernance}
				includeBridgeTvl={includeBridgeTvl}
				perpsOpenInterest={perpsTotals?.openInterest ?? null}
			/>
		) : null

	/* A platform page's views are its top tab row (layout/pageTabs.ts); embedded in a protocol's RWA tab, the strip. */
	const platformView = parseRwaEntityView(router.query[RWA_ENTITY_VIEW_QUERY_KEY])
	/* The platform header folds the table's rows under Assets and the whole platform under Information; nothing on it
	   comes from the index's own totals. */
	const platformFold = useMemo(
		() =>
			getRwaPlatformFold(platformView, props.assets, props.defaultInclusion, {
				aggregateAssets,
				includeStablecoins,
				includeGovernance,
				includeBridgeTvl,
				activeFilters
			}),
		[
			platformView,
			props.assets,
			props.defaultInclusion,
			aggregateAssets,
			includeStablecoins,
			includeGovernance,
			includeBridgeTvl,
			activeFilters
		]
	)
	const { data: flowSummary } = useRWAFlowSummary(pageKind === 'platform')
	const platformKpi = useMemo(
		() =>
			props.platformPage
				? foldRwaPlatformKpi(platformFold.aggregateAssets, {
						includeBridgeTvl: platformFold.includeBridgeTvl,
						flowSummary
					})
				: null,
		[platformFold, flowSummary, props.platformPage]
	)

	const handlePlatformViewChange = useCallback(
		(view: ReturnType<typeof parseRwaEntityView>) => {
			void pushShallowQuery(router, getRwaEntityViewQueryPatch(view, router.query))
		},
		[router]
	)
	/* Under Information a platform page draws itself as one entity with Add Metrics; the table views keep the breakdown. */
	const spotOverview = isRwaSpotOverview(props) ? props : null
	const chartSection =
		spotOverview?.platformPage && platformView === 'information' ? (
			<RWAPlatformEntityChartPanel overview={spotOverview} meta={spotOverview.platformPage.meta} {...platformFold} />
		) : section === 'perps' ? (
			<RWAPerpsBreakdownChartPanel
				scope={getRwaPerpsChartScope(props, props.perpsAsset)}
				groupBy={tableGroupBy}
				includeCex={includeCex}
				markets={aggregateAssets}
				isFiltered={hasPerpsHistoryFilters}
				title={scopeName ? `RWA Perps ${scopeName}` : 'RWA Perps'}
				pageKind={pageKind}
				slug={scopeSlug}
			/>
		) : spotOverview ? (
			<RWAOverviewChartPanel
				overview={spotOverview}
				pageKind={pageKind}
				pageSlug={scopeSlug}
				mode={mode}
				selectedModeLabel={props.nav.active}
				aggregateAssets={aggregateAssets}
				groupBy={tableGroupBy}
				selectedCategories={selectedCategories}
				includeStablecoins={includeStablecoins}
				includeGovernance={includeGovernance}
				includeBridgeTvl={includeBridgeTvl}
				activeFilters={activeFilters}
			/>
		) : null

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
		},
		inlineFilters: getRwaAssetsInlineFilters(pageKind),
		rows: props.assets,
		active: activeFilters,
		resetKeys: perpsFilters ? getRwaPerpsFilterQueryKeys(perpsFilters) : RWA_FILTER_QUERY_KEYS,
		showIncludeInTvl: section === 'assets'
	}

	/* The page controls lead the strip: the Group by (none under Information, which has nothing to group). A platform
	   page embedded in a protocol's RWA tab has no top row of its own, so its view switch leads the strip there. */
	const tableControls = (
		<>
			{props.platformPage && props.hideEntityNav ? (
				<SegmentedControl
					options={PLATFORM_VIEW_OPTIONS}
					value={platformView}
					onValueChange={handlePlatformViewChange}
					label="Platform view"
					variant="default"
					size="md"
				/>
			) : null}
			{props.platformPage && platformView === 'information' ? null : (
				<RWATableGroupBySelect pageKind={pageKind} value={tableGroupBy} onChange={handleGroupByChange} />
			)}
		</>
	)

	const tableProps = {
		assets: filteredAssets,
		groupBy: tableGroupBy,
		...(section === 'assets' ? { period: changePeriod, onPeriodChange: handlePeriodChange } : {}),
		pageKind,
		pageSlug: scopeSlug,
		includeBridgeTvl,
		platformLogos: props.platformLogos
	}

	return (
		<>
			{/* <Announcement>
				Stablecoins, Governance are not included by default. To include them, toggle the corresponding filters.
			</Announcement> */}
			<RWAPageTabs kind={pageKind} embedded={props.hideEntityNav} />
			{/* The loader builds the row from the page kind: a page lists its siblings in its own tree. */}
			{props.hideEntityNav ? null : (
				<RowLinksWithDropdown heading={props.nav.heading} links={props.nav.links} activeLink={props.nav.active} />
			)}
			{!props.hideEntityNav && props.entityQuestions != null && props.entityQuestions.length > 0 ? (
				<EntityQuestionsStrip
					questions={props.entityQuestions}
					entitySlug={getRwaQuestionsEntitySlug(pageKind, scopeName)}
					entityType="page"
					entityName={getRwaQuestionsEntityName(pageKind, scopeName)}
				/>
			) : null}
			{/* Information is a profile, so it draws no strip (the venue rule); a protocol's RWA tab keeps its view switch there. */}
			{props.platformPage && platformView === 'information' ? (
				props.hideEntityNav ? (
					<Card padding="sm" className="flex flex-wrap items-center gap-2">
						{tableControls}
					</Card>
				) : null
			) : (
				<RWAOverviewFilters {...filterProps} leading={tableControls} perpsFilters={perpsFilters ?? undefined} />
			)}
			{/* Everything below reads the address query: it waits for the router when the address carries one. */}
			<div {...RWA_QUERY_ZONE} className="contents">
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
						perpsVenueHref={props.perpsVenueHref}
						renderTable={() => <RWATable {...tableProps} />}
					/>
				) : (
					<>
						<RWATable {...tableProps} />
						{section === 'perps' ? null : (
							<RWAHighlights assets={aggregateAssets} seriesLatestTimestamp={props.seriesLatestTimestamp ?? null} />
						)}
					</>
				)}
			</div>
		</>
	)
}

const PLATFORM_VIEW_OPTIONS = getRwaEntityViewOptions('platform')

/** The name of what the page is scoped to; null on the two overviews. */
function getRwaScopeName(kind: RWAPageKind, props: RWAOverviewFrame & { perpsAsset?: string }): string | null {
	switch (kind) {
		case 'chain':
			return props.selectedChain
		case 'category':
			return props.selectedCategory
		case 'assetGroup':
		case 'perpsAssetGroup':
			return props.selectedAssetGroup
		case 'platform':
			return props.selectedPlatform
		case 'perpsAsset':
			return props.perpsAsset ?? null
		default:
			return null
	}
}

/** True when the frame is an Assets page's: every spot-only field is there. */
function isRwaSpotOverview<T extends RWAOverviewFrame>(frame: T): frame is T & IRWAAssetsOverview {
	return (
		frame.platformPage !== undefined &&
		frame.perpsTotals !== undefined &&
		frame.initialChartDatasets !== undefined &&
		frame.cards !== undefined &&
		frame.chartMetricAvailability !== undefined &&
		frame.seriesLatestTimestamp !== undefined
	)
}
