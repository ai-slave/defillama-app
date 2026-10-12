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
	formatPercent,
	formatUsd,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import { useMaplePoolsWithLoans } from './api'
import { buildMapleLoansData, type LoanRow } from './chartData'
import { CardSkeleton, MAPLE_USD_CATEGORY_CHART_OPTIONS, Pagination } from './shared'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const PRINCIPAL_BY_POOL_CHART: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Principal',
		encode: { x: 'Name', y: 'Principal' },
		color: '#4FC3F7',
		stack: 'a'
	}
]
const RATE_DISTRIBUTION_CHART: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Principal',
		encode: { x: 'Name', y: 'Principal' },
		color: '#FFA726',
		stack: 'a'
	}
]
const AGE_DISTRIBUTION_CHART: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Principal',
		encode: { x: 'Name', y: 'Principal' },
		color: '#7E57C2',
		stack: 'a'
	}
]

const loanColumns: Array<ColumnDef<typeof paginatedTableFeatures, LoanRow>> = [
	{
		header: 'Borrower',
		accessorKey: 'borrower',
		cell: ({ getValue }) => {
			const addr = getValue<string>()
			return `${addr.slice(0, 6)}…${addr.slice(-4)}`
		},
		size: 130
	},
	{ header: 'Pool', accessorKey: 'pool', size: 180 },
	{
		header: 'Principal',
		id: 'principal',
		accessorFn: (row) => row.principal ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 130
	},
	{
		header: 'Rate',
		id: 'interestRate',
		accessorFn: (row) => row.interestRate ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 80
	},
	{
		header: 'State',
		accessorKey: 'state',
		size: 80
	},
	{
		header: 'Age',
		id: 'ageDays',
		accessorFn: (row) => row.ageDays ?? undefined,
		cell: ({ getValue }) => {
			const days = getValue<number>()
			if (days <= 0) return '< 1d'
			if (days < 30) return `${days}d`
			return `${Math.floor(days / 30)}mo`
		},
		meta: { align: 'end' as const },
		size: 70
	},
	{
		header: 'Interest Paid',
		id: 'interestPaid',
		accessorFn: (row) => row.interestPaid ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Pay Interval',
		id: 'paymentIntervalDays',
		accessorFn: (row) => row.paymentIntervalDays ?? undefined,
		cell: ({ getValue }) => `${getValue<number>()}d`,
		meta: { align: 'end' as const },
		size: 90
	},
	{
		header: 'Impaired',
		accessorKey: 'isImpaired',
		cell: ({ getValue }) => {
			const impaired = getValue<boolean>()
			return <span className={impaired ? 'text-error' : ''}>{impaired ? 'Yes' : 'No'}</span>
		},
		size: 80
	}
]

function LoansTable({ data }: { data: Array<LoanRow> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'principal', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = usePaginatedTable({
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: loanColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination
	})

	if (data.length === 0) return null

	return (
		<Card padding="md">
			<h3 className="mb-3 label-md text-secondary">Open-term loans</h3>
			<Table table={instance} />
			{data.length > 15 && <Pagination table={instance} />}
		</Card>
	)
}

export default function Loans() {
	const { pools, isLoading } = useMaplePoolsWithLoans()

	const [nowSec] = useState(() => Math.floor(Date.now() / 1000))
	const data = useMemo(() => buildMapleLoansData(pools, nowSec), [pools, nowSec])
	const kpis =
		isLoading || data.rows.length === 0
			? null
			: {
					totalLoans: data.rows.length,
					totalPrincipal: formatUsd(data.totals.totalPrincipal, USD_LOWERCASE_MILLIONS_OPTIONS),
					avgRate: `${formatPercent(data.totals.weightedAverageRate, PERCENT_POINTS_TWO_DECIMALS_OPTIONS)}`,
					totalInterestPaid: formatUsd(data.totals.totalInterestPaid, USD_LOWERCASE_MILLIONS_OPTIONS),
					avgAge: `${Math.round(data.totals.averageAgeDays)}d`
				}

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{kpis ? (
					<>
						<StatTile label="Active Loans" value={kpis.totalLoans} />
						<StatTile label="Total Principal" value={kpis.totalPrincipal} />
						<StatTile label="Avg Interest Rate" value={kpis.avgRate} />
						<StatTile label="Total Interest Paid" value={kpis.totalInterestPaid} />
						<StatTile label="Avg Loan Age" value={kpis.avgAge} />
					</>
				) : (
					<>
						<StatTile label="Active Loans" loading />
						<StatTile label="Total Principal" loading />
						<StatTile label="Avg Interest Rate" loading />
						<StatTile label="Total Interest Paid" loading />
						<StatTile label="Avg Loan Age" loading />
					</>
				)}
			</div>

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : data.principalByPool.source.length > 0 ? (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Principal by pool"
							headingAs="h3"
							dataset={data.principalByPool}
							charts={PRINCIPAL_BY_POOL_CHART}
							valueSymbol="$"
							chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
							exportButtons="auto"
						/>
					</Suspense>
				</Panel>
			) : null}

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{isLoading ? (
					<PanelLoadingStatus className="min-h-[400px]" />
				) : data.rateDistribution.source.length > 0 ? (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="Interest Rate distribution"
								headingAs="h3"
								dataset={data.rateDistribution}
								charts={RATE_DISTRIBUTION_CHART}
								valueSymbol="$"
								chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
								exportButtons="auto"
							/>
						</Suspense>
					</Panel>
				) : null}

				{isLoading ? (
					<PanelLoadingStatus className="min-h-[400px]" />
				) : data.ageDistribution.source.length > 0 ? (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="Loan Age distribution"
								headingAs="h3"
								dataset={data.ageDistribution}
								charts={AGE_DISTRIBUTION_CHART}
								valueSymbol="$"
								chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
								exportButtons="auto"
							/>
						</Suspense>
					</Panel>
				) : null}
			</div>

			{isLoading ? <CardSkeleton title="Open-term loans" /> : <LoansTable data={data.rows} />}
		</div>
	)
}
