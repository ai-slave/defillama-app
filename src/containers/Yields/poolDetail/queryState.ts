import { readSingleQueryValue } from '~/utils/routerQuery'
import type { StickyQueryPref } from '../stickyQueryPrefs'
import { widestNestedRange } from './poolChartUtils'
import type { PoolHistory, PoolHistoryRange } from './types'

type QueryValue = string | Array<string> | undefined

export type HolderMode = 'share' | 'balance'
export type PoolChartKind = 'supply' | 'borrow' | 'growth'

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

/** Query patch for a window change; clears the retired avg7d/avg30d toggles so they cannot override it. */
export function getWindowQueryPatch(kind: PoolChartKind, window: PoolChartWindow): Record<string, string | undefined> {
	return {
		[getPoolSeriesQueryKey(kind, 'window')]: getWindowQueryValue(window),
		[getPoolSeriesQueryKey(kind, 'avg7d')]: undefined,
		[getPoolSeriesQueryKey(kind, 'avg30d')]: undefined
	}
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

// Every pool-page chart keeps its own range in the URL. The supply APY chart keeps the bare `range`
// it always had, so existing deep links still land where they did.
export type PoolRangeKind = 'supply' | 'borrow' | 'growth' | 'liquidity'

const POOL_RANGE_QUERY_KEYS: Record<PoolRangeKind, string> = {
	supply: 'range',
	borrow: 'borrowRange',
	growth: 'growthRange',
	liquidity: 'liquidityRange'
}

export function getPoolRangeQueryKey(kind: PoolRangeKind): string {
	return POOL_RANGE_QUERY_KEYS[kind]
}

// Borrow had no dedicated key before per-chart ranges, so a bare `range` deep link still seeds it
// until its own key is set.
export function getPoolRange(query: Record<string, QueryValue>, kind: PoolRangeKind): PoolHistoryRange {
	const value = query[getPoolRangeQueryKey(kind)]
	return getPoolHistoryRange(kind === 'borrow' ? (value ?? query[getPoolRangeQueryKey('supply')]) : value)
}

// Ranges nest (max ⊇ 90d ⊇ 30d), so the charts that read one history are served by a single fetch
// at the widest of their ranges; each slices its own window locally.
export function widestPoolRange(ranges: readonly [PoolHistoryRange, ...Array<PoolHistoryRange>]): PoolHistoryRange {
	return widestNestedRange(ranges)
}

/** Ranges are nested daily histories, so one max response can serve a narrower first paint. */
export function slicePoolHistory(history: PoolHistory, range: PoolHistoryRange): PoolHistory {
	if (range === 'max') return history
	return history.slice(range === '30d' ? -30 : -90)
}

export function getHolderModeQueryValue(mode: HolderMode): 'balance' | undefined {
	return mode === 'share' ? undefined : mode
}

// Liquidity chart unit. USD is the default; native token units are the honest way to read FLOWS,
// because in dollars a fall can be either an outflow or the token's price dropping.
export type LiquidityUnit = 'usd' | 'native'

export function getLiquidityUnit(value: QueryValue): LiquidityUnit {
	return readSingleQueryValue(value) === 'native' ? 'native' : 'usd'
}

export function getLiquidityUnitQueryValue(unit: LiquidityUnit): 'native' | undefined {
	return unit === 'usd' ? undefined : 'native'
}

// The growth chart's "deposited on" day, as a bare YYYY-MM-DD. Anything else is discarded rather
// than coerced, so a hand-edited URL falls back to the range's own start instead of an odd anchor.
export function getGrowthAnchorDate(value: QueryValue): string | null {
	const raw = readSingleQueryValue(value)
	if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
	return Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) ? null : raw
}

// The hypothetical deposit the chart grows. A $1 unit reads as the rate itself, so the chart is
// honest before anyone types a size; it is the canonical default and carries no query param.
export const GROWTH_DEFAULT_DEPOSIT = 1
// Above this the y-axis reads as noise and the premise stops being a useful "what if I deposited".
export const GROWTH_MAX_DEPOSIT = 1_000_000_000_000

export function getGrowthDeposit(value: QueryValue): number {
	const raw = readSingleQueryValue(value)
	if (!raw) return GROWTH_DEFAULT_DEPOSIT
	const amount = Number(raw)
	if (!Number.isFinite(amount) || amount <= 0) return GROWTH_DEFAULT_DEPOSIT
	return Math.min(amount, GROWTH_MAX_DEPOSIT)
}

export function getGrowthDepositQueryValue(amount: number): string | undefined {
	return amount === GROWTH_DEFAULT_DEPOSIT ? undefined : String(amount)
}

// The position the exit-capacity readout sizes against. Shares the growth chart's ceiling so a
// deep link cannot ask about a number the series could never answer.
export const EXIT_SIZE_DEFAULT = 10_000

export function getExitSize(value: QueryValue): number {
	const raw = readSingleQueryValue(value)
	if (!raw) return EXIT_SIZE_DEFAULT
	const amount = Number(raw)
	if (!Number.isFinite(amount) || amount <= 0) return EXIT_SIZE_DEFAULT
	return Math.min(amount, GROWTH_MAX_DEPOSIT)
}

export function getExitSizeQueryValue(amount: number): string | undefined {
	return amount === EXIT_SIZE_DEFAULT ? undefined : String(amount)
}

// Sticky per-browser chart preferences (see ../stickyQueryPrefs): one range shared by the two APY
// charts (each still has its own URL key) and one smoothing window per chart. Only non-default
// values are stored. The retired additive avg toggles, and the bare `range` that old links seed
// the borrow chart with, count as explicit choices so those links keep their meaning.
type PoolApyChartKind = 'supply' | 'borrow'

const POOL_CHART_RANGE_STORAGE_KEY = 'yields-pool-chart-range'

function poolChartRangePref(kind: PoolApyChartKind): StickyQueryPref {
	return {
		queryKey: getPoolRangeQueryKey(kind),
		storageKey: POOL_CHART_RANGE_STORAGE_KEY,
		...(kind === 'borrow' ? { aliasKeys: [getPoolRangeQueryKey('supply')] } : {}),
		isValid: (value) => value === '30d' || value === '90d'
	}
}

function poolChartWindowPref(kind: PoolApyChartKind): StickyQueryPref {
	return {
		queryKey: getPoolSeriesQueryKey(kind, 'window'),
		storageKey: `yields-pool-chart-window-${kind}`,
		aliasKeys: [getPoolSeriesQueryKey(kind, 'avg7d'), getPoolSeriesQueryKey(kind, 'avg30d')],
		isValid: (value) => value === '7d' || value === '30d'
	}
}

export const POOL_CHART_RANGE_PREFS: Record<PoolApyChartKind, StickyQueryPref> = {
	supply: poolChartRangePref('supply'),
	borrow: poolChartRangePref('borrow')
}

export const POOL_CHART_WINDOW_PREFS: Record<PoolApyChartKind, StickyQueryPref> = {
	supply: poolChartWindowPref('supply'),
	borrow: poolChartWindowPref('borrow')
}

export const POOL_CHART_PREFS: ReadonlyArray<StickyQueryPref> = [
	POOL_CHART_RANGE_PREFS.supply,
	POOL_CHART_RANGE_PREFS.borrow,
	POOL_CHART_WINDOW_PREFS.supply,
	POOL_CHART_WINDOW_PREFS.borrow
]
