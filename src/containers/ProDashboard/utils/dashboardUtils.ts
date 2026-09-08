import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard } from '../dashboardTypes'
import type { DashboardSavePayload } from '../services/DashboardAPI'

/** Remove transient data that must never cross the dashboard persistence boundary. */
export function toPersistedDashboardItems(items: Array<DashboardItemConfig>): Array<DashboardItemConfig> {
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

export function toDashboardSavePayload(dashboard: Dashboard): DashboardSavePayload {
	return {
		...dashboard.data,
		visibility: dashboard.visibility ?? 'private',
		tags: dashboard.tags ?? [],
		description: dashboard.description ?? '',
		aiGenerated: dashboard.aiGenerated ?? null
	}
}
