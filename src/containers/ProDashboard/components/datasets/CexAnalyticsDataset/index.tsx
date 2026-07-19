import {
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { lazy, Suspense, useContext, useEffect, useMemo, useState, type FC, type ReactNode } from 'react'
import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type {
	IMultiSeriesChart2Props,
	MultiSeriesChart2Dataset,
	MultiSeriesChart2SeriesConfig
} from '~/components/ECharts/types'
import { useTableSearch } from '~/components/Table/utils'
import type {
	CexAnalyticsMarketSharePoint,
	CexAnalyticsMetric,
	CexAnalyticsSnapshotResponse,
	CexAnalyticsTotalsPoint
} from '~/containers/Cexs/api.types'
import { useProDashboardTime } from '~/containers/ProDashboard/ProDashboardAPIContext'
import { getTimePeriodBounds, StreamDoneContext } from '~/containers/ProDashboard/queries'
import type { ProtocolsTableConfig } from '~/containers/ProDashboard/types'
import { useBreakpointWidth } from '~/hooks/useBreakpointWidth'
import { formattedNum } from '~/utils'
import { downloadCSV } from '~/utils/download'
import { LoadingSpinner } from '../../LoadingSpinner'
import { ProTableCSVButton } from '../../ProTable/CsvButton'
import { TableBody } from '../../ProTable/TableBody'
import { TablePagination } from '../../ProTable/TablePagination'
import { cexAnalyticsColumns } from './columns'
import { useCexAnalyticsMarketShare, useCexAnalyticsSnapshot, useCexAnalyticsTotals } from './useCexAnalyticsData'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2')) as FC<IMultiSeriesChart2Props>

const EMPTY_ROWS: any[] = []
const STACK_COLORS = {
	Spot: '#2d8cf0',
	Derivatives: '#f28b36'
}
const SHARE_PALETTE = [
	'#2d8cf0',
	'#2cb67d',
	'#f28b36',
	'#9b5de5',
	'#ef476f',
	'#06d6a0',
	'#ffa94d',
	'#577590',
	'#94a3b8'
]
const SPOT_VS_DERIVATIVES_CHARTS: MultiSeriesChart2SeriesConfig[] = [
	{
		type: 'bar',
		name: 'Spot',
		encode: { x: 'timestamp', y: 'Spot' },
		stack: 'stackA',
		color: STACK_COLORS.Spot,
		large: false
	},
	{
		type: 'bar',
		name: 'Derivatives',
		encode: { x: 'timestamp', y: 'Derivatives' },
		stack: 'stackA',
		color: STACK_COLORS.Derivatives,
		large: false
	}
]
const DOLLAR_CHART_OPTIONS = createTimeSeriesChartOptions('$')
const STACKED_PERCENT_CHART_OPTIONS = createTimeSeriesChartOptions('%')

type CexAnalyticsDatasetProps = {
	config: ProtocolsTableConfig
}

function DatasetState({
	title,
	isLoading,
	isError,
	errorMessage,
	children
}: {
	title: string
	isLoading: boolean
	isError: boolean
	errorMessage: string
	children: ReactNode
}) {
	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">{title}</h3>
				</div>
				<div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm text-pro-text-secondary">Loading CEX analytics...</p>
				</div>
			</div>
		)
	}

	if (isError) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<h3 className="text-lg font-semibold text-pro-text-primary">{title}</h3>
				</div>
				<div className="flex min-h-[320px] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">{errorMessage}</div>
				</div>
			</div>
		)
	}

	return <>{children}</>
}

function filterTimeSeriesRows<T extends { date: number }>(
	rows: T[],
	timePeriod: ReturnType<typeof useProDashboardTime>['timePeriod'],
	customTimePeriod: ReturnType<typeof useProDashboardTime>['customTimePeriod']
) {
	if (!timePeriod || timePeriod === 'all' || rows.length === 0) {
		return rows
	}

	const bounds = getTimePeriodBounds(timePeriod, customTimePeriod)
	if (!bounds) return rows

	let low = 0
	let high = rows.length
	while (low < high) {
		const mid = (low + high) >>> 1
		if (rows[mid].date < bounds.start) low = mid + 1
		else high = mid
	}
	const startIndex = low
	low = startIndex
	high = rows.length
	while (low < high) {
		const mid = (low + high) >>> 1
		if (rows[mid].date <= bounds.end) low = mid + 1
		else high = mid
	}
	return startIndex === 0 && low === rows.length ? rows : rows.slice(startIndex, low)
}

function formatRatio(value: number | null) {
	return value == null ? '-' : `${value.toFixed(2)}x`
}

function SummaryCards({ data }: { data: CexAnalyticsSnapshotResponse }) {
	const cards = [
		{ label: 'Spot Volume', value: formattedNum(data.summary.totalSpotVolume, true) },
		{ label: 'Derivatives Volume', value: formattedNum(data.summary.totalDerivativesVolume, true) },
		{ label: 'Open Interest', value: formattedNum(data.summary.totalOpenInterest, true) },
		{ label: 'Clean TVL', value: formattedNum(data.summary.totalCleanTvl, true) },
		{ label: 'Weighted Avg Leverage', value: formatRatio(data.summary.weightedAvgLeverage) }
	]

	return (
		<div className="flex h-full w-full flex-col gap-4 p-4">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<h3 className="text-lg font-semibold text-pro-text-primary">CEX Summary</h3>
					<p className="text-sm text-pro-text-secondary">Snapshot metrics across centralized exchanges.</p>
				</div>
				{data.summary.loadedAt ? (
					<span className="text-xs tracking-wide text-pro-text-tertiary uppercase">
						Loaded {new Date(data.summary.loadedAt).toLocaleString()}
					</span>
				) : null}
			</div>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
				{cards.map((card) => (
					<div key={card.label} className="rounded-lg border border-pro-cards-border p-3">
						<p className="text-xs font-medium tracking-wide text-pro-text-tertiary uppercase">{card.label}</p>
						<p className="mt-2 text-2xl font-semibold text-pro-text-primary">{card.value}</p>
					</div>
				))}
			</div>
		</div>
	)
}

function VenueComparisonTable({ data }: { data: CexAnalyticsSnapshotResponse }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'derivativesVolume24h', desc: true }])
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})

	const width = useBreakpointWidth()

	const instance = useReactTable({
		data: data.rows ?? EMPTY_ROWS,
		columns: cexAnalyticsColumns as ColumnDef<any>[],
		state: {
			sorting,
			columnOrder,
			columnSizing,
			columnFilters,
			pagination
		},
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onColumnOrderChange: setColumnOrder,
		onColumnSizingChange: setColumnSizing,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		autoResetPageIndex: false
	})

	useEffect(() => {
		const defaultOrder = instance.getAllLeafColumns().map((column) => column.id)
		const defaultSizing = {
			venue: 280,
			spotVolume24h: 140,
			derivativesVolume24h: 150,
			spotShare: 110,
			derivativesShare: 140,
			derivativesToSpotRatio: 145,
			openInterest: 135,
			avgLeverage: 120,
			cleanTvl: 120,
			volumeToTvl: 120
		}

		instance.setColumnOrder(defaultOrder)
		instance.setColumnSizing(defaultSizing)
	}, [instance, width])

	const [_venueName, setVenueName] = useTableSearch({ instance, columnToSearch: 'venue' })

	return (
		<div className="flex h-full w-full flex-col p-4">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<div className="mr-auto">
						<h3 className="text-lg font-semibold text-pro-text-primary">CEX Comparison</h3>
						<p className="text-sm text-pro-text-secondary">
							Spot, derivatives, OI, leverage, and efficiency across CEXs.
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<ProTableCSVButton
							onClick={() => {
								const rows = instance.getFilteredRowModel().rows.map((row) => row.original)
								const headers = [
									'CEX',
									'Spot 24h',
									'Derivatives 24h',
									'Spot Share %',
									'Derivatives Share %',
									'Derivatives / Spot',
									'Open Interest',
									'Avg Leverage',
									'Clean TVL',
									'Volume / TVL'
								]
								const csv = [
									headers.join(','),
									...rows.map((row) =>
										[
											row.venue,
											row.spotVolume24h,
											row.derivativesVolume24h,
											row.spotShare,
											row.derivativesShare,
											row.derivativesToSpotRatio ?? '',
											row.openInterest ?? '',
											row.avgLeverage ?? '',
											row.cleanTvl ?? '',
											row.volumeToTvl ?? ''
										].join(',')
									)
								].join('\n')

								downloadCSV('cexs-comparison.csv', csv, { addTimestamp: true })
							}}
							smol
						/>
						<input
							type="text"
							placeholder="Search CEXs..."
							onInput={(event) => setVenueName(event.currentTarget.value)}
							className="rounded-md border pro-border bg-pro-glass-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors focus:border-brand focus:outline-hidden"
						/>
					</div>
				</div>
			</div>
			<TableBody table={instance} />
			<TablePagination table={instance} />
		</div>
	)
}

function SpotVsDerivativesChart({ data }: { data: CexAnalyticsTotalsPoint[] }) {
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const filtered = useMemo(
		() => filterTimeSeriesRows(data, timePeriod, customTimePeriod),
		[data, timePeriod, customTimePeriod]
	)
	const dataset = useMemo<MultiSeriesChart2Dataset>(
		() => ({
			source: filtered.map((point) => ({
				timestamp: point.date * 1e3,
				Spot: point.spotVolume,
				Derivatives: point.derivativesVolume
			})),
			dimensions: ['timestamp', 'Spot', 'Derivatives']
		}),
		[filtered]
	)

	if (dataset.source.length === 0) {
		return (
			<div className="flex min-h-[320px] items-center justify-center p-4 text-sm text-pro-text-secondary">
				No volume data available.
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col p-4">
			<Suspense fallback={<div className="h-[360px]" />}>
				<MultiSeriesChart2
					title="Spot vs Derivatives Volume"
					dataset={dataset}
					charts={SPOT_VS_DERIVATIVES_CHARTS}
					chartOptions={DOLLAR_CHART_OPTIONS}
					valueSymbol="$"
					height="360px"
					hideDefaultLegend={false}
				/>
			</Suspense>
		</div>
	)
}

function VenueMarketShareChart({
	data,
	metric,
	topN
}: {
	data: CexAnalyticsMarketSharePoint[]
	metric: CexAnalyticsMetric
	topN: number
}) {
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const filtered = useMemo(
		() => filterTimeSeriesRows(data, timePeriod, customTimePeriod),
		[data, timePeriod, customTimePeriod]
	)

	const { dataset, charts } = useMemo(() => {
		const byDate = new Map<number, Record<string, number>>()
		const order: string[] = []
		const seenVenues = new Set<string>()
		for (const point of filtered) {
			if (!seenVenues.has(point.venue)) {
				seenVenues.add(point.venue)
				order.push(point.venue)
			}
			let record = byDate.get(point.date)
			if (!record) {
				record = { timestamp: point.date * 1e3 }
			}
			if (point.venue === '__proto__') {
				Object.defineProperty(record, point.venue, {
					value: point.share,
					enumerable: true,
					configurable: true,
					writable: true
				})
			} else {
				record[point.venue] = point.share
			}
			byDate.set(point.date, record)
		}

		// The server query is ordered by date, and filtering preserves that order.
		const source = Array.from(byDate.values())
		for (const record of source) {
			for (const venue of order) {
				if (Object.hasOwn(record, venue)) continue
				if (venue === '__proto__') {
					Object.defineProperty(record, venue, { value: 0, enumerable: true, configurable: true, writable: true })
				} else {
					record[venue] = 0
				}
			}
		}
		const charts: MultiSeriesChart2SeriesConfig[] = new Array(order.length)
		for (let index = 0; index < order.length; index++) {
			const venue = order[index]
			charts[index] = {
				type: 'line',
				name: venue,
				encode: { x: 'timestamp', y: venue },
				stack: 'Total',
				color: SHARE_PALETTE[index % SHARE_PALETTE.length]
			}
		}

		return {
			dataset: { source, dimensions: ['timestamp', ...order] },
			charts
		}
	}, [filtered])

	if (dataset.source.length === 0 || charts.length === 0) {
		return (
			<div className="flex min-h-[320px] items-center justify-center p-4 text-sm text-pro-text-secondary">
				No market share data available.
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col p-4">
			<Suspense fallback={<div className="h-[360px]" />}>
				<MultiSeriesChart2
					title={`CEX ${metric === 'spot' ? 'Spot' : 'Derivatives'} Market Share (Top ${topN})`}
					dataset={dataset}
					charts={charts}
					chartOptions={STACKED_PERCENT_CHART_OPTIONS}
					solidChartAreaStyle
					valueSymbol="%"
					height="360px"
					hideDefaultLegend={false}
				/>
			</Suspense>
		</div>
	)
}

export function CexAnalyticsDataset({ config }: CexAnalyticsDatasetProps) {
	const streamDone = useContext(StreamDoneContext)
	const rawView = config.cexAnalyticsView as string | undefined
	const view = rawView === 'efficiency' ? 'comparison' : config.cexAnalyticsView || 'comparison'
	const needsSnapshot = view === 'summary' || view === 'comparison'
	const needsTotals = view === 'spot-vs-derivatives'
	const needsShare = view === 'market-share'
	const snapshotQuery = useCexAnalyticsSnapshot(needsSnapshot && streamDone)
	const totalsQuery = useCexAnalyticsTotals(needsTotals && streamDone)
	const shareQuery = useCexAnalyticsMarketShare(
		config.cexAnalyticsMetric || 'derivatives',
		config.cexAnalyticsTopN || 8,
		needsShare && streamDone
	)

	if (view === 'summary') {
		return (
			<DatasetState
				title="CEX Summary"
				isLoading={snapshotQuery.isLoading}
				isError={Boolean(snapshotQuery.error)}
				errorMessage="Failed to load CEX summary"
			>
				{snapshotQuery.data ? <SummaryCards data={snapshotQuery.data} /> : null}
			</DatasetState>
		)
	}

	if (view === 'comparison') {
		return (
			<DatasetState
				title="CEX Comparison"
				isLoading={snapshotQuery.isLoading}
				isError={Boolean(snapshotQuery.error)}
				errorMessage="Failed to load CEX comparison data"
			>
				{snapshotQuery.data ? <VenueComparisonTable data={snapshotQuery.data} /> : null}
			</DatasetState>
		)
	}

	if (view === 'spot-vs-derivatives') {
		return (
			<DatasetState
				title="Spot vs Derivatives Volume"
				isLoading={totalsQuery.isLoading}
				isError={Boolean(totalsQuery.error)}
				errorMessage="Failed to load CEX volume history"
			>
				{totalsQuery.data ? <SpotVsDerivativesChart data={totalsQuery.data} /> : null}
			</DatasetState>
		)
	}

	if (view === 'market-share') {
		return (
			<DatasetState
				title="CEX Market Share"
				isLoading={shareQuery.isLoading}
				isError={Boolean(shareQuery.error)}
				errorMessage="Failed to load CEX market share"
			>
				{shareQuery.data ? (
					<VenueMarketShareChart
						data={shareQuery.data}
						metric={config.cexAnalyticsMetric || 'derivatives'}
						topN={config.cexAnalyticsTopN || 8}
					/>
				) : null}
			</DatasetState>
		)
	}

	return (
		<DatasetState
			title="CEX Comparison"
			isLoading={snapshotQuery.isLoading}
			isError={Boolean(snapshotQuery.error)}
			errorMessage="Failed to load CEX comparison data"
		>
			{snapshotQuery.data ? <VenueComparisonTable data={snapshotQuery.data} /> : null}
		</DatasetState>
	)
}

export default CexAnalyticsDataset
