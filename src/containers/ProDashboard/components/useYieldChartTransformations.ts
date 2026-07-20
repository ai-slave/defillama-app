import dayjs from 'dayjs'
import { useMemo } from 'react'
import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import type { CustomTimePeriod, TimePeriod } from '../dashboardTypes'
import {
	borrowApyDimensions,
	netBorrowApyDimensions,
	supplyApy7dDimensions,
	supplyApyDimensions,
	tvlApyDimensions
} from './yieldChartConfig'

type YieldChartDataset<T> = Omit<MultiSeriesChart2Dataset, 'source'> & {
	source: T[]
}
type TvlApyPoint = {
	timestamp: number
	TVL: number | null
	APY: number | null
}
type ApyCompositionPoint = {
	timestamp: number
	Base: number | null
	Reward: number | null
	Intrinsic: number | null
}
type SupplyApy7dPoint = { timestamp: number; '7d Supply APY': number }
type BorrowCompositionPoint = {
	timestamp: number
	'Base cost': number | null
	'Reward offset': number | null
	Intrinsic: number | null
}
type NetBorrowApyPoint = { timestamp: number; 'Net borrow cost': number }
type TimeBounds = { start: number; end: number } | null

interface UseYieldChartTransformationsOptions {
	chartData: PoolHistory | null | undefined
	borrowData?: BorrowMarketHistory | null | undefined
	timePeriod?: TimePeriod | null
	customTimePeriod?: CustomTimePeriod | null
}

function parseDate(date: string): number {
	return Math.floor(new Date(date.includes('T') ? date : `${date}T00:00:00Z`).getTime() / 1000)
}

function getTimeBounds(
	timePeriod: TimePeriod | null | undefined,
	customTimePeriod: CustomTimePeriod | null | undefined
): TimeBounds {
	if (!timePeriod || timePeriod === 'all') return null
	if (timePeriod === 'custom' && customTimePeriod) {
		if (customTimePeriod.type === 'relative' && customTimePeriod.relativeDays) {
			return {
				start: dayjs().subtract(customTimePeriod.relativeDays, 'day').unix(),
				end: Infinity
			}
		}
		if (customTimePeriod.type === 'absolute' && customTimePeriod.startDate && customTimePeriod.endDate) {
			return {
				start: customTimePeriod.startDate,
				end: customTimePeriod.endDate
			}
		}
		return null
	}

	const now = dayjs()
	const start =
		timePeriod === '30d'
			? now.subtract(30, 'day')
			: timePeriod === '90d'
				? now.subtract(90, 'day')
				: timePeriod === '365d'
					? now.subtract(365, 'day')
					: timePeriod === 'ytd'
						? now.startOf('year')
						: timePeriod === '3y'
							? now.subtract(3, 'year')
							: null
	return start ? { start: start.unix(), end: Infinity } : null
}

function inBounds(date: number, bounds: TimeBounds): boolean {
	return !bounds || (date >= bounds.start && date <= bounds.end)
}

function add(value: number | null, extra: number | null | undefined): number | null {
	if (value == null && extra == null) return null
	return (value ?? 0) + (extra ?? 0)
}

export function buildProSupplyHistorySeries(chartData: PoolHistory, bounds: TimeBounds = null) {
	const tvlApyDataset: YieldChartDataset<TvlApyPoint> = {
		source: [],
		dimensions: tvlApyDimensions
	}
	const supplyApyDataset: YieldChartDataset<ApyCompositionPoint> = {
		source: [],
		dimensions: supplyApyDimensions
	}
	const supplyApy7dDataset: YieldChartDataset<SupplyApy7dPoint> = {
		source: [],
		dimensions: supplyApy7dDimensions
	}
	for (const point of chartData) {
		const date = parseDate(point.date)
		if (!inBounds(date, bounds)) continue
		const tvlApyPoint = {
			timestamp: date * 1000,
			TVL: point.tvl_usd,
			APY: add(point.apy.avg_1d.total, point.intrinsic?.apy.avg_1d.base)
		}
		tvlApyDataset.source.push(tvlApyPoint)
		const intrinsic = point.intrinsic?.apy.avg_1d.base ?? null
		if (point.apy.avg_1d.base != null || point.apy.avg_1d.reward != null || intrinsic != null) {
			supplyApyDataset.source.push({
				timestamp: date * 1000,
				Base: point.apy.avg_1d.base,
				Reward: point.apy.avg_1d.reward,
				Intrinsic: intrinsic
			})
		}
		const avg7 = add(point.apy.avg_7d.total, point.intrinsic?.apy.avg_7d.base)
		if (avg7 != null)
			supplyApy7dDataset.source.push({
				timestamp: date * 1000,
				'7d Supply APY': avg7
			})
	}
	return { tvlApyDataset, supplyApyDataset, supplyApy7dDataset }
}

export function buildProBorrowHistorySeries(borrowData: BorrowMarketHistory, bounds: TimeBounds = null) {
	const borrowApyDataset: YieldChartDataset<BorrowCompositionPoint> = {
		source: [],
		dimensions: borrowApyDimensions
	}
	const netBorrowApyDataset: YieldChartDataset<NetBorrowApyPoint> = {
		source: [],
		dimensions: netBorrowApyDimensions
	}
	for (const point of borrowData) {
		const date = parseDate(point.date)
		if (!inBounds(date, bounds)) continue
		const intrinsic = point.intrinsic?.apy.avg_1d.base ?? null
		if (point.borrow_cost_apy.avg_1d.base != null || point.borrow_cost_apy.avg_1d.reward != null || intrinsic != null) {
			borrowApyDataset.source.push({
				timestamp: date * 1000,
				'Base cost': point.borrow_cost_apy.avg_1d.base,
				'Reward offset': point.borrow_cost_apy.avg_1d.reward == null ? null : -point.borrow_cost_apy.avg_1d.reward,
				Intrinsic: intrinsic
			})
		}
		const netCost = point.borrow_cost_apy.avg_1d.total
		if (netCost != null)
			netBorrowApyDataset.source.push({
				timestamp: date * 1000,
				'Net borrow cost': netCost
			})
	}
	return { borrowApyDataset, netBorrowApyDataset }
}

export function useYieldChartTransformations({
	chartData,
	borrowData,
	timePeriod,
	customTimePeriod
}: UseYieldChartTransformationsOptions) {
	const bounds = useMemo(() => getTimeBounds(timePeriod, customTimePeriod), [timePeriod, customTimePeriod])
	const { tvlApyDataset, supplyApyDataset, supplyApy7dDataset } = useMemo(
		() => buildProSupplyHistorySeries(chartData ?? [], bounds),
		[chartData, bounds]
	)
	const { borrowApyDataset, netBorrowApyDataset } = useMemo(
		() => buildProBorrowHistorySeries(borrowData ?? [], bounds),
		[borrowData, bounds]
	)

	const latest = tvlApyDataset.source.at(-1)
	const latestData = {
		apy: latest?.APY?.toFixed(2) ?? null,
		tvl: latest?.TVL ?? null
	}

	return {
		tvlApyDataset,
		supplyApyDataset,
		supplyApy7dDataset,
		borrowApyDataset,
		netBorrowApyDataset,
		latestData
	}
}
