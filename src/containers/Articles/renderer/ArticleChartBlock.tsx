import { useQueries } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo, type ReactNode } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { chartColor } from '~/constants/colors'
import { getProDashboardChartSourceQueryKey } from '~/containers/ProDashboard/chartSource'
import type { TimePeriod } from '~/containers/ProDashboard/dashboardTypes'
import { buildProDashboardProtocolRelations } from '~/containers/ProDashboard/protocolCatalog'
import {
	filterDataByTimePeriod,
	getChartQueryFn,
	ProxyAuthTokenContext,
	useProtocolsAndChains
} from '~/containers/ProDashboard/queries'
import { ChartPanelBodyError, ChartPanelBodyFallback, ChartPanelBodyLoading } from '~/ui/ChartPanel'
import { formatDate } from '~/utils/dateFormat'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { mergeFailedReads, queryReadFailed } from '~/utils/query'
import { buildArticleAnnotationMarkLine } from '../articleAnnotationMarkLine'
import { getArticleEntityRoute } from '../entityLinks'
import type { ArticleChartConfig, ArticleChartEntityType, ArticleChartRange, ArticleChartSeries } from '../types'
import {
	articleChartDefaultCaption,
	articleChartLatestLabel,
	articleChartValueSymbol,
	buildArticleChartModel,
	seriesDisplayName,
	uniqueChartTypeTitles
} from './articleChartModel'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

function entityLogo(entity: { entityType: ArticleChartEntityType; slug: string }) {
	return entity.entityType === 'chain' ? chainIconUrl(entity.slug) : tokenIconUrl(entity.slug)
}

function rangeToTimePeriod(range: ArticleChartRange | undefined): TimePeriod {
	return (range ?? 'all') as TimePeriod
}

const RANGE_LABEL: Record<ArticleChartRange, string> = {
	'30d': 'Past 30 days',
	'90d': 'Past 90 days',
	'365d': 'Past year',
	all: 'All time'
}

export function ArticleChartBlock({
	config,
	index,
	captionSlot
}: {
	config: ArticleChartConfig
	index?: number
	captionSlot?: ReactNode
}) {
	const series = config.series
	const timePeriod = rangeToTimePeriod(config.range)
	const chartLabel = uniqueChartTypeTitles(series).join(' / ')

	const authToken = useContext(ProxyAuthTokenContext)
	const { data: catalog } = useProtocolsAndChains()
	const protocolRelations = useMemo(() => buildProDashboardProtocolRelations(catalog ?? null), [catalog])

	const queries = useQueries({
		queries: series.map((s) => ({
			queryKey: getProDashboardChartSourceQueryKey({
				type: s.chartType,
				...(s.entityType === 'protocol'
					? { subjectType: 'protocol', protocol: s.slug }
					: { subjectType: 'chain', chain: s.slug }),
				geckoId: s.geckoId ?? null
			}),
			queryFn: getChartQueryFn(
				s.chartType,
				s.entityType,
				s.slug,
				s.geckoId ?? null,
				undefined,
				protocolRelations,
				undefined,
				undefined,
				authToken
			),
			select: (data: Array<[number, number]>) => filterDataByTimePeriod(data, timePeriod),
			staleTime: 1000 * 60 * 5,
			gcTime: 1000 * 60 * 30,
			refetchOnWindowFocus: false
		}))
	})

	const isLoading = queries.some((q) => q.isLoading)
	// A chart with some series loaded draws those; only a chart whose every read failed shows the error.
	const allFailed = queries.length > 0 && queries.every((q) => queryReadFailed(q))
	const failedReads = mergeFailedReads(queries.map((q) => (queryReadFailed(q) ? q : null)))

	const chartModel = useMemo(
		() =>
			buildArticleChartModel(
				series,
				queries.map((q) => q.data as Array<[number, number]> | undefined)
			),
		[queries, series]
	)

	const figureLabel = typeof index === 'number' ? `Fig. ${String(index).padStart(2, '0')}` : null
	const primarySeries = series[0]
	const route = primarySeries ? getArticleEntityRoute(primarySeries.entityType, primarySeries.slug) : '/'
	const primarySymbol = articleChartValueSymbol(series)
	const latestLabel = articleChartLatestLabel(series, queries[0]?.data as Array<[number, number]> | undefined)
	const rangeLabel = RANGE_LABEL[config.range ?? 'all']
	const isMulti = series.length > 1

	const uniqueEntities = useMemo(() => {
		const seen = new Set<string>()
		const out: Array<ArticleChartSeries> = []
		for (const s of series) {
			const key = `${s.entityType}:${s.slug}`
			if (seen.has(key)) continue
			seen.add(key)
			out.push(s)
		}
		return out
	}, [series])

	const charts = useMemo(() => {
		const markLine = buildArticleAnnotationMarkLine(config.annotations ?? [])
		const [firstChart, ...remainingCharts] = chartModel.charts
		if (!markLine || !firstChart) return chartModel.charts
		return [{ ...firstChart, markLine }, ...remainingCharts]
	}, [chartModel.charts, config.annotations])

	const chartOptions = useMemo<MultiSeriesChartOptions>(
		() => ({
			xAxis: { show: true },
			yAxis: config.logScale ? { show: true, type: 'log' } : { show: true, type: 'value' }
		}),
		[config.logScale]
	)

	const titleText = useMemo(() => {
		const firstEntity = uniqueEntities[0]
		if (uniqueEntities.length === 1 && firstEntity) return firstEntity.name
		return uniqueEntities.map((s) => s.name).join(' vs ')
	}, [uniqueEntities])

	return (
		<figure className="article-chart-figure not-prose my-10 grid gap-3">
			<header className="flex items-end justify-between gap-4 border-t border-strong pt-3">
				<div className="flex min-w-0 items-center gap-3">
					{uniqueEntities.length > 1 ? (
						<span className="flex shrink-0 -space-x-2">
							{uniqueEntities.slice(0, 4).map((e) => (
								<span
									key={`${e.entityType}:${e.slug}`}
									className="relative flex size-7 items-center justify-center overflow-hidden rounded-full border border-medium bg-surface"
								>
									<img src={entityLogo(e)} alt="" className="size-full object-cover" />
								</span>
							))}
						</span>
					) : primarySeries ? (
						<span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-surface">
							<img src={entityLogo(primarySeries)} alt="" className="size-full object-cover" />
						</span>
					) : null}
					<div className="flex min-w-0 flex-col leading-tight">
						<span className="truncate title-md tracking-tight text-primary">{titleText}</span>
						<span className="label-xs tracking-[0.18em] text-tertiary uppercase">
							{chartLabel} · {rangeLabel}
						</span>
					</div>
				</div>
				<div className="flex shrink-0 items-end gap-4 text-right">
					{latestLabel ? (
						<div className="flex flex-col leading-tight">
							<span className="label-xs tracking-[0.2em] text-tertiary uppercase">Latest</span>
							<span className="mono-md-bold text-primary tabular-nums">{latestLabel}</span>
						</div>
					) : null}
					{figureLabel ? (
						<span className="hidden label-xs tracking-[0.18em] text-tertiary uppercase sm:inline">{figureLabel}</span>
					) : null}
				</div>
			</header>

			{isMulti ? (
				<div className="flex flex-wrap gap-x-4 gap-y-1.5 body-sm text-secondary">
					{series.map((s, i) => (
						<span key={`${s.entityType}:${s.slug}:${s.chartType}`} className="inline-flex items-center gap-1.5">
							<span aria-hidden className="size-2 rounded-full" style={{ background: chartColor(i) }} />
							<span className="text-primary">{seriesDisplayName(s)}</span>
						</span>
					))}
				</div>
			) : null}

			<div className="article-chart-body relative">
				<div className="h-[380px] w-full">
					{allFailed ? (
						<ChartPanelBodyError retry={failedReads}>Couldn&apos;t load this chart.</ChartPanelBodyError>
					) : isLoading ? (
						<ChartPanelBodyLoading className="h-full" />
					) : chartModel.charts.length === 0 ? (
						<ChartPanelBodyFallback role="status" aria-live="polite" className="h-full body-sm text-tertiary">
							No data available
						</ChartPanelBodyFallback>
					) : (
						<Suspense fallback={<ChartPanelBodyLoading className="h-full" />}>
							<MultiSeriesChart
								dataset={chartModel.dataset}
								charts={charts}
								valueSymbol={primarySymbol}
								groupBy="daily"
								showLegend
								exportButtons="hidden"
								hideDataZoom
								height="380px"
								chartOptions={chartOptions}
							/>
						</Suspense>
					)}
				</div>
			</div>

			<figcaption className="flex flex-wrap items-baseline justify-between gap-3 border-t border-medium pt-2 body-md text-secondary">
				<div className="min-w-0 flex-1">
					{figureLabel ? <span className="mr-1.5 font-semibold text-primary">{figureLabel}.</span> : null}
					{captionSlot !== undefined ? (
						captionSlot
					) : (
						<span>
							{config.caption ||
								articleChartDefaultCaption(
									series,
									uniqueEntities.map((e) => e.name)
								)}
						</span>
					)}
					{config.logScale ? (
						<span className="ml-2 rounded-sm border border-medium px-1.5 py-px label-xs tracking-wider text-tertiary uppercase">
							log scale
						</span>
					) : null}
				</div>
				<div className="shrink-0 label-xs tracking-[0.18em] text-tertiary uppercase">
					Source ·{' '}
					<a href={route} target="_blank" rel="noreferrer noopener" className="text-tertiary hover:text-link">
						DefiLlama
					</a>
				</div>
			</figcaption>

			{config.annotations && config.annotations.length > 0 ? (
				<ol className="grid gap-1 border-t border-dashed border-medium pt-2 body-sm text-secondary">
					{config.annotations.map((a, i) => (
						// oxlint-disable-next-line react/no-array-index-key -- Lettered annotation legend slots may share dates and labels.
						<li key={`${a.date}-${i}`} className="flex gap-2">
							<span className="mono-sm-bold text-tertiary">{String.fromCharCode(65 + i)}</span>
							<span className="mono-sm text-tertiary">{formatDate(a.date)}</span>
							<span className="text-secondary">{a.label}</span>
						</li>
					))}
				</ol>
			) : null}
		</figure>
	)
}
