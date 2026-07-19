import { useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { useContext, useMemo } from 'react'
import { useProDashboardCatalog } from '../ProDashboardAPIContext'
import {
	getChartQueryFn,
	getChartQueryKey,
	ProxyAuthTokenContext,
	StreamDoneContext,
	useParentChildMapping
} from '../queries'
import type { MetricAggregator, MetricConfig, MetricWindow } from '../types'

const DEFAULT_COMPARE = {
	mode: 'previous_value' as const,
	format: 'percent' as const
}
const EMPTY_SERIES: [number, number][] = []

function selectFiniteMetricSeries(data: [number, number][]): [number, number][] {
	if (!Array.isArray(data)) return EMPTY_SERIES

	let firstInvalidIndex = -1
	for (let index = 0; index < data.length; index++) {
		const point = data[index]
		if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
			firstInvalidIndex = index
			break
		}
	}
	if (firstInvalidIndex === -1) return data

	const finiteData = data.slice(0, firstInvalidIndex)
	for (let index = firstInvalidIndex + 1; index < data.length; index++) {
		const point = data[index]
		if (Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
			finiteData.push(point)
		}
	}
	return finiteData
}

type WindowBounds = {
	currentStart: number | null
	previousStart?: number
	previousEnd?: number
}

function getWindowBounds(window: MetricWindow, reference: Dayjs): WindowBounds {
	if (window === 'all') {
		return { currentStart: null }
	}

	if (window === 'ytd') {
		const currentStart = reference.startOf('year')
		const previousStart = currentStart.subtract(1, 'year')
		return {
			currentStart: currentStart.unix(),
			previousStart: previousStart.unix(),
			previousEnd: currentStart.unix()
		}
	}

	if (window === '3y') {
		const currentStart = reference.subtract(3, 'year')
		const previousStart = currentStart.subtract(3, 'year')
		return {
			currentStart: currentStart.unix(),
			previousStart: previousStart.unix(),
			previousEnd: currentStart.unix()
		}
	}

	let days = 0
	switch (window) {
		case '7d':
			days = 7
			break
		case '30d':
			days = 30
			break
		case '90d':
			days = 90
			break
		case '365d':
			days = 365
			break
		default:
			days = 0
	}

	if (!days) {
		return { currentStart: null }
	}

	const currentStart = reference.subtract(days, 'day')
	const previousStart = currentStart.subtract(days, 'day')
	return {
		currentStart: currentStart.unix(),
		previousStart: previousStart.unix(),
		previousEnd: currentStart.unix()
	}
}

function filterByWindow(data: [number, number][], window: MetricWindow, reference: Dayjs): [number, number][] {
	if (data.length === 0) return []

	const { currentStart } = getWindowBounds(window, reference)

	if (currentStart === null) return data

	return data.filter(([ts]) => ts >= currentStart)
}

function getPreviousWindow(data: [number, number][], window: MetricWindow, reference: Dayjs): [number, number][] {
	if (data.length === 0) return []

	const { previousStart, previousEnd } = getWindowBounds(window, reference)
	if (previousStart === undefined || previousEnd === undefined) {
		return []
	}

	return data.filter(([ts]) => ts >= previousStart && ts < previousEnd)
}

function resolveMovingAverageLength(window: MetricWindow, arrLength: number): number {
	switch (window) {
		case '7d':
			return Math.min(arrLength, 7)
		case '30d':
			return Math.min(arrLength, 30)
		case '90d':
			return Math.min(arrLength, 90)
		case '365d':
			return Math.min(arrLength, 365)
		case '3y':
			return Math.min(arrLength, 365 * 3)
		case 'ytd':
		case 'all':
			return arrLength
		default:
			return Math.min(arrLength, 7)
	}
}

function aggregate(values: number[], aggregator: MetricAggregator, window: MetricWindow): number | null {
	if (values.length === 0) return null

	switch (aggregator) {
		case 'latest':
			return values[values.length - 1]
		case 'avg':
			return values.reduce((a, b) => a + b, 0) / values.length
		case 'max':
			return Math.max(...values)
		case 'min':
			return Math.min(...values)
		case 'sum':
			return values.reduce((a, b) => a + b, 0)
		case 'median': {
			const sorted = values.toSorted((a, b) => a - b)
			const mid = Math.floor(sorted.length / 2)
			return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
		}
		case 'stddev': {
			if (values.length < 2) return null
			const mean = values.reduce((a, b) => a + b, 0) / values.length
			const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
			return Math.sqrt(variance)
		}
		case 'first':
			return values[0]
		case 'growth': {
			const nonZero = values.filter((value) => value !== 0)
			if (nonZero.length < 2) return null
			const first = nonZero[0]
			const last = nonZero[nonZero.length - 1]
			return ((last - first) / first) * 100
		}
		case 'movingavg': {
			if (values.length < 7) return values.reduce((a, b) => a + b, 0) / values.length

			const windowSize = resolveMovingAverageLength(window, values.length)
			const recentValues = values.slice(-windowSize)
			return recentValues.reduce((a, b) => a + b, 0) / recentValues.length
		}
		default:
			return values[values.length - 1]
	}
}

export function useMetricData(metric: MetricConfig) {
	const { subject, type, window, aggregator } = metric
	const compare = useMemo(() => {
		if (!metric.compare) {
			return DEFAULT_COMPARE
		}
		const format = metric.compare.format === 'absolute' ? 'absolute' : 'percent'
		const mode = metric.compare.mode ?? 'previous_value'

		if (mode === 'none') {
			return { mode: 'none' as const, format }
		}

		if (mode === 'previous_window' || mode === 'previous_value') {
			return { mode, format } as const
		}

		return { mode: 'previous_value' as const, format }
	}, [metric.compare])
	const itemType = subject.itemType
	const item = subject.itemType === 'protocol' ? subject.protocol || '' : subject.chain || ''
	const { protocols, chains } = useProDashboardCatalog()
	const geckoId =
		subject.geckoId ??
		(subject.itemType === 'protocol'
			? (protocols.find((p: any) => p.slug === subject.protocol)?.geckoId as string | undefined)
			: (chains.find((c: any) => c.name === subject.chain)?.gecko_id as string | undefined))
	const { data: parentMapping } = useParentChildMapping()

	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const tokenTypes = ['tokenMcap', 'tokenPrice', 'tokenVolume']
	const chainTokenTypes = ['chainMcap', 'chainPrice']

	const {
		data: series,
		isLoading,
		isError
	} = useQuery({
		queryKey: ['pro-dashboard', 'metric', ...getChartQueryKey(type, itemType, item, geckoId, undefined)],
		queryFn: getChartQueryFn(type, itemType, item, geckoId, undefined, parentMapping, undefined, undefined, authToken),
		staleTime: Infinity,
		select: selectFiniteMetricSeries,
		enabled:
			streamDone &&
			!!item &&
			((itemType === 'protocol' && (!tokenTypes.includes(type) || !!geckoId)) ||
				(itemType === 'chain' && (!chainTokenTypes.includes(type) || !!geckoId)))
	})

	const resolvedSeries = series ?? EMPTY_SERIES

	const result = useMemo(() => {
		const reference = dayjs()
		const inWindow = filterByWindow(resolvedSeries, window, reference)
		const previousWindow = getPreviousWindow(resolvedSeries, window, reference)

		const values = inWindow.map(([, v]) => v)
		const value = aggregate(values, aggregator, window)

		const previousValues = previousWindow.map(([, v]) => v)
		const previousValue = aggregate(previousValues, aggregator, window)

		let delta: number | null = null
		let deltaPct: number | null = null
		if (compare.mode === 'previous_value') {
			if (aggregator === 'latest') {
				if (values.length >= 2) {
					const curr = values[values.length - 1]
					const first = values[0]
					delta = curr - first
					deltaPct = first !== 0 ? (delta / first) * 100 : null
				}
			} else if (value !== null && previousValue !== null) {
				delta = value - previousValue
				deltaPct = previousValue !== 0 ? (delta / previousValue) * 100 : null
			}
		} else if (compare.mode === 'previous_window') {
			if (value !== null && previousValue !== null) {
				delta = value - previousValue
				deltaPct = previousValue !== 0 ? (delta / previousValue) * 100 : null
			}
		}

		// Scale data points based on window size - charts handle their own sampling
		const maxPoints =
			window === '7d'
				? 7
				: window === '30d'
					? 30
					: window === '90d'
						? 90
						: window === '365d'
							? 365
							: window === 'ytd'
								? 365
								: window === '3y'
									? 1095
									: 1500
		const sparklineData = inWindow.length > maxPoints ? inWindow.slice(inWindow.length - maxPoints) : inWindow
		const lastUpdatedTs =
			inWindow.length > 0
				? inWindow[inWindow.length - 1][0]
				: resolvedSeries.length > 0
					? resolvedSeries[resolvedSeries.length - 1][0]
					: undefined

		return { value, delta, deltaPct, sparklineData, lastUpdatedTs }
	}, [resolvedSeries, window, aggregator, compare])

	return {
		...result,
		isLoading: isLoading || (!streamDone && !series),
		isError
	}
}
