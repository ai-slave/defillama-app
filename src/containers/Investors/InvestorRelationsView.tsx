import { useQuery } from '@tanstack/react-query'
import { Suspense, useState } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { CustomServerDataContext } from './CustomServerDataContext'
import { dashboardModuleQuery, resolveEmbeddedDashboardTabs } from './dashboardTabs'
import { CustomOnlyContent, InvestorsContent, SkeletonTable, TabLabel } from './DashboardTabsContent'
import { isDashboardRegistered } from './registry'
import { TabStatus } from './TabStatus'

/**
 * Renders an Investor Relations dashboard module (loaded by `dashboardId` from the ungated registry)
 * inside the main site. Shared by the protocol IR subroute and the chain IR tab. Uncontrolled, it draws its
 * own tab strip (external tabs are links after it); a controlled `activeTab` comes from the page's route nav. The `investors-dashboard pro-dashboard` wrapper provides the CSS variables the dashboard
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
	const content =
		tabs == null ? null : customOnly ? (
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
		)

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
					) : isControlled ? (
						content
					) : (
						<Tabs value={resolvedTab} onValueChange={setSelectedTab} values={tabs.map((tab) => tab.id)}>
							<div className="flex items-center gap-2">
								<SegmentedControl
									semantics="tabs"
									variant="default"
									size="md"
									label={`${entityName} dashboard`}
									options={tabs.flatMap((tab) =>
										tab.externalHref ? [] : [{ value: tab.id, label: <TabLabel tab={tab} /> }]
									)}
								/>
								{tabs.map((tab) =>
									tab.externalHref ? (
										<ExternalLinkButton
											key={tab.id}
											href={tab.externalHref}
											title={tab.externalTooltip ?? 'Opens in a new tab on a third-party site'}
											className="shrink-0"
										>
											{tab.label}
										</ExternalLinkButton>
									) : null
								)}
							</div>
							<TabPanel value={resolvedTab} className="flex flex-col gap-4">
								{content}
							</TabPanel>
						</Tabs>
					)}
				</div>
			</CustomServerDataContext.Provider>
		</AppMetadataProvider>
	)
}
