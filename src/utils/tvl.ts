export interface TvlChartData {
	tvl?: [string | number, number][]
	liquidstaking?: [string | number, number][]
	doublecounted?: [string | number, number][]
	dcAndLsOverlap?: [string | number, number][]
}

export interface TvlOverlapValues {
	doublecounted?: number | null | undefined
	liquidstaking?: number | null | undefined
	dcAndLsOverlap?: number | null | undefined
}

export function applyTvlOverlapBaseAdjustment(
	baseValue: number | null | undefined,
	extraValues: TvlOverlapValues = {}
): number {
	return (
		(baseValue ?? 0) -
		(extraValues.doublecounted ?? 0) -
		(extraValues.liquidstaking ?? 0) +
		(extraValues.dcAndLsOverlap ?? 0)
	)
}

export const processAdjustedTvl = (data: TvlChartData | null | undefined): [number, number][] => {
	const { tvl = [], liquidstaking = [], doublecounted = [], dcAndLsOverlap = [] } = data ?? {}

	const extraTvlCharts: Record<'liquidstaking' | 'doublecounted' | 'dcAndLsOverlap', Record<number, number>> = {
		liquidstaking: {},
		doublecounted: {},
		dcAndLsOverlap: {}
	}

	for (const [date, totalLiquidityUSD] of liquidstaking) {
		extraTvlCharts.liquidstaking[Number(date)] = Math.trunc(totalLiquidityUSD)
	}
	for (const [date, totalLiquidityUSD] of doublecounted) {
		extraTvlCharts.doublecounted[Number(date)] = Math.trunc(totalLiquidityUSD)
	}
	for (const [date, totalLiquidityUSD] of dcAndLsOverlap) {
		extraTvlCharts.dcAndLsOverlap[Number(date)] = Math.trunc(totalLiquidityUSD)
	}

	const adjustedTvl: [number, number][] = tvl.map(([date, totalLiquidityUSD]) => {
		const timestamp = Number(date)
		const sum = applyTvlOverlapBaseAdjustment(Math.trunc(totalLiquidityUSD), {
			liquidstaking: extraTvlCharts.liquidstaking[timestamp],
			doublecounted: extraTvlCharts.doublecounted[timestamp],
			dcAndLsOverlap: extraTvlCharts.dcAndLsOverlap[timestamp]
		})
		return [timestamp, sum] as [number, number]
	})

	return adjustedTvl
}

const toUtcDay = (ts: number): number => Math.floor(Number(ts) / 86400) * 86400
const startOfTodayUtc = (): number => {
	const now = new Date()
	return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000)
}
const filterOutToday = (pairs: [number, number][]): [number, number][] => {
	const today = startOfTodayUtc()
	return pairs.filter(([ts]) => ts < today)
}

type ProtocolTvlPoint = { date: number | string; totalLiquidityUSD: number | string }

export type ProtocolChainTvls = Record<string, { tvl?: ProtocolTvlPoint[] }>

interface AdjustProtocolTvlOptions {
	includeChains?: string[]
	excludeChains?: string[]
	filterMode?: 'include' | 'exclude'
}

const IGNORE_KEYS = ['staking', 'pool2', 'borrowed', 'vesting']
const ADJUST_KEYS = ['doublecounted', 'liquidstaking', 'dcAndLsOverlap'] as const
type AdjustKey = (typeof ADJUST_KEYS)[number]

const isIgnoreKey = (key: string): boolean => IGNORE_KEYS.some((k) => key === k || key.endsWith(`-${k}`))

const getAdjustType = (key: string): AdjustKey | null => {
	for (const k of ADJUST_KEYS) {
		if (key === k || key.endsWith(`-${k}`)) return k
	}
	return null
}

const getChainFromDerivedKey = (key: string, type: AdjustKey): string | null => {
	const suffix = `-${type}`
	return key.endsWith(suffix) ? key.slice(0, -suffix.length) : null
}

const toPairs = (points: readonly ProtocolTvlPoint[] | undefined): [number, number][] => {
	const byDay = new Map<number, { ts: number; v: number }>()

	for (const point of points ?? []) {
		const tsRaw = Number(point.date)
		const value = Number(point.totalLiquidityUSD)

		const vRaw = Math.trunc(value)
		const day = toUtcDay(tsRaw)
		const prev = byDay.get(day)
		if (!prev || tsRaw > prev.ts) {
			byDay.set(day, { ts: tsRaw, v: vRaw })
		}
	}
	const result: Array<[number, number]> = []
	for (const [day, { v }] of byDay) result.push([day, v])
	result.sort((a, b) => a[0] - b[0])
	return result
}

const accumulate = (store: Map<number, number>, pairs: [number, number][]) => {
	for (const [ts, v] of pairs) store.set(ts, (store.get(ts) || 0) + v)
}

export const processAdjustedProtocolTvl = (
	chainTvls: ProtocolChainTvls,
	options: AdjustProtocolTvlOptions = {}
): [number, number][] => {
	const includeSet = new Set((options.includeChains || []).filter(Boolean))
	const excludeSet = new Set((options.excludeChains || []).filter(Boolean))
	const filterMode =
		options.filterMode || (includeSet.size > 0 ? 'include' : excludeSet.size > 0 ? 'exclude' : 'include')

	const base = new Map<number, number>()
	const dc = new Map<number, number>()
	const ls = new Map<number, number>()
	const overlap = new Map<number, number>()

	const hasInclude = includeSet.size > 0
	const hasExclude = excludeSet.size > 0

	for (const key in chainTvls) {
		if (isIgnoreKey(key)) continue
		const value = chainTvls[key]
		if (value === undefined) continue

		const adjustType = getAdjustType(key)
		const pairs = toPairs(value.tvl)

		let include = true
		let chainScope: string | null = null
		if (adjustType) {
			chainScope = getChainFromDerivedKey(key, adjustType)
			if (chainScope) {
				if (filterMode === 'include' && hasInclude) include = includeSet.has(chainScope)
				if (filterMode === 'exclude' && hasExclude) include = !excludeSet.has(chainScope)
			} else {
				if (hasInclude || hasExclude) include = false
			}
		} else {
			if (filterMode === 'include' && hasInclude) include = includeSet.has(key)
			if (filterMode === 'exclude' && hasExclude) include = !excludeSet.has(key)
		}

		if (!include || pairs.length === 0) continue

		if (!adjustType) {
			accumulate(base, pairs)
			continue
		}

		switch (adjustType) {
			case 'doublecounted':
				accumulate(dc, pairs)
				break
			case 'liquidstaking':
				accumulate(ls, pairs)
				break
			case 'dcAndLsOverlap':
				accumulate(overlap, pairs)
				break
		}
	}

	const tsSet = new Set<number>()
	for (const m of [base, dc, ls, overlap]) {
		for (const [ts] of m) {
			tsSet.add(ts)
		}
	}
	const allTs = Array.from(tsSet).sort((a, b) => a - b)

	const adjusted: [number, number][] = allTs.map((ts) => {
		const doublecounted = dc.get(ts)
		const liquidstaking = ls.get(ts)
		const dcAndLsOverlap = overlap.get(ts)
		return [
			ts,
			applyTvlOverlapBaseAdjustment(base.get(ts) || 0, {
				doublecounted,
				liquidstaking,
				dcAndLsOverlap
			})
		]
	})

	return filterOutToday(adjusted)
}
