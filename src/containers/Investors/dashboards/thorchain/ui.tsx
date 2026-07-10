import { useQuery } from '@tanstack/react-query'
import { lazy } from 'react'
import type { IBarChartProps, IChartProps, IHBarChartProps, IPieChartProps } from '~/components/ECharts/types'
import { useMedia } from '~/hooks/useMedia'
import { formattedNum } from '~/utils'
import {
	barStacks,
	chartToData,
	unitSymbol,
	type ApiTableData,
	type Chart,
	type Distribution,
	type Kpi as KpiT
} from './transform'

const AreaChart = lazy(() => import('~/components/ECharts/AreaChart')) as React.FC<IChartProps>
const BarChart = lazy(() => import('~/components/ECharts/BarChart')) as React.FC<IBarChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>

export function useThorchainData<T>(fn: string) {
	return useQuery<T>({
		queryKey: ['thorchain', fn],
		queryFn: async () => {
			const res = await fetch(`/api/public/thorchain/${fn}`)
			if (!res.ok) throw new Error(`THORChain ${fn} error: ${res.status}`)
			return res.json()
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})
}

// One-line financial-term definitions served by the ir-server (metadata.definitions),
// surfaced as (i) tooltips so every Fees/Revenue term is defined in place.
export function useThorchainDefs(): Record<string, string> {
	const { data } = useThorchainData<{ definitions?: Record<string, string> }>('metadata')
	return data?.definitions ?? {}
}

const DAY = 86400

export interface SeriesKpis {
	lifetime: KpiT
	y1: KpiT
	d30: KpiT
	d7: KpiT
}

function windowKpi(series: [number, number][], days?: number): KpiT {
	const last = series[series.length - 1][0]
	const cutoff = days ? last - days * DAY : -Infinity
	const sum = series.reduce((acc, [t, v]) => (t > cutoff ? acc + (v || 0) : acc), 0)
	return { value: sum, formatted: formattedNum(sum, true) }
}

// Trailing-window USD sums of a DefiLlama daily series, fetched once and cached by `key`. The
// Overview and Financials KPIs share these cache keys so the same metric reads identical numbers
// in both tabs (single source — DefiLlama — instead of mixing in the ir-server's own totals).
export function useAdapterSeries(key: string, fetcher: () => Promise<[number, number][]>) {
	return useQuery<SeriesKpis | null>({
		queryKey: ['thorchain-adapter-series', key],
		queryFn: async () => {
			const series = await fetcher()
			if (!series?.length) return null
			return {
				lifetime: windowKpi(series),
				y1: windowKpi(series, 365),
				d30: windowKpi(series, 30),
				d7: windowKpi(series, 7)
			}
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})
}

// THORChain teal/green brand (see investors.tsx accent), then a short ordered set
// for additional categories. Mostly-monochrome teal, with accents past 3 series.
export const THOR_TEAL = '#23DCC8'
export const PALETTE = [
	'#23DCC8',
	'#00CCFF',
	'#31FD9D',
	'#f5c842',
	'#a78bfa',
	'#ff6565',
	'#5b8def',
	'#ff9f45',
	'#7ee787'
]
const colorMap = (names: string[]): Record<string, string> =>
	Object.fromEntries(names.map((n, i) => [n, PALETTE[i % PALETTE.length]]))

const THREE_MONTHS = 90
function lastNDaysZoom(len: number, days = THREE_MONTHS): any {
	if (len <= days) return undefined
	const start = ((len - days) / len) * 100
	return {
		dataZoom: [
			{ start, end: 100 },
			{ start, end: 100 }
		]
	}
}

// ---------------------------------------------------------------- KPI + layout

function KpiCard({ label, value, sub, def }: { label: string; value: string; sub?: string; def?: string }) {
	return (
		<div className="flex flex-col gap-1.5 rounded-lg border border-(--legacy-cards-border) bg-(--legacy-cards-bg) p-4">
			<span className="flex items-center gap-1 text-[11px] font-medium tracking-wider text-(--legacy-text-tertiary) uppercase">
				{label}
				{def && (
					<span title={def} className="cursor-help normal-case" aria-label={def}>
						ⓘ
					</span>
				)}
			</span>
			<span className="font-jetbrains text-xl font-semibold tracking-tight text-(--legacy-text-primary) tabular-nums">
				{value}
			</span>
			{sub && <span className="font-jetbrains text-[11px] text-(--legacy-text-tertiary) tabular-nums">{sub}</span>}
		</div>
	)
}

// Renders KPIs straight from the payload's KPI map; pass the ordered keys + labels.
// `cols` sets the widest breakpoint (4 default, 3 for denser tabs); `label` wraps it
// in a titled group for organizing many KPIs into readable bands.
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
				return k ? <KpiCard key={key} label={lbl} value={k.formatted} def={def} /> : null
			})}
		</div>
	)
	if (!label) return grid
	return (
		<div className="flex flex-col gap-3">
			<span className="text-[11px] font-semibold tracking-wider text-(--legacy-text-secondary) uppercase">{label}</span>
			{grid}
		</div>
	)
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="text-xs font-semibold tracking-wider text-(--legacy-text-tertiary) uppercase">{children}</h2>
}

// Single KPI that degrades to a placeholder when the backend hasn't shipped the
// field yet. `note` names the awaited API path so it's obvious what to wire later.
export function Kpi({ kpi, label, note, def }: { kpi?: KpiT; label: string; note?: string; def?: string }) {
	if (kpi) return <KpiCard label={label} value={kpi.formatted} def={def} />
	return (
		<div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-(--legacy-cards-border) bg-(--legacy-cards-bg) p-4">
			<span className="text-[11px] font-medium tracking-wider text-(--legacy-text-tertiary) uppercase">{label}</span>
			<span className="font-jetbrains text-xl font-semibold text-(--legacy-text-disabled) tabular-nums">—</span>
			<span className="font-jetbrains text-[10px] text-(--legacy-text-disabled)">
				{note ? `awaiting ${note}` : 'awaiting data'}
			</span>
		</div>
	)
}

// A labeled group of KPIs (e.g. the "Fees" vs "Revenue" bands on Financials).
export function KpiBand({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-3">
			<span className="text-[11px] font-semibold tracking-wider text-(--legacy-text-secondary) uppercase">{label}</span>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
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
	subtitle?: string
	note?: string
	height?: string
}) {
	return (
		<ChartCard title={title} subtitle={subtitle}>
			<div
				className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-(--legacy-cards-border) text-center"
				style={{ height }}
			>
				<span className="text-xs text-(--legacy-text-tertiary)">Awaiting data</span>
				{note && (
					<code className="rounded bg-(--legacy-app-bg) px-2 py-0.5 font-jetbrains text-[10px] text-(--legacy-text-disabled)">
						{note}
					</code>
				)}
			</div>
		</ChartCard>
	)
}

export function PageLoader() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center">
			<div className="size-5 animate-spin rounded-full border-2 border-(--legacy-text-disabled) border-t-transparent" />
		</div>
	)
}

export function ChartCard({
	title,
	subtitle,
	value,
	control,
	children
}: {
	title: string
	subtitle?: string
	value?: string
	/** Optional header-right control (e.g. a Daily/Cumulative toggle). */
	control?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<div className="rounded-lg border border-(--legacy-cards-border) bg-(--legacy-cards-bg) p-4">
			<div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
				<div className="min-w-0">
					<h3 className="text-sm font-semibold text-(--legacy-text-primary)">{title}</h3>
					{subtitle && <p className="mt-0.5 text-xs leading-relaxed text-(--legacy-text-tertiary)">{subtitle}</p>}
				</div>
				<div className="flex items-center gap-3">
					{value && (
						<p className="font-jetbrains text-xl font-semibold tracking-tight text-(--legacy-text-primary) tabular-nums">
							{value}
						</p>
					)}
					{control}
				</div>
			</div>
			{children}
		</div>
	)
}

export function SegToggle<T extends string>({
	options,
	value,
	onChange
}: {
	options: { value: T; label: string }[]
	value: T
	onChange: (v: T) => void
}) {
	return (
		<div className="flex rounded-md border border-(--legacy-cards-border) p-0.5">
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					onClick={() => onChange(o.value)}
					className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
						value === o.value
							? 'bg-(--sl-accent-muted) text-(--sl-accent)'
							: 'text-(--legacy-text-tertiary) hover:text-(--legacy-text-primary)'
					}`}
				>
					{o.label}
				</button>
			))}
		</div>
	)
}

// ------------------------------------------------------------------ chart cards

// Area/line time series. Single series renders as a mint area; multiple series
// render as overlaid lines (e.g. cumulative fees vs revenue).
export function TimeAreaCard({
	chart,
	subtitle,
	value,
	valueSymbol,
	fullRange,
	control
}: {
	chart: Chart
	subtitle?: string
	value?: string
	valueSymbol?: string
	/** Open showing the whole history instead of default-zooming to the last 90 days. */
	fullRange?: boolean
	control?: React.ReactNode
}) {
	if (!chart?.series?.length)
		return <PlaceholderCard title={chart?.title ?? ''} subtitle={subtitle} note="empty series" />
	const data = chartToData(chart)
	const stacks = chart.series.map((s) => s.name)
	return (
		<ChartCard title={chart.title ?? ''} subtitle={subtitle ?? chart.subtitle} value={value} control={control}>
			<AreaChart
				chartData={data}
				stacks={stacks}
				stackColors={colorMap(stacks)}
				color={THOR_TEAL}
				valueSymbol={valueSymbol ?? unitSymbol(chart.unit)}
				title=""
				height="360px"
				hideGradient={stacks.length > 1}
				chartOptions={fullRange ? undefined : lastNDaysZoom(data.length)}
			/>
		</ChartCard>
	)
}

// Bar time series. Series sharing a `stack` render stacked (e.g. volume by type).
export function TimeBarCard({
	chart,
	subtitle,
	value,
	valueSymbol,
	control
}: {
	chart: Chart
	subtitle?: string
	value?: string
	valueSymbol?: string
	control?: React.ReactNode
}) {
	if (!chart?.series?.length)
		return <PlaceholderCard title={chart?.title ?? ''} subtitle={subtitle} note="empty series" />
	const data = chartToData(chart)
	return (
		<ChartCard title={chart.title ?? ''} subtitle={subtitle ?? chart.subtitle} value={value} control={control}>
			<BarChart
				chartData={data}
				stacks={barStacks(chart)}
				stackColors={colorMap(chart.series.map((s) => s.name))}
				valueSymbol={valueSymbol ?? unitSymbol(chart.unit)}
				title=""
				height="360px"
				chartOptions={lastNDaysZoom(data.length)}
			/>
		</ChartCard>
	)
}

// Single-series ranked horizontal bars over category labels (by-chain, pool depth).
export function CategoryBarCard({
	chart,
	subtitle,
	valueSymbol
}: {
	chart: Chart
	subtitle?: string
	valueSymbol?: string
}) {
	return (
		<ChartCard title={chart.title ?? ''} subtitle={subtitle ?? chart.subtitle}>
			<HBarChart
				categories={chart.dates}
				values={chart.series[0]?.data ?? []}
				color={THOR_TEAL}
				valueSymbol={valueSymbol ?? (unitSymbol(chart.unit) || '$')}
				height="360px"
			/>
		</ChartCard>
	)
}

export function DonutCard({
	dist,
	subtitle,
	valueSymbol = '$'
}: {
	dist: Distribution
	subtitle?: string
	valueSymbol?: string
}) {
	// On narrow screens a right-hand vertical legend squeezes the pie into a sliver;
	// drop the legend below the chart instead.
	const isSmall = useMedia('(max-width: 640px)')
	return (
		<ChartCard title={dist.title ?? ''} subtitle={subtitle}>
			<PieChart
				chartData={dist.data.map((d) => ({ name: d.name, value: d.value }))}
				stackColors={colorMap(dist.data.map((d) => d.name))}
				valueSymbol={valueSymbol}
				radius={isSmall ? ['38%', '60%'] : ['45%', '72%']}
				height="360px"
				showLegend
				legendPosition={
					isSmall
						? { orient: 'horizontal', left: 'center', bottom: 0 }
						: { orient: 'vertical', left: 'right', top: 'middle' }
				}
			/>
		</ChartCard>
	)
}

// ------------------------------------------------------------------------ tables

// Generic table fed by the backend's pre-formatted Table payload. Numeric columns
// (format usd/pct/num) render mono + right-aligned by their own `align`.
export function ApiTable({ table, maxHeight }: { table: ApiTableData; maxHeight?: string }) {
	const cols = table.columns
	const grid = cols.map((c) => (c.align === 'right' ? 'minmax(90px,1fr)' : 'minmax(120px,2fr)')).join(' ')
	return (
		<div className="w-full overflow-auto rounded-lg border border-(--legacy-cards-border)" style={{ maxHeight }}>
			<div style={{ display: 'grid', gridTemplateColumns: grid }}>
				{cols.map((c) => (
					<div
						key={c.key}
						className="sticky top-0 z-[1] border-b border-(--legacy-divider) bg-(--legacy-cards-bg) px-3 py-2.5 text-[11px] font-semibold tracking-wider text-(--legacy-text-tertiary) uppercase"
						style={{ textAlign: c.align ?? 'left' }}
					>
						{c.label}
					</div>
				))}
				{table.rows.map((row, i) =>
					cols.map((c) => (
						<div
							key={`${i}-${c.key}`}
							className={`overflow-hidden border-b border-(--legacy-divider) px-3 py-2.5 text-[13px] text-ellipsis whitespace-nowrap text-(--legacy-text-primary) ${
								c.format && c.format !== 'text' ? 'font-jetbrains tabular-nums' : ''
							} ${i % 2 === 1 ? 'bg-(--legacy-cards-bg)' : ''}`}
							style={{ textAlign: c.align ?? 'left' }}
						>
							{String(row[c.key] ?? '')}
						</div>
					))
				)}
			</div>
		</div>
	)
}
