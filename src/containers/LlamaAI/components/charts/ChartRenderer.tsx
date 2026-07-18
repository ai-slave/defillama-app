import {
	lazy,
	memo,
	type ReactNode,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState
} from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { useArticleExport } from '~/components/AddToArticle/ArticleExportContext'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { Icon } from '~/components/Icon'
import { saveChartToLibrary } from '~/containers/LlamaAI/api/saveChartToLibrary'
import { updateChartStyle } from '~/containers/LlamaAI/api/updateChartStyle'
import { ChartControls } from '~/containers/LlamaAI/components/charts/ChartControls'
import { ChartStyleEditor } from '~/containers/LlamaAI/components/charts/ChartStyleEditor'
import type { ChartConfiguration, ChartDataByKey, ChartDataSeries, ChartStylePatch } from '~/containers/LlamaAI/types'
import type { AdaptedChartData } from '~/containers/LlamaAI/utils/chartAdapter'
import { adaptCandlestickData, adaptChartData } from '~/containers/LlamaAI/utils/chartAdapter'
import {
	deriveCapabilities,
	normalizeViewState,
	type ChartViewState
} from '~/containers/LlamaAI/utils/chartCapabilities'
import { areChartDataEqual, areChartsEqual, areStringArraysEqual } from '~/containers/LlamaAI/utils/chartComparison'
import { ChartDataTransformer } from '~/containers/LlamaAI/utils/chartDataTransformer'
import { buildRenderPlan, type ChartRenderPlan } from '~/containers/LlamaAI/utils/chartRenderPlan'
import { useAuthContext } from '~/containers/Subscription/auth'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const noop = () => {}

const CandlestickChart = lazy(() => import('~/components/ECharts/CandlestickChart'))
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))
const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))
const ScatterChart = lazy(() => import('~/components/ECharts/ScatterChart'))

interface ChartRendererProps {
	charts: ChartConfiguration[]
	chartData: ChartDataSeries | ChartDataByKey
	isLoading?: boolean
	hasError?: boolean
	chartTypes?: string[]
	resizeTrigger?: number
	sessionId?: string | null
	messageId?: string
	readOnly?: boolean
	/** Local persistence for style edits (e.g. research-article chart nodes). When set,
	 * the style editor is enabled without a chat session and saves go here instead of the API. */
	onLocalStyleSave?: (config: ChartConfiguration) => void
}

interface SingleChartProps {
	config: ChartConfiguration
	data: ChartDataSeries
	isActive: boolean
	title?: string
	sessionId?: string | null
	messageId?: string
	readOnly?: boolean
	onLocalStyleSave?: (config: ChartConfiguration) => void
}

type ChartAction =
	| { type: 'SET_STACKED'; payload: boolean }
	| { type: 'SET_PERCENTAGE'; payload: boolean }
	| { type: 'SET_CUMULATIVE'; payload: boolean }
	| { type: 'SET_GROUPING'; payload: ChartViewState['grouping'] }
	| { type: 'SET_HALLMARKS'; payload: boolean }
	| { type: 'SET_LABELS'; payload: boolean }
	| { type: 'SET_LOG_SCALE'; payload: boolean }

const chartReducer = (state: ChartViewState, action: ChartAction): ChartViewState => {
	switch (action.type) {
		case 'SET_STACKED':
			return { ...state, stacked: action.payload }
		case 'SET_PERCENTAGE':
			return { ...state, percentage: action.payload }
		case 'SET_CUMULATIVE':
			return { ...state, cumulative: action.payload }
		case 'SET_GROUPING':
			return { ...state, grouping: action.payload }
		case 'SET_HALLMARKS':
			return { ...state, showHallmarks: action.payload }
		case 'SET_LABELS':
			return { ...state, showLabels: action.payload }
		case 'SET_LOG_SCALE':
			return { ...state, logScale: action.payload }
		default:
			return state
	}
}

function createInitialChartState(config: ChartConfiguration): ChartViewState {
	return {
		stacked: config.displayOptions?.defaultStacked || false,
		percentage: config.displayOptions?.defaultPercentage || false,
		cumulative: false,
		grouping: 'day',
		showHallmarks: true,
		showLabels: config.displayOptions?.showLabels || false,
		logScale: config.displayOptions?.defaultLogScale || false
	}
}

function removeAdaptedChartTitle<T extends AdaptedChartData>(adaptedChart: T): T {
	if (!adaptedChart.props || !('title' in adaptedChart.props)) return adaptedChart
	const { title: _title, ...restProps } = adaptedChart.props
	return { ...adaptedChart, props: restProps } as T
}

function buildChartPresentation(
	config: ChartConfiguration,
	data: ChartDataSeries,
	chartState: ChartViewState
): ChartRenderPlan {
	// Pipeline order matters:
	// adapt base data -> derive intrinsic capabilities -> normalize view state -> transform -> render plan.
	const baseAdaptedChart = removeAdaptedChartTitle(adaptChartData(config, data))
	const capabilities = deriveCapabilities(config, baseAdaptedChart)
	const normalizedState = normalizeViewState(chartState, capabilities)
	const transformedChart = ChartDataTransformer.applyViewState(baseAdaptedChart, normalizedState, capabilities)
	return buildRenderPlan(config, transformedChart, normalizedState, capabilities)
}

function renderChartContent(renderPlan: ChartRenderPlan, chartKey: string, onChartReady: (instance: any) => void) {
	switch (renderPlan.rendererKind) {
		case 'cartesian':
			return (
				<Suspense fallback={<div className="h-[338px]" />}>
					<MultiSeriesChart2 key={chartKey} {...renderPlan.rendererProps} onReady={onChartReady} />
				</Suspense>
			)
		case 'hbar':
			return (
				<Suspense fallback={<div className="h-[338px]" />}>
					<HBarChart key={chartKey} {...renderPlan.rendererProps} onReady={onChartReady} />
				</Suspense>
			)
		case 'pie':
			return (
				<Suspense fallback={<div className="h-[338px]" />}>
					<PieChart key={chartKey} {...renderPlan.rendererProps} onReady={onChartReady} />
				</Suspense>
			)
		case 'scatter':
			return (
				<Suspense fallback={<div className="h-[360px]" />}>
					<ScatterChart key={chartKey} {...renderPlan.rendererProps} onReady={onChartReady} />
				</Suspense>
			)
		default:
			return (
				<div className="flex flex-col items-center justify-center gap-2 rounded-md bg-ai-error-bg p-1 py-8 text-ai-error-strong">
					<Icon name="alert-triangle" height={16} width={16} />
					<p>Unsupported chart type</p>
				</div>
			)
	}
}

function ChartExportButtonsSlot({
	chartInstance,
	exportModel,
	renderPlan,
	chartTitle,
	chartId,
	sessionId,
	messageId
}: {
	chartInstance: () => any
	exportModel: ChartRenderPlan['exportModel']
	renderPlan: ChartRenderPlan
	chartTitle: string | undefined
	chartId: string
	sessionId?: string | null
	messageId?: string
}) {
	const prepareCsvDirect = useMemo(
		() => (exportModel ? () => ({ filename: exportModel.csvFilename, rows: exportModel.csvRows }) : undefined),
		[exportModel]
	)

	const onCsvExport = useCallback(
		(info: { filename: string }) => {
			trackUmamiEvent('llamaai-download', {
				kind: 'chart-csv',
				filename: info.filename,
				chartId,
				chartTitle: chartTitle ?? '',
				sessionId: sessionId ?? '',
				messageId: messageId ?? ''
			})
		},
		[chartId, chartTitle, sessionId, messageId]
	)

	const onPngExport = useCallback(
		(info: { kind: 'download' | 'copy'; filename: string }) => {
			trackUmamiEvent('llamaai-download', {
				kind: info.kind === 'copy' ? 'chart-png-copy' : 'chart-png',
				filename: info.filename,
				chartId,
				chartTitle: chartTitle ?? '',
				sessionId: sessionId ?? '',
				messageId: messageId ?? ''
			})
		},
		[chartId, chartTitle, sessionId, messageId]
	)

	// Chat-only consolidated export menu: one icon opens CSV + image actions.
	// Other pages keep the separate .csv/.png buttons from ChartExportButtons.
	return (
		<ChartPngExportButton
			chartInstance={chartInstance}
			filename={renderPlan.filename}
			title={chartTitle}
			smol
			iconOnly
			csvMenuItem={
				exportModel && prepareCsvDirect
					? {
							prepareCsv: () => {
								const result = prepareCsvDirect()
								onCsvExport(result)
								return result
							}
						}
					: undefined
			}
			pngProfile={exportModel?.pngProfile}
			onExport={onPngExport}
		/>
	)
}

type PresentationResult = { ok: true; plan: ChartRenderPlan } | { ok: false; error: unknown }

function tryBuildPresentation(
	config: ChartConfiguration,
	data: ChartDataSeries,
	chartState: ChartViewState
): PresentationResult {
	try {
		return { ok: true, plan: buildChartPresentation(config, data, chartState) }
	} catch (error) {
		console.error('Chart render error:', error)
		return { ok: false, error }
	}
}

function SingleChart({
	config: baseConfig,
	data,
	isActive,
	title,
	sessionId,
	messageId,
	readOnly,
	onLocalStyleSave
}: SingleChartProps) {
	// authorizedFetch/user come from the shared auth context — real under the LlamaAI provider, an
	// empty object (→ no editor) in ProDashboard, so this is safe everywhere ChartRenderer renders.
	const { authorizedFetch, user } = useAuthContext()
	// Owner style edits render as a local override on top of the persisted config (live preview);
	// the override is kept after a successful save (the server returns the applied config).
	const [override, setOverride] = useState<ChartConfiguration | null>(null)
	const [editing, setEditing] = useState(false)
	const config = override ?? baseConfig
	const chatEditContext = !!authorizedFetch && !!user?.id && !!sessionId && !!messageId
	const canEdit = !readOnly && config.type !== 'candlestick' && (chatEditContext || !!onLocalStyleSave)

	const openArticleExport = useArticleExport()
	const [savingToLibrary, setSavingToLibrary] = useState(false)
	const handleSaveToLibrary = useCallback(async () => {
		if (!authorizedFetch || savingToLibrary) return
		setSavingToLibrary(true)
		try {
			const id = await saveChartToLibrary(authorizedFetch, {
				chartId: baseConfig.id,
				sessionId,
				messageId,
				frozen: true
			})
			if (id) toast.success('Chart saved to your library (frozen)')
			else toast.error('Failed to save chart')
		} finally {
			setSavingToLibrary(false)
		}
	}, [authorizedFetch, savingToLibrary, baseConfig.id, sessionId, messageId])

	const handleSaveStyle = useCallback(
		async (patch: ChartStylePatch) => {
			if (onLocalStyleSave) {
				// Local mode: the live-preview override already holds the fully edited
				// config; only the view defaults arrive solely via the patch.
				const base = override ?? baseConfig
				const updated: ChartConfiguration = base.displayOptions
					? {
							...base,
							displayOptions: {
								...base.displayOptions,
								defaultStacked: patch.defaultStacked,
								defaultPercentage: patch.defaultPercentage,
								defaultLogScale: patch.defaultLogScale,
								showLabels: patch.showLabels
							}
						}
					: base
				setOverride(updated)
				onLocalStyleSave(updated)
				return
			}
			if (!authorizedFetch || !sessionId || !messageId) return
			const updated = await updateChartStyle(authorizedFetch, {
				sessionId,
				messageId,
				chartId: baseConfig.id,
				style: patch
			})
			setOverride(updated)
		},
		[authorizedFetch, sessionId, messageId, onLocalStyleSave, override, baseConfig]
	)

	// category names (bars/slices) for per-category color pickers on single-series hbar & pie
	const editorCategories = useMemo(() => {
		const field = config.axes?.x?.field
		if (!field || !Array.isArray(data)) return []
		const seen = new Set<string>()
		const out: string[] = []
		for (const row of data) {
			const v = (row as Record<string, unknown>)?.[field]
			const key = v == null ? 'Unknown' : String(v)
			if (!seen.has(key)) {
				seen.add(key)
				out.push(key)
			}
		}
		return out
	}, [data, config])

	const [chartState, dispatch] = useReducer(chartReducer, config, createInitialChartState)
	const { chartInstance, handleChartReady } = useGetChartInstance()
	useEffect(() => {
		if (!editing) return
		const t = setTimeout(() => window.dispatchEvent(new CustomEvent('chartResize')), 60)
		return () => clearTimeout(t)
	}, [editing])
	const handleStackedChange = useCallback((stacked: boolean) => dispatch({ type: 'SET_STACKED', payload: stacked }), [])
	const handlePercentageChange = useCallback(
		(percentage: boolean) => dispatch({ type: 'SET_PERCENTAGE', payload: percentage }),
		[]
	)
	const handleCumulativeChange = useCallback(
		(cumulative: boolean) => dispatch({ type: 'SET_CUMULATIVE', payload: cumulative }),
		[]
	)
	const handleGroupingChange = useCallback(
		(grouping: ChartViewState['grouping']) => dispatch({ type: 'SET_GROUPING', payload: grouping }),
		[]
	)
	const handleHallmarksChange = useCallback(
		(showHallmarks: boolean) => dispatch({ type: 'SET_HALLMARKS', payload: showHallmarks }),
		[]
	)
	const handleLabelsChange = useCallback(
		(showLabels: boolean) => dispatch({ type: 'SET_LABELS', payload: showLabels }),
		[]
	)
	const handleLogScaleChange = useCallback(
		(logScale: boolean) => dispatch({ type: 'SET_LOG_SCALE', payload: logScale }),
		[]
	)

	const presentation = useMemo(
		() => (config.type === 'candlestick' ? null : tryBuildPresentation(config, data, chartState)),
		[config, data, chartState]
	)

	if (!isActive) return null

	if (config.type === 'candlestick') {
		const candlestickData = adaptCandlestickData(config, data)
		return (
			<div className="flex flex-col p-2" data-chart-id={config.id}>
				<Suspense fallback={<div className="h-[480px]" />}>
					<CandlestickChart data={candlestickData.data} indicators={candlestickData.indicators} />
				</Suspense>
			</div>
		)
	}

	if (!presentation) {
		return null
	}

	if (presentation.ok === false) {
		const errorMsg = presentation.error instanceof Error ? presentation.error.message : 'Unknown error'
		return (
			<div className="flex flex-col items-center justify-center gap-2 rounded-md bg-ai-error-bg p-1 py-8 text-ai-error-strong">
				<Icon name="alert-triangle" height={16} width={16} />
				<p>{errorMsg}</p>
			</div>
		)
	}

	const renderPlan = presentation.plan

	if (!renderPlan.hasData) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-1 py-8 text-ai-tertiary">
				<Icon name="bar-chart" height={16} width={16} />
				<p>No data available for chart</p>
			</div>
		)
	}

	const normalizedState = renderPlan.controls.state
	const exportModel = renderPlan.exportModel
	// A live style override (post-edit) carries the freshest title; the title prop
	// comes from message/node state, which in chat only refreshes on reload.
	const chartTitle = override?.title ?? title ?? config.title
	const chartKey = `${config.id}-${normalizedState.stacked}-${normalizedState.percentage}-${normalizedState.cumulative}-${normalizedState.grouping}-${normalizedState.showHallmarks}-${normalizedState.showLabels}-${normalizedState.logScale}`
	const chartContent = renderChartContent(renderPlan, chartKey, handleChartReady)

	return (
		<div className="flex flex-col *:[2n-1]:m-2" data-chart-id={config.id}>
			<ChartControls
				controls={{ ...renderPlan.controls, title }}
				onStackedChange={handleStackedChange}
				onPercentageChange={handlePercentageChange}
				onCumulativeChange={handleCumulativeChange}
				onGroupingChange={handleGroupingChange}
				onHallmarksChange={handleHallmarksChange}
				onLabelsChange={handleLabelsChange}
				onLogScaleChange={handleLogScaleChange}
			>
				<ChartExportButtonsSlot
					chartInstance={chartInstance}
					exportModel={exportModel}
					renderPlan={renderPlan}
					chartTitle={chartTitle}
					chartId={config.id}
					sessionId={sessionId}
					messageId={messageId}
				/>
				{canEdit ? (
					<button
						type="button"
						onClick={() => setEditing((v) => !v)}
						title="Edit chart style"
						className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs text-ai-tertiary hover:text-ai-primary"
					>
						<Icon name="settings" height={14} width={14} />
					</button>
				) : null}
				{openArticleExport && messageId && !readOnly ? (
					<>
						<button
							type="button"
							onClick={() => void handleSaveToLibrary()}
							disabled={savingToLibrary}
							title="Save chart (frozen data)"
							className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs text-ai-tertiary hover:text-ai-primary disabled:opacity-50"
						>
							<Icon name="bookmark" height={14} width={14} />
						</button>
						<button
							type="button"
							onClick={() =>
								openArticleExport({
									kind: 'chart',
									chartId: baseConfig.id,
									charts: { [baseConfig.id]: { config: baseConfig, data } },
									sessionId,
									messageId
								})
							}
							title="Add to research article"
							className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs text-ai-tertiary hover:text-ai-primary"
						>
							<Icon name="file-plus" height={14} width={14} />
						</button>
					</>
				) : null}
			</ChartControls>
			{chartContent}
			{editing && canEdit ? (
				<ChartEditorModal title={chartTitle} onClose={() => setEditing(false)}>
					<div className="flex flex-1 items-center justify-center overflow-auto p-5">
						<div className="w-full">{renderChartContent(renderPlan, `${chartKey}-edit`, noop)}</div>
					</div>
					<div className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-ai-line bg-ai-surface lg:w-[340px] lg:border-t-0 lg:border-l">
						<ChartStyleEditor
							config={config}
							original={baseConfig}
							caps={renderPlan.controls}
							categories={editorCategories}
							view={{
								logScale: normalizedState.logScale,
								stacked: normalizedState.stacked,
								showLabels: normalizedState.showLabels,
								percentage: normalizedState.percentage
							}}
							onView={(key, value) => {
								if (key === 'logScale') handleLogScaleChange(value)
								else if (key === 'stacked') handleStackedChange(value)
								else if (key === 'percentage') handlePercentageChange(value)
								else handleLabelsChange(value)
							}}
							onPreview={setOverride}
							onReset={() => setOverride(null)}
							onSave={handleSaveStyle}
							onClose={() => setEditing(false)}
						/>
					</div>
				</ChartEditorModal>
			) : null}
		</div>
	)
}

function ChartEditorModal({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', onKey)
		const prevOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.removeEventListener('keydown', onKey)
			document.body.style.overflow = prevOverflow
		}
	}, [onClose])

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
			<div className="absolute inset-0 bg-ai-backdrop" onClick={onClose} />
			<div className="relative flex h-[85vh] max-h-[560px] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-ai-line bg-ai-surface-card shadow-2xl lg:flex-row">
				<div className="flex items-center justify-between border-b border-ai-line px-4 py-2.5 lg:hidden">
					<span className="truncate text-sm font-semibold text-secondary">{title ?? 'Edit chart'}</span>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close editor"
						className="rounded-sm p-1 text-ai-muted hover:bg-ai-hover hover:text-ai-primary"
					>
						<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
							<path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
						</svg>
					</button>
				</div>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close editor"
					className="absolute top-2.5 right-2.5 z-10 hidden rounded-sm p-1 text-ai-muted hover:bg-ai-hover hover:text-ai-primary lg:block"
				>
					<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
						<path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
					</svg>
				</button>
				{children}
			</div>
		</div>,
		document.body
	)
}

const ChartLoadingSpinner = () => (
	<div className="size-4 animate-spin rounded-full border-b-2 border-ai-accent-blue"></div>
)

const ChartLoadingPlaceholder = ({ chartTypes }: { chartTypes?: string[] }) => (
	<div className="flex flex-col items-center justify-center gap-2 rounded-md border border-ai-line px-1 py-8">
		<ChartLoadingSpinner />
		<p className="text-ai-tertiary">
			{chartTypes?.length ? (
				<>
					Creating {chartTypes.join(', ')} visualization{chartTypes.length > 1 ? 's' : ''}&hellip;
				</>
			) : (
				<>Creating visualization&hellip;</>
			)}
		</p>
	</div>
)

const ChartErrorPlaceholder = () => (
	<div className="flex flex-col items-center justify-center gap-2 rounded-md bg-ai-error-bg p-1 py-8 text-ai-error-strong">
		<Icon name="alert-triangle" height={16} width={16} />
		<p>Chart generation encountered an issue</p>
	</div>
)

export function ChartRenderer({
	charts,
	chartData,
	isLoading = false,
	hasError = false,
	chartTypes,
	resizeTrigger = 0,
	sessionId,
	messageId,
	readOnly,
	onLocalStyleSave
}: ChartRendererProps) {
	return (
		<ChartRendererMemoized
			{...{
				charts,
				chartData,
				isLoading,
				hasError,
				chartTypes,
				resizeTrigger,
				sessionId,
				messageId,
				readOnly,
				onLocalStyleSave
			}}
		/>
	)
}

function ChartRendererImpl({
	charts,
	chartData,
	isLoading = false,
	hasError = false,
	chartTypes,
	resizeTrigger = 0,
	sessionId,
	messageId,
	readOnly,
	onLocalStyleSave
}: ChartRendererProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [activeTabIndex, setActiveTab] = useReducer((state: number, action: number) => action, 0)

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		let lastWidth = el.getBoundingClientRect().width
		let timer: ReturnType<typeof setTimeout> | null = null
		// ECharts instances listen for the shared resize event; debounce container
		// width changes so side panels and fullscreen toggles do not thrash charts.
		const observer = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width ?? 0
			if (Math.abs(w - lastWidth) < 1) return
			lastWidth = w
			if (timer) clearTimeout(timer)
			timer = setTimeout(() => window.dispatchEvent(new CustomEvent('chartResize')), 150)
		})
		observer.observe(el)
		return () => {
			observer.disconnect()
			if (timer) clearTimeout(timer)
		}
	}, [])

	useEffect(() => {
		if (resizeTrigger > 0) {
			const timer = setTimeout(() => {
				window.dispatchEvent(new CustomEvent('chartResize'))
			}, 100)
			return () => clearTimeout(timer)
		}
	}, [resizeTrigger])

	if (hasError && (!charts || charts.length === 0)) {
		return <ChartErrorPlaceholder />
	}

	if (isLoading && (!charts || charts.length === 0)) {
		return <ChartLoadingPlaceholder chartTypes={chartTypes} />
	}

	if (!isLoading && !hasError && (!charts || charts.length === 0)) {
		return null
	}

	const hasMultipleCharts = charts.length > 1

	return (
		<div ref={containerRef} className="flex flex-col gap-2 rounded-md border border-brand pt-2">
			{hasMultipleCharts ? (
				<div className="-mt-2 flex border-b border-ai-line">
					{charts.map((chart, index) => (
						<button
							key={`toggle-${chart.id}`}
							onClick={() => setActiveTab(index)}
							className={`border-b-2 px-2 py-1.5 text-sm transition-colors ${
								activeTabIndex === index
									? 'border-brand text-brand'
									: 'border-transparent text-ai-tertiary hover:text-ai-primary'
							}`}
						>
							{chart.title}
						</button>
					))}
				</div>
			) : null}
			{charts.map((chart, index) => {
				// Backend sessions before the keyed chart-data transition (commit a6035b1)
				// stored one flat row array. PR #2666 kept this branch load-bearing.
				const data = Array.isArray(chartData) ? chartData : chartData?.[chart.datasetName || chart.id] || []
				return (
					<SingleChart
						key={chart.id}
						config={chart}
						data={data}
						isActive={!hasMultipleCharts || activeTabIndex === index}
						title={chart.title}
						sessionId={sessionId}
						messageId={messageId}
						readOnly={readOnly}
						onLocalStyleSave={onLocalStyleSave}
					/>
				)
			})}
		</div>
	)
}

const ChartRendererMemoized = memo(ChartRendererImpl, (prev, next) => {
	return (
		prev.isLoading === next.isLoading &&
		prev.hasError === next.hasError &&
		prev.resizeTrigger === next.resizeTrigger &&
		prev.sessionId === next.sessionId &&
		prev.messageId === next.messageId &&
		prev.readOnly === next.readOnly &&
		prev.onLocalStyleSave === next.onLocalStyleSave &&
		areStringArraysEqual(prev.chartTypes, next.chartTypes) &&
		areChartsEqual(prev.charts, next.charts) &&
		areChartDataEqual(prev.chartData, next.chartData)
	)
})

ChartRendererMemoized.displayName = 'ChartRenderer'
