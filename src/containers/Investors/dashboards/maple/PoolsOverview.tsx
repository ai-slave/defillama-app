import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { Table } from '~/components/Table/Table'
import { Card } from '~/ui/Card'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import {
	formatCompactNumber,
	formatPercent,
	formatUsd,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import { useMapleActivePools } from './api'
import { buildMaplePoolsData, type PoolRow } from './chartData'
import {
	CardSkeleton,
	MAPLE_PERCENT_CATEGORY_CHART_OPTIONS,
	MAPLE_USD_CATEGORY_CHART_OPTIONS,
	Pagination
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

const poolColumns: Array<ColumnDef<typeof paginatedTableFeatures, PoolRow>> = [
	{ header: 'Pool', accessorKey: 'name', size: 220 },
	{ header: 'Asset', accessorKey: 'asset', size: 80 },
	{
		header: 'TVL',
		id: 'tvlUsd',
		accessorFn: (row) => row.tvlUsd ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Spot APY',
		id: 'spotApy',
		accessorFn: (row) => row.spotApy ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Utilization',
		id: 'utilization',
		accessorFn: (row) => row.utilization ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Depositors',
		id: 'numPositions',
		accessorFn: (row) => row.numPositions ?? undefined,
		cell: ({ getValue }) => formatCompactNumber(getValue<number>(), NUMBER_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Open Loans',
		id: 'numOpenTermLoans',
		accessorFn: (row) => row.numOpenTermLoans ?? undefined,
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Fees',
		id: 'feeRate',
		accessorFn: (row) => row.feeRate ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
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

function PoolsTable({ data }: { data: Array<PoolRow> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'tvlUsd', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = usePaginatedTable({
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
			<h3 className="mb-3 label-md text-secondary">Active pools</h3>
			<Table table={instance} />
			{data.length > 15 && <Pagination table={instance} />}
		</Card>
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
					totalTvl: formatUsd(data.totals.totalTvl, USD_LOWERCASE_MILLIONS_OPTIONS),
					activePools: pools.length,
					totalDepositors: formatCompactNumber(data.totals.totalDepositors, NUMBER_LOWERCASE_MILLIONS_OPTIONS),
					avgApy: `${formatPercent(data.totals.weightedAverageApy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS)}`,
					avgUtil: `${formatPercent(data.totals.weightedAverageUtilization, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
				}

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{kpis ? (
					<>
						<StatTile label="Total TVL" value={kpis.totalTvl} />
						<StatTile label="Active Pools" value={kpis.activePools} />
						<StatTile label="Total Depositors" value={kpis.totalDepositors} />
						<StatTile label="Avg Pool APY" value={kpis.avgApy} />
						<StatTile label="Avg Utilization" value={kpis.avgUtil} />
					</>
				) : (
					<>
						<StatTile label="Total TVL" loading />
						<StatTile label="Active Pools" loading />
						<StatTile label="Total Depositors" loading />
						<StatTile label="Avg Pool APY" loading />
						<StatTile label="Avg Utilization" loading />
					</>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{isLoading ? (
					<PanelLoadingStatus className="min-h-[400px]" />
				) : (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="TVL by pool"
								headingAs="h3"
								dataset={data.tvl}
								charts={TVL_CHART}
								valueSymbol="$"
								chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
								exportButtons="auto"
							/>
						</Suspense>
					</Panel>
				)}

				{isLoading ? (
					<PanelLoadingStatus className="min-h-[400px]" />
				) : data.utilization.source.length > 0 ? (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="Pool Utilization"
								headingAs="h3"
								dataset={data.utilization}
								charts={UTILIZATION_CHART}
								valueSymbol="%"
								chartOptions={MAPLE_PERCENT_CATEGORY_CHART_OPTIONS}
								exportButtons="auto"
							/>
						</Suspense>
					</Panel>
				) : null}
			</div>

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : data.apy.source.length > 0 ? (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Spot APY by pool"
							headingAs="h3"
							dataset={data.apy}
							charts={APY_CHART}
							valueSymbol="%"
							chartOptions={MAPLE_PERCENT_CATEGORY_CHART_OPTIONS}
							exportButtons="auto"
						/>
					</Suspense>
				</Panel>
			) : null}

			{isLoading ? <CardSkeleton title="Active pools" /> : <PoolsTable data={poolRows} />}
		</div>
	)
}
