import { getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { VirtualTable } from '~/components/Table/Table'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { useMapleActivePools } from './api'
import { buildMaplePoolsData, type PoolRow } from './chartData'
import {
	ChartCard,
	CardSkeleton,
	KpiCard,
	KpiSkeleton,
	MAPLE_CSV_ONLY_EXPORT,
	MAPLE_PERCENT_CATEGORY_CHART_OPTIONS,
	MAPLE_USD_CATEGORY_CHART_OPTIONS,
	Pagination,
	formatPct
} from './shared'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const TVL_CHART: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'TVL',
		encode: { x: 'Name', y: 'TVL' },
		color: '#4FC3F7',
		stack: 'a'
	}
]
const UTILIZATION_CHART: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Utilization',
		encode: { x: 'Name', y: 'Utilization' },
		color: '#AB47BC',
		stack: 'a'
	}
]
const APY_CHART: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Spot APY',
		encode: { x: 'Name', y: 'Spot APY' },
		color: '#66BB6A',
		stack: 'a'
	}
]

const poolColumns: ColumnDef<PoolRow>[] = [
	{ header: 'Pool', accessorKey: 'name', size: 220 },
	{ header: 'Asset', accessorKey: 'asset', size: 80 },
	{
		header: 'TVL',
		accessorKey: 'tvlUsd',
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Spot APY',
		accessorKey: 'spotApy',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Utilization',
		accessorKey: 'utilization',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Depositors',
		accessorKey: 'numPositions',
		cell: ({ getValue }) =>
			formatCompactNumber(getValue<number>(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 100
	},
	{ header: 'Open Loans', accessorKey: 'numOpenTermLoans', meta: { align: 'end' as const }, size: 100 },
	{
		header: 'Fees',
		accessorKey: 'feeRate',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 80
	},
	{
		header: 'Access',
		accessorKey: 'openToPublic',
		cell: ({ getValue }) => (getValue<boolean>() ? 'Public' : 'Permissioned'),
		size: 110
	}
]

function PoolsTable({ data }: { data: PoolRow[] }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'tvlUsd', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = useReactTable({
		data,
		columns: poolColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	if (data.length === 0) return null

	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">Active Pools</h3>
			<VirtualTable instance={instance} skipVirtualization />
			{data.length > 15 && <Pagination table={instance} />}
		</div>
	)
}

export default function PoolsOverview() {
	const { pools, isLoading } = useMapleActivePools()

	const data = useMemo(() => buildMaplePoolsData(pools), [pools])
	const poolRows = data.rows
	const kpis =
		isLoading || pools.length === 0
			? null
			: {
					totalTvl: formatUsd(data.totals.totalTvl, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
					activePools: pools.length,
					totalDepositors: formatCompactNumber(data.totals.totalDepositors, {
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
					avgApy: `${formatPercent(data.totals.weightedAverageApy, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`,
					avgUtil: `${formatPercent(data.totals.weightedAverageUtilization, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
				}

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{kpis ? (
					<>
						<KpiCard label="Total TVL" value={kpis.totalTvl} />
						<KpiCard label="Active Pools" value={kpis.activePools} />
						<KpiCard label="Total Depositors" value={kpis.totalDepositors} />
						<KpiCard label="Avg Pool APY" value={kpis.avgApy} />
						<KpiCard label="Avg Utilization" value={kpis.avgUtil} />
					</>
				) : (
					<>
						<KpiSkeleton label="Total TVL" />
						<KpiSkeleton label="Active Pools" />
						<KpiSkeleton label="Total Depositors" />
						<KpiSkeleton label="Avg Pool APY" />
						<KpiSkeleton label="Avg Utilization" />
					</>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{isLoading ? (
					<CardSkeleton title="TVL by Pool" />
				) : (
					<ChartCard title="TVL by Pool">
						<MultiSeriesChart
							dataset={data.tvl}
							charts={TVL_CHART}
							valueSymbol="$"
							height="400px"
							chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</ChartCard>
				)}

				{isLoading ? (
					<CardSkeleton title="Pool Utilization" />
				) : data.utilization.source.length > 0 ? (
					<ChartCard title="Pool Utilization">
						<MultiSeriesChart
							dataset={data.utilization}
							charts={UTILIZATION_CHART}
							valueSymbol="%"
							height="400px"
							chartOptions={MAPLE_PERCENT_CATEGORY_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</ChartCard>
				) : null}
			</div>

			{isLoading ? (
				<CardSkeleton title="Spot APY by Pool" />
			) : data.apy.source.length > 0 ? (
				<ChartCard title="Spot APY by Pool">
					<MultiSeriesChart
						dataset={data.apy}
						charts={APY_CHART}
						valueSymbol="%"
						height="400px"
						chartOptions={MAPLE_PERCENT_CATEGORY_CHART_OPTIONS}
						exportButtons={MAPLE_CSV_ONLY_EXPORT}
					/>
				</ChartCard>
			) : null}

			{isLoading ? <CardSkeleton title="Active Pools" /> : <PoolsTable data={poolRows} />}
		</div>
	)
}
