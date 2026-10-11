import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SummaryCardGrid } from '~/ui/SummaryStats'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { IRWAAssetsOverview, RWAOverviewFrame, RWASpotFilterKey } from './api.types'
import { rankRwaDefiProtocols } from './cards/cardData'
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
import type { RWAAssetsPageKind } from './layout/pageNav'
import { RWA_QUERY_ZONE } from './layout/QueryZoneGuard'
import { getRwaQuestionsEntityName, getRwaQuestionsEntitySlug } from './layout/questions'
import { RWAPageTabs } from './layout/SectionTabs'
import { RWAOverviewChartPanel } from './OverviewChartPanel'
import { RWAPerpsBreakdownChartPanel } from './PerpsBreakdownChartPanel'
import {
	countRwaPerpsFilters,
	readRwaVenueTypeChoice,
	getRwaPerpsFilterDefinitions,
	getRwaPerpsFilterQueryKeys
} from './perpsFilters'
import { filterRwaPerpsPageMarkets } from './perpsPageMarkets'
import { RWAPlatformEntityChartPanel } from './platformChart/PlatformEntityChartPanel'
import { RWAPlatformViews, RWAPlatformViewTabs } from './PlatformPage/PlatformViews'
import { getRwaEntityViewQueryPatch, parseRwaEntityView, RWA_ENTITY_VIEW_QUERY_KEY } from './PlatformPage/view'
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
 * The page kind picks the frame: an Assets page carries every spot field, and its platform page the venue page linked
 * from About (`perpsVenueHref`); a Perps page carries the frame every page shares, the spot filter lists left empty,
 * its three cards (`perpsCards`, /rwa/perps only) and its underlying (`perpsAsset`, /rwa/perps/asset/:key only).
 * `hideEntityNav`: a protocol's own RWA tab fixes the entity, so the top tab row, the switcher row, the Ask strip and
 * the page h1 are dead weight there. `entityQuestions`: the Ask strip's questions, fetched at build.
 */
type RWAOverviewPageProps = { hideEntityNav?: boolean; entityQuestions?: Array<string> }
type RWAAssetsOverviewProps = RWAOverviewPageProps &
	IRWAAssetsOverview & { pageKind: RWAAssetsPageKind; perpsVenueHref?: string | null }
type RWAPerpsOverviewProps = RWAOverviewPageProps &
	RWAOverviewFrame &
	Pick<IRWAAssetsOverview, RWASpotFilterKey> & {
		pageKind: Exclude<RWAPageKind, RWAAssetsPageKind | 'venue'>
		perpsCards: RwaPerpsCards | null
		perpsAsset: string | null
	}
type RWAOverviewProps = RWAAssetsOverviewProps | RWAPerpsOverviewProps

export function RWAOverview(props: RWAOverviewProps) {
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
	/* The props narrowed to the page's tree, where the code reads a field only one tree carries. A switch, because a
	   tree spans several kinds and only a switch narrows a union on a set of them. */
	let spot: RWAAssetsOverviewProps | null = null
	let perps: RWAPerpsOverviewProps | null = null
	switch (props.pageKind) {
		case 'perpsOverview':
		case 'perpsAssetGroup':
		case 'perpsAsset':
			perps = props
			break
		default:
			spot = props
	}
	const platformPage = spot?.platformPage ?? null
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
	const { filteredAssets, aggregateAssets } = useMemo(
		() =>
			perpsFilters
				? filterRwaPerpsPageMarkets(props.assets, router.query, perpsFilters)
				: { filteredAssets: spotFilteredAssets, aggregateAssets: spotAggregateAssets },
		[perpsFilters, props.assets, router.query, spotFilteredAssets, spotAggregateAssets]
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
	const handlePeriodChange = (period: RWAChangePeriod) => {
		void pushShallowQuery(router, { [RWA_CHANGE_PERIOD_QUERY_KEY]: getRwaChangePeriodQueryValue(period) })
	}

	const showFilters = props.assets.length > 0
	const scopeName = getRwaScopeName(props)
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
				? filterRwaPerpsPageMarkets(props.assets, router.query, perpsFiltersButVenueType).aggregateAssets
				: aggregateAssets,
		[perpsFiltersButVenueType, props.assets, router.query, aggregateAssets]
	)
	const perpsKpi = useMemo(
		() => (section === 'perps' ? foldRwaPerpsKpi(aggregateAssets, includeCex, everyVenueTypeAssets) : null),
		[aggregateAssets, everyVenueTypeAssets, includeCex, section]
	)
	const perpsTotals = spot?.perpsTotals ?? null
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
	const overviewCards = perps ? (
		perps.perpsCards && perpsKpi ? (
			<RWAPerpsCards
				filtered={hasPerpsHistoryFilters}
				cards={perps.perpsCards}
				markets={aggregateAssets}
				kpi={perpsKpi}
				includeCex={includeCex}
			/>
		) : null
	) : spot.cards ? (
		<RWAOverviewCards
			cards={spot.cards}
			assets={aggregateAssets}
			filtered={activeFilters}
			includeStablecoins={includeStablecoins}
			includeGovernance={includeGovernance}
			includeBridgeTvl={includeBridgeTvl}
			perpsOpenInterest={perpsTotals?.openInterest ?? null}
		/>
	) : null

	/* A platform page's views are its top tab row (layout/pageTabs.ts); embedded in a protocol's RWA tab, panel tabs. */
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
			platformPage
				? foldRwaPlatformKpi(platformFold.aggregateAssets, {
						includeBridgeTvl: platformFold.includeBridgeTvl,
						flowSummary
					})
				: null,
		[platformFold, flowSummary, platformPage]
	)

	const handlePlatformViewChange = (view: ReturnType<typeof parseRwaEntityView>) => {
		void pushShallowQuery(router, getRwaEntityViewQueryPatch(view, router.query))
	}
	/* Under Information a platform page draws itself as one entity with Add Metrics; the table views keep the breakdown. */
	const chartSection = perps ? (
		<RWAPerpsBreakdownChartPanel
			scope={getRwaPerpsChartScope(perps, perps.perpsAsset)}
			groupBy={tableGroupBy}
			includeCex={includeCex}
			markets={aggregateAssets}
			isFiltered={hasPerpsHistoryFilters}
			title={scopeName ? `RWA Perps ${scopeName}` : 'RWA Perps'}
			pageKind={pageKind}
			slug={scopeSlug}
		/>
	) : spot.platformPage && platformView === 'information' ? (
		<RWAPlatformEntityChartPanel overview={spot} meta={spot.platformPage.meta} {...platformFold} />
	) : (
		<RWAOverviewChartPanel
			overview={spot}
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
		},
		inlineFilters: getRwaAssetsInlineFilters(pageKind),
		rows: props.assets,
		active: activeFilters,
		resetKeys: perpsFilters ? getRwaPerpsFilterQueryKeys(perpsFilters) : RWA_FILTER_QUERY_KEYS,
		showIncludeInTvl: section === 'assets'
	}

	const tableProps = {
		assets: filteredAssets,
		groupBy: tableGroupBy,
		...(section === 'assets' ? { period: changePeriod, onPeriodChange: handlePeriodChange } : {}),
		pageKind,
		pageSlug: scopeSlug,
		includeBridgeTvl,
		platformLogos: props.platformLogos
	}

	/* A protocol's RWA tab has no top tab row, so a platform's views are panel tabs there. */
	const platformViewTabs = platformPage != null && props.hideEntityNav === true
	const content = (
		<>
			{/* Information is a profile, so it draws no strip (the venue rule); the Group by leads it everywhere else. */}
			{platformPage && platformView === 'information' ? null : (
				<RWAOverviewFilters
					{...filterProps}
					leading={<RWATableGroupBySelect pageKind={pageKind} value={tableGroupBy} onChange={handleGroupByChange} />}
					perpsFilters={perpsFilters ?? undefined}
				/>
			)}
			{spot?.platformPage && platformKpi ? (
				<>
					<SummaryCardGrid>
						<RWAPlatformKeyMetrics meta={spot.platformPage.meta} kpi={platformKpi} />
						<div className="col-span-2 flex flex-col gap-2">{chartSection}</div>
					</SummaryCardGrid>
					<RWAPlatformViews
						meta={spot.platformPage.meta}
						kpi={platformKpi}
						view={platformView}
						tabs={platformViewTabs}
						perpsVenueHref={spot.perpsVenueHref}
						renderTable={() => <RWATable {...tableProps} />}
					/>
				</>
			) : (
				<>
					<SummaryCardGrid>
						{keyMetrics}
						<div className="col-span-2 flex flex-col gap-2">{chartSection}</div>
					</SummaryCardGrid>
					{overviewCards}
					<RWATable {...tableProps} />
					{spot ? <RWAHighlights assets={aggregateAssets} seriesLatestTimestamp={spot.seriesLatestTimestamp} /> : null}
				</>
			)}
		</>
	)

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
			{/* Everything below reads the address query, the strip and the view switch included: it waits for the router
			    when the address carries one. */}
			<div {...RWA_QUERY_ZONE} className="contents">
				{platformViewTabs ? (
					<RWAPlatformViewTabs view={platformView} onViewChange={handlePlatformViewChange}>
						{content}
					</RWAPlatformViewTabs>
				) : (
					content
				)}
			</div>
		</>
	)
}

/** The name of what the page is scoped to; null on the two overviews. */
function getRwaScopeName(props: RWAOverviewProps): string | null {
	switch (props.pageKind) {
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
			return props.perpsAsset
		default:
			return null
	}
}
