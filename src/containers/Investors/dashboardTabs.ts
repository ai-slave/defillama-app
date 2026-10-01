import { queryOptions } from '@tanstack/react-query'
import type { DashboardModule, DashboardTabConfig } from './dashboardTypes'
import { getDashboardModule } from './registry'

export const DEFAULT_TABS: Array<DashboardTabConfig> = [{ id: 'dashboard', label: 'Overview' }]

/** A dashboard's module, loaded once per page: its bundle cannot change while the page is open. Null when unregistered. */
export function dashboardModuleQuery(dashboardId: string) {
	return queryOptions({
		queryKey: ['investors', 'dashboard-module', dashboardId],
		queryFn: async () => getDashboardModule(dashboardId),
		staleTime: Infinity
	})
}

/** The selected tab while `tabs` still has it, otherwise the first tab. */
export function resolveActiveTab(tabs: Array<DashboardTabConfig>, selectedTab: string | null): string {
	return selectedTab && tabs.some((tab) => tab.id === selectedTab) ? selectedTab : (tabs[0]?.id ?? 'dashboard')
}

/**
 * Tabs of an embedded IR dashboard. `loadedModule` is undefined while a registered dashboard's module
 * is still loading, which yields `tabs: null` (the skeleton). An unregistered dashboard, or a module
 * without tabs, falls back to the default Overview tab. A controlled tab wins over the selection.
 */
export function resolveEmbeddedDashboardTabs({
	registered,
	loadedModule,
	selectedTab,
	controlledTab
}: {
	registered: boolean
	loadedModule: DashboardModule | null | undefined
	selectedTab: string | null
	controlledTab: string | undefined
}): { tabs: Array<DashboardTabConfig> | null; activeTab: string } {
	const tabs = !registered ? DEFAULT_TABS : loadedModule === undefined ? null : (loadedModule?.tabs ?? DEFAULT_TABS)
	return { tabs, activeTab: controlledTab ?? resolveActiveTab(tabs ?? DEFAULT_TABS, selectedTab) }
}
