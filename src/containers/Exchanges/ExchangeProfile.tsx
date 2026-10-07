import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { ReportIncorrectData } from '~/components/ReportIncorrectData'
import { ViewTabs } from '~/components/ViewTabs'
import { Card } from '~/ui/Card'
import { ScopeNote } from '~/ui/ScopeNote'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { pushShallowQuery } from '~/utils/routerQuery'
import { useExchangeCountry } from './ExchangeCountrySelect'
import {
	ExchangeRegionalInformation,
	profileInformationMetadata,
	ProfileCountryCard,
	resolveProfileCountryView,
	type ProfileCountryView,
	useExchangeRegionalMetadata
} from './ExchangeRegionalInformation'
import { hasExchangeInformation } from './MetadataGroups'
import { EXCHANGE_SEGMENTS, type ExchangeOverviewChartModel, type ExchangeProfileModel } from './models'
import { PairTable } from './PairTable'
import { measuredExecutionSegments, ProfileExecution } from './ProfileExecution'
import { ProfileHighlights } from './ProfileHighlights'
import { ProfileHistory } from './ProfileHistory'
import { ProfileIdentity } from './ProfileIdentity'
import { ProfileMetrics } from './ProfileMetrics'
import { ProfileRanking } from './ProfileRanking'
import { ProfileReserves } from './ProfileReserves'
import { ProfileSegmentTabs } from './ProfileSegmentTabs'
import { ProfileTokenTable } from './ProfileTokenTable'
import {
	DEFAULT_PROFILE_TAB,
	EXCHANGES_QUERY_KEYS,
	getProfileSegment,
	getProfileTab,
	segmentQueryValue,
	withCountryParam,
	type ExchangeResearchRange,
	type ProfileSegmentSelection,
	type ProfileTab
} from './queryState'
import { VenueChart } from './VenueChart'

/**
 * The markets view to show. `all` is the per-token rollup and is always available once
 * the venue has any segment; an exact segment is honoured only if the venue trades it,
 * so a stale ?segment= cannot land on an empty table.
 */
export function resolveProfileSegment(
	profile: ExchangeProfileModel,
	selected: ProfileSegmentSelection | null
): ProfileSegmentSelection | null {
	const firstSegment = EXCHANGE_SEGMENTS.find((segment) => profile.segments[segment]) ?? null
	if (!firstSegment) return null
	if (selected && selected !== 'all' && profile.segments[selected]) return selected
	// No selection, or one this venue cannot serve, lands on the rollup: it is the view
	// that works for every venue whatever segments it runs.
	return 'all'
}

export function ExchangeProfile({
	profile,
	asOfDate,
	loadSeries
}: {
	profile: ExchangeProfileModel
	asOfDate: string
	loadSeries: (exchange: string, range: ExchangeResearchRange) => Promise<ExchangeOverviewChartModel>
}) {
	const countryState = useExchangeCountry()
	const regionalQuery = useExchangeRegionalMetadata(profile.slug, countryState.country)
	const countryView = resolveProfileCountryView(countryState.country, regionalQuery)
	return (
		<div className="flex flex-1 flex-col gap-2">
			<BasicLink
				href={withCountryParam('/exchanges', countryState.country)}
				className="w-fit body-sm text-link hover:underline"
			>
				← Exchanges
			</BasicLink>
			<ProfileCountryCard profileName={profile.name} view={countryView} countryState={countryState} />
			{profile.profileMode === 'metadata-only' ? (
				<MetadataOnlyExchangeProfile profile={profile} asOfDate={asOfDate} countryView={countryView} />
			) : (
				<MarketsExchangeProfile
					profile={profile}
					asOfDate={asOfDate}
					loadSeries={loadSeries}
					countryView={countryView}
				/>
			)}
		</div>
	)
}

function MetadataOnlyExchangeProfile({
	profile,
	asOfDate,
	countryView
}: {
	profile: ExchangeProfileModel
	asOfDate: string
	countryView: ProfileCountryView
}) {
	return (
		<>
			<Card as="header" padding="sm" className="flex flex-col gap-6">
				<ProfileIdentity profile={profile} />
				<ReportIncorrectData subject={{ type: 'exchange', name: profile.name, slug: profile.slug }} />
			</Card>
			<ExchangeRegionalInformation profile={profile} asOfDate={asOfDate} view={countryView} />
			{profile.hacks.length > 0 || profile.raises.length > 0 ? <ProfileHistory profile={profile} /> : null}
		</>
	)
}

function MarketsExchangeProfile({
	profile,
	asOfDate,
	loadSeries,
	countryView
}: {
	profile: ExchangeProfileModel
	asOfDate: string
	loadSeries: (exchange: string, range: ExchangeResearchRange) => Promise<ExchangeOverviewChartModel>
	countryView: ProfileCountryView
}) {
	const router = useRouter()
	const hasInformation =
		hasExchangeInformation(profile.metadata.groups) ||
		hasExchangeInformation(profileInformationMetadata(profile, countryView)?.groups ?? []) ||
		profile.quality != null
	const hasReserves = profile.reserves != null
	const hasHistory = profile.hacks.length > 0 || profile.raises.length > 0
	const hasExecution = measuredExecutionSegments(profile).length > 0
	const defaultSegment = resolveProfileSegment(profile, null)
	const countrySegments =
		countryView.status === 'unavailable'
			? []
			: countryView.status === 'available' || countryView.status === 'restricted' || countryView.status === 'leaving'
				? countryView.regional.segments
				: null
	const segment = resolveProfileSegment(profile, getProfileSegment(router.query))
	const active = segment && segment !== 'all' ? profile.segments[segment] : null
	const requestedTab = getProfileTab(router.query)
	const tab: ProfileTab =
		(requestedTab === 'information' && hasInformation) ||
		(requestedTab === 'reserves' && hasReserves) ||
		(requestedTab === 'history' && hasHistory) ||
		(requestedTab === 'execution' && hasExecution)
			? requestedTab
			: DEFAULT_PROFILE_TAB

	const setTab = (nextTab: ProfileTab) => {
		void pushShallowQuery(router, {
			[EXCHANGES_QUERY_KEYS.profileTab]: nextTab === DEFAULT_PROFILE_TAB ? undefined : nextTab
		})
	}

	const setSegment = (nextSegment: ProfileSegmentSelection) => {
		void pushShallowQuery(router, {
			[EXCHANGES_QUERY_KEYS.profileSegment]:
				nextSegment === defaultSegment ? undefined : nextSegment === 'all' ? 'all' : segmentQueryValue(nextSegment)
		})
	}
	const panelId = 'exchange-profile-panel'

	return (
		<>
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<ProfileMetrics
					profile={profile}
					countrySegments={countrySegments}
					showGlobalLabel={countryView.status !== 'global'}
				/>
				<div className="flex flex-col gap-2 xl:col-[2/-1]">
					<VenueChart
						exchange={profile.slug}
						loadSeries={loadSeries}
						showGlobalDataNotice={countryView.status !== 'global'}
					/>
					<ProfileHighlights profile={profile} />
				</div>
			</div>

			<ProfileSectionTabs
				activeTab={tab}
				hasReserves={hasReserves}
				hasHistory={hasHistory}
				hasInformation={hasInformation}
				hasExecution={hasExecution}
				onTabChange={setTab}
				panelId={panelId}
			>
				{tab === 'execution' && hasExecution ? (
					<ProfileExecution profile={profile} />
				) : tab === 'reserves' && profile.reserves ? (
					<ProfileReserves profile={profile} reserves={profile.reserves} />
				) : tab === 'history' && hasHistory ? (
					<ProfileHistory profile={profile} />
				) : tab === 'information' && hasInformation ? (
					<div className="flex flex-col gap-2">
						<ProfileRanking profile={profile} />
						<ExchangeRegionalInformation profile={profile} asOfDate={asOfDate} view={countryView} />
					</div>
				) : segment === 'all' ? (
					<div className="flex flex-col gap-1">
						{countryView.status !== 'global' ? (
							<ScopeNote>This table ignores the Country filter and shows every market.</ScopeNote>
						) : null}
						<ProfileTokenTable
							profile={profile}
							leadingControls={<ProfileSegmentTabs profile={profile} value={segment} onValueChange={setSegment} />}
						/>
					</div>
				) : segment && active ? (
					<div className="flex flex-col gap-1">
						{countryView.status !== 'global' ? (
							<ScopeNote>This table ignores the Country filter and shows every market.</ScopeNote>
						) : null}
						<PairTable
							pairs={active.pairs}
							segment={segment}
							capabilities={active.capabilities}
							csvFileName={`${profile.slug}-${segment}-markets`}
							header={null}
							leadingControls={<ProfileSegmentTabs profile={profile} value={segment} onValueChange={setSegment} />}
						/>
					</div>
				) : (
					<Card padding="sm" className="body-sm text-tertiary">
						No market segments are present for this venue.
					</Card>
				)}
			</ProfileSectionTabs>
		</>
	)
}

const PROFILE_TAB_LABELS: Record<ProfileTab, string> = {
	markets: 'Markets',
	execution: 'Execution',
	reserves: 'Reserves',
	information: 'Information',
	history: 'Hacks & raises'
}

export function visibleProfileTabs(
	hasReserves: boolean,
	hasInformation: boolean,
	hasHistory: boolean,
	hasExecution = false
): Array<ProfileTab> {
	return [
		'markets',
		...(hasExecution ? (['execution'] as const) : []),
		...(hasReserves ? (['reserves'] as const) : []),
		...(hasInformation ? (['information'] as const) : []),
		...(hasHistory ? (['history'] as const) : [])
	]
}

export function ProfileSectionTabs({
	activeTab,
	hasReserves,
	hasHistory,
	hasInformation,
	hasExecution,
	onTabChange,
	panelId,
	children
}: {
	activeTab: ProfileTab
	hasReserves?: boolean
	hasHistory?: boolean
	hasInformation: boolean
	hasExecution?: boolean
	onTabChange: (tab: ProfileTab) => void
	panelId: string
	children: ReactNode
}) {
	const tabs = visibleProfileTabs(!!hasReserves, hasInformation, !!hasHistory, !!hasExecution)
	return (
		<Tabs value={activeTab} onValueChange={onTabChange} values={tabs}>
			<ViewTabs tabs={tabs.map((id) => ({ id, label: PROFILE_TAB_LABELS[id] }))} label="Exchange sections" />
			<TabPanel id={panelId} value={activeTab}>
				{children}
			</TabPanel>
		</Tabs>
	)
}
