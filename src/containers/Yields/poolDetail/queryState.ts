import { readSingleQueryValue } from '~/utils/routerQuery'
import type { PoolHistoryRange } from './types'

type QueryValue = string | string[] | undefined

export type HolderMode = 'share' | 'balance'
export type PoolChartKind = 'supply' | 'borrow'

export function getPoolHistoryRange(value: QueryValue): PoolHistoryRange {
	const range = readSingleQueryValue(value)
	return range === '30d' || range === '90d' ? range : 'max'
}

export function getHolderMode(value: QueryValue): HolderMode {
	return readSingleQueryValue(value) === 'balance' ? 'balance' : 'share'
}

export function getSeriesVisibility(value: QueryValue, defaultEnabled: boolean): boolean {
	const override = readSingleQueryValue(value)
	if (override === 'true') return true
	if (override === 'false') return false
	return defaultEnabled
}

export type PoolChartWindow = 'daily' | '7d' | '30d'

// Exclusive smoothing window for the APY chart: every rate series renders the same window.
// Daily is the default and stays out of the URL.
export function getPoolChartWindow(value: QueryValue): PoolChartWindow {
	const window = readSingleQueryValue(value)
	return window === '7d' || window === '30d' ? window : 'daily'
}

export function getWindowQueryValue(window: PoolChartWindow): '7d' | '30d' | undefined {
	return window === 'daily' ? undefined : window
}

export function getPoolSeriesQueryKey(kind: PoolChartKind, seriesKey: string): string {
	return `${kind}${seriesKey.slice(0, 1).toUpperCase()}${seriesKey.slice(1)}`
}

export function getBooleanOverride(nextEnabled: boolean, defaultEnabled: boolean): 'true' | 'false' | undefined {
	return nextEnabled === defaultEnabled ? undefined : nextEnabled ? 'true' : 'false'
}

export function getRangeQueryValue(range: PoolHistoryRange): '30d' | '90d' | undefined {
	return range === 'max' ? undefined : range
}

export function getHolderModeQueryValue(mode: HolderMode): 'balance' | undefined {
	return mode === 'share' ? undefined : mode
}
