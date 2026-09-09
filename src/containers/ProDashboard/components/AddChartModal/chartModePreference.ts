import { getStorageItem, setStorageItem } from '~/contexts/localStorageStore'
import type { ChartModeType } from './types'

export const CHART_MODE_STORAGE_KEY = 'pro-dashboard-chart-mode'
export const DEFAULT_CHART_MODE: ChartModeType = 'manual'
export function readPreferredChartMode(): ChartModeType {
	const value = getStorageItem(CHART_MODE_STORAGE_KEY)
	return value === 'manual' || value === 'builder' ? value : DEFAULT_CHART_MODE
}
export function writePreferredChartMode(mode: ChartModeType) {
	setStorageItem(CHART_MODE_STORAGE_KEY, mode)
}
