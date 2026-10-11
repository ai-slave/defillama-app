import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useMedia } from '~/hooks/useMedia'
import { CHART_FILL, ChartPanel, ChartPanelBodyLoading, ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SurfaceBodyStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import { recordRuntimeError } from '~/utils/telemetry'
import { readInvestorApiJson } from '../../api.types'
import {
	chartToDataset,
	NETWORK_FEE_NOTE,
	sumDailySeries,
	unitSymbol,
	type ApiTableData,
	type Chart,
	type Distribution,
	type Kpi as KpiT
} from './transform'

// DefiLlama protocol slugs: the swap protocol, and the native chain whose L1 transaction
// fee THORChain counts as the "network fee" (see NETWORK_FEE_NOTE in ./transform).
export const DEX = 'thorchain-dex'
export const CHAIN = 'thorchain'

// Daily USD series for a fees-adapter metric, summed across both slugs. A missing chain
// series degrades to the dex figure alone rather than blanking the KPI, but is reported.
export function withNetworkFee(dataType: `${ADAPTER_DATA_TYPES}`) {
	return async () =>
		sumDailySeries(
			await Promise.all([
				fetchAdapterProtocolChartData({ adapterType: ADAPTER_TYPES.FEES, protocol: DEX, dataType }),
				fetchAdapterProtocolChartData({ adapterType: ADAPTER_TYPES.FEES, protocol: CHAIN, dataType }).catch((error) => {
					recordRuntimeError(error, 'clientRuntime')
					return []
				})
			])
		)
}

// The chain adapter reports the native tx fee under each of these at once — it is fee,
// revenue and protocol revenue in one — so all three stay consistent. Shared query config
// so every consumer (KPIs, by-chain charts, income statement) hits one cache entry.
export const NETWORK_FEE_DATA_TYPES: Record<string, `${ADAPTER_DATA_TYPES}` | undefined> = {
	fees: ADAPTER_DATA_TYPES.DAILY_FEES,
	revenue: ADAPTER_DATA_TYPES.DAILY_REVENUE,
	'protocol-revenue': ADAPTER_DATA_TYPES.DAILY_PROTOCOL_REVENUE
}

export function networkFeeQuery(dataType: `${ADAPTER_DATA_TYPES}` = ADAPTER_DATA_TYPES.DAILY_FEES) {
	return {
		queryKey: ['thorchain-network-fee', dataType],
		queryFn: () => fetchAdapterProtocolChartData({ adapterType: ADAPTER_TYPES.FEES, protocol: CHAIN, dataType }),
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	}
}

// Appends the network-fee caveat to an ir-server term definition, for KPI (i) tooltips.
export function defWithNetworkFee(def?: string): string {
	return def ? `${def} ${NETWORK_FEE_NOTE}` : NETWORK_FEE_NOTE
}

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>

export function useThorchainData<T>(fn: string) {
	return useQuery<T>({
		queryKey: ['thorchain', fn],
		queryFn: async () => {
			const res = await fetch(`/api/public/thorchain/${fn}`)
			if (!res.ok) throw new Error(`THORChain ${fn} error: ${res.status}`)
			return readInvestorApiJson<T>(res)
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

const DAY = 86_400

export interface SeriesKpis {
	lifetime: KpiT
	y1: KpiT
	d30: KpiT
	d7: KpiT
}

function windowKpi(series: Array<[number, number]>, days?: number): KpiT {
	const lastPoint = series[series.length - 1]
	if (!lastPoint) throw new Error('Expected a non-empty adapter series')
	const last = lastPoint[0]
	const cutoff = days ? last - days * DAY : -Infinity
	let sum = 0
	for (const [t, v] of series) {
		if (t > cutoff) sum += v || 0
	}
	return {
		value: sum,
		formatted: formatUsd(sum, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	}
}

// Trailing-window USD sums of a DefiLlama daily series, fetched once and cached by `key`. The
// Overview and Financials KPIs share these cache keys so the same metric reads identical numbers
// in both tabs (single source — DefiLlama — instead of mixing in the ir-server's own totals).
export function useAdapterSeries(key: string, fetcher: () => Promise<Array<[number, number]>>) {
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

function paletteColor(index: number): string {
	const color = PALETTE[index % PALETTE.length]
	if (color === undefined) throw new Error('Expected the THORChain chart palette to be non-empty')
	return color
}

const colorMap = (names: Array<string>): Record<string, string> =>
	Object.fromEntries(names.map((n, i) => [n, paletteColor(i)]))

const THREE_MONTHS = 90
function lastNDaysZoom(len: number, days = THREE_MONTHS): { dataZoom: { start: number; end: number } } | undefined {
	if (len <= days) return undefined
	const start = ((len - days) / len) * 100
	return { dataZoom: { start, end: 100 } }
}

// ---------------------------------------------------------------- KPI + layout

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
				return k ? <StatTile key={key} label={lbl} value={k.formatted} tooltip={def} /> : null
			})}
		</div>
	)
	if (!label) return grid
	return (
		<div className="flex flex-col gap-3">
			<span className="title-sm tracking-wider text-secondary uppercase">{label}</span>
			{grid}
		</div>
	)
}

// Single KPI that degrades to a placeholder when the backend hasn't shipped the
// field yet. `note` names the awaited API path so it's obvious what to wire later.
export function Kpi({
	kpi,
	label,
	note,
	def
}: {
	kpi?: KpiT | undefined
	label: string
	note?: string
	def?: string | undefined
}) {
	if (kpi) return <StatTile label={label} value={kpi.formatted} tooltip={def} />
	return <StatTile label={label} value="—" sub={note ? `awaiting ${note}` : 'awaiting data'} />
}

// A labeled group of KPIs (e.g. the "Fees" vs "Revenue" bands on Financials).
export function KpiBand({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-3">
			<span className="title-sm tracking-wider text-secondary uppercase">{label}</span>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
		</div>
	)
}

// The chart's panel with an "awaiting data" body + the awaited API field, so the target
// layout is visible before the backend ships the data.
export function PlaceholderCard({
	title,
	subtitle,
	note
}: {
	title: string
	subtitle?: string | undefined
	note?: string
}) {
	return (
		<ChartPanel>
			<ChartPanelToolbar leading={<ChartPanelTitle subtitle={subtitle}>{title}</ChartPanelTitle>} />
			<SurfaceBodyStatus variant="empty" contentClassName="flex flex-col items-center gap-2">
				Awaiting data
				{note ? <code className="rounded-sm bg-page px-2 py-0.5 mono-sm">{note}</code> : null}
			</SurfaceBodyStatus>
		</ChartPanel>
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
	value?: string | undefined
	valueSymbol?: string
	/** Open showing the whole history instead of default-zooming to the last 90 days. */
	fullRange?: boolean
	control?: React.ReactNode
}) {
	const resolvedValueSymbol = valueSymbol ?? unitSymbol(chart.unit)
	const { dataset, charts, chartOptions } = useMemo(() => {
		const multipleSeries = chart.series.length > 1
		const dataset = chartToDataset(chart)
		return {
			dataset,
			charts: chart.series.map((series, index): MultiSeriesChartSeriesConfig => ({
				type: 'line',
				name: series.name,
				encode: { x: 'timestamp', y: series.name },
				color: paletteColor(index),
				hideAreaStyle: multipleSeries
			})),
			chartOptions: {
				...createTimeSeriesChartOptions(resolvedValueSymbol),
				...(fullRange ? {} : (lastNDaysZoom(dataset.source.length) ?? {}))
			}
		}
	}, [chart, fullRange, resolvedValueSymbol])
	const { chartInstance, handleChartReady } = useGetChartInstance()
	if (chart.series.length === 0)
		return <PlaceholderCard title={chart.title ?? ''} subtitle={subtitle} note="empty series" />
	return (
		<ChartPanel>
			<ChartPanelToolbar
				leading={<ChartPanelTitle subtitle={subtitle ?? chart.subtitle}>{chart.title ?? ''}</ChartPanelTitle>}
			>
				{value ? <p className="mono-lg tracking-tight text-primary tabular-nums">{value}</p> : null}
				{control}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={slug(chart.title ?? 'thorchain')}
					title={chart.title}
					csvSource={{ type: 'dataset', prepare: () => dataset }}
				/>
			</ChartPanelToolbar>
			<Suspense fallback={<ChartPanelBodyLoading />}>
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					valueSymbol={resolvedValueSymbol}
					containerClassName={CHART_FILL}
					chartOptions={chartOptions}
					exportButtons="hidden"
					onReady={handleChartReady}
				/>
			</Suspense>
		</ChartPanel>
	)
}

// Bar time series. Series sharing a `stack` render stacked (e.g. volume by type).
export function TimeBarCard({
	chart,
	subtitle,
	value,
	valueSymbol,
	control,
	groupBy
}: {
	chart: Chart
	subtitle?: string
	value?: string
	valueSymbol?: string
	control?: React.ReactNode
	/** The period each bar covers; defaults to one day. */
	groupBy?: IMultiSeriesChartProps['groupBy']
}) {
	const resolvedValueSymbol = valueSymbol ?? unitSymbol(chart.unit)
	const { dataset, charts, chartOptions } = useMemo(() => {
		const dataset = chartToDataset(chart)
		return {
			dataset,
			charts: chart.series.map((series, index): MultiSeriesChartSeriesConfig => ({
				type: 'bar',
				name: series.name,
				encode: { x: 'timestamp', y: series.name },
				color: paletteColor(index),
				stack: series.stack ?? series.name,
				large: false
			})),
			chartOptions: {
				...createTimeSeriesChartOptions(resolvedValueSymbol),
				...lastNDaysZoom(dataset.source.length)
			}
		}
	}, [chart, resolvedValueSymbol])
	const { chartInstance, handleChartReady } = useGetChartInstance()
	if (chart.series.length === 0)
		return <PlaceholderCard title={chart.title ?? ''} subtitle={subtitle} note="empty series" />
	return (
		<ChartPanel>
			<ChartPanelToolbar
				leading={<ChartPanelTitle subtitle={subtitle ?? chart.subtitle}>{chart.title ?? ''}</ChartPanelTitle>}
			>
				{value ? <p className="mono-lg tracking-tight text-primary tabular-nums">{value}</p> : null}
				{control}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={slug(chart.title ?? 'thorchain')}
					showPng={false}
					csvSource={{ type: 'dataset', prepare: () => ({ ...dataset, groupBy }) }}
				/>
			</ChartPanelToolbar>
			<Suspense fallback={<ChartPanelBodyLoading />}>
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					valueSymbol={resolvedValueSymbol}
					containerClassName={CHART_FILL}
					showLegend={charts.length > 1}
					exportButtons="hidden"
					onReady={handleChartReady}
					chartOptions={chartOptions}
					{...(groupBy ? { groupBy } : {})}
				/>
			</Suspense>
		</ChartPanel>
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
		<ChartPanel>
			<ChartPanelToolbar
				leading={<ChartPanelTitle subtitle={subtitle ?? chart.subtitle}>{chart.title ?? ''}</ChartPanelTitle>}
			/>
			<Suspense fallback={<ChartPanelBodyLoading />}>
				<HBarChart
					categories={chart.dates}
					values={chart.series[0]?.data ?? []}
					color={THOR_TEAL}
					valueSymbol={valueSymbol ?? (unitSymbol(chart.unit) || '$')}
					containerClassName={CHART_FILL}
				/>
			</Suspense>
		</ChartPanel>
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
		<ChartPanel>
			<ChartPanelToolbar leading={<ChartPanelTitle subtitle={subtitle}>{dist.title ?? ''}</ChartPanelTitle>} />
			<Suspense fallback={<ChartPanelBodyLoading />}>
				<PieChart
					chartData={dist.data}
					stackColors={colorMap(dist.data.map((d) => d.name))}
					valueSymbol={valueSymbol}
					radius={isSmall ? ['38%', '60%'] : ['45%', '72%']}
					containerClassName={CHART_FILL}
					showLegend
					legendPosition={
						isSmall
							? { orient: 'horizontal', left: 'center', bottom: 0 }
							: { orient: 'vertical', left: 'right', top: 'middle' }
					}
				/>
			</Suspense>
		</ChartPanel>
	)
}

// ------------------------------------------------------------------------ tables

// Generic table fed by the backend's pre-formatted Table payload. Numeric columns
// (format usd/pct/num) render mono + right-aligned by their own `align`.
export function ApiTable({ table, maxHeight }: { table: ApiTableData; maxHeight?: string }) {
	const cols = table.columns
	const grid = cols.map((c) => (c.align === 'right' ? 'minmax(90px,1fr)' : 'minmax(120px,2fr)')).join(' ')
	return (
		<div className="w-full overflow-auto rounded-lg border border-subtle" style={{ maxHeight }}>
			<div style={{ display: 'grid', gridTemplateColumns: grid }}>
				{cols.map((c) => (
					<div
						key={c.key}
						className="sticky top-0 z-[1] border-b border-subtle bg-surface px-3 py-2.5 title-sm tracking-wider text-tertiary uppercase"
						style={{ textAlign: c.align ?? 'left' }}
					>
						{c.label}
					</div>
				))}
				{table.rows.map((row, i) =>
					cols.map((c) => (
						<div
							key={`${i}-${c.key}`}
							className={`truncate border-b border-subtle px-3 py-2.5 body-md text-primary ${
								c.format && c.format !== 'text' ? 'tabular-nums' : ''
							} ${i % 2 === 1 ? 'bg-surface' : ''}`}
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
