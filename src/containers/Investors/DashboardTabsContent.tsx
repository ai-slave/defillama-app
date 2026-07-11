import { Suspense, useEffect, useRef, useState } from 'react'
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
		<div className="relative overflow-hidden rounded-lg border border-(--legacy-cards-border) bg-(--legacy-cards-bg)">
			<div className="flex flex-col">
				<div className="flex border-b border-(--legacy-divider)">
					{PLACEHOLDER_COLS.map((_, i) => (
						<div key={i} className="flex-1 px-4 py-3.5">
							<div className="h-2.5 w-16 rounded-full bg-(--legacy-text-disabled) opacity-40" />
						</div>
					))}
				</div>
				{SKELETON_WIDTHS.map((widths, r) => (
					<div
						key={r}
						className="flex border-b border-(--legacy-divider) last:border-b-0"
						style={{ opacity: Math.max(0.15, 0.7 - r * 0.08) }}
					>
						{widths.map((w, c) => (
							<div key={c} className="flex-1 px-4 py-3.5">
								<div className={`${w} h-3 rounded-full bg-(--legacy-text-disabled)`} />
							</div>
						))}
					</div>
				))}
			</div>
			<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-(--legacy-cards-bg) via-transparent to-transparent" />
		</div>
	)
}

function ComingSoonSection({ label }: { label: string }) {
	return (
		<div className="relative">
			<SkeletonTable />
			<div className="absolute inset-0 flex items-center justify-center">
				<span className="rounded-full border border-(--legacy-cards-border) bg-(--legacy-cards-bg) px-5 py-2.5 text-sm font-semibold tracking-wide text-(--legacy-text-secondary) shadow-lg">
					{label} — Coming Soon
				</span>
			</div>
		</div>
	)
}

export const DEFAULT_TABS: DashboardTabConfig[] = [{ id: 'dashboard', label: 'Overview' }]

function DashboardTabInner({ visible }: { visible: boolean }) {
	const { items } = useProDashboardItemsState()
	const { protocolsLoading } = useProDashboardCatalog()
	const { isLoadingDashboard, currentDashboard } = useProDashboardDashboard()
	const dashboardReady = !isLoadingDashboard && !!currentDashboard

	return (
		<div className={visible ? '' : 'hidden'}>
			{dashboardReady && items.length > 0 && (
				<div className="w-full">
					<ChartGrid onAddChartClick={NOOP} />
				</div>
			)}
			{dashboardReady && !protocolsLoading && items.length === 0 && <EmptyState onAddChart={NOOP} isReadOnly />}
		</div>
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
	const prevTab = useRef(activeTab)
	const [visitedTabsBase, setVisitedTabsBase] = useState<Set<string>>(() => new Set([activeTab]))

	// Always include current activeTab synchronously — no blink waiting for useEffect
	const visitedTabs = visitedTabsBase.has(activeTab) ? visitedTabsBase : new Set([...visitedTabsBase, activeTab])

	useEffect(() => {
		setVisitedTabsBase((prev) => {
			if (prev.has(activeTab)) return prev
			return new Set(prev).add(activeTab)
		})
		if (activeTab !== prevTab.current) {
			prevTab.current = activeTab
			requestAnimationFrame(() => {
				window.dispatchEvent(new Event('resize'))
			})
		}
	}, [activeTab])

	const dashboardVisited = visitedTabs.has('dashboard')

	return (
		<>
			{!hasCustomHeader && (
				<header className="hidden items-center gap-3 md:flex">
					<h1 className="heading-sm tracking-tight pro-text1">
						{activeTab === 'dashboard' ? displayName || 'Dashboard' : tabs.find((t) => t.id === activeTab)?.label}
					</h1>
				</header>
			)}

			{dashboardVisited && (
				<ProDashboardAPIProvider
					key={dashboardId}
					initialDashboardId={dashboardId}
					hideDuplicateButton={hideDuplicateButton}
				>
					<DashboardTabInner visible={activeTab === 'dashboard'} />
				</ProDashboardAPIProvider>
			)}

			{tabs.map((tab) => {
				if (tab.id === 'dashboard') return null
				if (tab.externalHref) return null
				if (!visitedTabs.has(tab.id)) return null
				if (!tab.component) {
					return (
						<div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
							<ComingSoonSection label={tab.label} />
						</div>
					)
				}
				const TabComponent = tab.component
				return (
					<div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
						<Suspense fallback={null}>
							<TabComponent />
						</Suspense>
					</div>
				)
			})}
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
	const prevTab = useRef(activeTab)
	const [visitedTabsBase, setVisitedTabsBase] = useState<Set<string>>(() => new Set([activeTab]))
	const visitedTabs = visitedTabsBase.has(activeTab) ? visitedTabsBase : new Set([...visitedTabsBase, activeTab])

	useEffect(() => {
		setVisitedTabsBase((prev) => {
			if (prev.has(activeTab)) return prev
			return new Set(prev).add(activeTab)
		})
		if (activeTab !== prevTab.current) {
			prevTab.current = activeTab
			requestAnimationFrame(() => {
				window.dispatchEvent(new Event('resize'))
			})
		}
	}, [activeTab])

	return (
		<>
			{!hasCustomHeader && (
				<header className="hidden items-center gap-3 md:flex">
					<h1 className="heading-sm tracking-tight pro-text1">
						{tabs.find((t) => t.id === activeTab)?.label ?? displayName}
					</h1>
				</header>
			)}

			{tabs.map((tab) => {
				if (tab.externalHref) return null
				if (!visitedTabs.has(tab.id)) return null
				if (tab.proDashboardId) {
					return (
						<div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
							<ProDashboardAPIProvider
								key={tab.proDashboardId}
								initialDashboardId={tab.proDashboardId}
								hideDuplicateButton={hideDuplicateButton}
							>
								<DashboardTabInner visible={activeTab === tab.id} />
							</ProDashboardAPIProvider>
						</div>
					)
				}
				if (!tab.component) return null
				const TabComponent = tab.component
				return (
					<div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
						<Suspense fallback={null}>
							<TabComponent />
						</Suspense>
					</div>
				)
			})}
		</>
	)
}
