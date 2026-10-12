import type * as echarts from 'echarts/core'
import {
	type Dispatch,
	lazy,
	memo,
	type ReactNode,
	type SetStateAction,
	Suspense,
	useCallback,
	useMemo,
	useReducer,
	useState
} from 'react'
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
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { InlineStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { TabPanel, Tabs, UnderlineTabList } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const noop = () => {}

const CandlestickChart = lazy(() => import('~/components/ECharts/CandlestickChart'))
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))
const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))
const ScatterChart = lazy(() => import('~/components/ECharts/ScatterChart'))
// Every chat chart renders at this height unless its caller sizes it, so the loading placeholder reserves the same
const CHAT_CHART_HEIGHT = 360

interface ChartRendererProps {
	charts: Array<ChartConfiguration>
	chartData: ChartDataSeries | ChartDataByKey
	isLoading?: boolean
	hasError?: boolean
	chartTypes?: Array<string>
	sessionId?: string | null
	messageId?: string
	readOnly?: boolean
	height?: number
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
	sessionId: string | null | undefined
	messageId: string | undefined
	readOnly: boolean | undefined
	height: number | undefined
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
	height: number | undefined
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
	onChartReady: (instance: echarts.ECharts | null) => void,
	height = CHAT_CHART_HEIGHT
) {
	const heightProp = { height: `${height}px` }
	const fallback = <div style={{ height }} />
	switch (renderPlan.rendererKind) {
		case 'cartesian':
			return (
				<Suspense fallback={fallback}>
					<MultiSeriesChart key={chartKey} {...renderPlan.rendererProps} {...heightProp} onReady={onChartReady} />
				</Suspense>
			)
		case 'hbar':
			return (
				<Suspense fallback={fallback}>
					<HBarChart key={chartKey} {...renderPlan.rendererProps} {...heightProp} onReady={onChartReady} />
				</Suspense>
			)
		case 'pie':
			return (
				<Suspense fallback={fallback}>
					<PieChart key={chartKey} {...renderPlan.rendererProps} {...heightProp} onReady={onChartReady} />
				</Suspense>
			)
		case 'scatter':
			return (
				<Suspense fallback={fallback}>
					<ScatterChart key={chartKey} {...renderPlan.rendererProps} {...heightProp} onReady={onChartReady} />
				</Suspense>
			)
		default:
			return <ChartErrorPlaceholder message="Unsupported chart type" />
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
	chartTitle?: string
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
	chartTitle,
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
		previewContent = <ChartErrorPlaceholder />
	} else if (!previewPresentation.plan.hasData) {
		previewContent = (
			<div className="flex flex-col items-center justify-center gap-2 p-1 py-8 text-tertiary">
				<Icon name="bar-chart-2" className="size-4" />
				<p>No data available for chart</p>
			</div>
		)
	} else {
		previewContent = renderChartContent(previewPresentation.plan, previewChartKey, noop)
	}

	return (
		<ChartStyleEditor
			chartTitle={chartTitle}
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
			preview={previewContent}
		/>
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
	height,
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
		const save = async () => {
			const request: Parameters<typeof saveChartToLibrary>[1] = {
				chartId: baseConfig.id,
				frozen: true
			}
			if (sessionId !== undefined) request.sessionId = sessionId
			if (messageId !== undefined) request.messageId = messageId
			const id = await saveChartToLibrary(authorizedFetch, request)
			if (id) toast.success('Chart saved to your library (frozen)')
			else toast.error("Couldn't save the chart.")
		}
		setSavingToLibrary(true)
		// Promise.finally rather than a try/finally statement, which the compiler cannot lower. A throw
		// still propagates after the flag clears, which is what the finalizer did.
		await save().finally(() => setSavingToLibrary(false))
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
			height={height}
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
	height,
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
	height: number | undefined
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
				<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[480px]" />}>
					<CandlestickChart {...candlestickProps} containerClassName="min-h-[480px]" />
				</Suspense>
			</div>
		)
	}

	if (!presentation) {
		return null
	}

	if (presentation.ok === false) {
		return <ChartErrorPlaceholder />
	}

	const renderPlan = presentation.plan

	if (!renderPlan.hasData) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-1 py-8 text-tertiary">
				<Icon name="bar-chart-2" className="size-4" />
				<p>No data available for chart</p>
			</div>
		)
	}

	const normalizedState = renderPlan.controls.state
	const exportModel = renderPlan.exportModel
	const chartKey = `${config.id}-${normalizedState.stacked}-${normalizedState.percentage}-${normalizedState.cumulative}-${normalizedState.grouping}-${normalizedState.showHallmarks}-${normalizedState.showLabels}-${normalizedState.logScale}`
	const chartContent = renderChartContent(renderPlan, chartKey, handleChartReady, height)
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
					<Tooltip
						content="Edit chart style"
						render={
							<Button type="button" size="md" square onClick={handleOpenStyleEditor} aria-label="Edit chart style" />
						}
					>
						<Icon name="settings" className="size-4" />
					</Tooltip>
				) : null}
				{openArticleExport && messageId && !readOnly ? (
					<>
						<Tooltip
							content="Save chart (frozen data)"
							render={
								<Button
									type="button"
									size="md"
									square
									onClick={() => void handleSaveToLibrary()}
									pendingLabel="Saving…"
									pending={savingToLibrary}
									aria-label="Save chart (frozen data)"
								/>
							}
						>
							<Icon name="bookmark" className="size-4" />
						</Tooltip>
						<Tooltip
							content="Add to research article"
							render={
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
									aria-label="Add to research article"
								/>
							}
						>
							<Icon name="file-plus" className="size-4" />
						</Tooltip>
					</>
				) : null}
			</ChartControls>
			{chartContent}
			{editing && canEdit ? (
				<ChartEditorSession
					chartTitle={chartTitle}
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
			) : null}
		</div>
	)
}

function ChartLoadingPlaceholder({ chartTypes }: { chartTypes: Array<string> | undefined }) {
	const label = chartTypes?.length
		? `Creating ${chartTypes.join(', ')} visualization${chartTypes.length > 1 ? 's' : ''}`
		: 'Creating visualization'
	return <SurfaceBodyLoadingStatus label={label} />
}

// Readers see one plain sentence; a builder's exception text ("Cannot read properties of undefined") is not for them.
// The notice box, not SurfaceBodyStatus's red line: a chart that failed to draw reads like the chat's other failures.
function ChartErrorPlaceholder({ message = 'This chart couldn’t be drawn.' }: { message?: string }) {
	return (
		<div className="m-auto flex items-center justify-center px-4 initial:min-h-[360px]">
			<InlineStatus variant="error">{message}</InlineStatus>
		</div>
	)
}

export function ChartRenderer({
	charts,
	chartData,
	isLoading = false,
	hasError = false,
	chartTypes,
	sessionId,
	messageId,
	readOnly,
	height,
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
				sessionId,
				messageId,
				readOnly,
				height,
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
	sessionId,
	messageId,
	readOnly,
	height,
	artifactRefs,
	onLocalStyleSave
}: ChartRendererRuntimeProps) {
	const [selectedChartId, setSelectedChartId] = useState(charts[0]?.id)
	const activeChartId = charts.some((chart) => chart.id === selectedChartId) ? selectedChartId : charts[0]?.id

	// Without a chart yet, the placeholder gets the chart card's frame, so loading, loaded and failed share one box.
	if (hasError && (!charts || charts.length === 0)) {
		return (
			<Card padding="none">
				<ChartErrorPlaceholder />
			</Card>
		)
	}

	if (isLoading && (!charts || charts.length === 0)) {
		return (
			<Card padding="none">
				<ChartLoadingPlaceholder chartTypes={chartTypes} />
			</Card>
		)
	}

	if (!isLoading && !hasError && (!charts || charts.length === 0)) {
		return null
	}

	const hasMultipleCharts = charts.length > 1
	const renderChart = (chart: (typeof charts)[number]) => {
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
				height={height}
				artifactRef={artifactRefs?.[chart.id]}
				onLocalStyleSave={onLocalStyleSave}
			/>
		)
	}

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface pt-2">
			{hasMultipleCharts ? (
				<Tabs value={activeChartId!} onValueChange={setSelectedChartId} values={charts.map((chart) => chart.id)}>
					<UnderlineTabList
						label="Charts"
						tabs={charts.map((chart) => ({ id: chart.id, label: chart.title }))}
						className="-mt-2"
					/>
					{charts.map((chart) => (
						<TabPanel key={chart.id} value={chart.id}>
							{renderChart(chart)}
						</TabPanel>
					))}
				</Tabs>
			) : (
				charts.map(renderChart)
			)}
		</div>
	)
}

const ChartRendererMemoized = memo(ChartRendererImpl, (prev, next) => {
	return (
		prev.isLoading === next.isLoading &&
		prev.hasError === next.hasError &&
		prev.sessionId === next.sessionId &&
		prev.messageId === next.messageId &&
		prev.readOnly === next.readOnly &&
		prev.height === next.height &&
		prev.artifactRefs === next.artifactRefs &&
		prev.onLocalStyleSave === next.onLocalStyleSave &&
		areStringArraysEqual(prev.chartTypes, next.chartTypes) &&
		areChartsEqual(prev.charts, next.charts) &&
		areChartDataEqual(prev.chartData, next.chartData)
	)
})

ChartRendererMemoized.displayName = 'ChartRenderer'
