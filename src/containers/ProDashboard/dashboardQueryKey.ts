import type { DashboardQueryKey } from './dashboardStreamContract'

export function parseDashboardQueryKey(serializedKey: string): DashboardQueryKey | null {
	try {
		const queryKey: unknown = JSON.parse(serializedKey)
		return Array.isArray(queryKey) ? queryKey : null
	} catch {
		return null
	}
}
