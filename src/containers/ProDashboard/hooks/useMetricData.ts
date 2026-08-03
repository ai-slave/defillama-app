import { useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { useContext, useMemo } from 'react'
import { getChartDataPrerequisite, toChartRuntimeState } from '../chartRuntime'
import { getProDashboardChartSourceQueryKey, isChainTokenChartType, isProtocolTokenChartType } from '../chartSource'
import { useProDashboardCatalog } from '../ProDashboardAPIContext'
import { getChartQueryFn, ProxyAuthTokenContext, StreamDoneContext } from '../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../queryPolicy'
import type { ChartSubject, MetricAggregator, MetricConfig, MetricWindow } from '../types'

const DEFAULT_COMPARE = {
	mode: 'previous_value' as const,
	format: 'percent' as const
}

function selectFiniteMetricSeries(data: [number, number][]): [number, number][] {
	let firstInvalidIndex = -1
	for (let index = 0; index < data.length; index++) {
		const point = data[index]
		if (!point) throw new Error(`Missing metric chart point at index ${index}`)
		if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
			firstInvalidIndex = index
			break
		}
	}
	if (firstInvalidIndex === -1) return data

	const finiteData = data.slice(0, firstInvalidIndex)
	for (let index = firstInvalidIndex + 1; index < data.length; index++) {
		const point = data[index]
		if (!point) throw new Error(`Missing metric chart point at index ${index}`)
		if (Number.isFinite(point[0]) && Number.isFinite(point[1])) {
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

export function partitionMetricWindows(data: [number, number][], window: MetricWindow, reference: Dayjs) {
	const { currentStart, previousStart, previousEnd } = getWindowBounds(window, reference)
	const current = currentStart === null ? data : []
	const currentValues: number[] = []
	const previousValues: number[] = []

	for (const point of data) {
		const [timestamp, value] = point
		if (currentStart === null || timestamp >= currentStart) {
			if (currentStart !== null) current.push(point)
			currentValues.push(value)
		} else if (
			previousStart !== undefined &&
			previousEnd !== undefined &&
			timestamp >= previousStart &&
			timestamp < previousEnd
		) {
			previousValues.push(value)
		}
	}

	return { current, currentValues, previousValues }
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

export function aggregateMetricValues(
	values: number[],
	aggregator: MetricAggregator,
	window: MetricWindow
): number | null {
	if (values.length === 0) return null

	switch (aggregator) {
		case 'latest':
			return values.at(-1) ?? null
		case 'avg': {
			let total = 0
			for (const value of values) total += value
			return total / values.length
		}
		case 'max': {
			let maximum = Number.NEGATIVE_INFINITY
			for (const value of values) if (value > maximum) maximum = value
			return maximum
		}
		case 'min': {
			let minimum = Number.POSITIVE_INFINITY
			for (const value of values) if (value < minimum) minimum = value
			return minimum
		}
		case 'sum': {
			let total = 0
			for (const value of values) total += value
			return total
		}
		case 'median': {
			const sorted = values.toSorted((a, b) => a - b)
			const mid = Math.floor(sorted.length / 2)
			const upper = sorted.at(mid)
			if (upper === undefined) return null
			if (sorted.length % 2 !== 0) return upper
			const lower = sorted.at(mid - 1)
			return lower === undefined ? null : (lower + upper) / 2
		}
		case 'stddev': {
			if (values.length < 2) return null
			const mean = values.reduce((a, b) => a + b, 0) / values.length
			const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
			return Math.sqrt(variance)
		}
		case 'first':
			return values.at(0) ?? null
		case 'growth': {
			let first: number | undefined
			let last: number | undefined
			let count = 0
			for (const value of values) {
				if (value === 0) continue
				if (first === undefined) first = value
				last = value
				count++
			}
			if (first === undefined || last === undefined || count < 2) return null
			return ((last - first) / first) * 100
		}
		case 'movingavg': {
			const windowSize = values.length < 7 ? values.length : resolveMovingAverageLength(window, values.length)
			let total = 0
			for (let index = values.length - windowSize; index < values.length; index++) {
				const value = values[index]
				if (value === undefined) throw new Error(`Missing metric value at index ${index}`)
				total += value
			}
			return total / windowSize
		}
		default:
			return values.at(-1) ?? null
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
	const item = subject.itemType === 'protocol' ? subject.protocol : subject.chain
	const { getChainInfo, getProtocolInfo, parentMapping, protocolBySlug, protocolCatalog, protocolSymbols } =
		useProDashboardCatalog()
	const geckoId =
		subject.geckoId ??
		(subject.itemType === 'protocol'
			? getProtocolInfo(subject.protocol)?.geckoId
			: getChainInfo(subject.chain)?.gecko_id)

	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const subjectIdentity: ChartSubject =
		subject.itemType === 'protocol'
			? { subjectType: 'protocol', protocol: subject.protocol }
			: { subjectType: 'chain', chain: subject.chain }
	const prerequisite = getChartDataPrerequisite(subjectIdentity, protocolCatalog, protocolBySlug)
	const query = useQuery({
		queryKey: getProDashboardChartSourceQueryKey({
			type,
			...(itemType === 'protocol'
				? { subjectType: 'protocol', protocol: item }
				: { subjectType: 'chain', chain: item }),
			...(geckoId === undefined ? {} : { geckoId })
		}),
		queryFn: getChartQueryFn(
			type,
			itemType,
			item,
			geckoId,
			undefined,
			parentMapping,
			undefined,
			undefined,
			authToken,
			itemType === 'protocol' ? protocolSymbols : undefined
		),
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		select: selectFiniteMetricSeries,
		enabled:
			streamDone &&
			prerequisite.status === 'ready' &&
			!!item &&
			((itemType === 'protocol' && (!isProtocolTokenChartType(type) || !!geckoId)) ||
				(itemType === 'chain' && (!isChainTokenChartType(type) || !!geckoId)))
	})
	const runtime = toChartRuntimeState(query, streamDone, prerequisite)
	const resolvedSeries = runtime.data

	const result = useMemo(() => {
		const reference = dayjs()
		const {
			current: inWindow,
			currentValues: values,
			previousValues
		} = partitionMetricWindows(resolvedSeries, window, reference)
		const value = aggregateMetricValues(values, aggregator, window)
		const previousValue = aggregateMetricValues(previousValues, aggregator, window)

		let delta: number | null = null
		let deltaPct: number | null = null
		if (compare.mode === 'previous_value') {
			if (aggregator === 'latest') {
				const curr = values.at(-1)
				const first = values.at(0)
				if (curr !== undefined && first !== undefined && values.length >= 2) {
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
		const lastUpdatedTs = inWindow.at(-1)?.[0] ?? resolvedSeries.at(-1)?.[0]

		return { value, delta, deltaPct, sparklineData, lastUpdatedTs }
	}, [resolvedSeries, window, aggregator, compare])

	return {
		...result,
		isLoading: runtime.isLoading,
		isError: runtime.hasError,
		refetch: runtime.refetch
	}
}
