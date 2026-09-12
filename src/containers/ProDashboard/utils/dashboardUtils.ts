import { replaceEqualDeep } from '@tanstack/react-query'
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

export function dashboardPayloadChanges(
	base: DashboardSavePayload | undefined,
	payload: DashboardSavePayload
): Partial<DashboardSavePayload> {
	if (!base) return payload
	const changes: Partial<DashboardSavePayload> = {}
	for (const key of Object.keys(payload) as Array<keyof DashboardSavePayload>) {
		if (replaceEqualDeep(base[key], payload[key]) !== base[key])
			(changes as Record<string, unknown>)[key] = payload[key]
	}
	return changes
}

export function mergeDashboardItems(
	base: Array<DashboardItemConfig>,
	server: Array<DashboardItemConfig>,
	local: Array<DashboardItemConfig>
): Array<DashboardItemConfig> {
	if (replaceEqualDeep(base, local) === base) return replaceEqualDeep(local, server)
	const baseById = new Map(base.map((item) => [item.id, item]))
	const serverById = new Map(server.map((item) => [item.id, item]))
	const localIds = new Set(local.map((item) => item.id))
	const merged: Array<DashboardItemConfig> = []
	for (const item of local) {
		const baseItem = baseById.get(item.id)
		if (!baseItem) {
			merged.push(item)
			continue
		}
		const serverItem = serverById.get(item.id)
		const unchanged = replaceEqualDeep(baseItem, item) === baseItem
		if (!serverItem) {
			if (!unchanged) merged.push(item)
			continue
		}
		merged.push(unchanged ? serverItem : item)
	}
	for (const item of server) {
		if (!baseById.has(item.id) && !localIds.has(item.id)) merged.push(item)
	}
	return replaceEqualDeep(local, merged)
}

/**
 * Generate a unique ID for dashboard items
 */
export function generateItemId(type: string, identifier: string): string {
	return `${type}-${identifier}-${crypto.randomUUID()}`
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
