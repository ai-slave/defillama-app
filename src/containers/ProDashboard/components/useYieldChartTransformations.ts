import dayjs from 'dayjs'
import { useMemo } from 'react'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import type { CustomTimePeriod, TimePeriod } from '../ProDashboardAPIContext'

export type TvlApyPoint = { date: number; TVL: number | null; APY: number | null }
export type ApyCompositionPoint = {
	date: number
	Base: number | null
	Reward: number | null
	Intrinsic: number | null
}
export type BorrowCompositionPoint = {
	date: number
	'Base cost': number | null
	'Reward offset': number | null
	Intrinsic: number | null
}
export type ApyLinePoint = [date: number, value: number]
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
			return { start: dayjs().subtract(customTimePeriod.relativeDays, 'day').unix(), end: Infinity }
		}
		if (customTimePeriod.type === 'absolute' && customTimePeriod.startDate && customTimePeriod.endDate) {
			return { start: customTimePeriod.startDate, end: customTimePeriod.endDate }
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
	const tvlApyData: TvlApyPoint[] = []
	const tvlApySource: Array<{ timestamp: number; APY: number | null; TVL: number | null }> = []
	const supplyApyBarData: ApyCompositionPoint[] = []
	const supplyApy7dData: ApyLinePoint[] = []
	for (const point of chartData) {
		const date = parseDate(point.date)
		if (!inBounds(date, bounds)) continue
		const tvlApyPoint = {
			date,
			TVL: point.tvl_usd,
			APY: add(point.apy.avg_1d.total, point.intrinsic?.apy.avg_1d.base)
		}
		tvlApyData.push(tvlApyPoint)
		tvlApySource.push({ timestamp: date * 1000, APY: tvlApyPoint.APY, TVL: tvlApyPoint.TVL })
		const intrinsic = point.intrinsic?.apy.avg_1d.base ?? null
		if (point.apy.avg_1d.base != null || point.apy.avg_1d.reward != null || intrinsic != null) {
			supplyApyBarData.push({
				date,
				Base: point.apy.avg_1d.base,
				Reward: point.apy.avg_1d.reward,
				Intrinsic: intrinsic
			})
		}
		const avg7 = add(point.apy.avg_7d.total, point.intrinsic?.apy.avg_7d.base)
		if (avg7 != null) supplyApy7dData.push([date, avg7])
	}
	return { tvlApyData, tvlApySource, supplyApyBarData, supplyApy7dData }
}

export function buildProBorrowHistorySeries(borrowData: BorrowMarketHistory, bounds: TimeBounds = null) {
	const borrowApyBarData: BorrowCompositionPoint[] = []
	const netBorrowApyData: ApyLinePoint[] = []
	for (const point of borrowData) {
		const date = parseDate(point.date)
		if (!inBounds(date, bounds)) continue
		const intrinsic = point.intrinsic?.apy.avg_1d.base ?? null
		if (point.borrow_cost_apy.avg_1d.base != null || point.borrow_cost_apy.avg_1d.reward != null || intrinsic != null) {
			borrowApyBarData.push({
				date,
				'Base cost': point.borrow_cost_apy.avg_1d.base,
				'Reward offset': point.borrow_cost_apy.avg_1d.reward == null ? null : -point.borrow_cost_apy.avg_1d.reward,
				Intrinsic: intrinsic
			})
		}
		const netCost = point.borrow_cost_apy.avg_1d.total
		if (netCost != null) netBorrowApyData.push([date, netCost])
	}
	return { borrowApyBarData, netBorrowApyData }
}

export function useYieldChartTransformations({
	chartData,
	borrowData,
	timePeriod,
	customTimePeriod
}: UseYieldChartTransformationsOptions) {
	const bounds = useMemo(() => getTimeBounds(timePeriod, customTimePeriod), [timePeriod, customTimePeriod])
	const { tvlApyData, tvlApySource, supplyApyBarData, supplyApy7dData } = useMemo(
		() => buildProSupplyHistorySeries(chartData ?? [], bounds),
		[chartData, bounds]
	)
	const { borrowApyBarData, netBorrowApyData } = useMemo(
		() => buildProBorrowHistorySeries(borrowData ?? [], bounds),
		[borrowData, bounds]
	)

	const tvlApyDataset = useMemo(
		() => ({ source: tvlApySource, dimensions: ['timestamp', 'APY', 'TVL'] }),
		[tvlApySource]
	)

	const latest = tvlApyData.at(-1)
	const latestData = { apy: latest?.APY?.toFixed(2) ?? null, tvl: latest?.TVL ?? null }

	return {
		tvlApyData,
		tvlApyDataset,
		supplyApyBarData,
		supplyApy7dData,
		borrowApyBarData,
		netBorrowApyData,
		latestData
	}
}
