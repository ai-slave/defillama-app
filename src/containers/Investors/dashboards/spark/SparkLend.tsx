import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { createPaginatedRowModel, rowPaginationFeature, tableFeatures, useTable } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { filteredTableFeatures } from '~/components/Table/features/filtering'
import { Table } from '~/components/Table/Table'
import { TablePager } from '~/containers/Investors/TablePager'
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			{children}
		</div>
	)
}

function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			<div className="flex h-[400px] items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
		</div>
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
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">Yield Pools</h3>
			<Table table={instance} />
			{data.length > 15 && <Pagination table={instance} />}
		</div>
	)
}

function Pagination({ table }: { table: ReturnType<typeof useTable<typeof tableFeaturesConfig, PoolRow>> }) {
	const { pageIndex, pageSize } = table.state.pagination
	const total = table.getFilteredRowModel().rows.length

	return (
		<TablePager
			label={
				<>
					{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} of {total}
				</>
			}
			canPrevious={table.getCanPreviousPage()}
			canNext={table.getCanNextPage()}
			onPrevious={() => table.previousPage()}
			onNext={() => table.nextPage()}
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
				<CardSkeleton title="TVL" />
			) : (
				<ChartCard title="TVL">
					<MultiSeriesChart
						dataset={tvlDataset}
						charts={TVL_CHARTS}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={AREA_EXPORT}
					/>
				</ChartCard>
			)}

			{breakdownLoading ? (
				<CardSkeleton title="TVL by Chain" />
			) : tvlByChain.charts.length > 0 ? (
				<ChartCard title="TVL by Chain">
					<MultiSeriesChart
						dataset={tvlByChain.dataset}
						charts={tvlByChain.charts}
						valueSymbol="$"
						title=""
						height="400px"
						stacked
						solidChartAreaStyle
						chartOptions={DOLLAR_STACKED_CHART_OPTIONS}
						exportButtons={AREA_EXPORT}
					/>
				</ChartCard>
			) : null}

			{borrowedLoading ? (
				<CardSkeleton title="Total Borrowed" />
			) : (
				<ChartCard title="Total Borrowed">
					<MultiSeriesChart
						dataset={borrowedDataset}
						charts={BORROWED_CHARTS}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={AREA_EXPORT}
					/>
				</ChartCard>
			)}

			{feesLoading ? (
				<CardSkeleton title="Fees" />
			) : (
				<ChartCard title="Fees">
					<MultiSeriesChart
						dataset={feesDataset}
						charts={FEES_CHARTS}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{breakdownLoading ? (
				<CardSkeleton title="Fees by Chain" />
			) : feesByChain.charts.length > 0 ? (
				<ChartCard title="Fees by Chain">
					<MultiSeriesChart
						dataset={feesByChain.dataset}
						charts={feesByChain.charts}
						valueSymbol="$"
						title=""
						height="400px"
						hideDefaultLegend={feesByChain.charts.length < 2}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			) : null}

			{feesLoading ? (
				<CardSkeleton title="Revenue" />
			) : (
				<ChartCard title="Revenue">
					<MultiSeriesChart
						dataset={revenueDataset}
						charts={REVENUE_CHARTS}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{feesLoading ? (
				<CardSkeleton title="Supply Side Revenue" />
			) : (
				<ChartCard title="Supply Side Revenue">
					<MultiSeriesChart
						dataset={supplySideRevenueDataset}
						charts={SUPPLY_SIDE_REVENUE_CHARTS}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{tvlLoading ? (
				<CardSkeleton title="USD Inflows" />
			) : (
				<ChartCard title="USD Inflows">
					<MultiSeriesChart
						dataset={inflowsDataset}
						charts={INFLOWS_CHARTS}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{poolsLoading ? <CardSkeleton title="Yield Pools" /> : <YieldPoolsTable data={pools} />}
		</div>
	)
}
