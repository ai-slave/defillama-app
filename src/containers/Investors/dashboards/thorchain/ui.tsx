import { useQuery } from '@tanstack/react-query'
import { lazy, useMemo, useState } from 'react'
import type { IBarChartProps, IChartProps, IHBarChartProps, IPieChartProps } from '~/components/ECharts/types'
import { formattedNum } from '~/utils'
import {
	barStacks,
	chartToData,
	cumulativeChart,
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
export const colorMap = (names: string[]): Record<string, string> =>
	Object.fromEntries(names.map((n, i) => [n, PALETTE[i % PALETTE.length]]))

const THREE_MONTHS = 90
export function lastNDaysZoom(len: number, days = THREE_MONTHS): any {
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

export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<div className="flex flex-col gap-1.5 rounded-lg border border-(--cards-border) bg-(--cards-bg) p-4">
			<span className="text-[11px] font-medium tracking-wider text-(--text-tertiary) uppercase">{label}</span>
			<span className="font-jetbrains text-xl font-semibold tracking-tight text-(--text-primary) tabular-nums">
				{value}
			</span>
			{sub && <span className="font-jetbrains text-[11px] text-(--text-tertiary) tabular-nums">{sub}</span>}
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
	items: [string, string][]
	label?: string
	cols?: 3 | 4
}) {
	const grid = (
		<div
			className={`grid gap-3 ${cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}
		>
			{items.map(([key, lbl]) => {
				const k = kpis[key]
				return k ? <KpiCard key={key} label={lbl} value={k.formatted} /> : null
			})}
		</div>
	)
	if (!label) return grid
	return (
		<div className="flex flex-col gap-3">
			<span className="text-[11px] font-semibold tracking-wider text-(--text-secondary) uppercase">{label}</span>
			{grid}
		</div>
	)
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="text-xs font-semibold tracking-wider text-(--text-tertiary) uppercase">{children}</h2>
}

// Single KPI that degrades to a placeholder when the backend hasn't shipped the
// field yet. `note` names the awaited API path so it's obvious what to wire later.
export function Kpi({ kpi, label, note }: { kpi?: KpiT; label: string; note?: string }) {
	if (kpi) return <KpiCard label={label} value={kpi.formatted} />
	return (
		<div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-(--cards-border) bg-(--cards-bg) p-4">
			<span className="text-[11px] font-medium tracking-wider text-(--text-tertiary) uppercase">{label}</span>
			<span className="font-jetbrains text-xl font-semibold text-(--text-disabled) tabular-nums">—</span>
			<span className="font-jetbrains text-[10px] text-(--text-disabled)">
				{note ? `awaiting ${note}` : 'awaiting data'}
			</span>
		</div>
	)
}

// A labeled group of KPIs (e.g. "THORChain (Chain)" vs "THORChain DEX").
export function KpiBand({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-3">
			<span className="text-[11px] font-semibold tracking-wider text-(--text-secondary) uppercase">{label}</span>
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
				className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-(--cards-border) text-center"
				style={{ height }}
			>
				<span className="text-xs text-(--text-tertiary)">Awaiting data</span>
				{note && (
					<code className="rounded bg-(--app-bg) px-2 py-0.5 font-jetbrains text-[10px] text-(--text-disabled)">
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
			<div className="size-5 animate-spin rounded-full border-2 border-(--text-disabled) border-t-transparent" />
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
		<div className="rounded-lg border border-(--cards-border) bg-(--cards-bg) p-4">
			<div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
				<div className="min-w-0">
					<h3 className="text-sm font-semibold text-(--text-primary)">{title}</h3>
					{subtitle && <p className="mt-0.5 text-xs leading-relaxed text-(--text-tertiary)">{subtitle}</p>}
				</div>
				<div className="flex items-center gap-3">
					{value && (
						<p className="font-jetbrains text-xl font-semibold tracking-tight text-(--text-primary) tabular-nums">
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
		<div className="flex rounded-md border border-(--cards-border) p-0.5">
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					onClick={() => onChange(o.value)}
					className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
						value === o.value
							? 'bg-(--sl-accent-muted) text-(--sl-accent)'
							: 'text-(--text-tertiary) hover:text-(--text-primary)'
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
	valueSymbol
}: {
	chart: Chart
	subtitle?: string
	value?: string
	valueSymbol?: string
}) {
	if (!chart?.series?.length)
		return <PlaceholderCard title={chart?.title ?? ''} subtitle={subtitle} note="empty series" />
	const data = chartToData(chart)
	const stacks = chart.series.map((s) => s.name)
	return (
		<ChartCard title={chart.title ?? ''} subtitle={subtitle ?? chart.subtitle} value={value}>
			<AreaChart
				chartData={data}
				stacks={stacks}
				stackColors={colorMap(stacks)}
				color={THOR_TEAL}
				valueSymbol={valueSymbol ?? unitSymbol(chart.unit)}
				title=""
				height="360px"
				hideGradient={stacks.length > 1}
				chartOptions={lastNDaysZoom(data.length)}
			/>
		</ChartCard>
	)
}

// Bar time series. Series sharing a `stack` render stacked (e.g. volume by type).
export function TimeBarCard({
	chart,
	subtitle,
	value,
	valueSymbol
}: {
	chart: Chart
	subtitle?: string
	value?: string
	valueSymbol?: string
}) {
	if (!chart?.series?.length)
		return <PlaceholderCard title={chart?.title ?? ''} subtitle={subtitle} note="empty series" />
	const data = chartToData(chart)
	return (
		<ChartCard title={chart.title ?? ''} subtitle={subtitle ?? chart.subtitle} value={value}>
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

// Daily bars with a client-side Daily ↔ Cumulative toggle (cumulative = running
// sum, rendered as overlaid lines). Backend only ships the daily series.
export function ToggledTimeChart({
	chart,
	subtitle,
	value,
	valueSymbol
}: {
	chart: Chart
	subtitle?: string
	value?: string
	valueSymbol?: string
}) {
	const [view, setView] = useState<'daily' | 'cumulative'>('daily')
	const daily = useMemo(() => chartToData(chart), [chart])
	const cumulative = useMemo(() => chartToData(cumulativeChart(chart)), [chart])
	if (!chart?.series?.length)
		return <PlaceholderCard title={chart?.title ?? ''} subtitle={subtitle} note="empty series" />
	const sym = valueSymbol ?? unitSymbol(chart.unit)
	const names = chart.series.map((s) => s.name)
	const data = view === 'daily' ? daily : cumulative
	return (
		<ChartCard
			title={chart.title ?? ''}
			subtitle={subtitle ?? chart.subtitle}
			value={value}
			control={
				<SegToggle
					options={[
						{ value: 'daily', label: 'Daily' },
						{ value: 'cumulative', label: 'Cumulative' }
					]}
					value={view}
					onChange={(v) => setView(v)}
				/>
			}
		>
			{view === 'daily' ? (
				<BarChart
					chartData={data}
					stacks={barStacks(chart)}
					stackColors={colorMap(names)}
					valueSymbol={sym}
					title=""
					height="360px"
					chartOptions={lastNDaysZoom(data.length)}
				/>
			) : (
				<AreaChart
					chartData={data}
					stacks={names}
					stackColors={colorMap(names)}
					color={THOR_TEAL}
					valueSymbol={sym}
					title=""
					height="360px"
					isStackedChart={names.length > 1}
					hideGradient={names.length > 1}
					chartOptions={lastNDaysZoom(data.length)}
				/>
			)}
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
	return (
		<ChartCard title={dist.title ?? ''} subtitle={subtitle}>
			<PieChart
				chartData={dist.data.map((d) => ({ name: d.name, value: d.value }))}
				stackColors={colorMap(dist.data.map((d) => d.name))}
				valueSymbol={valueSymbol}
				radius={['45%', '72%']}
				height="360px"
				showLegend
				legendPosition={{ orient: 'vertical', left: 'right', top: 'middle' }}
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
		<div
			className="thin-scrollbar w-full overflow-auto rounded-lg border border-(--cards-border)"
			style={{ maxHeight }}
		>
			<div style={{ display: 'grid', gridTemplateColumns: grid }}>
				{cols.map((c) => (
					<div
						key={c.key}
						className="sticky top-0 z-[1] border-b border-(--divider) bg-(--cards-bg) px-3 py-2.5 text-[11px] font-semibold tracking-wider text-(--text-tertiary) uppercase"
						style={{ textAlign: c.align ?? 'left' }}
					>
						{c.label}
					</div>
				))}
				{table.rows.map((row, i) =>
					cols.map((c) => (
						<div
							key={`${i}-${c.key}`}
							className={`overflow-hidden border-b border-(--divider) px-3 py-2.5 text-[13px] text-ellipsis whitespace-nowrap text-(--text-primary) ${
								c.format && c.format !== 'text' ? 'font-jetbrains tabular-nums' : ''
							} ${i % 2 === 1 ? 'bg-(--cards-bg)' : ''}`}
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

// ------------------------------------------------------------------- pendulum

// Incentive Pendulum: where bonded RUNE sits versus its optimal share. The marker
// is the 2:1 target (~66.7% bonded); the fill is the current bonded share.
export function PendulumBar({
	bondedSharePct,
	optimalBondedSharePct,
	state
}: {
	bondedSharePct: number
	optimalBondedSharePct: number
	state: string
}) {
	const pct = Math.max(0, Math.min(100, bondedSharePct))
	const optimal = Math.max(0, Math.min(100, optimalBondedSharePct))
	const under = bondedSharePct < optimalBondedSharePct
	return (
		<div className="rounded-lg border border-(--cards-border) bg-(--cards-bg) p-4">
			<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
				<div>
					<h3 className="text-sm font-semibold text-(--text-primary)">Incentive Pendulum</h3>
					<p className="mt-0.5 text-xs text-(--text-tertiary)">{state}</p>
				</div>
				<span className="font-jetbrains text-xl font-semibold text-(--text-primary) tabular-nums">
					{pct.toFixed(1)}% bonded
				</span>
			</div>
			<div className="relative h-3 w-full rounded-full bg-(--divider)">
				<div
					className="absolute top-0 left-0 h-3 rounded-full"
					style={{ width: `${pct}%`, background: under ? '#f5b66b' : THOR_TEAL }}
				/>
				<div
					className="absolute top-[-3px] h-[18px] w-0.5 bg-(--text-primary)"
					style={{ left: `${optimal}%` }}
					title={`Optimal ${optimal.toFixed(1)}%`}
				/>
			</div>
			<div className="mt-1.5 flex justify-between font-jetbrains text-[10px] text-(--text-tertiary) tabular-nums">
				<span>Nodes (bonded)</span>
				<span>Target {optimal.toFixed(1)}%</span>
				<span>LPs (pooled)</span>
			</div>
		</div>
	)
}
