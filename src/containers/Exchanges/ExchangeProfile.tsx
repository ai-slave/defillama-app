import { useRouter } from 'next/router'
import type { KeyboardEvent, ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { ReportIncorrectData } from '~/components/ReportIncorrectData'
import { Card } from '~/ui/Card'
import { TabLink, tabTrackStyles } from '~/ui/Tab'
import { pushShallowQuery } from '~/utils/routerQuery'
import { hasExchangeInformation, MetadataGroups } from './MetadataGroups'
import {
	EXCHANGE_SEGMENTS,
	type ExchangeOverviewChartModel,
	type ExchangeProfileModel,
	type ExchangeSegment
} from './models'
import { PairTable } from './PairTable'
import { ProfileIdentity } from './ProfileIdentity'
import { ProfileMetrics } from './ProfileMetrics'
import { ProfilePromotions } from './ProfilePromotions'
import { ProfileReserves } from './ProfileReserves'
import { ProfileSegmentTabs } from './ProfileSegmentTabs'
import {
	DEFAULT_PROFILE_TAB,
	EXCHANGES_QUERY_KEYS,
	getProfileSegment,
	getProfileTab,
	type ProfileTab
} from './queryState'
import { VenueChart } from './VenueChart'

export function resolveProfileSegment(
	profile: ExchangeProfileModel,
	selected: ExchangeSegment | null
): ExchangeSegment | null {
	if (selected && profile.segments[selected]) return selected
	return EXCHANGE_SEGMENTS.find((segment) => profile.segments[segment]) ?? null
}

export function ExchangeProfile({
	profile,
	asOfDate,
	loadSeries
}: {
	profile: ExchangeProfileModel
	asOfDate: string
	loadSeries: (exchange: string) => Promise<ExchangeOverviewChartModel>
}) {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<BasicLink href="/exchanges" className="w-fit body-sm text-link hover:underline">
				← Exchanges
			</BasicLink>
			{profile.profileMode === 'metadata-only' ? (
				<MetadataOnlyExchangeProfile profile={profile} asOfDate={asOfDate} />
			) : (
				<MarketsExchangeProfile profile={profile} asOfDate={asOfDate} loadSeries={loadSeries} />
			)}
		</div>
	)
}

function MetadataOnlyExchangeProfile({ profile, asOfDate }: { profile: ExchangeProfileModel; asOfDate: string }) {
	return (
		<>
			<Card as="header" padding="sm" className="flex flex-col gap-6">
				<ProfileIdentity profile={profile} />
				<ReportIncorrectData subject={{ type: 'exchange', name: profile.name, slug: profile.slug }} />
			</Card>
			<ProfilePromotions promotions={profile.metadata.promotions} asOfDate={asOfDate} />
			<MetadataGroups groups={profile.metadata.groups} />
		</>
	)
}

function MarketsExchangeProfile({
	profile,
	asOfDate,
	loadSeries
}: {
	profile: ExchangeProfileModel
	asOfDate: string
	loadSeries: (exchange: string) => Promise<ExchangeOverviewChartModel>
}) {
	const router = useRouter()
	const hasInformation = hasExchangeInformation(profile.metadata.groups)
	const hasReserves = profile.reserves != null
	const defaultSegment = resolveProfileSegment(profile, null)
	// The page is statically generated without query params, so query-derived
	// state must wait for router.isReady — deep links like ?section=information
	// would otherwise mismatch the static HTML on hydration.
	const query = router.isReady ? router.query : {}
	const segment = resolveProfileSegment(profile, getProfileSegment(query))
	const active = segment ? profile.segments[segment] : null
	const requestedTab = getProfileTab(query)
	const tab: ProfileTab =
		(requestedTab === 'information' && hasInformation) || (requestedTab === 'reserves' && hasReserves)
			? requestedTab
			: DEFAULT_PROFILE_TAB

	const setTab = (nextTab: ProfileTab) => {
		void pushShallowQuery(router, {
			[EXCHANGES_QUERY_KEYS.profileTab]: nextTab === DEFAULT_PROFILE_TAB ? undefined : nextTab
		})
	}

	const setSegment = (nextSegment: ExchangeSegment) => {
		void pushShallowQuery(router, {
			[EXCHANGES_QUERY_KEYS.profileSegment]: nextSegment === defaultSegment ? undefined : nextSegment
		})
	}
	const panelId = 'exchange-profile-panel'

	return (
		<>
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<ProfileMetrics profile={profile} />
				<div className="xl:col-[2/-1]">
					<VenueChart exchange={profile.slug} loadSeries={loadSeries} />
				</div>
			</div>

			<ProfileSectionTabs
				activeTab={tab}
				hasReserves={hasReserves}
				hasInformation={hasInformation}
				onTabChange={setTab}
				panelId={panelId}
			>
				{tab === 'reserves' && profile.reserves ? (
					<ProfileReserves profile={profile} reserves={profile.reserves} />
				) : tab === 'information' && hasInformation ? (
					<div className="flex flex-col gap-2">
						<ProfilePromotions promotions={profile.metadata.promotions} asOfDate={asOfDate} />
						<MetadataGroups groups={profile.metadata.groups} />
					</div>
				) : segment && active ? (
					<PairTable
						pairs={active.pairs}
						segment={segment}
						capabilities={active.capabilities}
						csvFileName={`${profile.slug}-${segment}-markets`}
						header={null}
						leadingControls={<ProfileSegmentTabs profile={profile} value={segment} onValueChange={setSegment} />}
					/>
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
	reserves: 'Reserves',
	information: 'Information'
}

export function ProfileSectionTabs({
	activeTab,
	hasReserves,
	hasInformation,
	onTabChange,
	panelId,
	children
}: {
	activeTab: ProfileTab
	hasReserves?: boolean
	hasInformation: boolean
	onTabChange: (tab: ProfileTab) => void
	panelId: string
	children: ReactNode
}) {
	const activeTabId = `exchange-profile-tab-${activeTab}`
	const tabs: ProfileTab[] = [
		'markets',
		...(hasReserves ? (['reserves'] as const) : []),
		...(hasInformation ? (['information'] as const) : [])
	]
	const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: ProfileTab) => {
		const currentIndex = tabs.indexOf(currentTab)
		let nextIndex: number | null = null
		if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
		if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
		if (event.key === 'Home') nextIndex = 0
		if (event.key === 'End') nextIndex = tabs.length - 1
		if (nextIndex === null) return

		event.preventDefault()
		const nextTab = tabs[nextIndex]
		onTabChange(nextTab)
		document.getElementById(`exchange-profile-tab-${nextTab}`)?.focus()
	}
	return (
		<>
			<div className={tabTrackStyles} role="tablist" aria-label="Exchange sections">
				{tabs.map((tabId) => (
					<TabLink
						as="button"
						key={tabId}
						id={`exchange-profile-tab-${tabId}`}
						type="button"
						role="tab"
						aria-selected={activeTab === tabId}
						aria-controls={panelId}
						tabIndex={activeTab === tabId ? 0 : -1}
						data-active={activeTab === tabId}
						onClick={() => onTabChange(tabId)}
						onKeyDown={(event) => handleTabKeyDown(event, tabId)}
					>
						{PROFILE_TAB_LABELS[tabId]}
					</TabLink>
				))}
			</div>
			<div id={panelId} role="tabpanel" aria-labelledby={activeTabId}>
				{children}
			</div>
		</>
	)
}
