import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { ChartGroupingSelector, type ChartGroupingOption } from '~/components/ECharts/shared/ChartGroupingSelector'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { LoadingIndicator } from '~/ui/Status'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { ChartMetricsPicker, type ChartMetricGroup, type ChartMetricOption } from './ChartMetricsPicker'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from './fetch'
import { YIELD_PERCENT_OPTIONS, YIELD_USD_OPTIONS } from './format'
import {
	buildBorrowChart,
	buildSupplyChart,
	CHART_PALETTE,
	type ChartColorKey,
	type PoolChartModel
} from './poolCharts'
import {
	getBooleanOverride,
	getPoolChartWindow,
	getPoolHistoryRange,
	getPoolSeriesQueryKey,
	getRangeQueryValue,
	getSeriesVisibility,
	getWindowQueryValue,
	type PoolChartWindow
} from './queryState'
import { getChartTooltipItems, getChartTooltipTimestamp, getChartTooltipValue, type ChartTooltipItem } from './tooltip'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

type Range = '30d' | '90d' | 'max'

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

const RANGE_OPTIONS = [
	{ value: '30d', label: '', shortLabel: '30d' },
	{ value: '90d', label: '', shortLabel: '90d' },
	{ value: 'max', label: '', shortLabel: 'Max' }
] as const satisfies ReadonlyArray<ChartGroupingOption<Range>>

// A loaded range covers any range of equal-or-lower rank (slice locally instead of re-fetching).
const RANK: Record<Range, number> = { '30d': 0, '90d': 1, max: 2 }

function rangeCount(range: Range, total: number): number {
	if (range === '30d') return Math.min(30, total)
	if (range === '90d') return Math.min(90, total)
	return total
}

function fmtVal(v: number, symbol: string): string {
	if (!Number.isFinite(v)) return '-'
	return symbol === '$' ? formatUsd(v, YIELD_USD_OPTIONS) : formatPercent(v, YIELD_PERCENT_OPTIONS)
}

// One smoothing window governs every rate series — bars and the net line render their
// precomputed daily/7d/30d arrays — so whatever is plotted stays like-for-like.
function buildChartInputs(
	model: PoolChartModel,
	enabled: Record<string, boolean>,
	apyWindow: PoolChartWindow,
	range: Range,
	isDark: boolean
): { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig>; hasData: boolean } {
	const resolve = (key: ChartColorKey) => CHART_PALETTE[key][isDark ? 1 : 0]
	const total = model.dates.length
	const start = total - rangeCount(range, total)
	const renderedBars = model.bars.filter((b) => enabled[b.key] === true)
	const netLine = model.net && model.netLine && enabled[model.netLine.key] === true ? model.netLine : null
	const enabledLines = model.lines.filter((line) => enabled[line.key] === true)
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

	for (const line of enabledLines) {
		const dimensionIndex = dimensions.length
		dimensions.push(line.label)
		charts.push({
			type: 'line',
			name: line.label,
			encode: { x: 0, y: dimensionIndex },
			color: resolve(line.colorKey),
			yAxisIndex: 1,
			valueSymbol: '$'
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
		for (const line of enabledLines) row[dimensionIndex++] = line.values[sourceIndex] ?? null
		rows[rowIndex] = row
	}

	// An all-null window (a young pool's 30d average) must show a message, not blank axes.
	const hasData = rows.some((row) => row.some((value, index) => index > 0 && value != null))

	return { dataset: { source: rows, dimensions }, charts, hasData }
}

// Components keep their declared order (never re-sorted by value).
function buildTooltipFormatter(model: PoolChartModel, apyWindow: PoolChartWindow) {
	const rateSuffix = apyWindow === 'daily' ? '' : ` (${apyWindow} avg)`
	const barLabels = model.bars.map((b) => b.label + rateSuffix)
	const netLabel = model.netLine ? model.netLine.label + rateSuffix : null
	const magLabels = model.lines.map((l) => l.label)

	return (params: unknown) => {
		const items = getChartTooltipItems(params)
		if (items.length === 0) return ''
		const byName = new Map<string, ChartTooltipItem>()
		for (const p of items) byName.set(p.seriesName, p)

		const first = items[0]!
		const ts = getChartTooltipTimestamp(first)
		const date = Number.isFinite(ts) ? formatTooltipChartDate(ts, 'daily') : ''

		const valueOf = (p: ChartTooltipItem): number | null => {
			const raw = getChartTooltipValue(p)
			const n = typeof raw === 'number' ? raw : raw == null ? null : Number(raw)
			return n != null && Number.isFinite(n) ? n : null
		}
		const li = (inner: string, extra = '') => `<li style="list-style:none;${extra}">${inner}</li>`

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

		for (const label of magLabels) {
			const item = byName.get(label)
			if (item) html += row(item, '$')
		}

		return html
	}
}

export function PoolApyChart({
	model,
	poolId,
	kind,
	initialRange = 'max'
}: {
	model: PoolChartModel
	poolId: string
	kind: 'supply' | 'borrow'
	initialRange?: Range
}) {
	const router = useRouter()
	const [isDark] = useDarkModeManager()
	const range = getPoolHistoryRange(router.query.range)
	// Ranges are strictly nested (max ⊇ 90d ⊇ 30d), so we track only the widest loaded model and
	// slice it for narrower views; we fetch only for a range wider than what's loaded. Safe to
	// slice because the 7d/30d averages are precomputed per point.
	const [widest, setWidest] = useState<{ range: Range; model: PoolChartModel }>({ range: initialRange, model })
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)
	const reqId = useRef(0)
	const chartRef = useRef<echarts.ECharts | null>(null)

	useEffect(() => {
		const id = ++reqId.current
		// Already covered by the widest loaded range → slice locally, no network.
		if (RANK[range] <= RANK[widest.range]) {
			// One request lifecycle: the local-slice branch clears the flags the fetching branch sets, and the
			// request id it reads is a ref.
			// oxlint-disable-next-line react/set-state-in-effect -- see above
			setLoading(false)
			setError(false)
			return
		}
		setLoading(true)
		setError(false)
		const tvlLabel = model.lines[0]?.label ?? 'TVL'
		const load =
			kind === 'supply'
				? fetchPoolDetailHistory(poolId, range).then((h) => buildSupplyChart(h, tvlLabel))
				: fetchBorrowMarketDetailHistory(poolId, range).then((h) => buildBorrowChart(h))
		load
			.then((built) => {
				if (id !== reqId.current) return
				if (built) setWidest({ range, model: built })
				setLoading(false)
			})
			.catch(() => {
				if (id !== reqId.current) return
				setError(true)
				setLoading(false)
			})
		return () => {
			if (reqId.current === id) reqId.current += 1
		}
	}, [kind, model.lines, poolId, range, widest.range])

	const currentModel = widest.model
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
		for (const bar of currentModel.bars) {
			defs.push({ key: bar.key, label: bar.label, colorKey: bar.colorKey, defaultEnabled: true, group: 'apy' })
		}
		for (const line of currentModel.lines) {
			defs.push({ key: line.key, label: line.label, colorKey: line.colorKey, defaultEnabled: false, group: 'overlay' })
		}
		return defs
	}, [currentModel])

	// MultiSeriesChart reapplies its ECharts model when these input references change, so keep
	// the history transform and chart props stable across unrelated renders.
	const { enabled, dataset, charts, hasData } = useMemo(() => {
		const enabled: Record<string, boolean> = {}
		for (const def of seriesDefs) {
			enabled[def.key] = getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, def.key)], def.defaultEnabled)
		}
		return {
			enabled,
			...buildChartInputs(currentModel, enabled, apyWindow, range, isDark)
		}
	}, [apyWindow, currentModel, isDark, kind, range, router.query, seriesDefs])
	const chartOptions = useMemo(
		() => ({ tooltip: { formatter: buildTooltipFormatter(currentModel, apyWindow) } }),
		[apyWindow, currentModel]
	)

	const toggle = (key: string, active: boolean, defaultEnabled: boolean) => {
		const queryKey = getPoolSeriesQueryKey(kind, key)
		void pushShallowQuery(router, { [queryKey]: getBooleanOverride(!active, defaultEnabled) }, router.pathname)
	}

	const metricGroups: Array<ChartMetricGroup> = useMemo(() => {
		const resolve = (key: ChartColorKey) => CHART_PALETTE[key][isDark ? 1 : 0]
		const toOption = (def: SeriesDef): ChartMetricOption => ({
			key: def.key,
			label: def.label,
			color: resolve(def.colorKey),
			active: enabled[def.key] === true,
			defaultEnabled: def.defaultEnabled
		})
		return [
			{ label: 'APY', options: seriesDefs.filter((def) => def.group === 'apy').map(toOption) },
			{ label: 'Overlays', options: seriesDefs.filter((def) => def.group === 'overlay').map(toOption) }
		]
	}, [enabled, isDark, seriesDefs])

	return (
		<ChartPanel className="h-full">
			<PanelHeader>
				<PanelTitle>{currentModel.title}</PanelTitle>
				<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
					<ChartGroupingSelector
						value={range}
						options={RANGE_OPTIONS}
						onValueChange={(next) =>
							void pushShallowQuery(router, { range: getRangeQueryValue(next) }, router.pathname)
						}
					/>
					<ChartExportButtons
						chartInstance={() => chartRef.current}
						filename={`yields-${poolId}-${kind}`}
						csvSource={{ type: 'dataset', prepare: () => dataset }}
					/>
				</div>
			</PanelHeader>

			<ChartPanelToolbar>
				<ChartMetricsPicker
					groups={metricGroups}
					onToggle={(option) => toggle(option.key, option.active, option.defaultEnabled)}
				/>
				<ChartGroupingSelector
					className="ml-auto"
					value={apyWindow}
					options={WINDOW_OPTIONS}
					onValueChange={(next) =>
						void pushShallowQuery(
							router,
							{ [getPoolSeriesQueryKey(kind, 'window')]: getWindowQueryValue(next) },
							router.pathname
						)
					}
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
							hideDefaultLegend
							exportButtons="hidden"
							onReady={(inst) => {
								chartRef.current = inst
							}}
						/>
					</Suspense>
				)}
			</ChartPanelBody>
		</ChartPanel>
	)
}
