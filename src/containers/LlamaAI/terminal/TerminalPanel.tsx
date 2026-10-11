import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useAuthContext } from '~/auth'
import { subscribeToAuthStore } from '~/auth/authStore'
import { getChartTheme } from '~/components/ECharts/shared/chartTheme'
import { authorizedFetchAsFetch } from '~/containers/LlamaAI/authorizedFetchAdapter'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { ChartPanel } from '~/ui/ChartPanel'
import { SurfaceBodyStatus } from '~/ui/Status'
import { scheduleTerminalChatSave } from './terminalChatState'
import {
	belongsOnPricePane,
	createTerminalDatafeed,
	createTerminalStudies,
	defaultEntityFor,
	defaultSourceFor,
	fetchTerminalEntities,
	isAgentTicker,
	loadTerminalScript,
	plotOverridesFor,
	postStudyCatalogue,
	readSymbolInput,
	setCurrentTerminalEntity,
	SOURCE_INPUT_ID,
	STUDY_NAME
} from './terminalData'
import { runTerminalIndicators } from './terminalIndicators'
import { mountTerminalLayerControls } from './terminalLayers'
import { fetchTerminalLayout, getTerminalLayoutSession, startTerminalLayoutAutoSave } from './terminalLayout'
import { TerminalMarketStrip } from './TerminalMarketStrip'
import {
	followTerminalSymbol,
	pruneDeletedTerminalDrawings,
	readTerminalContext,
	replayTerminalDrawings,
	syncTerminalDrawing
} from './terminalOps'
import { releaseTerminalBars } from './terminalSocket'
import {
	chartTicker,
	getTerminalSymbol,
	peekRequestedTerminalSymbol,
	setTerminalSymbol,
	settleRequestedTerminalSymbol,
	setTerminalWidget,
	useTerminalSymbol,
	type TerminalChart,
	type TerminalWidget
} from './terminalViewStore'

const LIBRARY_PATH = '/assets/charting_library/'
const LIBRARY_SCRIPT = `${LIBRARY_PATH}charting_library.standalone.js`

declare global {
	interface Window {
		TradingView?: { widget: new (options: Record<string, unknown>) => TerminalWidget; version?: () => string }
	}
}

async function styleStudy(chart: TerminalChart, entityId: string, styled: Map<string, string>, fetchFn: typeof fetch) {
	if (!chart.getAllStudies().some((study) => study.id === entityId && study.name === STUDY_NAME)) return
	const study = chart.getStudyById(entityId)
	const existing = readSymbolInput(study.getInputValues().find((input) => input.id === SOURCE_INPUT_ID)?.value)
	// An agent series carries its own pane and plot style from the op that created it.
	if (isAgentTicker(existing)) return
	let source = existing
	if (!source) {
		source = defaultSourceFor(await fetchTerminalEntities(getTerminalSymbol(), fetchFn))
		if (!source) return
		study.setInputValues([{ id: SOURCE_INPUT_ID, value: source }])
	}
	// Styling a study fires the same event that brought us here, so a source we have
	// already shaped is left alone and the loop ends after one pass.
	if (styled.get(entityId) === source) return
	styled.set(entityId, source)
	// Switching metric on a live study has to move it too: a flow left on the price pane
	// draws bars straight over the candles.
	if (belongsOnPricePane(source)) {
		if (study.paneIndex() > 0) study.mergeUp()
		// Its own axis, or a $7B series shares the $90 price scale and disappears.
		study.changePriceScale('new-left')
	} else if (study.paneIndex() === 0) {
		study.unmergeDown()
	}
	study.applyOverrides(plotOverridesFor(source))
}

export function TerminalPanel() {
	const { authorizedFetch, user } = useAuthContext()
	const userId = user?.id
	const layoutSession = useSyncExternalStore(
		subscribeToAuthStore,
		() => (userId ? getTerminalLayoutSession(userId) : null),
		() => null
	)
	const fetchFn = useMemo(() => authorizedFetchAsFetch(authorizedFetch), [authorizedFetch])
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<TerminalChart | null>(null)
	const styledRef = useRef(new Map<string, string>())
	const [isDarkMode] = useDarkModeManager()
	const symbol = useTerminalSymbol()
	const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

	// A saved indicator re-runs on the server with no model call, but a pan still fires an event per
	// frame. 600ms is the floor of the measured round trip, so the gesture coalesces into one run
	// and a run is never overtaken by the next one; the server cache absorbs the repeats.
	const runIndicators = useDebouncedCallback(() => {
		const { symbol: current, interval, from, to } = readTerminalContext()
		void runTerminalIndicators({ symbol: current, interval, from, to }, fetchFn)
	}, 600)

	useEffect(() => {
		let cancelled = false
		setCurrentTerminalEntity(null)
		fetchTerminalEntities(symbol, fetchFn)
			.then((next) => {
				if (!cancelled) setCurrentTerminalEntity(defaultEntityFor(next))
			})
			.catch(() => undefined)
		return () => {
			cancelled = true
		}
	}, [symbol, fetchFn])

	// A study's default source cannot know the chart symbol — metainfo is static per registration —
	// so an empty one is filled the moment it appears, however it was added.
	const adoptStudy = useCallback(
		async (entityId: string) => {
			const chart = chartRef.current
			if (!chart) return
			try {
				await styleStudy(chart, entityId, styledRef.current, fetchFn)
			} catch {
				// A study removed between the event and this handler is not worth reporting.
			}
		},
		[fetchFn]
	)

	useEffect(() => {
		if (!layoutSession) return
		let widget: TerminalWidget | null = null
		let stopAutoSave: (() => void) | null = null
		let cancelled = false
		// A saved layout carries its own symbol, and the widget's `symbol` option overrides it, so
		// the option is only passed when something outside the chart actually asked for a symbol.
		const requestedSymbol = peekRequestedTerminalSymbol()

		Promise.all([
			loadTerminalScript(LIBRARY_SCRIPT),
			createTerminalDatafeed({ fetchFn }),
			fetchTerminalLayout(layoutSession, fetchFn)
		])
			.then(([, datafeed, savedLayout]) => {
				if (cancelled || layoutSession.controller.signal.aborted || !containerRef.current || !window.TradingView) return
				const initialSymbol = requestedSymbol ?? (savedLayout ? null : getTerminalSymbol())
				const chartTheme = getChartTheme(isDarkMode)
				const surfaceColor = getComputedStyle(containerRef.current).backgroundColor
				widget = new window.TradingView.widget({
					container: containerRef.current,
					library_path: LIBRARY_PATH,
					datafeed,
					...(initialSymbol && { symbol: initialSymbol }),
					...(savedLayout && { saved_data: savedLayout }),
					interval: '1D',
					// The library throttles the event to one save per second rather than per keystroke.
					auto_save_delay: 1,
					locale: 'en',
					theme: isDarkMode ? 'dark' : 'light',
					autosize: true,
					timezone: 'Etc/UTC',
					loading_screen: { backgroundColor: surfaceColor, foregroundColor: chartTheme.axisLabel },
					overrides: {
						'paneProperties.backgroundType': 'solid',
						'paneProperties.background': surfaceColor,
						'paneProperties.vertGridProperties.color': chartTheme.gridline,
						'paneProperties.horzGridProperties.color': chartTheme.gridline,
						'scalesProperties.textColor': chartTheme.axisLabel,
						'mainSeriesProperties.candleStyle.upColor': chartTheme.up,
						'mainSeriesProperties.candleStyle.downColor': chartTheme.down,
						'mainSeriesProperties.candleStyle.borderUpColor': chartTheme.up,
						'mainSeriesProperties.candleStyle.borderDownColor': chartTheme.down,
						'mainSeriesProperties.candleStyle.wickUpColor': chartTheme.up,
						'mainSeriesProperties.candleStyle.wickDownColor': chartTheme.down
					},
					custom_indicators_getter: createTerminalStudies({ up: chartTheme.up, down: chartTheme.down }),
					// localStorage settings are off, so this seed applies on every load rather than
					// being shadowed by whatever a browser happens to remember.
					favorites: { indicators: [STUDY_NAME], intervals: ['15', '60', '240', '1D'] },
					enabled_features: ['items_favoriting'],
					// Internal analytics switch in TradingView v32.2.0; recheck when upgrading the vendor build.
					disabled_features: ['use_localstorage_for_settings', 'header_compare', 'header_saveload', '14851']
				})
				widget.onChartReady(() => {
					if (cancelled || layoutSession.controller.signal.aborted || !widget) return
					const chart = widget.activeChart()
					chartRef.current = chart
					const pendingSymbol = peekRequestedTerminalSymbol()
					if (pendingSymbol) settleRequestedTerminalSymbol(pendingSymbol)
					if (pendingSymbol && pendingSymbol !== chartTicker(chart)) void chart.setSymbol(pendingSymbol)
					setTerminalWidget(widget)
					// The backend can only validate an indicator against the list this build accepts.
					postStudyCatalogue(widget, fetchFn)
					widget.subscribe('study_event', (entityId, eventType) => {
						if (eventType === 'create') void adoptStudy(entityId)
						if (eventType === 'remove') styledRef.current.delete(entityId)
					})
					// Changing the source is how a user switches metric, and the plot has to follow.
					widget.subscribe('study_properties_changed', (entityId) => void adoptStudy(entityId))
					widget.subscribe('drawing_event', (entityId, eventType) => {
						if (cancelled) return
						if (eventType === 'remove') setTimeout(pruneDeletedTerminalDrawings)
						else if (eventType === 'points_changed' || eventType === 'properties_changed') syncTerminalDrawing(entityId)
					})
					// A restored layout can open on a different symbol than the store's, and that
					// arrives without a change event, so the toolbar and the entity lookup are synced
					// from the chart itself.
					setTerminalSymbol(pendingSymbol ?? chartTicker(chart))
					chart.onSymbolChanged().subscribe(null, () => {
						// The agent's levels belong to the symbol it drew them on.
						followTerminalSymbol(chart)
						setTerminalSymbol(chartTicker(chart))
						// A saved script takes its symbol from the request, so it follows the chart.
						runIndicators()
						scheduleTerminalChatSave()
					})
					chart.onIntervalChanged().subscribe(null, () => scheduleTerminalChatSave())
					chart.onVisibleRangeChanged().subscribe(null, () => runIndicators())
					stopAutoSave = startTerminalLayoutAutoSave(layoutSession, widget, fetchFn)
					void mountTerminalLayerControls(widget, fetchFn).catch(() => undefined)
					replayTerminalDrawings()
					// Reopening the terminal rebuilds the widget, so this is the "on reopen" run.
					runIndicators()
					setStatus('ready')
				})
			})
			.catch(() => {
				if (!cancelled) setStatus('missing')
			})

		return () => {
			cancelled = true
			chartRef.current = null
			setTerminalWidget(null)
			releaseTerminalBars()
			// Flushed before the widget goes away, or an edit made inside the throttle window dies
			// with it.
			stopAutoSave?.()
			widget?.remove()
		}
	}, [layoutSession, isDarkMode, fetchFn, adoptStudy, runIndicators])

	useEffect(() => {
		const chart = chartRef.current
		if (!chart || chartTicker(chart) === symbol) return
		settleRequestedTerminalSymbol(symbol)
		void chart.setSymbol(symbol)
	}, [symbol])

	return (
		<section aria-label="Terminal" className="hidden min-w-0 flex-1 flex-col gap-2 lg:flex">
			<TerminalMarketStrip symbol={symbol} fetchFn={fetchFn} />
			<ChartPanel className="min-h-0 flex-1 overflow-hidden">
				{status === 'missing' ? (
					<SurfaceBodyStatus variant="error">
						Couldn't load the charting library from public/assets/charting_library and public/assets/datafeeds.
					</SurfaceBodyStatus>
				) : (
					<div ref={containerRef} className="min-h-0 flex-1 bg-surface" />
				)}
			</ChartPanel>
		</section>
	)
}
