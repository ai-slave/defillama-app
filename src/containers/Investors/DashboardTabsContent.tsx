import { Suspense } from 'react'
import { ChartGrid } from '~/containers/ProDashboard/components/ChartGrid'
import { EmptyDashboard } from '~/containers/ProDashboard/components/EmptyDashboard'
import {
	ProDashboardAPIProvider,
	useProDashboardCatalog,
	useProDashboardDashboard,
	useProDashboardItemsState
} from '~/containers/ProDashboard/ProDashboardAPIContext'
import { Card } from '~/ui/Card'
import { Skeleton } from '~/ui/Skeleton'
import type { DashboardTabConfig } from './dashboardTypes'

const NOOP = () => {}

const SKELETON_WIDTHS = [
	['w-16', 'w-4/5', 'w-14', 'w-20', 'w-12'],
	['w-14', 'w-3/5', 'w-16', 'w-16', 'w-14'],
	['w-16', 'w-2/3', 'w-12', 'w-24', 'w-10'],
	['w-14', 'w-1/2', 'w-14', 'w-20', 'w-16'],
	['w-16', 'w-3/4', 'w-16', 'w-14', 'w-12'],
	['w-14', 'w-2/5', 'w-12', 'w-20', 'w-14'],
	['w-16', 'w-3/5', 'w-14', 'w-16', 'w-10'],
	['w-14', 'w-1/2', 'w-16', 'w-24', 'w-12']
]

const PLACEHOLDER_COLS = ['', '', '', '', '']

/** The page's h1, always present: a custom project header shows the name in its own type, and phones hide the visible
    heading for space, so there it stays for screen readers and search only. */
function DashboardHeading({
	hidden,
	title,
	displayName
}: {
	hidden?: boolean
	title: string | undefined
	displayName: string
}) {
	if (hidden)
		return <h1 className="sr-only">{title && title !== displayName ? `${displayName}: ${title}` : displayName}</h1>
	return (
		<header className="flex items-center gap-3 max-md:sr-only">
			<h1 className="heading-sm tracking-tight text-primary">{title}</h1>
		</header>
	)
}

/** The loading table; `still` when it is the backdrop of a "Coming soon" note, which waits for nothing. */
export function SkeletonTable({ still }: { still?: boolean }) {
	return (
		<Card padding="none" className="relative overflow-hidden">
			<div className="flex flex-col">
				<div className="flex border-b border-subtle">
					{PLACEHOLDER_COLS.map((_, i) => (
						// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
						<div key={i} className="flex-1 px-4 py-3.5">
							<Skeleton className="h-2.5 w-16 rounded-full" still={still} />
						</div>
					))}
				</div>
				{SKELETON_WIDTHS.map((widths, r) => (
					<div
						// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
						key={r}
						className="flex border-b border-subtle last:border-b-0"
					>
						{widths.map((w, c) => (
							// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
							<div key={c} className="flex-1 px-4 py-3.5">
								<Skeleton className={`${w} h-3 rounded-full`} still={still} />
							</div>
						))}
					</div>
				))}
			</div>
			<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-surface via-transparent to-transparent" />
		</Card>
	)
}

function ComingSoonSection({ label }: { label: string }) {
	return (
		<div className="relative">
			<SkeletonTable still />
			<div className="absolute inset-0 flex items-center justify-center">
				<span className="rounded-full border border-medium bg-overlay px-5 py-2.5 title-md tracking-wide text-secondary">
					{label} — Coming soon
				</span>
			</div>
		</div>
	)
}

export function TabLabel({ tab }: { tab: DashboardTabConfig }) {
	if (!tab.comingSoon) return <>{tab.label}</>
	return (
		<span className="flex items-center gap-1.5">
			{tab.label}
			<span className="rounded-sm border border-medium px-1 py-px label-xs tracking-wide text-tertiary">
				Coming soon
			</span>
		</span>
	)
}

function DashboardTabInner() {
	const { items } = useProDashboardItemsState()
	const { protocolsLoading } = useProDashboardCatalog()
	const { isLoadingDashboard, currentDashboard } = useProDashboardDashboard()
	const dashboardReady = !isLoadingDashboard && !!currentDashboard

	return (
		<>
			{dashboardReady && items.length > 0 && (
				<div className="w-full">
					<ChartGrid onAddChartClick={NOOP} />
				</div>
			)}
			{dashboardReady && !protocolsLoading && items.length === 0 && <EmptyDashboard onAddChart={NOOP} isReadOnly />}
		</>
	)
}

export function InvestorsContent({
	tabs,
	activeTab,
	displayName,
	dashboardId,
	hasCustomHeader,
	hideDuplicateButton
}: {
	tabs: Array<DashboardTabConfig>
	activeTab: string
	displayName: string
	dashboardId: string
	hasCustomHeader?: boolean
	hideDuplicateButton: boolean
}) {
	const activeCustomTab = tabs.find((tab) => tab.id === activeTab)

	return (
		<>
			<DashboardHeading
				hidden={hasCustomHeader}
				title={activeTab === 'dashboard' ? displayName || 'Dashboard' : tabs.find((t) => t.id === activeTab)?.label}
				displayName={displayName}
			/>

			{activeTab === 'dashboard' && (
				<ProDashboardAPIProvider
					key={dashboardId}
					initialDashboardId={dashboardId}
					hideDuplicateButton={hideDuplicateButton}
				>
					<DashboardTabInner />
				</ProDashboardAPIProvider>
			)}

			{activeCustomTab && activeCustomTab.id !== 'dashboard' && !activeCustomTab.externalHref && (
				<ActiveCustomTab tab={activeCustomTab} />
			)}
		</>
	)
}

export function CustomOnlyContent({
	tabs,
	activeTab,
	displayName,
	hasCustomHeader,
	hideDuplicateButton
}: {
	tabs: Array<DashboardTabConfig>
	activeTab: string
	displayName: string
	hasCustomHeader?: boolean
	hideDuplicateButton: boolean
}) {
	const activeCustomTab = tabs.find((tab) => tab.id === activeTab)

	return (
		<>
			<DashboardHeading
				hidden={hasCustomHeader}
				title={tabs.find((t) => t.id === activeTab)?.label ?? displayName}
				displayName={displayName}
			/>

			{activeCustomTab &&
				!activeCustomTab.externalHref &&
				(activeCustomTab.proDashboardId ? (
					<ProDashboardAPIProvider
						key={activeCustomTab.proDashboardId}
						initialDashboardId={activeCustomTab.proDashboardId}
						hideDuplicateButton={hideDuplicateButton}
					>
						<DashboardTabInner />
					</ProDashboardAPIProvider>
				) : (
					<ActiveCustomTab tab={activeCustomTab} />
				))}
		</>
	)
}

function ActiveCustomTab({ tab }: { tab: DashboardTabConfig }) {
	if (!tab.component) return <ComingSoonSection label={tab.label} />
	const TabComponent = tab.component
	return (
		<Suspense fallback={null}>
			<TabComponent />
		</Suspense>
	)
}
