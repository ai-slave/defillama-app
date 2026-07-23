import type { Dashboard } from '../dashboardTypes'
import { dashboardAPI } from '../services/DashboardAPI'
import type { DashboardItemConfig } from '../types'
import { cleanItemsForSaving } from './dashboardUtils'

export async function addItemToDashboard(
	dashboardId: string,
	newItem: DashboardItemConfig,
	authorizedFetch: (url: string, options?: any) => Promise<Response>
): Promise<Dashboard> {
	const dashboard = await dashboardAPI.getDashboard(dashboardId, authorizedFetch)

	const updatedItems = [...(dashboard.data.items ?? []), newItem]

	return dashboardAPI.updateDashboard(
		dashboardId,
		{
			items: cleanItemsForSaving(updatedItems),
			dashboardName: dashboard.data.dashboardName,
			timePeriod: dashboard.data.timePeriod,
			customTimePeriod: dashboard.data.customTimePeriod,
			visibility: dashboard.visibility,
			tags: dashboard.tags,
			description: dashboard.description,
			aiGenerated: dashboard.aiGenerated ?? null
		},
		authorizedFetch
	)
}

export function replaceDashboardItem(
	items: DashboardItemConfig[],
	targetItemId: string,
	replacement: DashboardItemConfig
): DashboardItemConfig[] {
	const targetIndex = items.findIndex((item) => item.id === targetItemId && item.kind === 'llamaai-chart')
	if (targetIndex === -1) throw new Error('The chart repair slot no longer exists')
	const target = items[targetIndex]
	const nextItems = [...items]
	nextItems[targetIndex] = {
		...replacement,
		id: target.id,
		...(target.colSpan !== undefined && { colSpan: target.colSpan })
	} as DashboardItemConfig
	return nextItems
}

export async function replaceItemInDashboard(
	dashboardId: string,
	targetItemId: string,
	replacement: DashboardItemConfig,
	authorizedFetch: (url: string, options?: any) => Promise<Response>
): Promise<Dashboard> {
	const dashboard = await dashboardAPI.getDashboard(dashboardId, authorizedFetch)
	const updatedItems = replaceDashboardItem(dashboard.data.items ?? [], targetItemId, replacement)
	return dashboardAPI.updateDashboard(
		dashboardId,
		{
			items: cleanItemsForSaving(updatedItems),
			dashboardName: dashboard.data.dashboardName,
			timePeriod: dashboard.data.timePeriod,
			customTimePeriod: dashboard.data.customTimePeriod,
			visibility: dashboard.visibility,
			tags: dashboard.tags,
			description: dashboard.description,
			aiGenerated: dashboard.aiGenerated ?? null
		},
		authorizedFetch
	)
}
