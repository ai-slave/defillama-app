import { Suspense } from 'react'
import { ChartGrid } from '~/containers/ProDashboard/components/ChartGrid'
import { EmptyState } from '~/containers/ProDashboard/components/EmptyState'
import {
	ProDashboardAPIProvider,
	useProDashboardCatalog,
	useProDashboardDashboard,
	useProDashboardItemsState
} from '~/containers/ProDashboard/ProDashboardAPIContext'
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

export function SkeletonTable() {
	return (
		<div className="relative overflow-hidden rounded-lg border border-pro-cards-border bg-pro-cards-bg">
			<div className="flex flex-col">
				<div className="flex border-b border-subtle">
					{PLACEHOLDER_COLS.map((_, i) => (
						<div key={i} className="flex-1 px-4 py-3.5">
							<div className="h-2.5 w-16 rounded-full bg-tertiary opacity-40" />
						</div>
					))}
				</div>
				{SKELETON_WIDTHS.map((widths, r) => (
					<div
						key={r}
						className="flex border-b border-subtle last:border-b-0"
						style={{ opacity: Math.max(0.15, 0.7 - r * 0.08) }}
					>
						{widths.map((w, c) => (
							<div key={c} className="flex-1 px-4 py-3.5">
								<div className={`${w} h-3 rounded-full bg-tertiary`} />
							</div>
						))}
					</div>
				))}
			</div>
			<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-pro-cards-bg via-transparent to-transparent" />
		</div>
	)
}

function ComingSoonSection({ label }: { label: string }) {
	return (
		<div className="relative">
			<SkeletonTable />
			<div className="absolute inset-0 flex items-center justify-center">
				<span className="rounded-full border border-pro-cards-border bg-pro-cards-bg px-5 py-2.5 text-sm font-semibold tracking-wide text-pro-text-secondary shadow-lg">
					{label} — Coming Soon
				</span>
			</div>
		</div>
	)
}

export const DEFAULT_TABS: DashboardTabConfig[] = [{ id: 'dashboard', label: 'Overview' }]

export function TabLabel({ tab }: { tab: DashboardTabConfig }) {
	if (!tab.comingSoon) return <>{tab.label}</>
	return (
		<span className="flex items-center gap-1.5">
			{tab.label}
			<span className="rounded-sm border border-pro-cards-border px-1 py-px label-xs tracking-wide text-pro-text-tertiary">
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
			{dashboardReady && !protocolsLoading && items.length === 0 && <EmptyState onAddChart={NOOP} isReadOnly />}
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
	tabs: DashboardTabConfig[]
	activeTab: string
	displayName: string
	dashboardId: string
	hasCustomHeader?: boolean
	hideDuplicateButton: boolean
}) {
	const activeCustomTab = tabs.find((tab) => tab.id === activeTab)

	return (
		<>
			{!hasCustomHeader && (
				<header className="hidden items-center gap-3 md:flex">
					<h1 className="heading-sm tracking-tight text-pro-text-primary">
						{activeTab === 'dashboard' ? displayName || 'Dashboard' : tabs.find((t) => t.id === activeTab)?.label}
					</h1>
				</header>
			)}

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
	tabs: DashboardTabConfig[]
	activeTab: string
	displayName: string
	hasCustomHeader?: boolean
	hideDuplicateButton: boolean
}) {
	const activeCustomTab = tabs.find((tab) => tab.id === activeTab)

	return (
		<>
			{!hasCustomHeader && (
				<header className="hidden items-center gap-3 md:flex">
					<h1 className="heading-sm tracking-tight text-pro-text-primary">
						{tabs.find((t) => t.id === activeTab)?.label ?? displayName}
					</h1>
				</header>
			)}

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
