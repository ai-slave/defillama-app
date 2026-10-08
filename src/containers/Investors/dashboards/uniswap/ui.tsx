import { useQuery } from '@tanstack/react-query'
import { Fragment, lazy, useMemo } from 'react'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE } from '~/components/ECharts/shared/chartSpacing'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { formatTooltipChartDate, formatTooltipValue, type TooltipGroupBy } from '~/components/ECharts/shared/formatters'
import {
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems,
	TOOLTIP_OTHERS_ROW_STYLE
} from '~/components/ECharts/shared/tooltip'
import { fetchAdapterProtocolMetrics } from '~/containers/AdapterMetrics/api'
import type { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { useMedia } from '~/hooks/useMedia'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { keyedOccurrences, type RowIdentity } from '~/utils/keyedOccurrences'
import { formatUsd } from '~/utils/numberFormat'
import { readInvestorApiJson } from '../../api.types'
import { chartToPeriodDataset, unitSymbol, type Chart, type Kpi as KpiT } from './transform'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>

// DefiLlama protocol slug. DefiLlama-sourced figures are read client-side from the
// DefiLlama APIs directly (not through the ir-server), so the ir-server only has to
// keep serving what DefiLlama doesn't have (the Dune-sourced metrics).
export const PROTOCOL = 'uniswap'

export const QUERY_OPTS = { staleTime: 10 * 60 * 1000, refetchOnWindowFocus: false } as const

// Headline totals (24h/30d/all-time + chains) for one adapter metric, straight from DefiLlama.
export function useProtocolMetrics(adapterType: `${ADAPTER_TYPES}`, dataType?: `${ADAPTER_DATA_TYPES}`) {
	return useQuery({
		queryKey: ['uniswap-protocol-metrics', adapterType, dataType ?? 'default'],
		queryFn: () => fetchAdapterProtocolMetrics({ adapterType, protocol: PROTOCOL, ...(dataType ? { dataType } : {}) }),
		...QUERY_OPTS
	})
}

export function usdKpi(value: number | null | undefined): KpiT | undefined {
	if (value == null || !Number.isFinite(value)) return undefined
	// Fixed 2 fraction digits to match the ir-server's pre-formatted figures ($3.80T, $5.72B).
	return {
		value,
		formatted: formatUsd(value, { compact: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })
	}
}

export function countKpi(value: number | null | undefined, suffix: string): KpiT | undefined {
	if (value == null || !Number.isFinite(value)) return undefined
	return { value, formatted: `${value} ${suffix}` }
}

export function useUniswapData<T>(tab: string) {
	return useQuery<T>({
		queryKey: ['uniswap', tab],
		queryFn: async () => {
			const res = await fetch(`/api/public/uniswap/${tab}`)
			if (!res.ok) throw new Error(`Uniswap ${tab} error: ${res.status}`)
			return readInvestorApiJson<T>(res)
		},
		...QUERY_OPTS
	})
}

// One-line financial-term definitions served by the ir-server (metadata.definitions),
// surfaced as (i) tooltips so every metric is defined in place.
export function useUniswapDefs(): Record<string, string> {
	const { data } = useUniswapData<{ definitions?: Record<string, string> }>('metadata')
	return data?.definitions ?? {}
}

// Uniswap pink first, then an ordered set of distinct hues. 20 entries so the widest
// charts (the by-chain charts: top 20 + Others) never wrap back to a repeated color; gray is
// left out because seriesColor reserves it for the catch-all bucket.
export const UNI_PINK = '#FF007A'
export const PALETTE = [
	'#FF007A',
	'#4C82FB',
	'#9E62FF',
	'#40B66B',
	'#FFB238',
	'#00C3A0',
	'#FF5F52',
	'#5B8DEF',
	'#FC72FF',
	'#F97316',
	'#0EA5E9',
	'#84CC16',
	'#B45309',
	'#0D9488',
	'#7C3AED',
	'#BE185D',
	'#1D4ED8',
	'#C026D3',
	'#A16207',
	'#DC2626'
]

// Catch-all buckets ("Other", "Others") always render slate gray, so they never
// share a real category's color.
const OTHERS_GRAY = '#94A3B8'

export function paletteColor(index: number): string {
	const color = PALETTE[index % PALETTE.length]
	if (color === undefined) throw new Error('Expected the Uniswap chart palette to be non-empty')
	return color
}

// Each asset category gets a fixed color, shared by all four category charts (volume by category,
// protocol fees by category, the TVL-by-segment snapshot and its history). Positional cycling would
// repaint a category whenever a chart drops an all-zero series (Bonds is empty on the fee chart but
// not on the volume chart), so the same bucket would read as a different color on each.
// Hues are semantic where the category has one (BTC amber, commodities gold, DeFi Uniswap pink) and
// spread far enough apart to stay readable in a 12-series stack, which cycling the 13-entry palette
// cannot do: it would hand four pairs of categories the same color.
const CATEGORY_COLORS: Record<string, string> = {
	Stablecoins: '#0284C7',
	ETH: '#6366F1',
	LSTs: '#A855F7',
	BTC: '#D97706',
	Majors: '#15803D',
	DeFi: UNI_PINK,
	Equities: '#14B8A6',
	Commodities: '#B45309',
	Bonds: '#84CC16',
	'AI/agentic': '#DC2626',
	Memecoins: '#FACC15'
}

// Chain series wear their brand color on every chart (positional palette assignment painted
// Base pink and Ethereum in Base blue, which fights brand recognition).
// Covers every chain the marketshare/LP/fee charts currently emit; unmapped chains fall through
// to the positional palette.
const CHAIN_COLORS: Record<string, string> = {
	Ethereum: '#627EEA',
	Base: '#0052FF',
	Arbitrum: '#28A0F0',
	'OP Mainnet': '#FF0420',
	Optimism: '#FF0420',
	Polygon: '#8247E5',
	Unichain: '#F50DB4',
	'BNB Chain': '#F0B90B',
	BSC: '#F0B90B',
	Avalanche: '#E84142',
	'Robinhood Chain': '#00C805',
	Celo: '#FBCC5C',
	Ink: '#7132F5',
	'ZKsync Era': '#8C8DFC',
	Monad: '#836EF9'
}

// Router-vs-aggregator split: Uniswap's own routers are always Uniswap pink. The LP custody
// hues match the custody sankey's node colors (SANKEY_COLORS in Liquidity.tsx).
const FLOW_COLORS: Record<string, string> = {
	'Uniswap Routers': UNI_PINK,
	'Third-Party Aggregators': '#4C82FB',
	'Wallet-Custodied': '#4C82FB',
	'Contract-Managed': '#9E62FF'
}

// Color follows the entity: a known asset category or chain keeps its own color, catch-all
// buckets are always gray, everything else takes palette hues in series order.
export function seriesColor(name: string, index: number): string {
	const fixed = CATEGORY_COLORS[name] ?? CHAIN_COLORS[name] ?? FLOW_COLORS[name]
	if (fixed) return fixed
	if (/^others?\b/i.test(name) || /^(direct \/ other|non-uniswap routers \/ direct)$/i.test(name)) return OTHERS_GRAY
	return paletteColor(index)
}

const isCatchAll = (name: string) => /^others?$/i.test(name)

// Hover rows: largest first with the catch-all bucket as the last row, the tail past `maxItems`
// folded into it, and (for stacked parts of a whole) the Total under a divider.
export function createStackTooltipFormatter({
	groupBy,
	valueSymbol,
	maxItems,
	showTotal
}: {
	groupBy: TooltipGroupBy
	valueSymbol: string
	maxItems: number
	showTotal: boolean
}) {
	const line = (marker: string, name: string, value: number, style = 'list-style:none') =>
		`<li style="${style}">${marker}${escapeHtml(name)}&nbsp;&nbsp;${formatTooltipValue(value, valueSymbol)}</li>`
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''
		const axisValue = getTooltipAxisValue(items[0])
		let output = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		const rows: Array<{ marker: string; name: string; value: number }> = []
		let catchAll: (typeof rows)[number] | null = null
		let total = 0
		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const raw = getTooltipRawYValue(item, name)
			const value = raw === '-' ? Number.NaN : typeof raw === 'number' ? raw : Number(raw)
			if (!Number.isFinite(value) || value === 0) continue
			total += value
			const row = { marker: item.marker ?? '', name, value }
			if (isCatchAll(name)) catchAll = row
			else rows.push(row)
		}
		rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
		const hasTail = rows.length > maxItems - (catchAll ? 1 : 0)
		const visible = catchAll || hasTail ? rows.slice(0, maxItems - 1) : rows
		let tail = catchAll?.value ?? 0
		for (const row of rows.slice(visible.length)) tail += row.value
		for (const row of visible) output += line(row.marker, row.name, row.value)
		if (catchAll || hasTail)
			output += line(catchAll?.marker ?? rows[visible.length]?.marker ?? '', catchAll?.name ?? 'Others', tail)
		if (showTotal && rows.length + (catchAll ? 1 : 0) > 1)
			output += line('', 'Total', total, `${TOOLTIP_OTHERS_ROW_STYLE}font-weight:600;`)
		return output
	}
}

// Twice the rows on desktop; phones keep 10 so the tooltip never covers the whole chart.
export function useTooltipMaxItems() {
	return useMedia('(max-width: 37.5rem)') ? 10 : 20
}

// ---------------------------------------------------------------- KPI + layout

function KpiCard({ label, value, def }: { label: string; value: string; def?: string | undefined }) {
	return (
		<div className="flex flex-col gap-1.5 rounded-lg border border-subtle bg-surface p-4">
			<span className="flex items-center gap-1 label-sm tracking-wider text-tertiary uppercase">
				{label}
				{/* Shared Tooltip, not a `title` attribute: `title` never opens on touch. Padding
				    buys a ~29px tap target; the negative margins keep the row height unchanged. */}
				{def && (
					<Tooltip content={def} className="-my-2 -mr-2 cursor-help p-2" aria-label={def}>
						<Icon name="help-circle" height={13} width={13} />
					</Tooltip>
				)}
			</span>
			<span className="mono-lg tracking-tight text-primary tabular-nums">{value}</span>
		</div>
	)
}

// Renders KPIs straight from the payload's KPI map; pass the ordered keys + labels.
// The tooltip prefers an explicit definition, falling back to the KPI's own `note`.
export function KpiGrid({
	kpis,
	items,
	label,
	cols = 4
}: {
	kpis: Record<string, KpiT | undefined>
	items: Array<[string, string] | [string, string, string | undefined]>
	label?: string
	cols?: 3 | 4
}) {
	const grid = (
		<div
			className={`grid gap-3 ${cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}
		>
			{items.map(([key, lbl, def]) => {
				const k = kpis[key]
				return k ? <KpiCard key={key} label={lbl} value={k.formatted} def={def ?? k.note} /> : null
			})}
		</div>
	)
	if (!label) return grid
	return (
		<div className="flex flex-col gap-3">
			<span className="label-sm tracking-wider text-secondary uppercase">{label}</span>
			{grid}
		</div>
	)
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-tertiary uppercase">{children}</h2>
}

export function PageLoader() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center">
			<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
		</div>
	)
}

// Card chrome with an "awaiting data" body + the awaited API field, so the target
// layout is visible before the backend ships the data.
export function PlaceholderCard({
	title,
	subtitle,
	note,
	height = '360px'
}: {
	title: string
	subtitle?: string | undefined
	note?: string
	height?: string
}) {
	return (
		<ChartCard title={title} subtitle={subtitle}>
			<div
				className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-medium text-center"
				style={{ height }}
			>
				<span className="body-sm text-tertiary">Awaiting data</span>
				{note && <code className="rounded-sm bg-page px-2 py-0.5 mono-sm text-tertiary">{note}</code>}
			</div>
		</ChartCard>
	)
}

export function ChartCard({
	title,
	subtitle,
	subtitles,
	value,
	control,
	children
}: {
	title: string
	subtitle?: string | undefined
	/**
	 * Every subtitle a control on this card can swap in. They share one grid cell, so the box is as
	 * tall as the longest of them at whatever width the reader has, and switching views cannot move
	 * the chart underneath. Reserving lines by hand can't do this: which subtitle wraps, and into how
	 * many lines, changes with the viewport, the title beside it and the next copy edit.
	 */
	subtitles?: Array<string> | undefined
	value?: string | undefined
	/** Optional header-right control (e.g. a Daily/Cumulative toggle). */
	control?: React.ReactNode
	children: React.ReactNode
}) {
	const variants = subtitle && subtitles?.length ? [...new Set([subtitle, ...subtitles])] : null
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
				<div className="min-w-0 flex-1 basis-60">
					<h3 className="title-md text-primary">{title}</h3>
					{variants ? (
						<div className="mt-0.5 grid">
							{variants.map((text) => (
								<p
									key={text}
									aria-hidden={text === subtitle ? undefined : true}
									className={`col-start-1 row-start-1 body-sm text-tertiary ${text === subtitle ? '' : 'invisible'}`}
								>
									{text}
								</p>
							))}
						</div>
					) : (
						subtitle && <p className="mt-0.5 body-sm text-tertiary">{subtitle}</p>
					)}
				</div>
				<div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
					{value && <p className="mono-lg tracking-tight text-primary tabular-nums">{value}</p>}
					{control}
				</div>
			</div>
			{children}
		</div>
	)
}

// ------------------------------------------------------------------ chart cards

// Shared pre-formatted table: headers set alignment, right-aligned cells render mono.
export function MiniTable({
	getRowKey,
	getOccurrenceKey,
	grid,
	headers,
	rows,
	maxHeight
}: {
	grid: string
	headers: Array<[string, 'left' | 'right']>
	rows: Array<Array<string | number>>
	maxHeight?: string
} & RowIdentity<Array<string | number>>) {
	return (
		<div className="w-full overflow-auto rounded-lg border border-subtle" style={{ maxHeight }}>
			<div style={{ display: 'grid', gridTemplateColumns: grid }}>
				{headers.map(([label, align]) => (
					<div
						key={label}
						className="sticky top-0 z-[1] border-b border-subtle bg-surface px-3 py-2.5 label-md tracking-wider text-tertiary uppercase"
						style={{ textAlign: align }}
					>
						{label}
					</div>
				))}
				{(getRowKey
					? rows.map((item) => ({ item, key: getRowKey(item) }))
					: keyedOccurrences(rows, getOccurrenceKey)
				).map(({ item: row, key }, rowIndex) => (
					<Fragment key={key}>
						{row.map((cell, cellIndex) => {
							const align = headers[cellIndex]?.[1] ?? 'left'
							return (
								<div
									// oxlint-disable-next-line react/no-array-index-key -- Cells retain their fixed schema position within the keyed row.
									key={cellIndex}
									className={`truncate border-b border-subtle px-3 py-2.5 body-md text-primary ${
										align === 'right' ? 'text-right tabular-nums' : ''
									} ${rowIndex % 2 === 1 ? 'bg-surface' : ''}`}
								>
									{cell}
								</div>
							)
						})}
					</Fragment>
				))}
			</div>
		</div>
	)
}

// Ranked horizontal bars over named items (audits by firm, TVL by segment), one
// palette color per bar; catch-all "Other" bars go gray.
export function BarListCard({
	title,
	subtitle,
	items,
	valueSymbol = '',
	showValues = false
}: {
	title: string
	subtitle?: string
	items: Array<{ name: string; value: number }>
	valueSymbol?: string
	/** Print each value at its bar's end, for lists whose small bars vanish next to the largest. */
	showValues?: boolean
}) {
	return (
		<ChartCard title={title} subtitle={subtitle}>
			<HBarChart
				categories={items.map((item) => item.name)}
				values={items.map((item) => item.value)}
				colors={items.map((item, index) => seriesColor(item.name, index))}
				valueSymbol={valueSymbol}
				height="360px"
				showValueLabels={showValues}
			/>
		</ChartCard>
	)
}

// Area/line time series. Single series renders as a pink area; multiple series
// render as overlaid lines, or as stacked areas with `stacked` (for series that are
// composition parts, e.g. burns by source or TVL by chain).
export function TimeAreaCard({
	chart,
	title,
	subtitle,
	subtitles,
	value,
	valueSymbol,
	stacked,
	level,
	control,
	zoomLastPoints
}: {
	chart: Chart
	/** Fixed card title; defaults to the chart payload's own title. */
	title?: string
	subtitle?: string
	/** Every subtitle this card's control can swap in; see ChartCard. */
	subtitles?: Array<string>
	value?: string | undefined
	valueSymbol?: string
	stacked?: boolean
	/**
	 * The series is a level (a stock: open positions, holders), not a flow. Levels sit in a narrow
	 * band far from zero, so the shared zero-baseline y-axis would flatten them to a straight line;
	 * scale the axis to the data instead and drop the area fill, which would imply a zero baseline.
	 */
	level?: boolean
	/** Optional header-right control (e.g. a Total / By Chain toggle). */
	control?: React.ReactNode
	/** Open zoomed to the last N points (full history stays reachable via the zoom slider). */
	zoomLastPoints?: number
}) {
	const resolvedValueSymbol = valueSymbol ?? unitSymbol(chart.unit)
	const multipleSeries = chart.series.length > 1
	const tooltipMaxItems = useTooltipMaxItems()
	const { dataset, groupBy, charts, chartOptions } = useMemo(() => {
		const { dataset, groupBy } = chartToPeriodDataset(chart)
		const zoom =
			zoomLastPoints && dataset.source.length > zoomLastPoints
				? { dataZoom: { start: ((dataset.source.length - zoomLastPoints) / dataset.source.length) * 100, end: 100 } }
				: {}
		return {
			dataset,
			groupBy,
			charts: chart.series.map((series, index): MultiSeriesChartSeriesConfig => ({
				type: 'line',
				name: series.name,
				encode: { x: 'timestamp', y: series.name },
				color: seriesColor(series.name, index),
				...(stacked ? { stack: 'total' } : { hideAreaStyle: multipleSeries || !!level })
			})),
			chartOptions: {
				...createTimeSeriesChartOptions(resolvedValueSymbol),
				// The legend doubles as the per-series enable/disable toggle.
				...(multipleSeries
					? { legend: { type: 'scroll' as const, top: CHART_INSET }, grid: { top: CHART_LEGEND_RESERVE } }
					: {}),
				...(level ? { yAxis: { scale: true as const } } : {}),
				// Stacked parts of a whole get the capped rows + Total; overlaid lines keep the default.
				...(stacked && multipleSeries
					? {
							tooltip: {
								formatter: createStackTooltipFormatter({
									groupBy,
									valueSymbol: resolvedValueSymbol,
									maxItems: tooltipMaxItems,
									showTotal: resolvedValueSymbol !== '%'
								})
							}
						}
					: {}),
				...zoom
			}
		}
	}, [chart, stacked, level, multipleSeries, resolvedValueSymbol, zoomLastPoints, tooltipMaxItems])
	if (chart.series.length === 0)
		return <PlaceholderCard title={chart.title ?? ''} subtitle={subtitle} note="empty series" />
	return (
		<ChartCard
			title={title ?? chart.title ?? ''}
			subtitle={subtitle ?? chart.subtitle}
			subtitles={subtitles}
			value={value}
			control={control}
		>
			<MultiSeriesChart
				dataset={dataset}
				charts={charts}
				valueSymbol={resolvedValueSymbol}
				title=""
				height="360px"
				hideDefaultLegend={!multipleSeries}
				groupBy={groupBy}
				exportButtons="hidden"
				chartOptions={chartOptions}
			/>
		</ChartCard>
	)
}
