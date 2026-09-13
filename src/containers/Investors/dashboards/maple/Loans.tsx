import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { paginatedTableFeatures, usePaginatedTable } from '~/components/Table/features/pagination'
import { Table } from '~/components/Table/Table'
import {
	formatPercent,
	formatUsd,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import { useMaplePoolsWithLoans } from './api'
import { buildMapleLoansData, type LoanRow } from './chartData'
import {
	CardSkeleton,
	ChartCard,
	KpiCard,
	KpiSkeleton,
	MAPLE_CSV_ONLY_EXPORT,
	MAPLE_USD_CATEGORY_CHART_OPTIONS,
	Pagination
} from './shared'

const tableFeaturesConfig = paginatedTableFeatures

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

const loanColumns: Array<ColumnDef<typeof tableFeaturesConfig, LoanRow>> = [
	{
		header: 'Borrower',
		accessorKey: 'borrower',
		cell: ({ getValue }) => {
			const addr = getValue<string>()
			return `${addr.slice(0, 6)}...${addr.slice(-4)}`
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
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">Open-Term Loans</h3>
			<Table table={instance} />
			{data.length > 15 && <Pagination table={instance} />}
		</div>
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
						<KpiCard label="Active Loans" value={kpis.totalLoans} />
						<KpiCard label="Total Principal" value={kpis.totalPrincipal} />
						<KpiCard label="Avg Interest Rate" value={kpis.avgRate} />
						<KpiCard label="Total Interest Paid" value={kpis.totalInterestPaid} />
						<KpiCard label="Avg Loan Age" value={kpis.avgAge} />
					</>
				) : (
					<>
						<KpiSkeleton label="Active Loans" />
						<KpiSkeleton label="Total Principal" />
						<KpiSkeleton label="Avg Interest Rate" />
						<KpiSkeleton label="Total Interest Paid" />
						<KpiSkeleton label="Avg Loan Age" />
					</>
				)}
			</div>

			{isLoading ? (
				<CardSkeleton title="Principal by Pool" />
			) : data.principalByPool.source.length > 0 ? (
				<ChartCard title="Principal by Pool">
					<MultiSeriesChart
						dataset={data.principalByPool}
						charts={PRINCIPAL_BY_POOL_CHART}
						valueSymbol="$"
						height="400px"
						chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
						exportButtons={MAPLE_CSV_ONLY_EXPORT}
					/>
				</ChartCard>
			) : null}

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{isLoading ? (
					<CardSkeleton title="Interest Rate Distribution" />
				) : data.rateDistribution.source.length > 0 ? (
					<ChartCard title="Interest Rate Distribution">
						<MultiSeriesChart
							dataset={data.rateDistribution}
							charts={RATE_DISTRIBUTION_CHART}
							valueSymbol="$"
							height="400px"
							chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</ChartCard>
				) : null}

				{isLoading ? (
					<CardSkeleton title="Loan Age Distribution" />
				) : data.ageDistribution.source.length > 0 ? (
					<ChartCard title="Loan Age Distribution">
						<MultiSeriesChart
							dataset={data.ageDistribution}
							charts={AGE_DISTRIBUTION_CHART}
							valueSymbol="$"
							height="400px"
							chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</ChartCard>
				) : null}
			</div>

			{isLoading ? <CardSkeleton title="Open-Term Loans" /> : <LoansTable data={data.rows} />}
		</div>
	)
}
