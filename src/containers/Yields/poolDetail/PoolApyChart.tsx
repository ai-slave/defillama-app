import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo, useRef } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { ChartGroupingSelector, type ChartGroupingOption } from '~/components/ECharts/shared/ChartGroupingSelector'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useNowSecondsOnce } from '~/hooks/useNowSeconds'
import { CHART_FILL, ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { LoadingIndicator } from '~/ui/Status'
import { formatPercent, formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { writeStickyPref } from '../stickyQueryPrefs'
import { useSubscribeProModal } from '../useSubscribeProModal'
import { ChartMetricsPicker, type ChartMetricGroup, type ChartMetricOption } from './ChartMetricsPicker'
import { fetchBorrowMarketDetailHistory } from './fetch'
import { YIELD_PERCENT_OPTIONS } from './format'
import {
	buildBorrowChart,
	buildSupplyChart,
	CHART_PALETTE,
	type ChartColorKey,
	hasDrawableDay,
	type PoolChartBar,
	type PoolChartLine,
	type PoolChartModel,
	VERIFIED_APY_SERIES
} from './poolCharts'
import { rangeCount } from './poolChartUtils'
import { PoolRangeControl } from './PoolRangeControl'
import {
	getBooleanOverride,
	getPoolChartWindow,
	getPoolRange,
	getPoolSeriesQueryKey,
	getSeriesVisibility,
	getWindowQueryPatch,
	getWindowQueryValue,
	POOL_CHART_WINDOW_PREFS,
	type PoolChartWindow
} from './queryState'
import { getChartTooltipItems, getChartTooltipTimestamp, getChartTooltipValue, type ChartTooltipItem } from './tooltip'
import type { PoolHistoryRange } from './types'
import { useVerifiedHistoryFetcher } from './useVerifiedHistory'
import { useWidestHistory } from './useWidestHistory'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

// ChartGroupingSelector renders shortLabel (falling back to the label's first letter).
const WINDOW_OPTIONS = [
	{ value: 'daily', label: 'Daily values', shortLabel: 'Daily' },
	{ value: '7d', label: '7-day average', shortLabel: '7d avg' },
	{ value: '30d', label: '30-day average', shortLabel: '30d avg' }
] as const satisfies ReadonlyArray<ChartGroupingOption<PoolChartWindow>>

// Single source for a toggleable series: its default feeds the URL override read, the picker
// option, and getBooleanOverride, so the three can never disagree.
interface SeriesDef {
	key: string
	label: string
	colorKey: ChartColorKey
	defaultEnabled: boolean
	group: 'apy' | 'overlay'
}

function fmtVal(v: number, symbol: string): string {
	if (!Number.isFinite(v)) return '-'
	return symbol === '$' ? formatUsd(v, USD_LOWERCASE_MILLIONS_OPTIONS) : formatPercent(v, YIELD_PERCENT_OPTIONS)
}

// A rate line that ships its windows (the measured APY) follows the smoothing window like the
// bars; a dollar magnitude has none and stays daily.
function windowedLine(line: PoolChartLine, apyWindow: PoolChartWindow): { name: string; values: Array<number | null> } {
	if (line.unit !== 'percent' || !line.avg7 || !line.avg30) return { name: line.label, values: line.values }
	const rateSuffix = apyWindow === 'daily' ? '' : ` (${apyWindow} avg)`
	return {
		name: line.label + rateSuffix,
		values: apyWindow === 'daily' ? line.values : apyWindow === '7d' ? line.avg7 : line.avg30
	}
}

// One smoothing window governs every rate series — bars and the net line render their
// precomputed daily/7d/30d arrays — so whatever is plotted stays like-for-like.
function buildChartInputs(
	model: PoolChartModel,
	enabled: Record<string, boolean>,
	apyWindow: PoolChartWindow,
	range: PoolHistoryRange,
	isDark: boolean,
	nowMs: number
): { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig>; hasData: boolean } {
	const resolve = (key: ChartColorKey) => CHART_PALETTE[key][isDark ? 1 : 0]
	const standIn = model.bars.find((b) => enabled[b.key] === true && b.replaces != null)
	const renderedBars = model.bars.filter((b) => enabled[b.key] === true && b.key !== standIn?.replaces)
	// The verified view spans the measured days only: from the first reading to yesterday, since the
	// days before have no base to draw and today's reading only completes at the next anchor.
	const today = nowMs - (nowMs % 86_400_000)
	const total = model.dates.length - (standIn && model.dates[model.dates.length - 1]! >= today ? 1 : 0)
	const measuredFrom = standIn ? standIn.values.findIndex((value) => value != null) : 0
	const start = Math.min(total, Math.max(total - rangeCount(range, total), measuredFrom))
	const netLine = model.net && model.netLine && enabled[model.netLine.key] === true ? model.netLine : null
	// Resolve names/windows once per chart build. Calling `windowedLine` inside the point loop used to
	// allocate one wrapper per line per day (thousands on long histories).
	const enabledLines = model.lines
		.filter((line) => enabled[line.key] === true)
		.map((line) => ({ line, ...windowedLine(line, apyWindow) }))
	const windowValues = (series: {
		values: Array<number | null>
		avg7: Array<number | null>
		avg30: Array<number | null>
	}) => (apyWindow === 'daily' ? series.values : apyWindow === '7d' ? series.avg7 : series.avg30)
	// Rate series carry the window in their name so the tooltip, legend and CSV export can
	// never present an averaged value under a daily label.
	const rateSuffix = apyWindow === 'daily' ? '' : ` (${apyWindow} avg)`

	const dimensions: Array<string> = ['timestamp']
	const charts: Array<MultiSeriesChartSeriesConfig> = []

	for (const b of renderedBars) {
		const dimensionIndex = dimensions.length
		dimensions.push(b.label + rateSuffix)
		charts.push({
			type: 'bar',
			name: b.label + rateSuffix,
			encode: { x: 0, y: dimensionIndex },
			stack: 'apy',
			color: resolve(b.colorKey),
			yAxisIndex: 0,
			barMaxWidth: 16,
			...(model.net ? { excludeFromTooltipTotal: true } : {})
		})
	}

	if (netLine) {
		const dimensionIndex = dimensions.length
		dimensions.push(netLine.label + rateSuffix)
		charts.push({
			type: 'line',
			name: netLine.label + rateSuffix,
			encode: { x: 0, y: dimensionIndex },
			color: resolve(netLine.colorKey),
			yAxisIndex: 0,
			hideAreaStyle: true
		})
	}

	// Dollar overlays take the secondary axis; a percent overlay shares the rate axis and stays out
	// of the stacked total.
	for (const { line, name } of enabledLines) {
		const dimensionIndex = dimensions.length
		dimensions.push(name)
		charts.push({
			type: 'line',
			name,
			encode: { x: 0, y: dimensionIndex },
			color: resolve(line.colorKey),
			yAxisIndex: line.unit === 'percent' ? 0 : 1,
			valueSymbol: line.unit === 'percent' ? '%' : '$',
			...(line.unit === 'percent' ? { hideAreaStyle: true, excludeFromTooltipTotal: true } : {})
		})
	}

	const rows = new Array<MultiSeriesChartDataset['source'][number]>(total - start)
	for (let sourceIndex = start, rowIndex = 0; sourceIndex < total; sourceIndex++, rowIndex++) {
		const row = new Array<number | null>(dimensions.length)
		row[0] = model.dates[sourceIndex]!
		let dimensionIndex = 1
		for (const bar of renderedBars) {
			const value = windowValues(bar)[sourceIndex]
			row[dimensionIndex++] = value == null ? null : value * (bar.sign ?? 1)
		}
		if (netLine) row[dimensionIndex++] = windowValues(netLine)[sourceIndex] ?? null
		for (const { values } of enabledLines) row[dimensionIndex++] = values[sourceIndex] ?? null
		rows[rowIndex] = row
	}

	// An all-null window (a young pool's 30d average) must show a message, not blank axes.
	const hasData = rows.some((row) => row.some((value, index) => index > 0 && value != null))

	return { dataset: { source: rows, dimensions }, charts, hasData }
}

const li = (inner: string, extra = '') => `<li style="list-style:none;${extra}">${inner}</li>`

const valueOf = (p: ChartTooltipItem): number | null => {
	const raw = getChartTooltipValue(p)
	const n = typeof raw === 'number' ? raw : raw == null ? null : Number(raw)
	return n != null && Number.isFinite(n) ? n : null
}

// Components keep their declared order (never re-sorted by value).
function buildTooltipFormatter(model: PoolChartModel, apyWindow: PoolChartWindow) {
	const rateSuffix = apyWindow === 'daily' ? '' : ` (${apyWindow} avg)`
	const barLabels = model.bars.map((b) => b.label + rateSuffix)
	const netLabel = model.netLine ? model.netLine.label + rateSuffix : null
	// Rates read together: percent overlays follow the total, and the dollar magnitudes close.
	const overlays = [...model.lines]
		.sort((a, b) => Number(a.unit === 'usd') - Number(b.unit === 'usd'))
		.map((line) => ({
			label: windowedLine(line, apyWindow).name,
			symbol: line.unit === 'percent' ? '%' : '$'
		}))

	return (params: unknown) => {
		const items = getChartTooltipItems(params)
		if (items.length === 0) return ''
		const byName = new Map<string, ChartTooltipItem>()
		for (const p of items) byName.set(p.seriesName, p)

		const first = items[0]!
		const ts = getChartTooltipTimestamp(first)
		const date = Number.isFinite(ts) ? formatTooltipChartDate(ts, 'daily') : ''

		const row = (p: ChartTooltipItem, symbol: string) => {
			const v = valueOf(p)
			return v == null ? '' : li(`${p.marker} ${p.seriesName}: ${fmtVal(v, symbol)}`)
		}

		let html = date

		let total = 0
		let hasBar = false
		for (const label of barLabels) {
			const p = byName.get(label)
			if (!p) continue
			const v = valueOf(p)
			if (v == null) continue
			hasBar = true
			total += v
			html += row(p, '%')
		}

		const summaryStyle = 'font-weight:600;'
		if (model.net && netLabel) {
			const item = byName.get(netLabel)
			const v = item ? valueOf(item) : null
			if (v != null) html += li(`${netLabel}: ${fmtVal(v, '%')}`, summaryStyle)
		} else if (!model.net && hasBar) {
			html += li(`Total APY${rateSuffix}: ${fmtVal(total, '%')}`, summaryStyle)
		}

		for (const overlay of overlays) {
			const item = byName.get(overlay.label)
			if (item) html += row(item, overlay.symbol)
		}

		return html
	}
}

export function PoolApyChart({
	model,
	poolId,
	kind,
	initialRange = 'max',
	lockedVerifiedApy = false
}: {
	model: PoolChartModel
	poolId: string
	kind: 'supply' | 'borrow'
	initialRange?: PoolHistoryRange
	// The pool is measured but this reader's model has no measured line. The picker still lists
	// it, greyed, so the reader learns the line exists and what unlocks it.
	lockedVerifiedApy?: boolean
}) {
	const router = useRouter()
	const { show: showUpgrade, modal: upgradeModal } = useSubscribeProModal('verified-yields', 'apy-chart-metrics')
	const [isDark] = useDarkModeManager()
	const range = getPoolRange(router.query, kind)
	const { fetchHistory, isPending: historyAccessPending } = useVerifiedHistoryFetcher(poolId)
	// Safe to slice narrower views locally because the 7d/30d averages are precomputed per point.
	const {
		model: currentModel,
		loading,
		error
	} = useWidestHistory(
		initialRange,
		model,
		range,
		(next) => {
			const tvlLabel = model.lines.find((line) => line.unit === 'usd')?.label ?? 'TVL'
			return kind === 'supply'
				? fetchHistory(next).then((h) => buildSupplyChart(h, tvlLabel))
				: fetchBorrowMarketDetailHistory(poolId, next).then((h) => buildBorrowChart(h))
		},
		kind === 'borrow' || !historyAccessPending
	)
	const chartRef = useRef<echarts.ECharts | null>(null)

	// Old links may carry the retired additive avg toggles; map them to the nearest window.
	const legacyWindow = getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, 'avg30d')], false)
		? '30d'
		: getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, 'avg7d')], false)
			? '7d'
			: undefined
	const apyWindow = getPoolChartWindow(router.query[getPoolSeriesQueryKey(kind, 'window')] ?? legacyWindow)

	const seriesDefs = useMemo<Array<SeriesDef>>(() => {
		const defs: Array<SeriesDef> = []
		if (currentModel.net && currentModel.netLine) {
			const netLine = currentModel.netLine
			defs.push({
				key: netLine.key,
				label: netLine.label,
				colorKey: netLine.colorKey,
				defaultEnabled: true,
				group: 'apy'
			})
		}
		// A stand-in with no drawable day yet leaves the default with the bar it replaces.
		const drawable = (bar: PoolChartBar) => !bar.replaces || hasDrawableDay(bar, currentModel.dates)
		const replaced = new Set(currentModel.bars.flatMap((bar) => (bar.replaces && drawable(bar) ? [bar.replaces] : [])))
		for (const bar of currentModel.bars) {
			defs.push({
				key: bar.key,
				label: bar.label,
				colorKey: bar.colorKey,
				defaultEnabled: drawable(bar) && !replaced.has(bar.key),
				group: 'apy'
			})
		}
		// The measured APY is a rate and lists with the rates; dollar magnitudes are the overlays.
		for (const line of currentModel.lines) {
			defs.push({
				key: line.key,
				label: line.label,
				colorKey: line.colorKey,
				defaultEnabled: line.defaultEnabled ?? false,
				group: line.unit === 'percent' ? 'apy' : 'overlay'
			})
		}
		return defs
	}, [currentModel])

	// MultiSeriesChart reapplies its ECharts model when these input references change, so keep
	// the history transform and chart props stable across unrelated renders.
	const nowMs = useNowSecondsOnce() * 1000
	const { enabled, dataset, charts, hasData } = useMemo(() => {
		const enabled: Record<string, boolean> = {}
		for (const def of seriesDefs) {
			enabled[def.key] = getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, def.key)], def.defaultEnabled)
		}
		return {
			enabled,
			...buildChartInputs(currentModel, enabled, apyWindow, range, isDark, nowMs)
		}
	}, [apyWindow, currentModel, isDark, kind, nowMs, range, router.query, seriesDefs])
	const chartOptions = useMemo(
		() => ({ tooltip: { formatter: buildTooltipFormatter(currentModel, apyWindow) } }),
		[apyWindow, currentModel]
	)

	const toggle = (key: string, active: boolean, defaultEnabled: boolean) => {
		// Hoisted: the React Compiler bails on a call expression used as a computed object key.
		const toggledKey = getPoolSeriesQueryKey(kind, key)
		const patch: Record<string, string | undefined> = {
			[toggledKey]: getBooleanOverride(!active, defaultEnabled)
		}
		// A bar and the one that replaces it draw one at a time: turning either on turns the other off.
		if (!active) {
			const bar = currentModel.bars.find((b) => b.key === key)
			const partner = bar?.replaces ?? currentModel.bars.find((b) => b.replaces === key)?.key
			const partnerDef = seriesDefs.find((def) => def.key === partner)
			if (partner && partnerDef) {
				patch[getPoolSeriesQueryKey(kind, partner)] = getBooleanOverride(false, partnerDef.defaultEnabled)
			}
		}
		void pushShallowQuery(router, patch, router.pathname)
	}

	const metricGroups: Array<ChartMetricGroup> = useMemo(() => {
		const resolve = (key: ChartColorKey) => CHART_PALETTE[key][isDark ? 1 : 0]
		const toOption = (def: SeriesDef): ChartMetricOption => ({
			key: def.key,
			label: def.label,
			color: resolve(def.colorKey),
			active: enabled[def.key] === true,
			defaultEnabled: def.defaultEnabled,
			verified: def.colorKey === 'verified'
		})
		const apy = seriesDefs.filter((def) => def.group === 'apy').map(toOption)
		if (lockedVerifiedApy && !apy.some((option) => option.key === VERIFIED_APY_SERIES.key)) {
			apy.push({
				...VERIFIED_APY_SERIES,
				color: resolve('verified'),
				active: false,
				defaultEnabled: false,
				locked: true
			})
		}
		return [
			{ label: 'APY', options: apy },
			{ label: 'Overlays', options: seriesDefs.filter((def) => def.group === 'overlay').map(toOption) }
		]
	}, [enabled, isDark, lockedVerifiedApy, seriesDefs])

	return (
		<ChartPanel>
			<PanelHeader>
				<PanelTitle>{currentModel.title}</PanelTitle>
				<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
					<PoolRangeControl kind={kind} />
					<ChartExportButtons
						chartInstance={() => chartRef.current}
						filename={`yields-${poolId}-${kind}`}
						csvSource={{ type: 'dataset', prepare: () => dataset }}
					/>
				</div>
			</PanelHeader>

			<ChartPanelToolbar
				leading={
					<ChartMetricsPicker
						groups={metricGroups}
						onToggle={(option) => toggle(option.key, option.active, option.defaultEnabled)}
						onUnlock={showUpgrade}
					/>
				}
			>
				<ChartGroupingSelector
					value={apyWindow}
					options={WINDOW_OPTIONS}
					onValueChange={(next) => {
						writeStickyPref(POOL_CHART_WINDOW_PREFS[kind], getWindowQueryValue(next))
						void pushShallowQuery(router, getWindowQueryPatch(kind, next), router.pathname)
					}}
				/>
			</ChartPanelToolbar>

			<ChartPanelBody>
				{loading ? (
					<ChartPanelBodyFallback role="status" aria-live="polite">
						<LoadingIndicator label={`Loading ${range} history`} />
					</ChartPanelBodyFallback>
				) : error ? (
					<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
						Couldn't load {range} history.
					</ChartPanelBodyFallback>
				) : !hasData ? (
					<ChartPanelBodyFallback role="status" className="body-sm text-secondary">
						No data in this range for the selected series and window.
					</ChartPanelBodyFallback>
				) : (
					<Suspense
						fallback={
							<ChartPanelBodyFallback role="status" aria-live="polite">
								<LoadingIndicator label="Loading chart" />
							</ChartPanelBodyFallback>
						}
					>
						<MultiSeriesChart
							dataset={dataset}
							charts={charts}
							chartOptions={chartOptions}
							valueSymbol="%"
							containerClassName={CHART_FILL}
							hideDefaultLegend
							exportButtons="hidden"
							onReady={(inst) => {
								chartRef.current = inst
							}}
						/>
					</Suspense>
				)}
			</ChartPanelBody>
			{upgradeModal}
		</ChartPanel>
	)
}
