import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { Card } from '~/ui/Card'
import { SummaryCardGrid } from '~/ui/SummaryStats'
import { pushShallowQuery } from '~/utils/routerQuery'
import { RWAPerpsFilterPills, RWAResetAllFilters } from '../FilterStrip'
import { RWA_QUERY_ZONE } from '../layout/QueryZoneGuard'
import { getRwaQuestionsEntityName, getRwaQuestionsEntitySlug } from '../layout/questions'
import { RWAPageTabs } from '../layout/SectionTabs'
import { RWAListYourAssetsButton } from '../links'
import { RWAPerpsBreakdownChartPanel } from '../PerpsBreakdownChartPanel'
import {
	countRwaPerpsFilters,
	filterRwaPerpsRows,
	getRwaPerpsFilterDefinitions,
	getRwaPerpsFilterQueryKeys
} from '../perpsFilters'
import { RWAPerpsMoreFilters } from '../PerpsMoreFilters'
import { unpackRwaPerpsMarkets } from '../perpsPayload'
import { RWAInformationPanels } from '../PlatformPage/InformationPanels'
import { parseRwaEntityView, RWA_ENTITY_VIEW_QUERY_KEY } from '../PlatformPage/view'
import { RWA_SERIES_PICK_CLEARED } from '../seriesPick'
import { getRwaGroupByQueryValue, parseRwaGroupBy, RWA_GROUP_BY_QUERY_KEY, type RWAGroupBy } from '../table/groupBy'
import { RWATable } from '../table/RWATable'
import { RWATableGroupBySelect } from '../table/toolbar/GroupBySelect'
import { VenueMarketsPanel } from './panels/VenueMarkets'
import { getRwaVenueCountedMarkets, summarizeRwaVenueMarkets } from './venueData'
import { RWAVenueEntityChartPanel } from './VenueEntityChartPanel'
import { RWAVenueKeyMetrics } from './VenueKeyMetrics'
import { foldRwaVenueKpi } from './venueKpi'
import type { RWAVenuePageProps } from './venuePageData'

const PAGE_KIND = 'venue'

/**
 * The perps twin of the platform page: its two views as the top tab row (Information and Markets, layout/pageTabs.ts),
 * the venue nav row led by All, the Ask strip, then under Markets the strip: the Group by, Reset all when something
 * is set, and on the right Filters and List Your Assets. Information is a profile of the whole venue, so it has no
 * strip and its card folds every market. The venue's Key Metrics sit beside its chart, then the six panels
 * (Information) or the markets table (Markets). One venue, so no Venue column, no Venue Type and no Include in TVL;
 * every filter sits in the Filters dialog.
 */
export function RWAVenuePage({
	venue,
	venueSlug,
	meta,
	spotHref,
	markets: packedMarkets,
	nav,
	entityQuestions,
	venueType,
	typeOpenInterest
}: RWAVenuePageProps & { entityQuestions?: Array<string> }) {
	const router = useRouter()
	const markets = useMemo(() => unpackRwaPerpsMarkets(packedMarkets), [packedMarkets])
	const view = parseRwaEntityView(router.query[RWA_ENTITY_VIEW_QUERY_KEY])
	const groupBy = parseRwaGroupBy(router.query[RWA_GROUP_BY_QUERY_KEY], PAGE_KIND)

	/* The filters narrow the Markets view: its card, table and chart. The Information view describes the whole venue. */
	const filterDefinitions = useMemo(() => getRwaPerpsFilterDefinitions(markets, PAGE_KIND), [markets])
	const filteredMarkets = useMemo(
		() => filterRwaPerpsRows(markets, router.query, filterDefinitions),
		[markets, router.query, filterDefinitions]
	)
	const activeFilterCount = countRwaPerpsFilters(router.query, filterDefinitions)
	const resetKeys = getRwaPerpsFilterQueryKeys(filterDefinitions)
	const kpi = useMemo(
		() => foldRwaVenueKpi(getRwaVenueCountedMarkets(view === 'list' ? filteredMarkets : markets), typeOpenInterest),
		[view, filteredMarkets, markets, typeOpenInterest]
	)
	const summary = useMemo(() => summarizeRwaVenueMarkets(getRwaVenueCountedMarkets(markets)), [markets])

	const onGroupByChange = (next: RWAGroupBy) =>
		void pushShallowQuery(router, {
			[RWA_GROUP_BY_QUERY_KEY]: getRwaGroupByQueryValue(next, PAGE_KIND),
			...RWA_SERIES_PICK_CLEARED
		})

	return (
		<>
			<RWAPageTabs kind={PAGE_KIND} />
			<RowLinksWithDropdown heading={nav.heading} links={nav.links} activeLink={nav.active} />
			{entityQuestions != null && entityQuestions.length > 0 ? (
				<EntityQuestionsStrip
					questions={entityQuestions}
					entitySlug={getRwaQuestionsEntitySlug(PAGE_KIND, venue)}
					entityType="page"
					entityName={getRwaQuestionsEntityName(PAGE_KIND, venue)}
				/>
			) : null}
			{view === 'list' ? (
				<Card padding="sm" className="flex flex-wrap items-center gap-2">
					<RWATableGroupBySelect pageKind={PAGE_KIND} value={groupBy} onChange={onGroupByChange} />
					<div className="flex flex-wrap items-center gap-2 sm:ml-auto">
						<RWAResetAllFilters active={activeFilterCount > 0} keys={resetKeys} />
						<RWAPerpsFilterPills filters={filterDefinitions} />
						<RWAPerpsMoreFilters definitions={filterDefinitions} label="Filters" />
						<RWAListYourAssetsButton />
					</div>
				</Card>
			) : null}
			{/* Everything below reads the address query: it waits for the router when the address carries one. */}
			<div {...RWA_QUERY_ZONE} className="contents">
				<SummaryCardGrid>
					<RWAVenueKeyMetrics
						venue={venue}
						logo={meta?.logo ?? null}
						venueSlug={venueSlug}
						kpi={kpi}
						venueType={venueType}
						takerFeeBps={meta?.perpTakerFeeBps ?? null}
					/>
					<div className="col-span-2 flex flex-col gap-2">
						{view === 'information' ? (
							<RWAVenueEntityChartPanel venue={venue} venueSlug={venueSlug} milestones={meta?.milestones ?? []} />
						) : (
							<RWAPerpsBreakdownChartPanel
								scope={{ kind: 'venue', slug: venue }}
								groupBy={groupBy}
								includeCex
								markets={filteredMarkets}
								isFiltered={activeFilterCount > 0}
								title={venue}
								pageKind={PAGE_KIND}
								slug={venueSlug}
							/>
						)}
					</div>
				</SummaryCardGrid>
				{view === 'list' ? (
					<RWATable
						assets={filteredMarkets}
						groupBy={groupBy}
						pageKind={PAGE_KIND}
						pageSlug={venueSlug}
						includeBridgeTvl
						headerSlot={<h2 className="label-md">Markets</h2>}
					/>
				) : null}
				{/* Stays mounted under Markets, hidden, so the venue's profile copy is in the served HTML for crawlers. */}
				<div hidden={view !== 'information'}>
					<RWAInformationPanels
						meta={meta}
						issuers={[]}
						crossLink={spotHref ? { label: 'Spot assets on the platform page', href: spotHref } : null}
						slot={<VenueMarketsPanel summary={summary} />}
					/>
				</div>
			</div>
		</>
	)
}
