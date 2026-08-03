import type { DashboardItemConfig } from '../dashboardItemConfig'

/** Remove transient data that must never cross the dashboard persistence boundary. */
export function toPersistedDashboardItems(items: DashboardItemConfig[]): DashboardItemConfig[] {
	return items.map((item) => {
		if (item.kind === 'sql') {
			const { snapshot: _snapshot, ...sqlConfigToSave } = item
			return sqlConfigToSave
		}
		return item
	})
}

/**
 * Generate a unique ID for dashboard items
 */
export function generateItemId(type: string, identifier: string): string {
	return `${type}-${identifier}-${Date.now()}`
}
