import dayjs from 'dayjs'
import { useMemo } from 'react'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import type { CustomTimePeriod, TimePeriod } from '../dashboardTypes'
import type { ActiveYieldChartType } from '../types'
import {
	borrowApyDimensions,
	netBorrowApyDimensions,
	supplyApy7dDimensions,
	supplyApyDimensions,
	tvlApyDimensions
} from './yieldChartConfig'

type TimeBounds = { start: number; end: number } | null

interface UseYieldChartTransformationsOptions {
	chartType: ActiveYieldChartType
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

export function buildProYieldChartSeries({
	chartType,
	chartData,
	borrowData,
	bounds = null
}: {
	chartType: ActiveYieldChartType
	chartData: PoolHistory
	borrowData: BorrowMarketHistory
	bounds?: TimeBounds
}): MultiSeriesChartDataset {
	const dimensions =
		chartType === 'tvl-apy'
			? tvlApyDimensions
			: chartType === 'supply-apy'
				? supplyApyDimensions
				: chartType === 'supply-apy-7d'
					? supplyApy7dDimensions
					: chartType === 'borrow-apy'
						? borrowApyDimensions
						: netBorrowApyDimensions
	const dataset: MultiSeriesChartDataset = { source: [], dimensions }

	if (chartType === 'borrow-apy' || chartType === 'net-borrow-apy') {
		for (const point of borrowData) {
			const date = parseDate(point.date)
			if (!inBounds(date, bounds)) continue
			const timestamp = date * 1000
			if (chartType === 'net-borrow-apy') {
				const netCost = point.borrow_cost_apy.avg_1d.total
				if (netCost != null) dataset.source.push([timestamp, netCost])
				continue
			}
			const intrinsic = point.intrinsic?.apy.avg_1d.base ?? null
			if (
				point.borrow_cost_apy.avg_1d.base != null ||
				point.borrow_cost_apy.avg_1d.reward != null ||
				intrinsic != null
			) {
				dataset.source.push([
					timestamp,
					point.borrow_cost_apy.avg_1d.base,
					point.borrow_cost_apy.avg_1d.reward == null ? null : -point.borrow_cost_apy.avg_1d.reward,
					intrinsic
				])
			}
		}
		return dataset
	}

	for (const point of chartData) {
		const date = parseDate(point.date)
		if (!inBounds(date, bounds)) continue
		const timestamp = date * 1000
		if (chartType === 'tvl-apy') {
			dataset.source.push([timestamp, add(point.apy.avg_1d.total, point.intrinsic?.apy.avg_1d.base), point.tvl_usd])
		} else if (chartType === 'supply-apy-7d') {
			const avg7 = add(point.apy.avg_7d.total, point.intrinsic?.apy.avg_7d.base)
			if (avg7 != null) dataset.source.push([timestamp, avg7])
		} else {
			const intrinsic = point.intrinsic?.apy.avg_1d.base ?? null
			if (point.apy.avg_1d.base != null || point.apy.avg_1d.reward != null || intrinsic != null) {
				dataset.source.push([timestamp, point.apy.avg_1d.base, point.apy.avg_1d.reward, intrinsic])
			}
		}
	}
	return dataset
}

export function useYieldChartTransformations({
	chartType,
	chartData,
	borrowData,
	timePeriod,
	customTimePeriod
}: UseYieldChartTransformationsOptions) {
	const bounds = useMemo(() => getTimeBounds(timePeriod, customTimePeriod), [timePeriod, customTimePeriod])
	const dataset = useMemo(
		() => buildProYieldChartSeries({ chartType, chartData: chartData ?? [], borrowData: borrowData ?? [], bounds }),
		[borrowData, bounds, chartData, chartType]
	)

	const latest = chartType === 'tvl-apy' ? dataset.source.at(-1) : undefined
	const latestApy = latest?.[1] as number | null | undefined
	const latestData = {
		apy: latestApy?.toFixed(2) ?? null,
		tvl: (latest?.[2] as number | null | undefined) ?? null
	}

	return {
		dataset,
		latestData
	}
}
