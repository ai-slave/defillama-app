import dayjs from 'dayjs'
import { useMemo } from 'react'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import type { CustomTimePeriod, TimePeriod } from '../dashboardTypes'
import {
	borrowApyDimensions,
	netBorrowApyDimensions,
	supplyApy7dDimensions,
	supplyApyDimensions,
	tvlApyDimensions
} from './yieldChartConfig'

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
	const tvlApyDataset: MultiSeriesChartDataset = {
		source: [],
		dimensions: tvlApyDimensions
	}
	const supplyApyDataset: MultiSeriesChartDataset = {
		source: [],
		dimensions: supplyApyDimensions
	}
	const supplyApy7dDataset: MultiSeriesChartDataset = {
		source: [],
		dimensions: supplyApy7dDimensions
	}
	for (const point of chartData) {
		const date = parseDate(point.date)
		if (!inBounds(date, bounds)) continue
		const timestamp = date * 1000
		tvlApyDataset.source.push([timestamp, add(point.apy.avg_1d.total, point.intrinsic?.apy.avg_1d.base), point.tvl_usd])
		const intrinsic = point.intrinsic?.apy.avg_1d.base ?? null
		if (point.apy.avg_1d.base != null || point.apy.avg_1d.reward != null || intrinsic != null) {
			supplyApyDataset.source.push([timestamp, point.apy.avg_1d.base, point.apy.avg_1d.reward, intrinsic])
		}
		const avg7 = add(point.apy.avg_7d.total, point.intrinsic?.apy.avg_7d.base)
		if (avg7 != null) supplyApy7dDataset.source.push([timestamp, avg7])
	}
	return { tvlApyDataset, supplyApyDataset, supplyApy7dDataset }
}

export function buildProBorrowHistorySeries(borrowData: BorrowMarketHistory, bounds: TimeBounds = null) {
	const borrowApyDataset: MultiSeriesChartDataset = {
		source: [],
		dimensions: borrowApyDimensions
	}
	const netBorrowApyDataset: MultiSeriesChartDataset = {
		source: [],
		dimensions: netBorrowApyDimensions
	}
	for (const point of borrowData) {
		const date = parseDate(point.date)
		if (!inBounds(date, bounds)) continue
		const timestamp = date * 1000
		const intrinsic = point.intrinsic?.apy.avg_1d.base ?? null
		if (point.borrow_cost_apy.avg_1d.base != null || point.borrow_cost_apy.avg_1d.reward != null || intrinsic != null) {
			borrowApyDataset.source.push([
				timestamp,
				point.borrow_cost_apy.avg_1d.base,
				point.borrow_cost_apy.avg_1d.reward == null ? null : -point.borrow_cost_apy.avg_1d.reward,
				intrinsic
			])
		}
		const netCost = point.borrow_cost_apy.avg_1d.total
		if (netCost != null) netBorrowApyDataset.source.push([timestamp, netCost])
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
	const latestApy = latest?.[1] as number | null | undefined
	const latestData = {
		apy: latestApy?.toFixed(2) ?? null,
		tvl: (latest?.[2] as number | null | undefined) ?? null
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
