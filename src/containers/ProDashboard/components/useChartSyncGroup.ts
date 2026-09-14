import { useCallback } from 'react'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { useProDashboardDashboard } from '../ProDashboardAPIContext'

export const CHART_SYNC_STORAGE_KEY = 'pro-dashboard-sync-hover'

export function useChartSyncPreference() {
	const enabled = useStorageItem(CHART_SYNC_STORAGE_KEY, 'on') === 'on'
	const toggle = useCallback(() => setStorageItem(CHART_SYNC_STORAGE_KEY, enabled ? 'off' : 'on'), [enabled])
	return { enabled, toggle }
}

export function useChartSyncGroup(): string | undefined {
	const { enabled } = useChartSyncPreference()
	const { dashboardId } = useProDashboardDashboard()
	return enabled && dashboardId ? `pro-dashboard-${dashboardId}` : undefined
}
