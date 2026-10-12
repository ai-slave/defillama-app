import { TabList } from '@ariakit/react'
import { useQueries } from '@tanstack/react-query'
import { Fragment, Suspense, useCallback, useMemo, useState } from 'react'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { DisclosureChevron } from '~/ui/DisclosureChevron'
import { Icon } from '~/ui/Icon'
import { RailItem } from '~/ui/RailItem'
import { PanelStatus } from '~/ui/Status'
import { Tab, TabPanel, Tabs } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { queryReadFailed } from '~/utils/query'
import { getInvestorsProjects, type InvestorsSite } from './config'
import { CustomServerDataContext } from './CustomServerDataContext'
import { dashboardModuleQuery, DEFAULT_TABS, resolveActiveTab } from './dashboardTabs'
import { CustomOnlyContent, InvestorsContent, TabLabel } from './DashboardTabsContent'
import { Logo } from './Logo'
import { scrollToPageTop } from './scrollToPageTop'
import { useInvestorsSite } from './SiteContext'

type ShellProject = {
	name: string
	customOnly: boolean
	id: string
	dashboardId: string
}

function InvestorsShell({
	site,
	protocol,
	customServerData
}: {
	site: InvestorsSite
	protocol?: string
	customServerData?: Record<string, unknown>
}) {
	const [isDark, toggleTheme] = useDarkModeManager()
	const allProjects = useMemo<Array<ShellProject>>(() => getInvestorsProjects(site.projectIds), [site])

	const isSingleProtocol = !!protocol
	const visibleProjects = useMemo(
		() => (protocol ? allProjects.filter((project) => project.id === protocol) : allProjects),
		[allProjects, protocol]
	)
	const defaultProject = visibleProjects[0]?.id ?? site.defaultProjectId

	// One module query per project, in visibleProjects order.
	const moduleQueries = useQueries({
		queries: visibleProjects.map((project) => dashboardModuleQuery(project.dashboardId))
	})
	const [activeTab, setActiveTab] = useState<string | null>(null)
	const [activeProject, setActiveProject] = useState(defaultProject)
	const [tabsOpen, setTabsOpen] = useState(true)
	const [sidebarOpen, setSidebarOpen] = useState(false)

	const closeSidebar = useCallback(() => setSidebarOpen(false), [])

	const activeIndex = visibleProjects.findIndex((p) => p.id === activeProject)
	const activeProjectConfig = visibleProjects[activeIndex]
	const activeModule = moduleQueries[activeIndex]
	const dashboardId = activeProjectConfig?.dashboardId ?? visibleProjects[0]?.dashboardId ?? ''
	const displayName = activeProjectConfig?.name ?? 'Dashboard'
	const tabs = activeModule?.data?.tabs ?? DEFAULT_TABS
	const HeaderComponent = activeModule?.data?.header
	const resolvedTab = resolveActiveTab(tabs, activeTab)
	const panelTabs = tabs.filter((tab) => !tab.externalHref)

	return (
		<CustomServerDataContext.Provider value={customServerData ?? {}}>
			<Tabs
				value={resolvedTab}
				onValueChange={(tab) => {
					scrollToPageTop()
					setActiveTab(tab)
				}}
				values={panelTabs.map((tab) => tab.id)}
				orientation="vertical"
			>
				<div className="investors-dashboard col-span-full flex min-h-screen flex-col bg-page md:flex-row">
					{/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a scrim over the sidebar; the close button and Escape are the keyboard paths. */}
					{sidebarOpen && <div className="fixed inset-0 z-20 bg-screen-dim md:hidden" onClick={closeSidebar} />}

					<div className="sticky top-0 z-10 flex items-center gap-3 bg-page px-4 py-3 md:hidden">
						<Tooltip
							content="Open dashboards menu"
							render={
								<Button
									variant="ghost"
									size="md"
									square
									onClick={() => setSidebarOpen(true)}
									aria-label="Open dashboards menu"
									aria-expanded={sidebarOpen}
								/>
							}
						>
							<Icon name="menu" className="size-4" aria-hidden="true" />
						</Tooltip>
						<Logo size="sm" href="/" />
					</div>

					<aside
						className={`sl-sidebar fixed top-0 left-0 z-30 flex h-screen w-56 shrink-0 flex-col overflow-hidden px-3 pt-6 pb-4 transition-transform duration-200 ${
							sidebarOpen ? 'translate-x-0' : '-translate-x-full'
						} md:z-10 md:translate-x-0`}
					>
						<div className="hidden flex-col items-center pb-3 md:flex">
							<Logo href="/" />
						</div>
						<div className="mb-3 hidden h-px bg-border-subtle md:block" />

						<nav aria-label="Dashboards" className="flex flex-1 flex-col gap-1 overflow-y-auto">
							{visibleProjects.map((project, index) => {
								const isActive = activeProject === project.id
								// Only the active project lists its tabs; a single-protocol site always shows them.
								const isExpanded = isActive && (isSingleProtocol || tabsOpen)

								return (
									<div key={project.id}>
										{isSingleProtocol ? (
											// One protocol has nothing to switch or collapse, so its name is a label, not a control.
											<div className={`px-3 py-2 label-md ${isActive ? 'text-link' : 'text-secondary'}`}>
												{project.name}
											</div>
										) : (
											<RailItem
												as="button"
												type="button"
												// The open project's selected tab carries the selection; a collapsed project shows it on its own row.
												active={isActive && !isExpanded}
												aria-expanded={isExpanded}
												onClick={() => {
													if (isActive) {
														setTabsOpen(!tabsOpen)
													} else {
														scrollToPageTop()
														setActiveProject(project.id)
														setTabsOpen(true)
														setActiveTab(moduleQueries[index].data?.tabs?.[0]?.id ?? 'dashboard')
														closeSidebar()
													}
												}}
											>
												<DisclosureChevron kind="tree" size="sm" open={isExpanded} />
												{project.name}
											</RailItem>
										)}

										{isExpanded && (
											<div className="ml-3 flex flex-col gap-0.5 border-l border-subtle pt-1 pl-2">
												<TabList aria-label={`${project.name} dashboard`} className="flex flex-col gap-0.5">
													{panelTabs.map((tab, idx) => {
														const isNewGroup = tab.group && (idx === 0 || panelTabs[idx - 1]?.group !== tab.group)
														const isSoloGroup =
															isNewGroup && panelTabs.filter((t) => t.group === tab.group).length === 1

														return (
															<Fragment key={tab.id}>
																{isNewGroup && !isSoloGroup && (
																	<div className={`px-3 label-xs text-tertiary uppercase${idx === 0 ? '' : ' mt-3'}`}>
																		{tab.group}
																	</div>
																)}
																<Tab
																	value={tab.id}
																	onClick={closeSidebar}
																	render={
																		<RailItem
																			as="button"
																			active={resolvedTab === tab.id}
																			className={isSoloGroup && idx !== 0 ? 'mt-3' : undefined}
																		/>
																	}
																>
																	<TabLabel tab={tab} />
																</Tab>
															</Fragment>
														)
													})}
												</TabList>
												{tabs.map((tab) =>
													tab.externalHref ? (
														<Tooltip
															key={tab.id}
															content={tab.externalTooltip ?? 'Opens in a new tab on a third-party site'}
															render={
																<RailItem
																	href={tab.externalHref}
																	target="_blank"
																	rel="noopener noreferrer"
																	onClick={closeSidebar}
																/>
															}
														>
															<span className="flex-1">{tab.label}</span>
															<Icon name="external-link" className="size-3.5 shrink-0" />
														</Tooltip>
													) : null
												)}
											</div>
										)}
									</div>
								)
							})}
						</nav>

						<div className="mt-auto flex items-center justify-end pt-4">
							<Tooltip
								content={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
								render={
									<Button
										variant="ghost"
										size="md"
										square
										onClick={toggleTheme}
										aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
									/>
								}
							>
								{isDark ? <Icon name="sun" className="size-4" /> : <Icon name="moon" className="size-4" />}
							</Tooltip>
						</div>
					</aside>

					<div className="relative flex flex-1 flex-col gap-4 p-5 md:ml-56">
						{HeaderComponent && (
							<Suspense fallback={null}>
								<HeaderComponent />
							</Suspense>
						)}
						<TabPanel value={resolvedTab} className="flex flex-1 flex-col gap-4">
							{activeProjectConfig?.customOnly ? (
								<CustomOnlyContent
									tabs={tabs}
									activeTab={resolvedTab}
									displayName={displayName}
									hasCustomHeader={!!HeaderComponent}
									hideDuplicateButton
								/>
							) : activeModule && queryReadFailed(activeModule) ? (
								<PanelStatus variant="error" retry={activeModule}>
									Couldn't load this dashboard.
								</PanelStatus>
							) : activeModule?.isLoading ? null : (
								<InvestorsContent
									tabs={tabs}
									activeTab={resolvedTab}
									displayName={displayName}
									dashboardId={dashboardId}
									hasCustomHeader={!!HeaderComponent}
									hideDuplicateButton
								/>
							)}
						</TabPanel>
					</div>
				</div>
			</Tabs>
		</CustomServerDataContext.Provider>
	)
}

export default function InvestorsDashboard({
	protocol,
	customServerData
}: {
	protocol?: string
	customServerData?: Record<string, unknown>
}) {
	const site = useInvestorsSite()
	if (!site) return null
	return (
		<AppMetadataProvider>
			<InvestorsShell
				key={`${site.id}:${protocol ?? 'all'}`}
				site={site}
				protocol={protocol}
				customServerData={customServerData}
			/>
		</AppMetadataProvider>
	)
}
