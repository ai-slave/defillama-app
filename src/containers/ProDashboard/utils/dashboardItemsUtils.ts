import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard } from '../dashboardTypes'
import { dashboardAPI, type DashboardAuthorizedFetch } from '../services/DashboardAPI'
import { toPersistedDashboardItems } from './dashboardUtils'

export async function addItemToDashboard(
	dashboardId: string,
	newItem: DashboardItemConfig,
	authorizedFetch: DashboardAuthorizedFetch
): Promise<Dashboard> {
	const dashboard = await dashboardAPI.getDashboard(dashboardId, authorizedFetch)

	const updatedItems = [...(dashboard.data.items ?? []), newItem]

	return dashboardAPI.updateDashboard(
		dashboardId,
		{
			items: toPersistedDashboardItems(updatedItems),
			dashboardName: dashboard.data.dashboardName,
			...(dashboard.data.timePeriod === undefined ? {} : { timePeriod: dashboard.data.timePeriod }),
			...(dashboard.data.customTimePeriod === undefined ? {} : { customTimePeriod: dashboard.data.customTimePeriod }),
			...(dashboard.visibility === undefined ? {} : { visibility: dashboard.visibility }),
			...(dashboard.tags === undefined ? {} : { tags: dashboard.tags }),
			...(dashboard.description === undefined ? {} : { description: dashboard.description }),
			aiGenerated: dashboard.aiGenerated ?? null
		},
		authorizedFetch
	)
}

export function replaceDashboardItem(
	items: Array<DashboardItemConfig>,
	targetItemId: string,
	replacement: DashboardItemConfig
): Array<DashboardItemConfig> {
	const target = items.find((item) => item.id === targetItemId && item.kind === 'llamaai-chart')
	if (!target) throw new Error('The chart repair slot no longer exists')
	return items.map((item) =>
		item === target
			? {
					...replacement,
					id: target.id,
					...(target.colSpan === undefined ? {} : { colSpan: target.colSpan })
				}
			: item
	)
}

export async function replaceItemInDashboard(
	dashboardId: string,
	targetItemId: string,
	replacement: DashboardItemConfig,
	authorizedFetch: DashboardAuthorizedFetch
): Promise<Dashboard> {
	const dashboard = await dashboardAPI.getDashboard(dashboardId, authorizedFetch)
	const updatedItems = replaceDashboardItem(dashboard.data.items ?? [], targetItemId, replacement)
	return dashboardAPI.updateDashboard(
		dashboardId,
		{
			items: toPersistedDashboardItems(updatedItems),
			dashboardName: dashboard.data.dashboardName,
			...(dashboard.data.timePeriod === undefined ? {} : { timePeriod: dashboard.data.timePeriod }),
			...(dashboard.data.customTimePeriod === undefined ? {} : { customTimePeriod: dashboard.data.customTimePeriod }),
			...(dashboard.visibility === undefined ? {} : { visibility: dashboard.visibility }),
			...(dashboard.tags === undefined ? {} : { tags: dashboard.tags }),
			...(dashboard.description === undefined ? {} : { description: dashboard.description }),
			aiGenerated: dashboard.aiGenerated ?? null
		},
		authorizedFetch
	)
}
