import {
	createPaginatedRowModel,
	rowPaginationFeature,
	tableFeatures,
	useTable,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	type PaginationState,
	type SortingState
} from '@tanstack/react-table'
import { lazy, Suspense, useContext, useMemo, useState, type ReactNode } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { selectChartDatasetColumns } from '~/components/ECharts/MultiSeriesChart/selection'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_LEGEND_RESERVE } from '~/components/ECharts/shared/chartSpacing'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import { useTableSearch } from '~/components/Table/utils'
import type {
	CexAnalyticsMarketSharePoint,
	CexAnalyticsMetric,
	CexAnalyticsSnapshotResponse,
	CexAnalyticsSnapshotRow,
	CexAnalyticsTotalsPoint
} from '~/containers/Cexs/api.types'
import { useProDashboardTime } from '~/containers/ProDashboard/ProDashboardAPIContext'
import { getTimePeriodBounds, StreamDoneContext } from '~/containers/ProDashboard/queries'
import type { CexDatasetTableConfig } from '~/containers/ProDashboard/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import type { CsvCell } from '~/utils/csvCell'
import { formatDateTime } from '~/utils/dateFormat'
import { downloadCSV } from '~/utils/download'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import { scaledPx, useCardHeightScale } from '../../cardHeightContext'
import { CSVExportButton } from '../../CSVExportButton'
import { ProCardLoading } from '../../ProCardStatus'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import { cexAnalyticsColumns } from './columns'
import { useCexAnalyticsMarketShare, useCexAnalyticsSnapshot, useCexAnalyticsTotals } from './useCexAnalyticsData'

export const tableFeaturesConfig = tableFeatures({
	...orderedFilteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const EMPTY_ROWS: Array<CexAnalyticsSnapshotRow> = []
const CEX_COLUMN_ORDER: ColumnOrderState = [
	'venue',
	'spotVolume24h',
	'derivativesVolume24h',
	'spotShare',
	'derivativesShare',
	'derivativesToSpotRatio',
	'openInterest',
	'avgLeverage',
	'cleanTvl',
	'volumeToTvl'
]
const CEX_COLUMN_SIZING: ColumnSizingState = {
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
] as const
const SPOT_VS_DERIVATIVES_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
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
const STACKED_PERCENT_CHART_OPTIONS = { grid: { top: CHART_LEGEND_RESERVE } }

type CexAnalyticsDatasetProps = {
	config: CexDatasetTableConfig
}

function DatasetState({
	isLoading,
	isError,
	errorMessage,
	children
}: {
	isLoading: boolean
	isError: boolean
	errorMessage: string
	children: ReactNode
}) {
	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(320px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading CEX analytics…" />
				</div>
			</div>
		)
	}

	if (isError) {
		return (
			<div className="flex h-full w-full flex-col">
				<div className="flex min-h-[calc(320px*var(--card-scale,1))] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">{errorMessage}</div>
				</div>
			</div>
		)
	}

	return <>{children}</>
}

function filterTimeSeriesRows<T extends { date: number }>(
	rows: Array<T>,
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
		const row = rows[mid]
		if (!row) return rows
		if (row.date < bounds.start) low = mid + 1
		else high = mid
	}
	const startIndex = low
	low = startIndex
	high = rows.length
	while (low < high) {
		const mid = (low + high) >>> 1
		const row = rows[mid]
		if (!row) return rows
		if (row.date <= bounds.end) low = mid + 1
		else high = mid
	}
	return startIndex === 0 && low === rows.length ? rows : rows.slice(startIndex, low)
}

function SummaryCards({ data }: { data: CexAnalyticsSnapshotResponse }) {
	const weightedAvgLeverage = formatRatio(data.summary.weightedAvgLeverage)
	const cards = [
		{
			label: 'Spot Volume',
			value: formatUsd(data.summary.totalSpotVolume, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		},
		{
			label: 'Derivatives Volume',
			value: formatUsd(data.summary.totalDerivativesVolume, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		},
		{
			label: 'Open Interest',
			value: formatUsd(data.summary.totalOpenInterest, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		},
		{
			label: 'Clean TVL',
			value: formatUsd(data.summary.totalCleanTvl, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		},
		{ label: 'Weighted Avg Leverage', value: weightedAvgLeverage === null ? null : `${weightedAvgLeverage}x` }
	]

	return (
		<div className="flex h-full w-full flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<p className="text-sm text-pro-text-secondary">Snapshot metrics across centralized exchanges.</p>
				{data.summary.loadedAt ? (
					<span className="text-xs tracking-wide text-pro-text-tertiary uppercase">
						Loaded {formatDateTime(data.summary.loadedAt, { timeZone: 'UTC' }) ?? '-'}
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
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(CEX_COLUMN_ORDER)
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(CEX_COLUMN_SIZING)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})

	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data: data.rows ?? EMPTY_ROWS,
		columns: cexAnalyticsColumns,
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
		autoResetPageIndex: true
	})

	const [_venueName, setVenueName] = useTableSearch({ instance, columnToSearch: 'venue' })

	return (
		<div className="flex h-full w-full flex-col">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<p className="mr-auto text-sm text-pro-text-secondary">
						Spot, derivatives, OI, leverage, and efficiency across CEXs.
					</p>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<CSVExportButton
							onClick={() => {
								const rows = instance.getFilteredRowModel().rows
								const csv: Array<Array<CsvCell>> = [
									[
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
								]
								for (const tableRow of rows) {
									const row = tableRow.original
									csv.push([
										row.venue,
										row.spotVolume24h,
										row.derivativesVolume24h,
										row.spotShare,
										row.derivativesShare,
										row.derivativesToSpotRatio,
										row.openInterest,
										row.avgLeverage,
										row.cleanTvl,
										row.volumeToTvl
									])
								}

								downloadCSV('cexs-comparison.csv', csv, { addTimestamp: true })
							}}
							smol
						/>
						<input
							type="text"
							placeholder="Search CEXs..."
							onInput={(event) => setVenueName(event.currentTarget.value)}
							className="rounded-md border border-pro-cards-border bg-pro-glass-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors focus:border-brand focus:outline-hidden"
						/>
					</div>
				</div>
			</div>
			<TableBody table={instance} />
			<TablePagination
				pageSize={pagination.pageSize}
				pageIndex={pagination.pageIndex}
				pageCount={instance.getPageCount()}
				canPreviousPage={instance.getCanPreviousPage()}
				canNextPage={instance.getCanNextPage()}
				previousPage={instance.previousPage}
				nextPage={instance.nextPage}
				setPageSize={instance.setPageSize}
				showPageSizes={instance.getRowCount() > 10}
			/>
		</div>
	)
}

function SpotVsDerivativesChart({ data }: { data: Array<CexAnalyticsTotalsPoint> }) {
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(360, cardHeightScale)
	const filtered = useMemo(
		() => filterTimeSeriesRows(data, timePeriod, customTimePeriod),
		[data, timePeriod, customTimePeriod]
	)
	const dataset = useMemo<MultiSeriesChartDataset>(
		() => ({
			source: filtered.map((point) => [point.date * 1e3, point.spotVolume, point.derivativesVolume]),
			dimensions: ['timestamp', 'Spot', 'Derivatives']
		}),
		[filtered]
	)

	if (dataset.source.length === 0) {
		return (
			<div className="flex min-h-[calc(320px*var(--card-scale,1))] items-center justify-center p-4 text-sm text-pro-text-secondary">
				No volume data available.
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col">
			<Suspense fallback={<div className="h-[calc(360px*var(--card-scale,1))]" />}>
				<MultiSeriesChart
					title="Spot vs Derivatives Volume"
					dataset={dataset}
					charts={SPOT_VS_DERIVATIVES_CHARTS}
					valueSymbol="$"
					height={chartHeight}
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
	data: Array<CexAnalyticsMarketSharePoint>
	metric: CexAnalyticsMetric
	topN: number
}) {
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(360, cardHeightScale)
	const filtered = useMemo(
		() => filterTimeSeriesRows(data, timePeriod, customTimePeriod),
		[data, timePeriod, customTimePeriod]
	)

	const { dataset, charts } = useMemo(() => {
		const byDate = new Map<number, Map<string, number>>()
		const order: Array<string> = []
		const seenVenues = new Set<string>()
		for (const point of filtered) {
			if (!seenVenues.has(point.venue)) {
				seenVenues.add(point.venue)
				order.push(point.venue)
			}
			let values = byDate.get(point.date)
			if (!values) {
				values = new Map()
				byDate.set(point.date, values)
			}
			values.set(point.venue, point.share)
		}

		// The server query is ordered by date, and filtering preserves that order.
		const source: MultiSeriesChartDataset['source'] = new Array(byDate.size)
		let rowIndex = 0
		for (const [date, values] of byDate) {
			const row = new Array<number>(order.length + 1)
			row[0] = date * 1e3
			for (const [venueIndex, venue] of order.entries()) {
				row[venueIndex + 1] = values.get(venue) ?? 0
			}
			source[rowIndex++] = row
		}
		const charts: Array<MultiSeriesChartSeriesConfig> = []
		for (const [index, venue] of order.entries()) {
			const color = SHARE_PALETTE[index % SHARE_PALETTE.length]
			if (!color) throw new Error('CEX market-share palette must not be empty')
			charts.push({
				type: 'line',
				name: venue,
				encode: { x: 0, y: index + 1 },
				stack: 'Total',
				color
			})
		}

		return {
			dataset: { source, dimensions: ['timestamp', ...order] },
			charts
		}
	}, [filtered])
	const venueSeries = useMemo(() => charts.map((chart) => chart.name), [charts])
	const { activeSeries, selectedCharts, setSelectedSeries } = useLocalSelection({
		availableSeries: venueSeries,
		scope: metric
	})
	const title = `CEX ${metric === 'spot' ? 'Spot' : 'Derivatives'} Market Share (Top ${topN})`

	if (dataset.source.length === 0 || charts.length === 0) {
		return (
			<div className="flex min-h-[calc(320px*var(--card-scale,1))] items-center justify-center p-4 text-sm text-pro-text-secondary">
				No market share data available.
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col">
			<div className="flex flex-wrap items-center justify-end gap-2 pb-2">
				<div className="flex flex-wrap items-center justify-end gap-2">
					{venueSeries.length > 1 ? (
						<SelectWithCombobox
							allValues={venueSeries}
							selectedValues={activeSeries}
							setSelectedValues={setSelectedSeries}
							label="Venue"
							labelType="smol"
							variant="filter"
							size="sm"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename={`cex-${metric}-market-share`}
						title={title}
						csvSource={{
							type: 'dataset',
							prepare: () =>
								selectChartDatasetColumns(
									dataset,
									charts.filter((chart) => selectedCharts.has(chart.name))
								)
						}}
						smol
					/>
				</div>
			</div>
			<Suspense fallback={<div className="h-[calc(360px*var(--card-scale,1))]" />}>
				<MultiSeriesChart
					title=""
					dataset={dataset}
					charts={charts}
					selectedCharts={selectedCharts}
					chartOptions={STACKED_PERCENT_CHART_OPTIONS}
					solidChartAreaStyle
					valueSymbol="%"
					height={chartHeight}
					hideDefaultLegend={false}
					exportButtons="hidden"
					onReady={handleChartReady}
				/>
			</Suspense>
		</div>
	)
}

export function CexAnalyticsDataset({ config }: CexAnalyticsDatasetProps) {
	const streamDone = useContext(StreamDoneContext)
	const view = config.cexAnalyticsView
	const needsSnapshot = view === 'summary' || view === 'comparison'
	const needsTotals = view === 'spot-vs-derivatives'
	const needsShare = view === 'market-share'
	const shareMetric = needsShare ? config.cexAnalyticsMetric : 'derivatives'
	const shareTopN = needsShare ? config.cexAnalyticsTopN : 8
	const snapshotQuery = useCexAnalyticsSnapshot(needsSnapshot && streamDone)
	const totalsQuery = useCexAnalyticsTotals(needsTotals && streamDone)
	const shareQuery = useCexAnalyticsMarketShare(shareMetric, shareTopN, needsShare && streamDone)

	if (view === 'summary') {
		return (
			<DatasetState
				isLoading={snapshotQuery.isLoading || (!streamDone && snapshotQuery.data === undefined)}
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
				isLoading={snapshotQuery.isLoading || (!streamDone && snapshotQuery.data === undefined)}
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
				isLoading={totalsQuery.isLoading || (!streamDone && totalsQuery.data === undefined)}
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
				isLoading={shareQuery.isLoading || (!streamDone && shareQuery.data === undefined)}
				isError={Boolean(shareQuery.error)}
				errorMessage="Failed to load CEX market share"
			>
				{shareQuery.data ? (
					<VenueMarketShareChart
						data={shareQuery.data}
						metric={config.cexAnalyticsMetric}
						topN={config.cexAnalyticsTopN}
					/>
				) : null}
			</DatasetState>
		)
	}

	const exhaustiveView: never = view
	return exhaustiveView
}
