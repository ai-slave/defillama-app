import { Suspense, useEffect, useState } from 'react'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { ContentReadyContext } from './ContentReadyContext'
import { CustomServerDataContext } from './CustomServerDataContext'
import { CustomOnlyContent, DEFAULT_TABS, InvestorsContent, SkeletonTable, TabLabel } from './DashboardTabsContent'
import type { DashboardModule, DashboardTabConfig } from './dashboardTypes'
import { getDashboardModule } from './registry'

const NOOP = () => {}

function PillStrip({
	tabs,
	activeTab,
	onSelect
}: {
	tabs: Array<DashboardTabConfig>
	activeTab: string
	onSelect: (id: string) => void
}) {
	return (
		<div className="flex items-center gap-1 overflow-x-auto border-b border-sl-divider pb-2">
			{tabs.map((tab) => {
				if (tab.externalHref) {
					return (
						<a
							key={tab.id}
							href={tab.externalHref}
							target="_blank"
							rel="noopener noreferrer"
							title={tab.externalTooltip ?? 'Opens in a new tab on a third-party site'}
							className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap text-pro-text-secondary transition-colors hover:bg-sl-hover-bg hover:text-pro-text-primary"
						>
							<TabLabel tab={tab} />
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="size-3 shrink-0 opacity-70"
								aria-hidden="true"
							>
								<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
								<polyline points="15 3 21 3 21 9" />
								<line x1="10" y1="14" x2="21" y2="3" />
							</svg>
						</a>
					)
				}

				const isActive = activeTab === tab.id
				return (
					<button
						key={tab.id}
						onClick={() => onSelect(tab.id)}
						className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
							isActive
								? 'bg-sl-accent-muted text-sl-accent'
								: 'text-pro-text-secondary hover:bg-sl-hover-bg hover:text-pro-text-primary'
						}`}
					>
						<TabLabel tab={tab} />
					</button>
				)
			})}
		</div>
	)
}

/**
 * Renders an Investor Relations dashboard module (loaded by `dashboardId` from the ungated registry)
 * inside the main site, under its own pill-strip sub-nav. Shared by the protocol IR subroute and the
 * chain IR tab. The `investors-dashboard pro-dashboard` wrapper provides the CSS variables the dashboard
 * components depend on (`--pro-*`, `--sl-*`); `investors-dashboard-embedded` re-points the surface
 * tokens (`--cards-*`, `--text-*`, ...) back to the site theme so the content sits in the page flow
 * instead of reproducing the standalone IR shell.
 */
export function InvestorRelationsView({
	dashboardId,
	customOnly,
	entityName,
	customServerData
}: {
	dashboardId: string
	customOnly: boolean
	entityName: string
	customServerData?: Record<string, unknown>
}) {
	const [tabs, setTabs] = useState<Array<DashboardTabConfig> | null>(null)
	const [HeaderComponent, setHeaderComponent] = useState<DashboardModule['header'] | null>(null)
	const [activeTab, setActiveTab] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		setTabs(null)
		setHeaderComponent(null)
		setActiveTab(null)
		const loader = getDashboardModule(dashboardId)
		if (!loader) {
			setTabs(DEFAULT_TABS)
			return
		}
		loader.then((mod) => {
			if (cancelled) return
			setTabs(mod?.tabs ?? DEFAULT_TABS)
			setHeaderComponent(() => mod?.header ?? null)
		})
		return () => {
			cancelled = true
		}
	}, [dashboardId])

	const resolvedTabs = tabs ?? DEFAULT_TABS
	const resolvedTab =
		activeTab && resolvedTabs.some((t) => t.id === activeTab) ? activeTab : (resolvedTabs[0]?.id ?? 'dashboard')

	return (
		<AppMetadataProvider>
			<CustomServerDataContext.Provider value={customServerData ?? {}}>
				<ContentReadyContext.Provider value={NOOP}>
					<div className="investors-dashboard investors-dashboard-embedded flex flex-col gap-4 pro-dashboard">
						{HeaderComponent ? (
							<Suspense fallback={null}>
								<HeaderComponent />
							</Suspense>
						) : null}
						{tabs == null ? (
							<SkeletonTable />
						) : (
							<>
								<PillStrip tabs={resolvedTabs} activeTab={resolvedTab} onSelect={setActiveTab} />
								{customOnly ? (
									<CustomOnlyContent
										tabs={resolvedTabs}
										activeTab={resolvedTab}
										displayName={entityName}
										hasCustomHeader={!!HeaderComponent}
										hideDuplicateButton
									/>
								) : (
									<InvestorsContent
										tabs={resolvedTabs}
										activeTab={resolvedTab}
										displayName={entityName}
										dashboardId={dashboardId}
										hasCustomHeader={!!HeaderComponent}
										hideDuplicateButton
									/>
								)}
							</>
						)}
					</div>
				</ContentReadyContext.Provider>
			</CustomServerDataContext.Provider>
		</AppMetadataProvider>
	)
}
