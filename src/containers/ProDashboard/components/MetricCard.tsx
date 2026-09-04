import { lazy, Suspense, useMemo } from 'react'

const SparklineChart = lazy(() =>
	import('~/components/ECharts/SparklineChart').then((m) => ({ default: m.SparklineChart }))
)
const BarSparkline = lazy(() => import('~/components/ECharts/BarSparkline').then((m) => ({ default: m.BarSparkline })))
import { Icon } from '~/ui/Icon'
import { formatUsd, formatCompactNumber, formatNumber, formatPercent } from '~/utils/numberFormat'
import { useMetricData } from '../hooks/useMetricData'
import { useProDashboardCatalog, useProDashboardPermissions } from '../ProDashboardAPIContext'
import type { MetricAggregator, MetricChartType, MetricConfig, MetricWindow } from '../types'
import { getProDashboardChartTypeConfig } from '../types'
import { getItemIconUrl } from '../utils'

const EMPTY_CHART_SERIES: [number, number][] = []
const VOLUME_METRIC_TYPES = new Set([
	'volume',
	'perps',
	'aggregators',
	'perpsAggregators',
	'bridgeAggregators',
	'tokenVolume',
	'optionsPremium',
	'optionsNotional'
])

const WINDOW_BADGE_LABELS: Record<MetricWindow, string> = {
	'7d': 'Last 7d',
	'30d': 'Last 30d',
	'90d': 'Last 90d',
	'365d': 'Last 365d',
	ytd: 'Year to date',
	'3y': 'Last 3y',
	all: 'All time'
}

const WINDOW_PHRASES: Record<MetricWindow, string> = {
	'7d': 'over the last 7 days',
	'30d': 'over the last 30 days',
	'90d': 'over the last 90 days',
	'365d': 'over the last 365 days',
	ytd: 'for the year to date',
	'3y': 'over the last 3 years',
	all: 'across all time'
}

const AGGREGATOR_BADGE: Record<MetricAggregator, string> = {
	latest: 'Latest',
	avg: 'Average',
	max: 'Peak',
	min: 'Low',
	sum: 'Total',
	median: 'Median',
	stddev: 'Std Dev',
	first: 'First',
	growth: 'Growth',
	movingavg: 'Moving Avg'
}

const AGGREGATOR_SUMMARY_LABELS: Record<MetricAggregator, string> = {
	latest: 'latest value',
	avg: 'average',
	max: 'highest value',
	min: 'lowest value',
	sum: 'total',
	median: 'median',
	stddev: 'standard deviation',
	first: 'first value',
	growth: 'growth',
	movingavg: 'moving average'
}

const toSentenceCase = (phrase: string) => {
	if (!phrase) return ''
	return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

interface MetricCardProps {
	metric: MetricConfig
}

export function MetricCard({ metric }: MetricCardProps) {
	const { getChainInfo, getProtocolInfo } = useProDashboardCatalog()
	const { isReadOnly } = useProDashboardPermissions()
	const {
		value,
		delta,
		deltaPct,
		sparklineData,
		lastUpdatedTs: _lastUpdatedTs,
		isLoading,
		isError,
		refetch
	} = useMetricData(metric)

	const { displayTitle, baseTitle, iconUrl, format } = useMemo(() => {
		const subject = metric.subject
		let name = ''
		let iconUrl: string | undefined
		if (subject.itemType === 'protocol') {
			const info = getProtocolInfo(subject.protocol)
			name = info?.name || subject.protocol
			iconUrl = getItemIconUrl('protocol', info, subject.protocol)
		} else {
			const info = getChainInfo(subject.chain)
			name = subject.chain
			iconUrl = getItemIconUrl('chain', info, subject.chain)
		}
		const typeConfig = getProDashboardChartTypeConfig(metric.type)
		const typeLabel = typeConfig?.title || metric.type
		const baseTitle = name ? `${name} ${typeLabel}` : typeLabel
		const label = metric.label?.trim()
		const displayTitle = label && label.length > 0 ? label : baseTitle

		let auto: 'currency' | 'number' | 'percent' = ['medianApy'].includes(metric.type)
			? 'percent'
			: ['activeUsers', 'newUsers', 'txs'].includes(metric.type)
				? 'number'
				: 'currency'

		if (metric.aggregator === 'growth') {
			auto = 'percent'
		}

		const fmt = metric.format?.value && metric.format.value !== 'auto' ? metric.format.value : auto
		return { displayTitle, baseTitle, iconUrl, format: fmt }
	}, [metric, getChainInfo, getProtocolInfo])

	const displayValue = (() => {
		if (value == null) return '-'
		if (format === 'currency')
			return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		if (format === 'number')
			return formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		return `${formatPercent(value, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
	})()

	const compareFormat = metric.compare?.format ?? 'percent'

	const deltaText = (() => {
		if (delta == null && deltaPct == null) return null
		if (compareFormat === 'absolute') {
			if (delta == null) return null
			if (format === 'percent') {
				if (Math.abs(delta) < 0.005) return null
			} else if (Math.abs(delta) < 1e-12) {
				return null
			}
			const v =
				format === 'currency'
					? formatUsd(delta, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: format === 'percent'
						? `${formatNumber(delta)}pp`
						: formatCompactNumber(delta, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
			return v
		}
		if (deltaPct == null) return null
		if (Math.abs(deltaPct) < 0.005) return null
		const sign = deltaPct > 0 ? '+' : ''
		return `${sign}${formatPercent(deltaPct, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
	})()

	const deltaPositive = (delta ?? deltaPct ?? 0) > 0
	const deltaNegative = (delta ?? deltaPct ?? 0) < 0

	const windowBadge = WINDOW_BADGE_LABELS[metric.window]
	const windowPhrase = WINDOW_PHRASES[metric.window]
	const aggregatorBadge = AGGREGATOR_BADGE[metric.aggregator]

	const isVolumeMetric = VOLUME_METRIC_TYPES.has(metric.type)

	const summaryText = (() => {
		const base = AGGREGATOR_SUMMARY_LABELS[metric.aggregator] ?? aggregatorBadge.toLowerCase()
		const contextAware = isVolumeMetric ? base.replace('value', 'volume') : base
		const aggregatorSummary = toSentenceCase(contextAware)
		if (value == null) {
			return `${displayTitle} ${windowPhrase} (${aggregatorBadge}) has no data available yet.`
		}
		return `${displayTitle} — ${aggregatorSummary} ${windowPhrase} is ${displayValue}.`
	})()

	const hasCustomLabel = Boolean(metric.label?.trim())

	const chartType: MetricChartType = metric.chartType

	const chartSeries = chartType === 'none' ? EMPTY_CHART_SERIES : sparklineData

	const sparklineColor = deltaPositive ? 'var(--success)' : deltaNegative ? 'var(--error)' : 'var(--bg-brand)'

	const content = useMemo(() => {
		if (isLoading) {
			return (
				<div className="flex flex-1 items-center justify-center">
					<div className="size-6 animate-spin rounded-full border-b-2 border-brand" />
				</div>
			)
		}

		if (isError) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-1 text-pro-text-form">
					<Icon name="alert-triangle" height={18} width={18} />
					<span className="text-sm">Error</span>
					<button type="button" className="text-sm text-link hover:underline" onClick={refetch}>
						Try again
					</button>
				</div>
			)
		}

		return (
			<div className="flex h-full flex-1 flex-col items-center justify-center gap-3 text-center">
				<p className="text-4xl leading-tight font-semibold">{displayValue}</p>
				{chartSeries.length > 1 ? (
					<Suspense fallback={<div className="h-16 w-full max-w-[280px]" />}>
						<div className="w-full max-w-[280px]">
							{chartType === 'bar' ? (
								<BarSparkline data={chartSeries} height={64} />
							) : (
								<SparklineChart data={chartSeries} color={sparklineColor} height={64} smooth />
							)}
						</div>
					</Suspense>
				) : null}
				{deltaText && metric.aggregator !== 'growth' ? (
					<p
						className={`text-xs font-semibold tracking-wide uppercase ${
							deltaPositive ? 'text-success' : deltaNegative ? 'text-error' : 'text-pro-text-form'
						}`}
					>
						{deltaText}
					</p>
				) : null}
				<p className="max-w-[420px] text-sm text-pro-text-secondary">{summaryText}</p>
			</div>
		)
	}, [
		chartType,
		deltaNegative,
		deltaPositive,
		deltaText,
		displayValue,
		isError,
		isLoading,
		metric.aggregator,
		refetch,
		chartSeries,
		sparklineColor,
		summaryText
	])

	return (
		<div className="flex h-full min-h-[240px] flex-col gap-3 p-3">
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-center gap-1">
					{iconUrl ? (
						<img src={iconUrl} alt={displayTitle} width={20} height={20} className="size-5 shrink-0 rounded-full" />
					) : (
						<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-secondary">
							{displayTitle?.charAt(0)?.toUpperCase()}
						</div>
					)}
					<div className="flex flex-col">
						<h2 className="text-base leading-tight font-semibold text-pro-text-primary">{displayTitle}</h2>
						{hasCustomLabel ? <p className="text-[11px] leading-tight text-pro-text-tertiary">{baseTitle}</p> : null}
					</div>
				</div>
				{!isReadOnly ? (
					<div className="text-[11px] tracking-wide text-pro-text-form">
						{windowBadge} · {aggregatorBadge}
					</div>
				) : null}
			</div>

			<div className="flex h-full flex-1 items-center justify-center pt-4">{content}</div>
		</div>
	)
}
