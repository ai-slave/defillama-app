import type * as echarts from 'echarts/core'
import {
	type Dispatch,
	lazy,
	memo,
	type ReactNode,
	type SetStateAction,
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
import { useAuthContext } from '~/auth'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { saveChartToLibrary } from '~/containers/LlamaAI/api/saveChartToLibrary'
import { updateChartStyle } from '~/containers/LlamaAI/api/updateChartStyle'
import type {
	ChartConfiguration,
	ChartDataByKey,
	ChartDataSeries,
	ChartStylePatch
} from '~/containers/LlamaAI/chartTypes'
import { isChartDataRow } from '~/containers/LlamaAI/chartTypes'
import { useArticleExport } from '~/containers/LlamaAI/components/AddToArticle/useArticleExport'
import { ChartControls } from '~/containers/LlamaAI/components/charts/ChartControls'
import { ChartStyleEditor, type ChartStyleEditorView } from '~/containers/LlamaAI/components/charts/ChartStyleEditor'
import { canAddChartArtifactToDashboard } from '~/containers/LlamaAI/dashboardArtifactFlow'
import type { ChartArtifactRef, ChartArtifactRefs } from '~/containers/LlamaAI/types'
import type { AdaptedChartData } from '~/containers/LlamaAI/utils/adaptedChartTypes'
import type { ArticleExportRequest } from '~/containers/LlamaAI/utils/articleExport'
import { adaptChartData } from '~/containers/LlamaAI/utils/chartAdapter'
import { adaptCandlestickData } from '~/containers/LlamaAI/utils/chartAdapters/candlestick'
import {
	deriveCapabilities,
	normalizeViewState,
	type ChartCapabilities,
	type ChartViewState
} from '~/containers/LlamaAI/utils/chartCapabilities'
import {
	areChartConfigsEqual,
	areChartDataEqual,
	areChartsEqual,
	areStringArraysEqual
} from '~/containers/LlamaAI/utils/chartComparison'
import { ChartDataTransformer } from '~/containers/LlamaAI/utils/chartDataTransformer'
import { buildRenderPlan, type ChartRenderPlan } from '~/containers/LlamaAI/utils/chartRenderPlan'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button, buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const noop = () => {}
const chartToolbarIconButtonStyles = buttonStyles({ size: 'md', square: true })

const CandlestickChart = lazy(() => import('~/components/ECharts/CandlestickChart'))
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))
const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))
const ScatterChart = lazy(() => import('~/components/ECharts/ScatterChart'))

interface ChartRendererProps {
	charts: Array<ChartConfiguration>
	chartData: ChartDataSeries | ChartDataByKey
	isLoading?: boolean
	hasError?: boolean
	chartTypes?: Array<string>
	resizeTrigger?: number
	sessionId?: string | null
	messageId?: string
	readOnly?: boolean
	artifactRefs?: ChartArtifactRefs
	/** Local persistence for style edits (e.g. research-article chart nodes). When set,
	 * the style editor is enabled without a chat session and saves go here instead of the API. */
	onLocalStyleSave?: (config: ChartConfiguration) => void
}

interface ChartRendererRuntimeProps {
	charts: Array<ChartConfiguration>
	chartData: ChartDataSeries | ChartDataByKey
	isLoading: boolean
	hasError: boolean
	chartTypes: Array<string> | undefined
	resizeTrigger: number
	sessionId: string | null | undefined
	messageId: string | undefined
	readOnly: boolean | undefined
	artifactRefs: ChartArtifactRefs | undefined
	onLocalStyleSave: ((config: ChartConfiguration) => void) | undefined
}

interface SingleChartProps {
	config: ChartConfiguration
	data: ChartDataSeries
	isActive: boolean
	title: string | undefined
	sessionId: string | null | undefined
	messageId: string | undefined
	readOnly: boolean | undefined
	artifactRef: ChartArtifactRef | undefined
	onLocalStyleSave: ((config: ChartConfiguration) => void) | undefined
}

type ChartAction =
	| { type: 'SET_STACKED'; payload: boolean }
	| { type: 'SET_PERCENTAGE'; payload: boolean }
	| { type: 'SET_CUMULATIVE'; payload: boolean }
	| { type: 'SET_GROUPING'; payload: ChartViewState['grouping'] }
	| { type: 'SET_HALLMARKS'; payload: boolean }
	| { type: 'SET_LABELS'; payload: boolean }
	| { type: 'SET_LOG_SCALE'; payload: boolean }
	| { type: 'RESET_VIEW'; payload: ChartViewState }

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
		case 'RESET_VIEW':
			return action.payload
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

function applySavedStyleDefaults(state: ChartViewState, config: ChartConfiguration): ChartViewState {
	const defaults = createInitialChartState(config)
	return {
		...state,
		stacked: defaults.stacked,
		percentage: defaults.percentage,
		showLabels: defaults.showLabels,
		logScale: defaults.logScale
	}
}

function removeAdaptedChartTitle(adaptedChart: AdaptedChartData): AdaptedChartData {
	switch (adaptedChart.chartType) {
		case 'pie': {
			const { title: _title, ...props } = adaptedChart.props
			return { ...adaptedChart, props }
		}
		case 'scatter': {
			const { title: _title, ...props } = adaptedChart.props
			return { ...adaptedChart, props }
		}
		default:
			return adaptedChart
	}
}

interface ChartPresentationBase {
	adaptedChart: AdaptedChartData
	capabilities: ChartCapabilities
}

function buildChartPresentationBase(config: ChartConfiguration, data: ChartDataSeries): ChartPresentationBase {
	const baseAdaptedChart = removeAdaptedChartTitle(adaptChartData(config, data))
	const capabilities = deriveCapabilities(config, baseAdaptedChart)
	return { adaptedChart: baseAdaptedChart, capabilities }
}

function buildChartPresentation(
	config: ChartConfiguration,
	base: ChartPresentationBase,
	chartState: ChartViewState
): ChartRenderPlan {
	const normalizedState = normalizeViewState(chartState, base.capabilities)
	const transformedChart = ChartDataTransformer.applyViewState(base.adaptedChart, normalizedState, base.capabilities)
	return buildRenderPlan(config, transformedChart, normalizedState, base.capabilities)
}

function renderChartContent(
	renderPlan: ChartRenderPlan,
	chartKey: string,
	onChartReady: (instance: echarts.ECharts | null) => void
) {
	switch (renderPlan.rendererKind) {
		case 'cartesian':
			return (
				<Suspense fallback={<div className="h-[338px]" />}>
					<MultiSeriesChart key={chartKey} {...renderPlan.rendererProps} onReady={onChartReady} />
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
	chartInstance: () => echarts.ECharts | null
	exportModel: ChartRenderPlan['exportModel']
	renderPlan: ChartRenderPlan
	chartTitle: string | undefined
	chartId: string
	sessionId: string | null | undefined
	messageId: string | undefined
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
			className={chartToolbarIconButtonStyles}
			filename={renderPlan.filename}
			title={chartTitle}
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
type BasePresentationResult = { ok: true; base: ChartPresentationBase } | { ok: false; error: unknown }

function tryBuildPresentationBase(config: ChartConfiguration, data: ChartDataSeries): BasePresentationResult {
	try {
		return { ok: true, base: buildChartPresentationBase(config, data) }
	} catch (error) {
		console.error('Chart render error:', error)
		return { ok: false, error }
	}
}

function tryBuildPresentation(
	config: ChartConfiguration,
	base: ChartPresentationBase,
	chartState: ChartViewState
): PresentationResult {
	try {
		return { ok: true, plan: buildChartPresentation(config, base, chartState) }
	} catch (error) {
		console.error('Chart render error:', error)
		return { ok: false, error }
	}
}

interface ChartEditorSessionProps {
	config: ChartConfiguration
	original: ChartConfiguration
	data: ChartDataSeries
	initialViewIntent: ChartViewState
	resetView: ChartStyleEditorView
	initialBase: BasePresentationResult | null
	initialControls: ChartRenderPlan['controls']
	categories: Array<string>
	onSave: (draft: ChartConfiguration, patch: ChartStylePatch) => Promise<void>
	onCancel: () => void
}

function ChartEditorSession({
	config,
	original,
	data,
	initialViewIntent,
	resetView,
	initialBase,
	initialControls,
	categories,
	onSave,
	onCancel
}: ChartEditorSessionProps) {
	// Preview changes stay inside the modal. SingleChart only receives the final draft on Save.
	const [preview, setPreview] = useState<{ config: ChartConfiguration; view: ChartViewState }>(() => ({
		config,
		view: initialViewIntent
	}))
	const handlePreview = useCallback((draft: ChartConfiguration, view: ChartStyleEditorView) => {
		setPreview((current) => ({ config: draft, view: { ...current.view, ...view } }))
	}, [])
	const previewBase = useMemo(
		() => (preview.config === config && initialBase ? initialBase : tryBuildPresentationBase(preview.config, data)),
		[preview.config, config, initialBase, data]
	)
	const previewPresentation = useMemo<PresentationResult>(() => {
		if (previewBase.ok === false) return previewBase
		return tryBuildPresentation(preview.config, previewBase.base, preview.view)
	}, [preview.config, preview.view, previewBase])
	const previewControls = previewPresentation.ok ? previewPresentation.plan.controls : initialControls
	const previewState = previewControls.state
	const previewChartKey = `${config.id}-preview-${preview.config.type}-${preview.config.series.map((series) => series.type).join('-')}-${previewState.stacked}-${previewState.percentage}-${previewState.cumulative}-${previewState.grouping}-${previewState.showHallmarks}-${previewState.showLabels}-${previewState.logScale}`

	let previewContent: ReactNode
	if (previewPresentation.ok === false) {
		const errorMsg = previewPresentation.error instanceof Error ? previewPresentation.error.message : 'Unknown error'
		previewContent = (
			<div className="flex flex-col items-center justify-center gap-2 rounded-md bg-ai-error-bg p-1 py-8 text-ai-error-strong">
				<Icon name="alert-triangle" height={16} width={16} />
				<p>{errorMsg}</p>
			</div>
		)
	} else if (!previewPresentation.plan.hasData) {
		previewContent = (
			<div className="flex flex-col items-center justify-center gap-2 p-1 py-8 text-ai-tertiary">
				<Icon name="bar-chart" height={16} width={16} />
				<p>No data available for chart</p>
			</div>
		)
	} else {
		previewContent = renderChartContent(previewPresentation.plan, previewChartKey, noop)
	}

	return (
		<>
			<div className="flex h-[360px] min-h-[360px] shrink-0 items-center justify-center overflow-hidden px-5 lg:h-auto lg:min-h-0 lg:flex-1 lg:overflow-auto lg:p-5">
				<div className="w-full">{previewContent}</div>
			</div>
			<div className="flex w-full shrink-0 flex-col border-t border-ai-line bg-ai-surface lg:h-full lg:min-h-0 lg:w-[340px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
				<ChartStyleEditor
					config={config}
					original={original}
					caps={previewControls}
					categories={categories}
					view={{
						logScale: initialViewIntent.logScale,
						stacked: initialViewIntent.stacked,
						showLabels: initialViewIntent.showLabels,
						percentage: initialViewIntent.percentage
					}}
					resetView={resetView}
					onPreview={handlePreview}
					onSave={onSave}
					onCancel={onCancel}
				/>
			</div>
		</>
	)
}

function SingleChart({
	config: baseConfig,
	data,
	isActive,
	title,
	sessionId,
	messageId,
	readOnly,
	artifactRef,
	onLocalStyleSave
}: SingleChartProps) {
	// authorizedFetch/user come from the shared auth context — real under the LlamaAI provider, an
	// empty object (→ no editor) in ProDashboard, so this is safe everywhere ChartRenderer renders.
	const { authorizedFetch, user } = useAuthContext()
	// Chat messages retain successful saves locally because their persisted payload does not refresh
	// until reload. Editor drafts stay inside ChartStyleEditor and never enter this render pipeline.
	const [appliedConfigOverride, setAppliedConfigOverride] = useState<{
		config: ChartConfiguration
		source: ChartConfiguration
	} | null>(null)
	const [editing, setEditing] = useState(false)
	const appliedConfig =
		appliedConfigOverride && areChartConfigsEqual(appliedConfigOverride.source, baseConfig)
			? appliedConfigOverride.config
			: null
	const config = appliedConfig ?? baseConfig
	const [chartState, dispatch] = useReducer(chartReducer, config, createInitialChartState)
	const chatEditContext = !!authorizedFetch && !!user?.id && !!sessionId && !!messageId
	const canEdit = !readOnly && config.type !== 'candlestick' && (chatEditContext || !!onLocalStyleSave)

	const openArticleExport = useArticleExport()
	const [savingToLibrary, setSavingToLibrary] = useState(false)
	const handleSaveToLibrary = useCallback(async () => {
		if (!authorizedFetch || savingToLibrary) return
		setSavingToLibrary(true)
		try {
			const request: Parameters<typeof saveChartToLibrary>[1] = {
				chartId: baseConfig.id,
				frozen: true
			}
			if (sessionId !== undefined) request.sessionId = sessionId
			if (messageId !== undefined) request.messageId = messageId
			const id = await saveChartToLibrary(authorizedFetch, request)
			if (id) toast.success('Chart saved to your library (frozen)')
			else toast.error('Failed to save chart')
		} finally {
			setSavingToLibrary(false)
		}
		// oxlint-disable-next-line react/memo-dependencies -- React Compiler does not see dependencies read inside an async try/finally; these are correct.
	}, [authorizedFetch, savingToLibrary, baseConfig.id, sessionId, messageId])

	const handleSaveStyle = useCallback(
		async (draft: ChartConfiguration, patch: ChartStylePatch) => {
			if (onLocalStyleSave) {
				let updated = draft
				if (draft.displayOptions) {
					const displayOptions: NonNullable<ChartConfiguration['displayOptions']> = { ...draft.displayOptions }
					if (patch.defaultStacked === undefined) delete displayOptions.defaultStacked
					else displayOptions.defaultStacked = patch.defaultStacked
					if (patch.defaultPercentage === undefined) delete displayOptions.defaultPercentage
					else displayOptions.defaultPercentage = patch.defaultPercentage
					if (patch.defaultLogScale === undefined) delete displayOptions.defaultLogScale
					else displayOptions.defaultLogScale = patch.defaultLogScale
					if (patch.showLabels === undefined) delete displayOptions.showLabels
					else displayOptions.showLabels = patch.showLabels
					updated = { ...draft, displayOptions }
				}
				onLocalStyleSave(updated)
				setAppliedConfigOverride({ config: updated, source: baseConfig })
				dispatch({ type: 'RESET_VIEW', payload: applySavedStyleDefaults(chartState, updated) })
				setEditing(false)
				return
			}
			if (!authorizedFetch || !sessionId || !messageId) return
			const updated = await updateChartStyle(authorizedFetch, {
				sessionId,
				messageId,
				chartId: baseConfig.id,
				style: patch
			})
			setAppliedConfigOverride({ config: updated, source: baseConfig })
			dispatch({ type: 'RESET_VIEW', payload: applySavedStyleDefaults(chartState, updated) })
			setEditing(false)
		},
		[authorizedFetch, sessionId, messageId, onLocalStyleSave, baseConfig, chartState]
	)

	if (!isActive) return null

	return (
		<ActiveSingleChart
			config={config}
			baseConfig={baseConfig}
			data={data}
			chartState={chartState}
			dispatch={dispatch}
			title={title}
			appliedConfig={appliedConfig}
			editing={editing}
			setEditing={setEditing}
			canEdit={canEdit}
			openArticleExport={openArticleExport}
			savingToLibrary={savingToLibrary}
			handleSaveToLibrary={handleSaveToLibrary}
			handleSaveStyle={handleSaveStyle}
			sessionId={sessionId}
			messageId={messageId}
			readOnly={readOnly}
			artifactRef={artifactRef}
		/>
	)
}

function ActiveSingleChart({
	config,
	baseConfig,
	data,
	chartState,
	dispatch,
	title,
	appliedConfig,
	editing,
	setEditing,
	canEdit,
	openArticleExport,
	savingToLibrary,
	handleSaveToLibrary,
	handleSaveStyle,
	sessionId,
	messageId,
	readOnly,
	artifactRef
}: {
	config: ChartConfiguration
	baseConfig: ChartConfiguration
	data: ChartDataSeries
	chartState: ChartViewState
	dispatch: Dispatch<ChartAction>
	title: string | undefined
	appliedConfig: ChartConfiguration | null
	editing: boolean
	setEditing: Dispatch<SetStateAction<boolean>>
	canEdit: boolean
	openArticleExport: ReturnType<typeof useArticleExport>
	savingToLibrary: boolean
	handleSaveToLibrary: () => Promise<void>
	handleSaveStyle: (draft: ChartConfiguration, patch: ChartStylePatch) => Promise<void>
	sessionId: string | null | undefined
	messageId: string | undefined
	readOnly: boolean | undefined
	artifactRef: ChartArtifactRef | undefined
}) {
	// category names (bars/slices) for per-category color pickers on single-series hbar & pie
	const editorCategories = useMemo(() => {
		const field = config.axes?.x?.field
		if (!field || !Array.isArray(data)) return []
		const seen = new Set<string>()
		const out: Array<string> = []
		for (const row of data) {
			if (!isChartDataRow(row)) continue
			const v = row[field]
			const key = v == null ? 'Unknown' : String(v)
			if (!seen.has(key)) {
				seen.add(key)
				out.push(key)
			}
		}
		return out
	}, [data, config])

	const { chartInstance, handleChartReady } = useGetChartInstance()
	useEffect(() => {
		if (!editing) return
		const t = setTimeout(() => window.dispatchEvent(new CustomEvent('chartResize')), 60)
		return () => clearTimeout(t)
	}, [editing])
	const handleStackedChange = useCallback(
		(stacked: boolean) => dispatch({ type: 'SET_STACKED', payload: stacked }),
		[dispatch]
	)
	const handlePercentageChange = useCallback(
		(percentage: boolean) => dispatch({ type: 'SET_PERCENTAGE', payload: percentage }),
		[dispatch]
	)
	const handleCumulativeChange = useCallback(
		(cumulative: boolean) => dispatch({ type: 'SET_CUMULATIVE', payload: cumulative }),
		[dispatch]
	)
	const handleGroupingChange = useCallback(
		(grouping: ChartViewState['grouping']) => dispatch({ type: 'SET_GROUPING', payload: grouping }),
		[dispatch]
	)
	const handleHallmarksChange = useCallback(
		(showHallmarks: boolean) => dispatch({ type: 'SET_HALLMARKS', payload: showHallmarks }),
		[dispatch]
	)
	const handleLabelsChange = useCallback(
		(showLabels: boolean) => dispatch({ type: 'SET_LABELS', payload: showLabels }),
		[dispatch]
	)
	const handleLogScaleChange = useCallback(
		(logScale: boolean) => dispatch({ type: 'SET_LOG_SCALE', payload: logScale }),
		[dispatch]
	)
	const handleOpenStyleEditor = useCallback(() => setEditing(true), [setEditing])
	const handleCancelStyleEditor = useCallback(() => setEditing(false), [setEditing])

	// The adapted chart and intrinsic capabilities depend only on base inputs. View controls
	// always transform from this canonical result so state toggles never repeat adaptation.
	const basePresentation = useMemo(
		() => (config.type === 'candlestick' ? null : tryBuildPresentationBase(config, data)),
		[config, data]
	)
	const presentation = useMemo<PresentationResult | null>(() => {
		if (!basePresentation) return null
		if (basePresentation.ok === false) return basePresentation
		return tryBuildPresentation(config, basePresentation.base, chartState)
	}, [config, basePresentation, chartState])

	// A locally applied config carries the freshest title; the title prop
	// comes from message/node state, which in chat only refreshes on reload.
	const chartTitle = appliedConfig?.title ?? title ?? config.title
	const addToDashboardButton =
		canAddChartArtifactToDashboard(artifactRef, readOnly) && artifactRef ? (
			<AddToDashboardButton
				chartConfig={null}
				llamaAIChart={{ chartId: config.id, title: chartTitle ?? config.id, artifactRef }}
				variant="icon"
				smol
			/>
		) : null

	if (config.type === 'candlestick') {
		const candlestickData = adaptCandlestickData(config, data)
		const candlestickProps =
			candlestickData.indicators === undefined
				? { data: candlestickData.data }
				: { data: candlestickData.data, indicators: candlestickData.indicators }
		return (
			<div className="flex flex-col p-2" data-chart-id={config.id}>
				{addToDashboardButton ? <div className="flex justify-end">{addToDashboardButton}</div> : null}
				<Suspense fallback={<div className="h-[480px]" />}>
					<CandlestickChart {...candlestickProps} />
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
	const chartKey = `${config.id}-${normalizedState.stacked}-${normalizedState.percentage}-${normalizedState.cumulative}-${normalizedState.grouping}-${normalizedState.showHallmarks}-${normalizedState.showLabels}-${normalizedState.logScale}`
	const chartContent = renderChartContent(renderPlan, chartKey, handleChartReady)
	const controls = title === undefined ? renderPlan.controls : { ...renderPlan.controls, title }

	return (
		<div className="flex flex-col *:[2n-1]:m-2" data-chart-id={config.id}>
			<ChartControls
				controls={controls}
				onStackedChange={handleStackedChange}
				onPercentageChange={handlePercentageChange}
				onCumulativeChange={handleCumulativeChange}
				onGroupingChange={handleGroupingChange}
				onHallmarksChange={handleHallmarksChange}
				onLabelsChange={handleLabelsChange}
				onLogScaleChange={handleLogScaleChange}
				onOpenStyleEditor={canEdit ? handleOpenStyleEditor : undefined}
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
				{addToDashboardButton}
				{canEdit ? (
					<Button
						type="button"
						size="md"
						square
						onClick={handleOpenStyleEditor}
						title="Edit chart style"
						aria-label="Edit chart style"
					>
						<Icon name="settings" height={14} width={14} />
					</Button>
				) : null}
				{openArticleExport && messageId && !readOnly ? (
					<>
						<Button
							type="button"
							size="md"
							square
							onClick={() => void handleSaveToLibrary()}
							disabled={savingToLibrary}
							title="Save chart (frozen data)"
							aria-label="Save chart (frozen data)"
						>
							<Icon name="bookmark" height={14} width={14} />
						</Button>
						<Button
							type="button"
							size="md"
							square
							onClick={() => {
								const request: ArticleExportRequest = {
									kind: 'chart',
									chartId: baseConfig.id,
									charts: { [baseConfig.id]: { config: baseConfig, data } },
									messageId
								}
								if (sessionId !== undefined) request.sessionId = sessionId
								openArticleExport(request)
							}}
							title="Add to research article"
							aria-label="Add to research article"
						>
							<Icon name="file-plus" height={14} width={14} />
						</Button>
					</>
				) : null}
			</ChartControls>
			{chartContent}
			{editing && canEdit ? (
				<ChartEditorModal title={chartTitle} onClose={handleCancelStyleEditor}>
					<ChartEditorSession
						config={config}
						original={baseConfig}
						data={data}
						// Keep raw view intent so capabilities introduced by a draft (such as the first
						// annotation) can become active. The preview pipeline normalizes it per draft.
						initialViewIntent={chartState}
						resetView={{
							logScale: baseConfig.displayOptions?.defaultLogScale ?? false,
							stacked: baseConfig.displayOptions?.defaultStacked ?? false,
							showLabels: baseConfig.displayOptions?.showLabels ?? false,
							percentage: baseConfig.displayOptions?.defaultPercentage ?? false
						}}
						initialBase={basePresentation}
						initialControls={renderPlan.controls}
						categories={editorCategories}
						onSave={handleSaveStyle}
						onCancel={handleCancelStyleEditor}
					/>
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
			<div className="relative flex h-[85dvh] max-h-[560px] w-full max-w-5xl flex-col overflow-y-auto overscroll-contain rounded-xl border border-ai-line bg-ai-surface-card shadow-2xl lg:flex-row lg:overflow-hidden">
				<div className="flex shrink-0 items-center justify-between border-b border-ai-line px-4 py-2.5 lg:hidden">
					<span className="truncate text-sm font-semibold text-secondary">{title ?? 'Edit chart'}</span>
					<Button type="button" variant="ghost" size="md" square onClick={onClose} aria-label="Close editor">
						<Icon name="x" className="size-4" aria-hidden="true" />
					</Button>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="md"
					square
					onClick={onClose}
					aria-label="Close editor"
					className="absolute top-2.5 right-2.5 z-10 hidden lg:flex"
				>
					<Icon name="x" className="size-4" aria-hidden="true" />
				</Button>
				{children}
			</div>
		</div>,
		document.body
	)
}

function ChartLoadingSpinner() {
	return <div className="size-4 animate-spin rounded-full border-b-2 border-ai-accent-blue" />
}

function ChartLoadingPlaceholder({ chartTypes }: { chartTypes: Array<string> | undefined }) {
	return (
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
}

function ChartErrorPlaceholder() {
	return (
		<div className="flex flex-col items-center justify-center gap-2 rounded-md bg-ai-error-bg p-1 py-8 text-ai-error-strong">
			<Icon name="alert-triangle" height={16} width={16} />
			<p>Chart generation encountered an issue</p>
		</div>
	)
}

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
	artifactRefs,
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
				artifactRefs,
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
	resizeTrigger,
	sessionId,
	messageId,
	readOnly,
	artifactRefs,
	onLocalStyleSave
}: ChartRendererRuntimeProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [selectedChartId, setSelectedChartId] = useState(charts[0]?.id)
	const activeChartId = charts.some((chart) => chart.id === selectedChartId) ? selectedChartId : charts[0]?.id

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
		if (resizeTrigger <= 0) return undefined
		const timer = setTimeout(() => {
			window.dispatchEvent(new CustomEvent('chartResize'))
		}, 100)
		return () => clearTimeout(timer)
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
					{charts.map((chart) => (
						<button
							type="button"
							key={`toggle-${chart.id}`}
							onClick={() => setSelectedChartId(chart.id)}
							className={`border-b-2 px-2 py-1.5 text-sm transition-colors ${
								activeChartId === chart.id
									? 'border-brand text-brand'
									: 'border-transparent text-ai-tertiary hover:text-ai-primary'
							}`}
						>
							{chart.title}
						</button>
					))}
				</div>
			) : null}
			{charts.map((chart) => {
				// Backend sessions before the keyed chart-data transition (commit a6035b1)
				// stored one flat row array. PR #2666 kept this branch load-bearing.
				const data = Array.isArray(chartData) ? chartData : chartData?.[chart.datasetName || chart.id] || []
				return (
					<SingleChart
						key={chart.id}
						config={chart}
						data={data}
						isActive={!hasMultipleCharts || activeChartId === chart.id}
						title={chart.title}
						sessionId={sessionId}
						messageId={messageId}
						readOnly={readOnly}
						artifactRef={artifactRefs?.[chart.id]}
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
		prev.artifactRefs === next.artifactRefs &&
		prev.onLocalStyleSave === next.onLocalStyleSave &&
		areStringArraysEqual(prev.chartTypes, next.chartTypes) &&
		areChartsEqual(prev.charts, next.charts) &&
		areChartDataEqual(prev.chartData, next.chartData)
	)
})

ChartRendererMemoized.displayName = 'ChartRenderer'
