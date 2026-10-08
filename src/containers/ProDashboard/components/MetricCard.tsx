import { lazy, Suspense, useMemo, useState } from 'react'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { useDarkModeManager } from '~/contexts/LocalStorage'

const SparklineChart = lazy(() =>
	import('~/components/ECharts/SparklineChart').then((m) => ({ default: m.SparklineChart }))
)
const BarSparkline = lazy(() =>
	import('~/components/ECharts/BarSparkline').then((m) => ({
		default: m.BarSparkline
	}))
)
import { useCountUp } from '../hooks/useCountUp'
import { useMetricData } from '../hooks/useMetricData'
import { useProDashboardCatalog } from '../ProDashboardAPIContext'
import type { MetricAggregator, MetricChartType, MetricConfig, MetricWindow } from '../types'
import { getProDashboardChartTypeConfig } from '../types'
import { ProBadge, ProMeta } from '../ui'
import { getItemIconUrl } from '../utils'
import { BoundParameterBadge } from './BoundParameterBadge'
import { EntityIcon } from './EntityIcon'
import { formatMetricValue, getMetricDelta, getMetricValueFormat } from './metricCardValue'
import { ProCardHeader } from './ProCardHeader'
import { ProCardError, ProCardLoading } from './ProCardStatus'

const EMPTY_CHART_SERIES: Array<[number, number]> = []
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
	const {
		value,
		delta,
		deltaPct,
		sparklineData,
		lastUpdatedTs: _lastUpdatedTs,
		isLoading,
		isError,
		isFetching,
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
		return { displayTitle, baseTitle, iconUrl, format: getMetricValueFormat(metric) }
	}, [metric, getChainInfo, getProtocolInfo])

	const [hasSeenLoading, setHasSeenLoading] = useState(isLoading)
	if (isLoading && !hasSeenLoading) setHasSeenLoading(true)
	const animatedValue = useCountUp(value, { enabled: hasSeenLoading })

	const displayValue = formatMetricValue(animatedValue, format)
	const exactValue = formatMetricValue(value, format)

	const compareFormat = metric.compare?.format ?? 'percent'

	const change = getMetricDelta(delta, deltaPct, format, compareFormat)

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
		return `${displayTitle} — ${aggregatorSummary} ${windowPhrase} is ${exactValue}.`
	})()

	const hasCustomLabel = Boolean(metric.label?.trim())

	const chartType: MetricChartType = metric.chartType

	const chartSeries = chartType === 'none' ? EMPTY_CHART_SERIES : sparklineData

	const [isDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isDark)
	const sparklineColor =
		change.direction === 'up' ? chartTheme.dataUp : change.direction === 'down' ? chartTheme.dataDown : chartTheme.brand

	const content = useMemo(() => {
		if (isLoading) {
			return <ProCardLoading variant="metric" />
		}

		if (isError) {
			return <ProCardError retry={{ refetch, isFetching }} />
		}

		return (
			<div className="flex h-full flex-1 flex-col items-start justify-center gap-2">
				<div className="flex flex-wrap items-baseline gap-2">
					<p className="mono-xl tabular-nums">{displayValue}</p>
					{change.label && metric.aggregator !== 'growth' ? (
						<ProBadge
							tone={change.direction === 'up' ? 'success' : change.direction === 'down' ? 'warning' : 'neutral'}
							{...(hasSeenLoading ? { className: 'animate-pro-rise [animation-delay:300ms]' } : {})}
						>
							{change.label}
						</ProBadge>
					) : null}
				</div>
				{chartSeries.length > 1 ? (
					<Suspense fallback={<div className="h-16 w-full" />}>
						<div className="w-full">
							{chartType === 'bar' ? (
								<BarSparkline data={chartSeries} height={64} />
							) : (
								<SparklineChart data={chartSeries} color={sparklineColor} height={64} smooth />
							)}
						</div>
					</Suspense>
				) : null}
				<p className="body-md text-pro-text-secondary">{summaryText}</p>
			</div>
		)
	}, [
		chartType,
		change.direction,
		change.label,
		displayValue,
		isError,
		isFetching,
		isLoading,
		hasSeenLoading,
		metric.aggregator,
		refetch,
		chartSeries,
		sparklineColor,
		summaryText
	])

	return (
		<div className="flex h-full min-h-[calc(140px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader
				title={displayTitle}
				icon={<EntityIcon src={iconUrl} name={displayTitle} />}
				badge={<BoundParameterBadge {...(metric.bindings === undefined ? {} : { bindings: metric.bindings })} />}
				subtitle={<ProMeta items={[hasCustomLabel ? baseTitle : null, windowBadge, aggregatorBadge]} />}
			/>
			<div className="flex h-full min-h-0 flex-1 flex-col px-3 pb-3">{content}</div>
		</div>
	)
}
