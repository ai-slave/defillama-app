import type { DashboardItemConfig } from '../../types'

export const INITIAL_DASHBOARD_STREAM_ITEM_COUNT = 8

export function partitionDashboardStreamItems(
	items: DashboardItemConfig[],
	initialItemCount = INITIAL_DASHBOARD_STREAM_ITEM_COUNT
): DashboardItemConfig[][] {
	if (items.length <= initialItemCount) return [items]
	return [items.slice(0, initialItemCount), items.slice(initialItemCount)]
}
