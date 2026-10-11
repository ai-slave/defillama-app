import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { createPaginatedRowModel, rowPaginationFeature, tableFeatures, useTable } from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { filteredTableFeatures } from '~/components/Table/features/filtering'
import { Table } from '~/components/Table/Table'
import { TablePager } from '~/components/Table/TablePager'
import { Card } from '~/ui/Card'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import {
	formatPercent,
	formatUsd,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import { AREA_EXPORT, BAR_EXPORT, DOLLAR_CHART_OPTIONS, DOLLAR_STACKED_CHART_OPTIONS } from './chartDefaults'
import {
	useSparklendBorrowedChart,
	useSparklendChainBreakdown,
	useSparklendFeesCharts,
	useSparklendMetrics,
	useSparklendTvlChart,
	useSparklendYieldPools
} from './sparklendApi'

const tableFeaturesConfig = tableFeatures({
	...filteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const TVL_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{ type: 'line', name: 'TVL', encode: { x: 'timestamp', y: 'TVL' } }
]
const BORROWED_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{ type: 'line', name: 'Borrowed', encode: { x: 'timestamp', y: 'Borrowed' } }
]
const FEES_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{ type: 'bar', name: 'Fees', encode: { x: 'timestamp', y: 'Fees' }, color: '#4FC3F7', stack: 'a' }
]
const REVENUE_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{ type: 'bar', name: 'Revenue', encode: { x: 'timestamp', y: 'Revenue' }, color: '#66BB6A', stack: 'a' }
]
const SUPPLY_SIDE_REVENUE_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{
		type: 'bar',
		name: 'Supply Side Revenue',
		encode: { x: 'timestamp', y: 'Supply Side Revenue' },
		color: '#FFA726',
		stack: 'a'
	}
]
const INFLOWS_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{
		type: 'bar',
		name: 'USD Inflows',
		encode: { x: 'timestamp', y: 'USD Inflows' },
		color: '#AB47BC',
		stack: 'a'
	}
]

function CardSkeleton({ title }: { title: string }) {
	return (
		<Card padding="md">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			<SurfaceBodyLoadingStatus className="min-h-[400px]" />
		</Card>
	)
}

interface PoolRow {
	symbol: string
	chain: string
	tvlUsd: number
	apy: number | null
	apyBase: number | null
	apyReward: number | null
	poolMeta: string | null
}

const poolColumns: Array<ColumnDef<typeof tableFeaturesConfig, PoolRow>> = [
	{
		header: 'Pool',
		accessorKey: 'symbol',
		cell: ({ row }) => {
			const meta = row.original.poolMeta
			return meta ? `${row.original.symbol} (${meta})` : row.original.symbol
		},
		size: 200
	},
	{ header: 'Chain', accessorKey: 'chain', size: 120 },
	{
		header: 'TVL',
		id: 'tvlUsd',
		accessorFn: (row) => row.tvlUsd ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Supply APY',
		id: 'apy',
		accessorFn: (row) => row.apy ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number | null>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Base APY',
		id: 'apyBase',
		accessorFn: (row) => row.apyBase ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number | null>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Reward APY',
		id: 'apyReward',
		accessorFn: (row) => row.apyReward ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number | null>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 120
	}
]

function YieldPoolsTable({ data }: { data: Array<PoolRow> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'tvlUsd', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: poolColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination
	})

	if (data.length === 0) return null

	return (
		<Card padding="md">
			<h3 className="mb-3 label-md text-secondary">Yield pools</h3>
			<Table table={instance} />
			{data.length > 15 && <Pagination table={instance} />}
		</Card>
	)
}

function Pagination({ table }: { table: ReturnType<typeof useTable<typeof tableFeaturesConfig, PoolRow>> }) {
	const { pageIndex, pageSize } = table.state.pagination
	const total = table.getFilteredRowModel().rows.length

	return (
		<TablePager
			pageIndex={pageIndex}
			pageCount={table.getPageCount()}
			onPageChange={(index) => table.setPageIndex(index)}
			range={{ from: pageIndex * pageSize + 1, to: Math.min((pageIndex + 1) * pageSize, total), total }}
			className="mt-2"
		/>
	)
}

export default function SparkLend() {
	const { fees, revenue, supplySideRevenue, isLoading: metricsLoading } = useSparklendMetrics()
	const { tvlDataset, inflowsDataset, previousTvl, isLoading: tvlLoading } = useSparklendTvlChart()
	const { borrowedDataset, currentBorrowed, isLoading: borrowedLoading } = useSparklendBorrowedChart()
	const { feesDataset, revenueDataset, supplySideRevenueDataset, isLoading: feesLoading } = useSparklendFeesCharts()
	const { pools, isLoading: poolsLoading } = useSparklendYieldPools()
	const { tvlByChain, feesByChain, isLoading: breakdownLoading } = useSparklendChainBreakdown()

	const kpis = useMemo(() => {
		if (metricsLoading || tvlLoading || borrowedLoading) return null

		return {
			tvl: previousTvl != null ? formatUsd(previousTvl, USD_LOWERCASE_MILLIONS_OPTIONS) : '—',
			borrowed: currentBorrowed != null ? formatUsd(currentBorrowed, USD_LOWERCASE_MILLIONS_OPTIONS) : '—',
			fees24h: fees?.total48hto24h != null ? formatUsd(fees.total48hto24h, USD_LOWERCASE_MILLIONS_OPTIONS) : '—',
			revenue24h:
				revenue?.total48hto24h != null ? formatUsd(revenue.total48hto24h, USD_LOWERCASE_MILLIONS_OPTIONS) : '—',
			supplySideRevenue24h:
				supplySideRevenue?.total48hto24h != null
					? formatUsd(supplySideRevenue.total48hto24h, USD_LOWERCASE_MILLIONS_OPTIONS)
					: '—'
		}
	}, [fees, revenue, supplySideRevenue, previousTvl, currentBorrowed, metricsLoading, tvlLoading, borrowedLoading])

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
				{kpis ? (
					<>
						<StatTile label="TVL" value={kpis.tvl} />
						<StatTile label="Total Borrowed" value={kpis.borrowed} />
						<StatTile label="Fees (24h)" value={kpis.fees24h} />
						<StatTile label="Revenue (24h)" value={kpis.revenue24h} />
						<StatTile label="Supply Side Rev (24h)" value={kpis.supplySideRevenue24h} />
					</>
				) : (
					<>
						<StatTile label="TVL" loading />
						<StatTile label="Total Borrowed" loading />
						<StatTile label="Fees (24h)" loading />
						<StatTile label="Revenue (24h)" loading />
						<StatTile label="Supply Side Rev (24h)" loading />
					</>
				)}
			</div>

			{tvlLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="TVL"
							headingAs="h3"
							dataset={tvlDataset}
							charts={TVL_CHARTS}
							valueSymbol="$"
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={AREA_EXPORT}
						/>
					</Suspense>
				</Panel>
			)}

			{breakdownLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : tvlByChain.charts.length > 0 ? (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="TVL by chain"
							headingAs="h3"
							dataset={tvlByChain.dataset}
							charts={tvlByChain.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							chartOptions={DOLLAR_STACKED_CHART_OPTIONS}
							exportButtons={AREA_EXPORT}
						/>
					</Suspense>
				</Panel>
			) : null}

			{borrowedLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Total Borrowed"
							headingAs="h3"
							dataset={borrowedDataset}
							charts={BORROWED_CHARTS}
							valueSymbol="$"
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={AREA_EXPORT}
						/>
					</Suspense>
				</Panel>
			)}

			{feesLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Fees"
							headingAs="h3"
							dataset={feesDataset}
							charts={FEES_CHARTS}
							valueSymbol="$"
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</Panel>
			)}

			{breakdownLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : feesByChain.charts.length > 0 ? (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Fees by Chain"
							headingAs="h3"
							dataset={feesByChain.dataset}
							charts={feesByChain.charts}
							valueSymbol="$"
							showLegend={feesByChain.charts.length > 1}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</Panel>
			) : null}

			{feesLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Revenue"
							headingAs="h3"
							dataset={revenueDataset}
							charts={REVENUE_CHARTS}
							valueSymbol="$"
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</Panel>
			)}

			{feesLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Supply Side Revenue"
							headingAs="h3"
							dataset={supplySideRevenueDataset}
							charts={SUPPLY_SIDE_REVENUE_CHARTS}
							valueSymbol="$"
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</Panel>
			)}

			{tvlLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="USD inflows"
							headingAs="h3"
							dataset={inflowsDataset}
							charts={INFLOWS_CHARTS}
							valueSymbol="$"
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</Panel>
			)}

			{poolsLoading ? <CardSkeleton title="Yield pools" /> : <YieldPoolsTable data={pools} />}
		</div>
	)
}
