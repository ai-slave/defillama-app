import * as Ariakit from '@ariakit/react'
import { useQueries } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useId, useMemo, useRef, useState } from 'react'
import { buildSparseCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { createCappedRemainderTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { chartColor } from '~/constants/colors'
import { useAppMetadata } from '~/containers/ProDashboard/AppMetadataContext'
import { getProDashboardChartSourceQueryKey } from '~/containers/ProDashboard/chartSource'
import { ChartTypePills } from '~/containers/ProDashboard/components/AddChartModal/ChartTypePills'
import type { TimePeriod } from '~/containers/ProDashboard/dashboardTypes'
import { buildProDashboardProtocolRelations } from '~/containers/ProDashboard/protocolCatalog'
import {
	filterDataByTimePeriod,
	getChartQueryFn,
	ProxyAuthTokenContext,
	useProtocolsAndChains
} from '~/containers/ProDashboard/queries'
import { CHAIN_CHART_TYPES, CHART_TYPES, PROTOCOL_CHART_TYPES } from '~/containers/ProDashboard/types'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Dialog, DialogCancelButton, DialogDiscardGuard, DialogFooter, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { ListRow } from '~/ui/ListRow'
import { ListLoading, NoResults } from '~/ui/NoResults'
import { SearchField } from '~/ui/SearchField'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Select } from '~/ui/Select'
import { EmptyState, InlineLoading, SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { tokenIconUrl, chainIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { mergeFailedReads, queryReadFailed } from '~/utils/query'
import { buildArticleAnnotationMarkLine } from '../articleAnnotationMarkLine'
import { deriveLegacyChartType, deriveLegacyEntities, validateArticleChartConfig } from '../chartAdapters'
import type {
	ArticleChartAnnotation,
	ArticleChartConfig,
	ArticleChartEntityType,
	ArticleChartRange,
	ArticleChartSeries
} from '../types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const ARTICLE_TOOLTIP_FORMATTER = createCappedRemainderTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
const MAX_SERIES = 4
const MAX_ANNOTATIONS = 5

const RANGES: Array<{ value: ArticleChartRange; label: string }> = [
	{ value: '30d', label: '30D' },
	{ value: '90d', label: '90D' },
	{ value: '365d', label: '1Y' },
	{ value: 'all', label: 'All' }
]

const ENTITY_TYPES = [
	{ value: 'protocol', label: 'Protocols' },
	{ value: 'chain', label: 'Chains' }
] as const
const SCALES = [
	{ value: 'linear', label: 'Linear' },
	{ value: 'log', label: 'Log' }
] as const

type Entity = {
	entityType: ArticleChartEntityType
	slug: string
	name: string
	logo?: string
	tvl?: number
	geckoId?: string | null
}

const labelFor = (key: string) => CHART_TYPES[key as keyof typeof CHART_TYPES]?.title || key

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
	annotations
}: {
	series: Array<ArticleChartSeries>
	range: ArticleChartRange
	logScale: boolean
	annotations: Array<ArticleChartAnnotation>
}) {
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
			select: (data: Array<[number, number]>) => filterDataByTimePeriod(data, range as TimePeriod),
			staleTime: 1000 * 60 * 5,
			gcTime: 1000 * 60 * 30,
			refetchOnWindowFocus: false
		}))
	})

	const isLoading = queries.some((q) => q.isLoading)
	// A preview with some series loaded draws those; only one whose every read failed shows the error.
	const allFailed = queries.length > 0 && queries.every((q) => queryReadFailed(q))
	const failedReads = mergeFailedReads(queries.map((q) => (queryReadFailed(q) ? q : null)))

	const chartModel = useMemo(() => {
		const chartSeries = series
			.map((s, i) => {
				const data = queries[i]?.data as Array<[number, number]> | undefined
				if (!data || data.length === 0) return null
				const meta = CHART_TYPES[s.chartType as keyof typeof CHART_TYPES]
				const type: 'line' | 'bar' = meta?.chartType === 'bar' ? 'bar' : 'line'
				return {
					name: `${s.name} · ${meta?.title || s.chartType}`,
					type,
					color: chartColor(i),
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

	// The preview is 300px tall, under the fallback's 360px default minimum.
	if (allFailed) {
		return (
			<SurfaceBodyStatus variant="error" retry={failedReads} className="h-[300px] min-h-0">
				Couldn&apos;t load chart data.
			</SurfaceBodyStatus>
		)
	}
	const loading = <SurfaceBodyLoadingStatus label="Loading chart" className="h-[300px] min-h-0" />
	if (isLoading) return loading
	if (chartModel.charts.length === 0) {
		return (
			<SurfaceBodyStatus variant="empty" className="h-[300px] min-h-0">
				No data available.
			</SurfaceBodyStatus>
		)
	}
	return (
		<Suspense fallback={loading}>
			<MultiSeriesChart
				dataset={chartModel.dataset}
				charts={charts}
				valueSymbol="$"
				groupBy="daily"
				showLegend
				exportButtons="hidden"
				hideDataZoom
				height="300px"
				chartOptions={chartOptions}
			/>
		</Suspense>
	)
}

function seriesId(s: ArticleChartSeries) {
	return `${s.entityType}:${s.slug}:${s.chartType}`
}

const DEFAULT_METRIC = 'tvl'

type PickerPane = 'series' | 'preview'

export function ArticleChartPickerDialog({ store, onInsert, initialConfig }: Props) {
	const normalizedInitialConfig = useMemo(() => validateArticleChartConfig(initialConfig), [initialConfig])
	const initialSeries = normalizedInitialConfig?.series ?? []
	const initialFirstSeries = initialSeries[0]
	const initialLastProtocol = [...initialSeries].reverse().find((s) => s.entityType === 'protocol')
	const initialLastChain = [...initialSeries].reverse().find((s) => s.entityType === 'chain')
	const [tab, setTab] = useState<ArticleChartEntityType>(initialFirstSeries?.entityType ?? 'protocol')
	const searchRef = useRef<HTMLInputElement>(null)
	const [query, setQuery] = useState('')
	const [series, setSeries] = useState<Array<ArticleChartSeries>>(() => initialSeries.map((s) => ({ ...s })))
	const [caption, setCaption] = useState(normalizedInitialConfig?.caption ?? '')
	const [range, setRange] = useState<ArticleChartRange>(normalizedInitialConfig?.range ?? 'all')
	const [logScale, setLogScale] = useState(normalizedInitialConfig?.logScale ?? false)
	const [annotations, setAnnotations] = useState<Array<ArticleChartAnnotation & { id: string }>>(() =>
		(normalizedInitialConfig?.annotations ?? []).map((annotation) => ({ ...annotation, id: crypto.randomUUID() }))
	)
	const [protocolMetric, setProtocolMetric] = useState<string>(initialLastProtocol?.chartType ?? DEFAULT_METRIC)
	const [chainMetric, setChainMetric] = useState<string>(initialLastChain?.chartType ?? DEFAULT_METRIC)
	const { data: catalog, isLoading: catalogLoading } = useProtocolsAndChains()
	const { availableProtocolChartTypes, availableChainChartTypes, loading: metaLoading } = useAppMetadata()

	const currentMetric = tab === 'protocol' ? protocolMetric : chainMetric
	const setCurrentMetric = (next: string) => {
		if (tab === 'protocol') setProtocolMetric(next)
		else setChainMetric(next)
	}

	const entities = useMemo<Array<Entity>>(() => {
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

	// Set by an Insert with no series; the search field then says so until one is picked.
	const [submitted, setSubmitted] = useState(false)
	const seriesError = submitted && series.length === 0 ? 'Choose at least one series.' : null
	const searchRegionRef = useRef<HTMLDivElement>(null)
	// Toggling and metric changes keep the series unique.
	const handleInsert = () => {
		if (series.length === 0) {
			// On a phone the picking pane may be hidden behind the preview, so it shows first.
			return showFieldErrors(searchRegionRef.current!, () => {
				setSubmitted(true)
				setPane('series')
			})
		}
		onInsert({
			series,
			entities: deriveLegacyEntities(series),
			chartType: deriveLegacyChartType(series),
			...(range !== 'all' ? { range } : {}),
			...(logScale ? { logScale: true } : {}),
			...(annotations.length > 0 ? { annotations: annotations.map(({ date, label }) => ({ date, label })) } : {}),
			...(caption.trim() ? { caption: caption.trim() } : {})
		})
		store.hide()
	}

	const updateAnnotation = (index: number, patch: Partial<ArticleChartAnnotation>) => {
		setAnnotations((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
	}
	const addAnnotation = () => {
		if (annotations.length >= MAX_ANNOTATIONS) return
		setAnnotations((prev) => [
			...prev,
			{ id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), label: '' }
		])
	}
	const removeAnnotation = (index: number) => {
		setAnnotations((prev) => prev.filter((_, i) => i !== index))
	}

	const selectedIds = useMemo(() => new Set(series.map(seriesId)), [series])

	// The draft as the reader sees it, without the annotation ids the editor adds: leaving with it changed asks first.
	const draftSnapshot = JSON.stringify({
		series,
		caption,
		range,
		logScale,
		annotations: annotations.map(({ date, label }) => ({ date, label }))
	})
	const [openedSnapshot] = useState(draftSnapshot)
	const dirty = draftSnapshot !== openedSnapshot
	const [pane, setPane] = useState<PickerPane>('series')
	const rangeLabelId = useId()
	const scaleLabelId = useId()
	// Phones skip the search autofocus: the keyboard would cover the list before anyone asked to search.
	const isSmallScreen = useMedia('(max-width: 639px)')

	return (
		// An outside tap never drops the draft; Cancel, × and Escape ask first once it has changed.
		<Dialog
			size="xl"
			workspace
			store={store}
			initialFocus={isSmallScreen ? undefined : searchRef}
			hideOnInteractOutside={false}
			portal
		>
			<DialogDiscardGuard
				when={dirty}
				title="Discard this chart?"
				description="The series and options you picked are not saved to the article."
			/>
			<DialogHeader title={initialConfig ? 'Edit chart' : 'Embed a DefiLlama chart'} />
			<div className="md:hidden">
				<DialogToolbar>
					<SegmentedControl<PickerPane>
						label="Picker view"
						options={[
							{ value: 'series', label: `Series (${series.length})` },
							{ value: 'preview', label: 'Preview' }
						]}
						value={pane}
						onValueChange={setPane}
						variant="solid-responsive"
						size="md"
					/>
				</DialogToolbar>
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_1fr]">
				<aside
					className={`min-h-0 flex-col border-medium bg-page md:flex md:border-r ${pane === 'series' ? 'flex' : 'hidden'}`}
				>
					<div className="grid gap-2 px-3 pt-3 pb-2">
						<SegmentedControl
							label="Entity type"
							value={tab}
							options={ENTITY_TYPES}
							onValueChange={(value) => {
								setTab(value)
								setQuery('')
							}}
							variant="field"
							size="md"
						/>
						<ChartTypePills
							label="Metric to add"
							chartTypes={chartTypeOptions}
							selectedType={currentMetric}
							onSelect={setCurrentMetric}
							isLoading={metaLoading}
							mode={tab}
						/>
						<div ref={searchRegionRef} role="search">
							<Field hideLabel label={tab === 'protocol' ? 'Search protocols' : 'Search chains'} error={seriesError}>
								{(control) => (
									<SearchField
										{...control}
										ref={searchRef}
										label={tab === 'protocol' ? 'Search protocols' : 'Search chains'}
										value={query}
										onChange={setQuery}
										placeholder={tab === 'protocol' ? 'Search protocols' : 'Search chains'}
									/>
								)}
							</Field>
						</div>
					</div>
					<ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
						{catalogLoading ? (
							<li>
								<ListLoading label={tab === 'protocol' ? 'Loading protocols' : 'Loading chains'} />
							</li>
						) : filteredEntities.length === 0 ? (
							<li>
								<NoResults>No results</NoResults>
							</li>
						) : (
							filteredEntities.map((entity) => {
								const candidateId = `${entity.entityType}:${entity.slug}:${currentMetric}`
								const checked = selectedIds.has(candidateId)
								const tvl = entity.tvl != null && entity.tvl > 0 ? formatUsd(entity.tvl, { compact: true }) : null
								const limitReached = !checked && series.length >= MAX_SERIES
								return (
									<li key={`${entity.entityType}:${entity.slug}`}>
										<Ariakit.Checkbox
											render={<ListRow aria-label={entity.name} selected={checked} check="box" className="gap-2.5" />}
											onChange={() => toggleEntity(entity)}
											// At the limit a row stays focusable, so a reader hears it is unavailable.
											disabled={limitReached}
											accessibleWhenDisabled
											checked={checked}
										>
											{/* A disabled row's text takes the disabled color; its logo dims with it. */}
											<span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-surface group-aria-disabled:opacity-40">
												<img src={entityLogo(entity)} alt="" className="size-full object-cover" />
											</span>
											<span className="min-w-0 flex-1 truncate label-md">{entity.name}</span>
											{tvl ? <span className="shrink-0 body-sm text-tertiary tabular-nums">{tvl}</span> : null}
										</Ariakit.Checkbox>
									</li>
								)
							})
						)}
					</ul>
				</aside>

				<section className={`min-h-0 flex-col overflow-y-auto md:flex ${pane === 'preview' ? 'flex' : 'hidden'}`}>
					{series.length === 0 ? (
						<EmptyState size="md" title={`Pick up to ${MAX_SERIES} series`}>
							Choose a metric from the left, then tick any protocols or chains to add them as series. Switch metric or
							tab to mix different metrics and entity types on a single chart.
						</EmptyState>
					) : (
						<>
							<div className="grid gap-2 px-5 pt-4 pb-3">
								<span className="label-xs tracking-wide text-tertiary uppercase">Series</span>
								<ul className="grid gap-1.5">
									{series.map((s, i) => {
										const id = seriesId(s)
										const types = availableTypesForEntity(s.entityType, s.slug, s.geckoId)
										return (
											<li
												key={id}
												className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-medium bg-page px-2.5 py-1.5 sm:grid-cols-[12px_minmax(0,1fr)_auto_auto]"
											>
												<span aria-hidden className="size-2 rounded-full" style={{ background: chartColor(i) }} />
												<span className="flex min-w-0 items-center gap-2">
													<span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-surface">
														<img src={entityLogo(s)} alt="" className="size-full object-cover" />
													</span>
													<span className="truncate label-sm text-primary">{s.name}</span>
													<span className="label-xs tracking-[0.16em] text-tertiary uppercase">{s.entityType}</span>
												</span>
												<div className="col-start-2 row-start-2 sm:col-auto sm:row-auto">
													<Select
														heading="Chart type"
														allValues={types.map((key) => ({ key, name: labelFor(key) }))}
														selectedValues={s.chartType}
														setSelectedValues={(next) => updateSeriesChartType(id, next)}
														label={<span className="truncate">{labelFor(s.chartType)}</span>}
														labelType="none"
														variant="input"
														size="md"
														className="w-44 justify-between"
														triggerProps={{ 'aria-label': `Chart type for ${s.name}` }}
													/>
												</div>
												<Tooltip
													content={`Remove ${s.name} ${labelFor(s.chartType)}`}
													render={
														<Button
															variant="ghost"
															size="md"
															square
															onClick={() => removeSeries(id)}
															aria-label={`Remove ${s.name} ${labelFor(s.chartType)}`}
														/>
													}
												>
													<Icon name="x" className="size-4" aria-hidden="true" />
												</Tooltip>
											</li>
										)
									})}
								</ul>
								{metaLoading ? <InlineLoading label="Loading available chart types" /> : null}
							</div>

							<div className="flex flex-wrap items-center gap-3 px-5 pb-3">
								<div className="grid gap-1.5">
									<span id={rangeLabelId} className="label-xs tracking-wide text-tertiary uppercase">
										Range
									</span>
									<SegmentedControl<ArticleChartRange>
										label="Range"
										aria-labelledby={rangeLabelId}
										value={range}
										options={RANGES}
										onValueChange={setRange}
										variant="default"
										size="md"
									/>
								</div>
								<div className="grid gap-1.5">
									<span id={scaleLabelId} className="label-xs tracking-wide text-tertiary uppercase">
										Y-axis scale
									</span>
									<SegmentedControl
										label="Y-axis scale"
										aria-labelledby={scaleLabelId}
										value={logScale ? 'log' : 'linear'}
										options={SCALES}
										onValueChange={(value) => setLogScale(value === 'log')}
										variant="default"
										size="md"
									/>
								</div>
							</div>

							<div className="relative shrink-0 grow border-t border-medium bg-page">
								<div className="pointer-events-none absolute top-3 left-5 z-10 flex items-center gap-2">
									<span className="rounded-full border border-medium bg-surface-glass px-2 py-0.5 label-xs tracking-wide text-tertiary uppercase backdrop-blur">
										Preview
									</span>
								</div>
								<div className="px-3 pt-2 pb-3">
									<MultiPreview series={series} range={range} logScale={logScale} annotations={annotations} />
								</div>
							</div>

							<label className="grid gap-1 border-t border-medium px-5 py-3">
								<span className="label-xs tracking-wide text-tertiary uppercase">Caption (optional)</span>
								<Input
									value={caption}
									onChange={(event) => setCaption(event.target.value)}
									placeholder="Add a one-line caption shown under the chart…"
									className="w-full"
								/>
							</label>

							<div className="grid gap-2 border-t border-medium px-5 py-3">
								<div className="flex items-center justify-between">
									<span className="label-xs tracking-wide text-tertiary uppercase">Annotations</span>
									<Button
										size="sm"
										onClick={addAnnotation}
										disabled={annotations.length >= MAX_ANNOTATIONS}
										accessibleWhenDisabled
									>
										<Icon name="plus" className="size-3.5" aria-hidden="true" />
										Add
									</Button>
								</div>
								{annotations.length === 0 ? (
									<p className="body-sm text-tertiary">
										Mark a date on the chart with a short label (e.g. "V3 launch", "depeg event").
									</p>
								) : (
									<ul className="grid gap-1.5">
										{annotations.map((annotation, i) => (
											<li
												key={annotation.id}
												className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-medium bg-page px-2 py-1.5 sm:grid-cols-[16px_auto_minmax(0,1fr)_auto]"
											>
												<span className="mono-sm-bold text-tertiary">{String.fromCharCode(65 + i)}</span>
												<Input
													type="date"
													aria-label={`Annotation ${i + 1} date`}
													value={annotation.date.slice(0, 10)}
													onChange={(e) => updateAnnotation(i, { date: e.target.value })}
													className="cursor-pointer"
												/>
												<Input
													value={annotation.label}
													onChange={(e) => updateAnnotation(i, { label: e.target.value })}
													placeholder="Label"
													aria-label={`Annotation ${i + 1} label`}
													// A phone row is too narrow for the date and the label side by side, so the label takes its own line.
													className="max-sm:col-[2/-1] max-sm:row-start-2"
												/>
												<Tooltip
													content={`Remove annotation ${i + 1}`}
													render={
														<Button
															variant="ghost"
															size="md"
															square
															onClick={() => removeAnnotation(i)}
															aria-label={`Remove annotation ${i + 1}`}
														/>
													}
												>
													<Icon name="x" className="size-4" aria-hidden="true" />
												</Tooltip>
											</li>
										))}
									</ul>
								)}
							</div>
						</>
					)}
				</section>
			</div>

			<DialogFooter
				leading={
					<span className="label-sm text-secondary">
						{series.length} / {MAX_SERIES} series
					</span>
				}
				dismiss={<DialogCancelButton />}
			>
				<Button variant="primary" size="md" onClick={handleInsert}>
					{initialConfig ? 'Update chart' : 'Insert chart'}
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
