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
