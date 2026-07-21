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
import { metricSeriesToggleStyles } from '~/ui/MetricChip'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { pushShallowQuery } from '~/utils/routerQuery'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from './fetch'
import { fmtPct, fmtUsd } from './format'
import {
	buildBorrowChart,
	buildSupplyChart,
	CHART_PALETTE,
	type ChartColorKey,
	type PoolChartModel
} from './poolCharts'
import {
	getBooleanOverride,
	getPoolHistoryRange,
	getPoolSeriesQueryKey,
	getRangeQueryValue,
	getSeriesVisibility
} from './queryState'
import { getChartTooltipItems, getChartTooltipTimestamp, getChartTooltipValue, type ChartTooltipItem } from './tooltip'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

type Range = '30d' | '90d' | 'max'

const AVG_KEYS = ['7d', '30d'] as const
type AvgKey = (typeof AVG_KEYS)[number]
const AVG_COLORS: Record<AvgKey, string> = { '7d': '#2962ff', '30d': '#9c27b0' }

const RANGE_OPTIONS = [
	{ value: '30d', label: '', shortLabel: '30d' },
	{ value: '90d', label: '', shortLabel: '90d' },
	{ value: 'max', label: '', shortLabel: 'Max' }
] as const satisfies readonly ChartGroupingOption<Range>[]

// A loaded range covers any range of equal-or-lower rank (slice locally instead of re-fetching).
const RANK: Record<Range, number> = { '30d': 0, '90d': 1, max: 2 }

function rangeCount(range: Range, total: number): number {
	if (range === '30d') return Math.min(30, total)
	if (range === '90d') return Math.min(90, total)
	return total
}

function fmtVal(v: number, symbol: string): string {
	if (!Number.isFinite(v)) return '-'
	return symbol === '$' ? fmtUsd(v) : `${fmtPct(v)}%`
}

// Averages re-sum over the *enabled* breakdown components (or use the net line's own
// averages in net mode), so the overlay always reconciles with what's plotted.
function buildChartInputs(
	model: PoolChartModel,
	enabled: Record<string, boolean>,
	avgEnabled: Record<AvgKey, boolean>,
	showBars: boolean,
	range: Range,
	isDark: boolean
): { dataset: MultiSeriesChartDataset; charts: MultiSeriesChartSeriesConfig[] } {
	const resolve = (key: ChartColorKey) => CHART_PALETTE[key][isDark ? 1 : 0]
	const total = model.dates.length
	const start = total - rangeCount(range, total)
	const enabledBars = model.bars.filter((b) => enabled[b.key] ?? true)
	// Net mode always draws its signed context bars; supply mode's "Daily" toggle can
	// hide them while the averages (computed over enabledBars) survive.
	const renderedBars = model.net || showBars ? enabledBars : []
	const averageKeys = AVG_KEYS.filter((key) => avgEnabled[key])
	const netLine = model.net && model.netLine && (enabled[model.netLine.key] ?? true) ? model.netLine : null
	const enabledLines = model.lines.filter((line) => enabled[line.key] ?? false)
	const hasValueInRange = (values: Array<number | null>) => {
		for (let index = start; index < total; index++) if (values[index] != null) return true
		return false
	}
	const visibleAverageKeys = averageKeys.filter((averageKey) => {
		if (model.net && model.netLine) {
			return hasValueInRange(averageKey === '7d' ? model.netLine.avg7 : model.netLine.avg30)
		}
		return enabledBars.some((bar) => hasValueInRange(averageKey === '7d' ? bar.avg7 : bar.avg30))
	})

	const dimensions: string[] = ['timestamp']
	const charts: MultiSeriesChartSeriesConfig[] = []

	for (const b of renderedBars) {
		const dimensionIndex = dimensions.length
		dimensions.push(b.label)
		charts.push({
			type: 'bar',
			name: b.label,
			encode: { x: 0, y: dimensionIndex },
			stack: 'apy',
			color: resolve(b.colorKey),
			yAxisIndex: 0,
			barMaxWidth: 16,
			...(model.net ? { excludeFromTooltipTotal: true } : {})
		})
	}

	for (const avgKey of visibleAverageKeys) {
		const name = `${avgKey} avg`
		const dimensionIndex = dimensions.length
		dimensions.push(name)
		charts.push({
			type: 'line',
			name,
			encode: { x: 0, y: dimensionIndex },
			color: AVG_COLORS[avgKey],
			yAxisIndex: 0,
			hideAreaStyle: true,
			excludeFromTooltipTotal: true
		})
	}

	if (netLine) {
		const dimensionIndex = dimensions.length
		dimensions.push(netLine.label)
		charts.push({
			type: 'line',
			name: netLine.label,
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
		row[0] = model.dates[sourceIndex]
		let dimensionIndex = 1
		for (const bar of renderedBars) {
			const value = bar.values[sourceIndex]
			row[dimensionIndex++] = value == null ? null : value * (bar.sign ?? 1)
		}
		for (const averageKey of visibleAverageKeys) {
			if (model.net && model.netLine) {
				row[dimensionIndex++] = (averageKey === '7d' ? model.netLine.avg7 : model.netLine.avg30)[sourceIndex]
			} else {
				let sum = 0
				let hasValue = false
				for (const bar of enabledBars) {
					const value = (averageKey === '7d' ? bar.avg7 : bar.avg30)[sourceIndex]
					if (value != null) {
						sum += value
						hasValue = true
					}
				}
				row[dimensionIndex++] = hasValue ? sum : null
			}
		}
		if (netLine) row[dimensionIndex++] = netLine.values[sourceIndex]
		for (const line of enabledLines) row[dimensionIndex++] = line.values[sourceIndex]
		rows[rowIndex] = row
	}

	return { dataset: { source: rows, dimensions }, charts }
}

// Components keep their declared order (never re-sorted by value).
function buildTooltipFormatter(model: PoolChartModel) {
	const barLabels = model.bars.map((b) => b.label)
	const netLabel = model.netLine?.label ?? null
	const magLabels = model.lines.map((l) => l.label)

	return (params: unknown) => {
		const items = getChartTooltipItems(params)
		if (!items.length) return ''
		const byName = new Map<string, ChartTooltipItem>()
		for (const p of items) byName.set(p.seriesName, p)

		const first = items[0]
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
		if (model.net && netLabel && byName.has(netLabel)) {
			const v = valueOf(byName.get(netLabel))
			if (v != null) html += li(`${netLabel}: ${fmtVal(v, '%')}`, summaryStyle)
		} else if (!model.net && hasBar) {
			html += li(`Total APY: ${fmtVal(total, '%')}`, summaryStyle)
		}

		for (const name of ['7d avg', '30d avg']) {
			const p = byName.get(name)
			if (p) html += row(p, '%')
		}

		for (const label of magLabels) {
			if (byName.has(label)) html += row(byName.get(label), '$')
		}

		return html
	}
}

function Chip({
	active,
	onClick,
	color,
	children,
	title
}: {
	active: boolean
	onClick: () => void
	color?: string
	children: React.ReactNode
	title?: string
}) {
	const className = metricSeriesToggleStyles
	const style = active && color ? { borderColor: color } : undefined
	if (title)
		return (
			<Tooltip
				content={title}
				render={
					<button
						type="button"
						aria-pressed={active}
						onClick={onClick}
						className={className}
						style={style}
						data-active={active}
					/>
				}
			>
				{children}
			</Tooltip>
		)
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={className}
			style={style}
			data-active={active}
		>
			{children}
		</button>
	)
}

const Divider = () => <span className="mx-1 h-4 w-px shrink-0 bg-border-medium" aria-hidden />

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
	// MultiSeriesChart reapplies its ECharts model when these input references change, so keep
	// the history transform and chart props stable across unrelated renders.
	const { hasBreakdownControls, enabled, avgEnabled, showBars, dataset, charts } = useMemo(() => {
		const hasBreakdownControls = currentModel.bars.length > 1
		const enabled: Record<string, boolean> = {}
		for (const bar of currentModel.bars) {
			// A lone component has no breakdown toggle, so an old or hand-edited URL must not hide it.
			enabled[bar.key] = hasBreakdownControls
				? getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, bar.key)], true)
				: true
		}
		for (const line of currentModel.lines) {
			enabled[line.key] = getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, line.key)], false)
		}
		if (currentModel.netLine) {
			enabled[currentModel.netLine.key] = getSeriesVisibility(
				router.query[getPoolSeriesQueryKey(kind, currentModel.netLine.key)],
				true
			)
		}
		const avgEnabled: Record<AvgKey, boolean> = {
			'7d': getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, 'avg7d')], false),
			'30d': getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, 'avg30d')], false)
		}
		const showBars = getSeriesVisibility(router.query[getPoolSeriesQueryKey(kind, 'daily')], true)

		return {
			hasBreakdownControls,
			enabled,
			avgEnabled,
			showBars,
			...buildChartInputs(currentModel, enabled, avgEnabled, showBars, range, isDark)
		}
	}, [currentModel, isDark, kind, range, router.query])
	const chartOptions = useMemo(() => ({ tooltip: { formatter: buildTooltipFormatter(currentModel) } }), [currentModel])

	const color = (key: ChartColorKey) => CHART_PALETTE[key][isDark ? 1 : 0]
	const toggle = (key: string, active: boolean, defaultEnabled: boolean) => {
		const queryKey = getPoolSeriesQueryKey(kind, key)
		void pushShallowQuery(router, { [queryKey]: getBooleanOverride(!active, defaultEnabled) }, router.pathname)
	}

	const netOn = currentModel.netLine ? enabled[currentModel.netLine.key] : false

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
					<ChartExportButtons chartInstance={() => chartRef.current} filename={`yields-${poolId}-${kind}`} />
				</div>
			</PanelHeader>

			<ChartPanelToolbar>
				<span className="body-sm text-secondary">Series</span>
				{currentModel.net && currentModel.netLine ? (
					<Chip
						active={netOn}
						onClick={() => toggle(currentModel.netLine!.key, netOn, true)}
						color={color(currentModel.netLine.colorKey)}
					>
						{currentModel.netLine.label}
					</Chip>
				) : (
					<Chip active={showBars} onClick={() => toggle('daily', showBars, true)} title="Show the raw daily bars">
						Daily
					</Chip>
				)}

				{AVG_KEYS.map((key) => (
					<Chip
						key={key}
						active={avgEnabled[key]}
						onClick={() => toggle(`avg${key}`, avgEnabled[key], false)}
						color={AVG_COLORS[key]}
					>
						{key} avg
					</Chip>
				))}

				{hasBreakdownControls ? (
					<>
						<Divider />
						<span className="body-sm text-secondary">Breakdown</span>
						{currentModel.bars.map((b) => (
							<Chip
								key={b.key}
								active={enabled[b.key] ?? true}
								onClick={() => toggle(b.key, enabled[b.key], true)}
								color={color(b.colorKey)}
							>
								{b.label}
							</Chip>
						))}
					</>
				) : null}

				{currentModel.lines.length ? (
					<>
						<Divider />
						<span className="body-sm text-secondary">Overlays</span>
						{currentModel.lines.map((line) => (
							<Chip
								key={line.key}
								active={enabled[line.key] ?? false}
								onClick={() => toggle(line.key, enabled[line.key], false)}
								color={color(line.colorKey)}
							>
								{line.label}
							</Chip>
						))}
					</>
				) : null}
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
