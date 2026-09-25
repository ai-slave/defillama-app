import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { getInvestorsProjects, type InvestorsSite } from './config'
import { ContentReadyContext } from './ContentReadyContext'
import { CustomServerDataContext } from './CustomServerDataContext'
import { DEFAULT_TABS, resolveActiveTab } from './dashboardTabs'
import { CustomOnlyContent, InvestorsContent, SkeletonTable, TabLabel } from './DashboardTabsContent'
import type { DashboardModule, DashboardTabConfig } from './dashboardTypes'
import { Logo } from './Logo'
import { getDashboardModule } from './registry'
import { scrollToPageTop } from './scrollToPageTop'
import { useInvestorsSite } from './SiteContext'

export { useContentReady } from './ContentReadyContext'

type ShellProject = {
	name: string
	customOnly: boolean
	id: string
	dashboardId: string
	comingSoon: boolean
}

function ProjectComingSoon() {
	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="relative w-full max-w-2xl">
				<SkeletonTable />
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="rounded-full border border-pro-cards-border bg-pro-cards-bg px-5 py-2.5 text-sm font-semibold tracking-wide text-pro-text-secondary shadow-lg">
						Coming Soon
					</span>
				</div>
			</div>
		</div>
	)
}

function useProjectModules(projects: Array<ShellProject>) {
	const [tabsByProject, setTabsByProject] = useState<Record<string, Array<DashboardTabConfig>>>({})
	const [headersByProject, setHeadersByProject] = useState<Record<string, DashboardModule['header']>>({})
	const [loadingProjects, setLoadingProjects] = useState<Set<string>>(
		() => new Set(projects.filter((p) => p.dashboardId && !p.comingSoon).map((p) => p.id))
	)

	useEffect(() => {
		let cancelled = false
		for (const project of projects) {
			if (!project.dashboardId || project.comingSoon) continue
			const loader = getDashboardModule(project.dashboardId)
			if (loader) {
				// oxlint-disable-next-line no-loop-func -- the closure reads the cancellation flag that the effect cleanup sets.
				loader.then((mod) => {
					if (!cancelled && mod?.tabs) {
						setTabsByProject((prev) => (prev[project.id] === mod.tabs ? prev : { ...prev, [project.id]: mod.tabs }))
					}
					if (!cancelled && mod?.header) {
						setHeadersByProject((prev) =>
							prev[project.id] === mod.header ? prev : { ...prev, [project.id]: mod.header }
						)
					}
					if (!cancelled) {
						setLoadingProjects((prev) => {
							if (!prev.has(project.id)) return prev
							const next = new Set(prev)
							next.delete(project.id)
							return next
						})
					}
				})
			}
		}
		return () => {
			cancelled = true
		}
	}, [projects])

	return { tabsByProject, headersByProject, loadingProjects }
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
	const allProjects = useMemo<Array<ShellProject>>(
		() => [
			...getInvestorsProjects(site.projectIds).map((project) => ({ ...project, comingSoon: false })),
			...(site.comingSoonProjectIds.length > 0
				? [{ id: 'your-project', name: 'Your Project', dashboardId: '', comingSoon: true, customOnly: false }]
				: [])
		],
		[site]
	)

	const isSingleProtocol = !!protocol
	const visibleProjects = useMemo(
		() => (protocol ? allProjects.filter((project) => project.id === protocol) : allProjects),
		[allProjects, protocol]
	)
	const defaultProject = visibleProjects[0]?.id ?? site.defaultProjectId

	const { tabsByProject, headersByProject, loadingProjects } = useProjectModules(visibleProjects)
	const [activeTab, setActiveTab] = useState<string | null>(null)
	const [activeProject, setActiveProject] = useState(defaultProject)
	const [expandedProject, setExpandedProject] = useState<string | null>(defaultProject)
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [contentReadyProjects, setContentReadyProjects] = useState<Set<string>>(new Set())

	const closeSidebar = useCallback(() => setSidebarOpen(false), [])
	const markContentReady = useCallback(() => {
		setContentReadyProjects((prev) => {
			if (prev.has(activeProject)) return prev
			return new Set(prev).add(activeProject)
		})
	}, [activeProject])

	const activeProjectConfig = visibleProjects.find((p) => p.id === activeProject)
	const dashboardId = activeProjectConfig?.dashboardId ?? visibleProjects[0]?.dashboardId ?? ''
	const displayName = activeProjectConfig?.name ?? 'Dashboard'
	const tabs = tabsByProject[activeProject] ?? DEFAULT_TABS
	const HeaderComponent = headersByProject[activeProject]
	const resolvedTab = resolveActiveTab(tabs, activeTab)

	// Only show the global loader when the active tab is the pro dashboard (Overview) tab.
	// Custom tabs handle their own loading state and should not be blocked by the stream.
	const showGlobalLoader = !!HeaderComponent && !contentReadyProjects.has(activeProject) && resolvedTab === 'dashboard'

	return (
		<CustomServerDataContext.Provider value={customServerData ?? {}}>
			<div className="investors-dashboard col-span-full flex min-h-screen flex-col bg-pro-app-bg pro-dashboard md:flex-row">
				{/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a scrim over the sidebar; the close button and Escape are the keyboard paths. */}
				{sidebarOpen && <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={closeSidebar} />}

				<div className="sticky top-0 z-10 flex items-center gap-3 bg-pro-app-bg px-4 py-3 md:hidden">
					<button
						type="button"
						onClick={() => setSidebarOpen(true)}
						className="flex size-8 items-center justify-center rounded-md text-pro-text-secondary hover:bg-sl-hover-bg hover:text-pro-text-primary"
					>
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
							<path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
						</svg>
					</button>
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
					<div className="mb-3 hidden h-px bg-sl-divider md:block" />

					<nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
						{visibleProjects.map((project) => {
							const isActive = activeProject === project.id
							const isExpanded = isSingleProtocol || (expandedProject === project.id && !project.comingSoon)

							return (
								<div key={project.id}>
									<button
										type="button"
										onClick={() => {
											if (isSingleProtocol) return
											if (isActive && !project.comingSoon) {
												setExpandedProject(isExpanded ? null : project.id)
											} else {
												scrollToPageTop()
												setActiveProject(project.id)
												setExpandedProject(project.comingSoon ? expandedProject : project.id)
												if (!project.comingSoon) {
													const projectTabs = tabsByProject[project.id]
													setActiveTab(projectTabs?.[0]?.id ?? 'dashboard')
												}
												closeSidebar()
											}
										}}
										className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold tracking-wide transition-colors ${
											isActive
												? 'text-sl-accent'
												: 'text-pro-text-secondary hover:bg-sl-hover-bg hover:text-pro-text-primary'
										}`}
									>
										{!isSingleProtocol && (
											<svg
												width="12"
												height="12"
												viewBox="0 0 12 12"
												fill="none"
												className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
											>
												<path
													d="M4.5 2.5L8 6L4.5 9.5"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										)}
										{project.name}
										{project.comingSoon && (
											<span className="ml-auto rounded-full bg-sl-btn-inactive-bg px-1.5 py-0.5 text-[10px] font-normal text-pro-text-tertiary">
												Soon
											</span>
										)}
									</button>

									{isExpanded && (
										<div className="ml-3 flex flex-col gap-0.5 border-l border-sl-divider pt-1 pl-2">
											{(tabsByProject[project.id] ?? DEFAULT_TABS).map((tab, idx, arr) => {
												const isNewGroup = tab.group && (idx === 0 || arr[idx - 1]?.group !== tab.group)
												const isSoloGroup = isNewGroup && arr.filter((t) => t.group === tab.group).length === 1

												return (
													<div key={tab.id}>
														{isNewGroup && !isSoloGroup && (
															<div
																className={`px-3 text-[10px] font-bold tracking-[0.15em] text-pro-text-tertiary uppercase${idx === 0 ? '' : ' mt-3'}`}
															>
																{tab.group}
															</div>
														)}
														{tab.externalHref ? (
															<a
																href={tab.externalHref}
																target="_blank"
																rel="noopener noreferrer"
																title={tab.externalTooltip ?? 'Opens in a new tab on a third-party site'}
																onClick={closeSidebar}
																className={`flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-xs tracking-wide transition-colors ${isSoloGroup ? `font-semibold${idx === 0 ? '' : ' mt-3'}` : 'font-medium'} text-pro-text-secondary hover:bg-sl-hover-bg hover:text-pro-text-primary`}
															>
																<span className="flex-1">{tab.label}</span>
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
														) : (
															<button
																type="button"
																onClick={() => {
																	if (resolvedTab !== tab.id) scrollToPageTop()
																	setActiveTab(tab.id)
																	closeSidebar()
																}}
																className={`w-full rounded-md px-3 py-1.5 text-left text-xs tracking-wide transition-colors ${isSoloGroup ? `font-semibold${idx === 0 ? '' : ' mt-3'}` : 'font-medium'} ${
																	resolvedTab === tab.id
																		? 'bg-sl-accent-muted text-sl-accent'
																		: 'text-pro-text-secondary hover:bg-sl-hover-bg hover:text-pro-text-primary'
																}`}
															>
																<TabLabel tab={tab} />
															</button>
														)}
													</div>
												)
											})}
										</div>
									)}
								</div>
							)
						})}
					</nav>

					<div className="mt-auto flex items-center justify-end pt-4">
						<button
							type="button"
							onClick={toggleTheme}
							className="flex size-8 items-center justify-center rounded-lg text-pro-text-secondary transition-colors hover:bg-sl-hover-bg hover:text-pro-text-primary"
						>
							{isDark ? (
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
									<path
										d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
								</svg>
							) : (
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path
										d="M14 9.68A6.5 6.5 0 0 1 6.32 2 6.5 6.5 0 1 0 14 9.68Z"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							)}
						</button>
					</div>
				</aside>

				<div className="relative flex flex-1 flex-col gap-4 p-5 md:ml-56">
					{showGlobalLoader && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-pro-app-bg md:left-56">
							<Logo animate />
						</div>
					)}
					<ContentReadyContext.Provider value={markContentReady}>
						{HeaderComponent && (
							<Suspense fallback={null}>
								<HeaderComponent />
							</Suspense>
						)}
						{activeProjectConfig?.comingSoon ? (
							<ProjectComingSoon />
						) : activeProjectConfig?.customOnly ? (
							<CustomOnlyContent
								tabs={tabs}
								activeTab={resolvedTab}
								displayName={displayName}
								hasCustomHeader={!!HeaderComponent}
								hideDuplicateButton
							/>
						) : loadingProjects.has(activeProject) ? null : (
							<InvestorsContent
								tabs={tabs}
								activeTab={resolvedTab}
								displayName={displayName}
								dashboardId={dashboardId}
								hasCustomHeader={!!HeaderComponent}
								hideDuplicateButton
							/>
						)}
					</ContentReadyContext.Provider>
				</div>
			</div>
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
