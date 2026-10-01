import { useQuery } from '@tanstack/react-query'
import { Suspense, useState } from 'react'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { CustomServerDataContext } from './CustomServerDataContext'
import { dashboardModuleQuery, resolveEmbeddedDashboardTabs } from './dashboardTabs'
import { CustomOnlyContent, InvestorsContent, SkeletonTable, TabLabel } from './DashboardTabsContent'
import type { DashboardTabConfig } from './dashboardTypes'
import { isDashboardRegistered } from './registry'
import { TabStatus } from './TabStatus'

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
						type="button"
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
	customServerData,
	activeTab
}: {
	dashboardId: string
	customOnly: boolean
	entityName: string
	customServerData?: Record<string, unknown>
	activeTab?: string
}) {
	// The module query is keyed by dashboard, so a dashboard switch shows the skeleton again instead of the
	// previous dashboard's tabs; the tab choice starts over with it.
	const registered = isDashboardRegistered(dashboardId)
	const moduleQuery = useQuery({ ...dashboardModuleQuery(dashboardId), enabled: registered })
	const [selectedTab, setSelectedTab] = useState<string | null>(null)
	const [syncedDashboardId, setSyncedDashboardId] = useState(dashboardId)
	if (dashboardId !== syncedDashboardId) {
		setSyncedDashboardId(dashboardId)
		setSelectedTab(null)
	}
	const isControlled = activeTab !== undefined
	const loadedModule = moduleQuery.data
	const { tabs, activeTab: resolvedTab } = resolveEmbeddedDashboardTabs({
		registered,
		loadedModule,
		selectedTab,
		controlledTab: activeTab
	})
	const HeaderComponent = loadedModule?.header ?? null

	return (
		<AppMetadataProvider>
			<CustomServerDataContext.Provider value={customServerData ?? {}}>
				<div className="investors-dashboard investors-dashboard-embedded flex flex-col gap-4 pro-dashboard">
					{HeaderComponent ? (
						<Suspense fallback={null}>
							<HeaderComponent />
						</Suspense>
					) : null}
					{moduleQuery.isError ? (
						<TabStatus variant="error">Couldn't load this dashboard. Reload the page to try again.</TabStatus>
					) : tabs == null ? (
						<SkeletonTable />
					) : (
						<>
							{isControlled ? null : <PillStrip tabs={tabs} activeTab={resolvedTab} onSelect={setSelectedTab} />}
							{customOnly ? (
								<CustomOnlyContent
									tabs={tabs}
									activeTab={resolvedTab}
									displayName={entityName}
									hasCustomHeader={!!HeaderComponent}
									hideDuplicateButton
								/>
							) : (
								<InvestorsContent
									tabs={tabs}
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
			</CustomServerDataContext.Provider>
		</AppMetadataProvider>
	)
}
