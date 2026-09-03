import * as Ariakit from '@ariakit/react'
import { useQueries } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo, useState } from 'react'
import { buildSparseCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { createCappedRemainderTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { useAppMetadata } from '~/containers/ProDashboard/AppMetadataContext'
import { getProDashboardChartSourceQueryKey } from '~/containers/ProDashboard/chartSource'
import { ChartTypePills } from '~/containers/ProDashboard/components/AddChartModal/ChartTypePills'
import type { TimePeriod } from '~/containers/ProDashboard/dashboardTypes'
import { buildProDashboardParentMapping } from '~/containers/ProDashboard/protocolCatalog'
import {
	filterDataByTimePeriod,
	getChartQueryFn,
	ProxyAuthTokenContext,
	useProtocolsAndChains
} from '~/containers/ProDashboard/queries'
import { CHAIN_CHART_TYPES, CHART_TYPES, PROTOCOL_CHART_TYPES } from '~/containers/ProDashboard/types'
import { Icon } from '~/ui/Icon'
import { tokenIconUrl, chainIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { buildArticleAnnotationMarkLine } from '../articleAnnotationMarkLine'
import { validateArticleChartConfig } from '../chartAdapters'
import type {
	ArticleChartAnnotation,
	ArticleChartConfig,
	ArticleChartEntityType,
	ArticleChartRange,
	ArticleChartSeries
} from '../types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const SERIES_COLORS = ['#3e6dcc', '#e07b39', '#16a34a', '#a855f7']
const ARTICLE_TOOLTIP_FORMATTER = createCappedRemainderTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
const MAX_SERIES = 4
const MAX_ANNOTATIONS = 5

const RANGES: Array<{ value: ArticleChartRange; label: string }> = [
	{ value: '30d', label: '30D' },
	{ value: '90d', label: '90D' },
	{ value: '365d', label: '1Y' },
	{ value: 'all', label: 'All' }
]

type Entity = {
	entityType: ArticleChartEntityType
	slug: string
	name: string
	logo?: string
	tvl?: number
	geckoId?: string | null
}

function ChartTypeSelect({
	value,
	options,
	onChange
}: {
	value: string
	options: string[]
	onChange: (next: string) => void
}) {
	const labelFor = (key: string) => CHART_TYPES[key as keyof typeof CHART_TYPES]?.title || key
	return (
		<Ariakit.SelectProvider value={value} setValue={(v) => onChange(typeof v === 'string' ? v : v[0])}>
			<Ariakit.Select
				className="flex h-7 w-44 items-center justify-between gap-2 rounded-md border border-medium bg-surface px-2.5 text-xs text-primary transition-colors hover:border-tertiary focus-visible:border-link focus-visible:outline-hidden data-[state=open]:border-link"
				aria-label="Chart type"
			>
				<span className="truncate text-left">{labelFor(value)}</span>
				<Ariakit.SelectArrow className="shrink-0 text-tertiary" />
			</Ariakit.Select>
			<Ariakit.SelectPopover
				gutter={4}
				sameWidth
				portal
				unmountOnHide
				className="z-[90] flex max-h-72 flex-col overflow-auto rounded-md border border-medium bg-surface py-1 text-xs shadow-lg outline-hidden"
			>
				{options.map((option) => (
					<Ariakit.SelectItem
						key={option}
						value={option}
						className="flex shrink-0 cursor-pointer items-center justify-between gap-3 px-2.5 py-1.5 text-secondary hover:bg-research-tint-hover hover:text-primary data-active-item:bg-research-tint-hover data-active-item:text-primary"
					>
						<span className="truncate">{labelFor(option)}</span>
						<Ariakit.SelectItemCheck className="shrink-0 text-link" />
					</Ariakit.SelectItem>
				))}
			</Ariakit.SelectPopover>
		</Ariakit.SelectProvider>
	)
}

type Props = {
	store: Ariakit.DialogStore
	onInsert: (config: ArticleChartConfig) => void
	initialConfig?: ArticleChartConfig | null
}

function entityLogo(entity: { entityType: ArticleChartEntityType; slug: string; logo?: string }) {
	if (entity.logo) return entity.logo
	if (entity.entityType === 'chain') return chainIconUrl(entity.slug)
	return tokenIconUrl(entity.slug)
}

function MultiPreview({
	series,
	range,
	logScale,
	annotations,
	height
}: {
	series: ArticleChartSeries[]
	range: ArticleChartRange
	logScale: boolean
	annotations: ArticleChartAnnotation[]
	height: number
}) {
	const authToken = useContext(ProxyAuthTokenContext)
	const { data: catalog } = useProtocolsAndChains()
	const parentMapping = useMemo(() => buildProDashboardParentMapping(catalog?.protocols ?? []), [catalog])
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
				parentMapping,
				undefined,
				undefined,
				authToken
			),
			select: (data: [number, number][]) => filterDataByTimePeriod(data, range as TimePeriod),
			staleTime: 1000 * 60 * 5,
			gcTime: 1000 * 60 * 30,
			refetchOnWindowFocus: false
		}))
	})

	const isLoading = queries.some((q) => q.isLoading)
	const isError = queries.length > 0 && queries.every((q) => q.isError)

	const chartModel = useMemo(() => {
		const chartSeries = series
			.map((s, i) => {
				const data = queries[i]?.data as [number, number][] | undefined
				if (!data || data.length === 0) return null
				const meta = CHART_TYPES[s.chartType as keyof typeof CHART_TYPES]
				const type: 'line' | 'bar' = meta?.chartType === 'bar' ? 'bar' : 'line'
				return {
					name: `${s.name} · ${meta?.title || s.chartType}`,
					type,
					color: SERIES_COLORS[i % SERIES_COLORS.length]!,
					data,
					// Each API series owns its calendar; connect across union rows belonging only to sibling series.
					...(type === 'line' ? { connectNulls: true } : {}),
					...(meta?.chartType === 'area' && series.length === 1 ? { areaStyle: {} } : {})
				}
			})
			.filter(<T,>(v: T | null): v is T => v !== null)
		return buildSparseCartesianChartModel(chartSeries)
	}, [queries, series])
	const charts = useMemo(() => {
		const markLine = buildArticleAnnotationMarkLine(annotations)
		const [firstChart, ...remainingCharts] = chartModel.charts
		if (!markLine || !firstChart) return chartModel.charts
		return [{ ...firstChart, markLine }, ...remainingCharts]
	}, [annotations, chartModel.charts])

	const chartOptions = useMemo<MultiSeriesChartOptions>(
		() => ({
			tooltip: { formatter: ARTICLE_TOOLTIP_FORMATTER },
			xAxis: { show: true },
			yAxis: logScale ? { show: true, type: 'log' } : { show: true, type: 'value' }
		}),
		[logScale]
	)

	const heightPx = `${height}px`

	if (isLoading) {
		return (
			<div className="flex items-center justify-center text-xs text-tertiary" style={{ height: heightPx }}>
				Loading chart…
			</div>
		)
	}
	if (isError || chartModel.charts.length === 0) {
		return (
			<div className="flex items-center justify-center text-xs text-tertiary" style={{ height: heightPx }}>
				No data available
			</div>
		)
	}
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center text-xs text-tertiary" style={{ height: heightPx }}>
					…
				</div>
			}
		>
			<MultiSeriesChart
				dataset={chartModel.dataset}
				charts={charts}
				valueSymbol="$"
				groupBy="daily"
				hideDefaultLegend={false}
				exportButtons="hidden"
				hideDataZoom
				height={heightPx}
				chartOptions={chartOptions}
			/>
		</Suspense>
	)
}

function seriesId(s: ArticleChartSeries) {
	return `${s.entityType}:${s.slug}:${s.chartType}`
}

const DEFAULT_METRIC = 'tvl'

export function ArticleChartPickerDialog({ store, onInsert, initialConfig }: Props) {
	const normalizedInitialConfig = useMemo(() => validateArticleChartConfig(initialConfig), [initialConfig])
	const initialSeries = normalizedInitialConfig?.series ?? []
	const initialFirstSeries = initialSeries[0]
	const initialLastProtocol = [...initialSeries].reverse().find((s) => s.entityType === 'protocol')
	const initialLastChain = [...initialSeries].reverse().find((s) => s.entityType === 'chain')
	const [tab, setTab] = useState<ArticleChartEntityType>(initialFirstSeries?.entityType ?? 'protocol')
	const [query, setQuery] = useState('')
	const [series, setSeries] = useState<ArticleChartSeries[]>(() => initialSeries.map((s) => ({ ...s })))
	const [caption, setCaption] = useState(normalizedInitialConfig?.caption ?? '')
	const [range, setRange] = useState<ArticleChartRange>(normalizedInitialConfig?.range ?? 'all')
	const [logScale, setLogScale] = useState(normalizedInitialConfig?.logScale ?? false)
	const [annotations, setAnnotations] = useState<ArticleChartAnnotation[]>(normalizedInitialConfig?.annotations ?? [])
	const [protocolMetric, setProtocolMetric] = useState<string>(initialLastProtocol?.chartType ?? DEFAULT_METRIC)
	const [chainMetric, setChainMetric] = useState<string>(initialLastChain?.chartType ?? DEFAULT_METRIC)
	const { data: catalog, isLoading: catalogLoading } = useProtocolsAndChains()
	const { availableProtocolChartTypes, availableChainChartTypes, loading: metaLoading } = useAppMetadata()

	const currentMetric = tab === 'protocol' ? protocolMetric : chainMetric
	const setCurrentMetric = (next: string) => {
		if (tab === 'protocol') setProtocolMetric(next)
		else setChainMetric(next)
	}

	const entities = useMemo<Entity[]>(() => {
		if (!catalog) return []
		if (tab === 'protocol') {
			return (catalog.protocols || [])
				.filter((protocol) => protocol.slug)
				.map<Entity>((protocol) => ({
					entityType: 'protocol',
					slug: protocol.slug,
					name: protocol.name,
					...(protocol.logo === undefined ? {} : { logo: protocol.logo }),
					tvl: protocol.tvl,
					geckoId: protocol.geckoId ?? null
				}))
		}
		return (catalog.chains || []).map<Entity>((chain) => ({
			entityType: 'chain',
			slug: chain.name,
			name: chain.name,
			tvl: chain.tvl,
			geckoId: chain.gecko_id ?? null
		}))
	}, [catalog, tab])

	const availableTypesForEntity = (entityType: ArticleChartEntityType, slug: string, geckoId?: string | null) => {
		const order = entityType === 'protocol' ? PROTOCOL_CHART_TYPES : CHAIN_CHART_TYPES
		const fn = entityType === 'protocol' ? availableProtocolChartTypes : availableChainChartTypes
		const allowed: ReadonlySet<string> = new Set(fn(slug, { hasGeckoId: !!geckoId }))
		return order.filter((t) => allowed.has(t))
	}

	const filteredEntities = useMemo(() => {
		const q = query.trim().toLowerCase()
		const fn = tab === 'protocol' ? availableProtocolChartTypes : availableChainChartTypes
		const supportsCurrent = (e: Entity) => {
			const allowed: ReadonlySet<string> = new Set(fn(e.slug, { hasGeckoId: !!e.geckoId }))
			return allowed.has(currentMetric)
		}
		const list = entities.filter(supportsCurrent)
		const searched = q ? list.filter((e) => e.name.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q)) : list
		return searched.slice(0, 200)
	}, [entities, query, tab, currentMetric, availableProtocolChartTypes, availableChainChartTypes])

	const chartTypeOptions = useMemo(() => {
		const order = tab === 'protocol' ? PROTOCOL_CHART_TYPES : CHAIN_CHART_TYPES
		return order.map((value) => ({
			value,
			label: CHART_TYPES[value as keyof typeof CHART_TYPES]?.title || value,
			available: true
		}))
	}, [tab])

	const toggleEntity = (entity: Entity) => {
		const candidate: ArticleChartSeries = {
			entityType: entity.entityType,
			slug: entity.slug,
			name: entity.name,
			...(entity.geckoId ? { geckoId: entity.geckoId } : {}),
			chartType: currentMetric
		}
		const id = seriesId(candidate)
		setSeries((prev) => {
			if (prev.some((s) => seriesId(s) === id)) {
				return prev.filter((s) => seriesId(s) !== id)
			}
			if (prev.length >= MAX_SERIES) return prev
			return [...prev, candidate]
		})
	}

	const removeSeries = (id: string) => {
		setSeries((prev) => prev.filter((s) => seriesId(s) !== id))
	}

	const updateSeriesChartType = (id: string, chartType: string) => {
		setSeries((prev) => {
			const next = prev.map((s) => (seriesId(s) === id ? { ...s, chartType } : s))
			const seenIds = new Set<string>()
			return next.filter((s) => {
				const sid = seriesId(s)
				if (seenIds.has(sid)) return false
				seenIds.add(sid)
				return true
			})
		})
	}

	const canInsert = series.length > 0
	const handleInsert = () => {
		if (!canInsert) return
		const seenIds = new Set<string>()
		const dedupedSeries = series.filter((s) => {
			const id = seriesId(s)
			if (seenIds.has(id)) return false
			seenIds.add(id)
			return true
		})
		const seenEntities = new Set<string>()
		const entitiesLegacy = dedupedSeries
			.map((s) => ({
				entityType: s.entityType,
				slug: s.slug,
				name: s.name,
				...(s.geckoId ? { geckoId: s.geckoId } : {})
			}))
			.filter((e) => {
				const key = `${e.entityType}:${e.slug}`
				if (seenEntities.has(key)) return false
				seenEntities.add(key)
				return true
			})
		const counts = new Map<string, number>()
		for (const s of dedupedSeries) counts.set(s.chartType, (counts.get(s.chartType) ?? 0) + 1)
		const firstSeries = dedupedSeries[0]
		if (!firstSeries) return
		let chartTypeLegacy = firstSeries.chartType
		let bestCount = 0
		for (const [type, count] of counts) {
			if (count > bestCount) {
				chartTypeLegacy = type
				bestCount = count
			}
		}
		onInsert({
			series: dedupedSeries,
			entities: entitiesLegacy,
			chartType: chartTypeLegacy,
			...(range !== 'all' ? { range } : {}),
			...(logScale ? { logScale: true } : {}),
			...(annotations.length > 0 ? { annotations } : {}),
			...(caption.trim() ? { caption: caption.trim() } : {})
		})
		store.hide()
	}

	const updateAnnotation = (index: number, patch: Partial<ArticleChartAnnotation>) => {
		setAnnotations((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
	}
	const addAnnotation = () => {
		if (annotations.length >= MAX_ANNOTATIONS) return
		setAnnotations((prev) => [...prev, { date: new Date().toISOString().slice(0, 10), label: '' }])
	}
	const removeAnnotation = (index: number) => {
		setAnnotations((prev) => prev.filter((_, i) => i !== index))
	}

	const selectedIds = useMemo(() => new Set(series.map(seriesId)), [series])

	return (
		<Ariakit.Dialog
			store={store}
			modal
			backdrop={<div className="fixed inset-0 z-[80] bg-research-backdrop backdrop-blur-sm" />}
			className="fixed top-1/2 left-1/2 z-[81] flex max-h-[92vh] w-[min(1180px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-medium bg-surface shadow-article-dialog outline-hidden"
		>
			<div className="flex flex-wrap items-center gap-3 border-b border-medium px-5 py-3">
				<Ariakit.DialogHeading className="mr-2 text-sm font-semibold tracking-tight text-primary">
					Embed a DefiLlama chart
				</Ariakit.DialogHeading>
				<div role="tablist" className="flex items-center rounded-md border border-medium bg-page p-0.5 text-xs">
					{(['protocol', 'chain'] as const).map((value) => {
						const active = tab === value
						return (
							<button
								key={value}
								role="tab"
								aria-selected={active}
								type="button"
								onClick={() => {
									setTab(value)
									setQuery('')
								}}
								className={`rounded-sm px-3 py-1 font-medium transition-colors ${
									active ? 'bg-surface text-primary shadow-sm' : 'text-tertiary hover:text-primary'
								}`}
							>
								{value === 'protocol' ? 'Protocols' : 'Chains'}
							</button>
						)
					})}
				</div>
				{series.length > 0 ? (
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">
						{series.length} / {MAX_SERIES} series
					</span>
				) : null}
				<div className="ml-auto">
					<Ariakit.DialogDismiss className="rounded-md border border-transparent px-2 py-1 text-xs text-tertiary hover:border-medium hover:text-primary">
						Close
					</Ariakit.DialogDismiss>
				</div>
			</div>

			<div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_1fr]">
				<aside className="flex min-h-0 flex-col border-medium bg-page/40 md:border-r">
					<div className="grid gap-2 px-3 pt-3 pb-2">
						<div>
							<span className="mb-1 block text-[10px] font-medium tracking-wide text-tertiary uppercase">
								Metric to add
							</span>
							<ChartTypePills
								chartTypes={chartTypeOptions}
								selectedType={currentMetric}
								onSelect={setCurrentMetric}
								isLoading={metaLoading}
								mode={tab}
							/>
						</div>
						<div className="relative">
							<Icon
								name="search"
								aria-hidden
								className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tertiary"
							/>
							<input
								autoFocus
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={tab === 'protocol' ? 'Search protocols' : 'Search chains'}
								className="w-full rounded-md border border-medium bg-surface py-1.5 pr-2 pl-8 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
							/>
						</div>
					</div>
					<ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
						{catalogLoading ? (
							<li className="px-3 py-8 text-center text-xs text-tertiary">Loading…</li>
						) : filteredEntities.length === 0 ? (
							<li className="px-3 py-8 text-center text-xs text-tertiary">No results</li>
						) : (
							filteredEntities.map((entity) => {
								const candidateId = `${entity.entityType}:${entity.slug}:${currentMetric}`
								const checked = selectedIds.has(candidateId)
								const tvl = entity.tvl != null && entity.tvl > 0 ? formatUsd(entity.tvl, { compact: true }) : null
								const limitReached = !checked && series.length >= MAX_SERIES
								return (
									<li key={`${entity.entityType}:${entity.slug}`}>
										<button
											type="button"
											onClick={() => toggleEntity(entity)}
											disabled={limitReached}
											aria-pressed={checked}
											className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
												checked ? 'bg-research-tint text-link' : 'text-primary hover:bg-research-tint-hover'
											}`}
										>
											<span
												className={`flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${
													checked ? 'border-link bg-link' : 'border-medium bg-surface group-hover:border-tertiary'
												}`}
											>
												{checked ? <Icon name="check" className="size-2.5 text-on-brand" /> : null}
											</span>
											<span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-surface">
												<img src={entityLogo(entity)} alt="" className="size-full object-cover" />
											</span>
											<span className="min-w-0 flex-1 truncate text-sm">{entity.name}</span>
											{tvl ? <span className="shrink-0 text-[11px] text-tertiary tabular-nums">{tvl}</span> : null}
										</button>
									</li>
								)
							})
						)}
					</ul>
				</aside>

				<section className="flex min-h-0 flex-col overflow-y-auto">
					{series.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-16 text-center">
							<div className="text-sm font-medium text-primary">Pick up to {MAX_SERIES} series</div>
							<p className="max-w-sm text-xs leading-relaxed text-tertiary">
								Choose a metric from the left, then tick any protocols or chains to add them as series. Switch metric or
								tab to mix different metrics and entity types on a single chart.
							</p>
						</div>
					) : (
						<>
							<div className="grid gap-2 px-5 pt-4 pb-3">
								<span className="text-[10px] font-medium tracking-wide text-tertiary uppercase">Series</span>
								<ul className="grid gap-1.5">
									{series.map((s, i) => {
										const id = seriesId(s)
										const types = availableTypesForEntity(s.entityType, s.slug, s.geckoId)
										return (
											<li
												key={id}
												className="grid grid-cols-[12px_1fr_auto_24px] items-center gap-2 rounded-md border border-medium bg-page px-2.5 py-1.5"
											>
												<span
													aria-hidden
													className="size-2 rounded-full"
													style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
												/>
												<span className="flex min-w-0 items-center gap-2">
													<span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-surface">
														<img src={entityLogo(s)} alt="" className="size-full object-cover" />
													</span>
													<span className="truncate text-xs font-medium text-primary">{s.name}</span>
													<span className="font-jetbrains text-[9px] tracking-[0.16em] text-tertiary uppercase">
														{s.entityType}
													</span>
												</span>
												<ChartTypeSelect
													value={s.chartType}
													options={types}
													onChange={(next) => updateSeriesChartType(id, next)}
												/>
												<button
													type="button"
													onClick={() => removeSeries(id)}
													aria-label={`Remove ${s.name}`}
													className="flex size-6 items-center justify-center rounded-sm text-tertiary hover:bg-research-tint-hover hover:text-primary"
												>
													×
												</button>
											</li>
										)
									})}
								</ul>
								{metaLoading ? <div className="text-[11px] text-tertiary">Loading available chart types…</div> : null}
							</div>

							<div className="flex flex-wrap items-center gap-3 px-5 pb-3">
								<div className="grid gap-1.5">
									<span className="text-[10px] font-medium tracking-wide text-tertiary uppercase">Range</span>
									<div className="flex items-center rounded-md border border-medium bg-page p-0.5 text-xs">
										{RANGES.map((r) => {
											const active = range === r.value
											return (
												<button
													key={r.value}
													type="button"
													onClick={() => setRange(r.value)}
													className={`rounded-sm px-2.5 py-1 font-medium transition-colors ${
														active ? 'bg-surface text-primary shadow-sm' : 'text-tertiary hover:text-primary'
													}`}
												>
													{r.label}
												</button>
											)
										})}
									</div>
								</div>
								<div className="grid gap-1.5">
									<span className="text-[10px] font-medium tracking-wide text-tertiary uppercase">Y-axis</span>
									<div
										role="radiogroup"
										aria-label="Y-axis scale"
										className="flex items-center rounded-md border border-medium bg-page p-0.5 text-xs"
									>
										{[
											{ value: false, label: 'Linear' },
											{ value: true, label: 'Log' }
										].map((opt) => {
											const active = logScale === opt.value
											return (
												<button
													key={String(opt.value)}
													type="button"
													role="radio"
													aria-checked={active}
													onClick={() => setLogScale(opt.value)}
													className={`rounded-sm px-2.5 py-1 font-medium transition-colors ${
														active ? 'bg-surface text-primary shadow-sm' : 'text-tertiary hover:text-primary'
													}`}
												>
													{opt.label}
												</button>
											)
										})}
									</div>
								</div>
							</div>

							<div className="relative min-h-0 flex-1 border-t border-medium bg-page">
								<div className="pointer-events-none absolute top-3 left-5 z-10 flex items-center gap-2">
									<span className="rounded-full border border-medium bg-surface/80 px-2 py-0.5 text-[10px] font-medium tracking-wide text-tertiary uppercase backdrop-blur">
										Preview
									</span>
								</div>
								<div className="px-3 pt-2 pb-3">
									<MultiPreview
										series={series}
										range={range}
										logScale={logScale}
										annotations={annotations}
										height={300}
									/>
								</div>
							</div>

							<div className="grid gap-2 border-t border-medium px-5 py-3">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-medium tracking-wide text-tertiary uppercase">Annotations</span>
									<button
										type="button"
										onClick={addAnnotation}
										disabled={annotations.length >= MAX_ANNOTATIONS}
										className="rounded-sm border border-medium px-2 py-0.5 text-[11px] text-secondary transition-colors hover:bg-research-tint-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
									>
										+ Add
									</button>
								</div>
								{annotations.length === 0 ? (
									<p className="text-[11px] text-tertiary">
										Mark a date on the chart with a short label (e.g. "V3 launch", "depeg event").
									</p>
								) : (
									<ul className="grid gap-1.5">
										{annotations.map((annotation, i) => (
											<li
												key={i}
												className="grid grid-cols-[16px_120px_1fr_24px] items-center gap-2 rounded-md border border-medium bg-page px-2 py-1.5"
											>
												<span className="font-jetbrains text-[10px] font-semibold text-tertiary">
													{String.fromCharCode(65 + i)}
												</span>
												<input
													type="date"
													value={annotation.date.slice(0, 10)}
													onChange={(e) => updateAnnotation(i, { date: e.target.value })}
													className="rounded-sm border border-medium bg-surface px-2 py-1 text-xs text-primary focus:border-link focus:outline-hidden"
												/>
												<input
													value={annotation.label}
													onChange={(e) => updateAnnotation(i, { label: e.target.value })}
													placeholder="Label"
													className="rounded-sm border border-medium bg-surface px-2 py-1 text-xs text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
												/>
												<button
													type="button"
													onClick={() => removeAnnotation(i)}
													aria-label="Remove annotation"
													className="flex size-6 items-center justify-center rounded-sm text-tertiary hover:bg-research-tint-hover hover:text-primary"
												>
													×
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						</>
					)}
				</section>
			</div>

			<div className="grid items-end gap-3 border-t border-medium bg-surface px-5 py-3 md:grid-cols-[1fr_auto]">
				<label className="grid gap-1">
					<span className="text-[10px] font-medium tracking-wide text-tertiary uppercase">Caption (optional)</span>
					<input
						value={caption}
						onChange={(event) => setCaption(event.target.value)}
						placeholder="Add a one-line caption shown under the chart…"
						disabled={!canInsert}
						className="w-full rounded-md border border-medium bg-page px-3 py-1.5 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden disabled:opacity-60"
					/>
				</label>
				<div className="flex items-center justify-end gap-2">
					<Ariakit.DialogDismiss className="rounded-md border border-medium px-3 py-2 text-xs text-secondary hover:bg-research-tint-hover">
						Cancel
					</Ariakit.DialogDismiss>
					<button
						type="button"
						disabled={!canInsert}
						onClick={handleInsert}
						className="rounded-md bg-link px-4 py-2 text-xs font-medium text-on-brand transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
					>
						{initialConfig ? 'Update chart' : 'Insert chart'}
					</button>
				</div>
			</div>
		</Ariakit.Dialog>
	)
}
