import { getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChart2Props, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { VirtualTable } from '~/components/Table/Table'
import { formattedNum } from '~/utils'
import { useMaplePoolsWithLoans, parseInterestRate, parseTokenAmount } from './api'
import {
	ChartCard,
	CardSkeleton,
	KpiCard,
	KpiSkeleton,
	MAPLE_CSV_ONLY_EXPORT,
	MAPLE_USD_CATEGORY_CHART_OPTIONS,
	Pagination,
	formatPct
} from './shared'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

const PRINCIPAL_BY_POOL_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		type: 'bar',
		name: 'Principal',
		encode: { x: 'Name', y: 'Principal' },
		color: '#4FC3F7',
		stack: 'a'
	}
]
const RATE_DISTRIBUTION_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		type: 'bar',
		name: 'Principal',
		encode: { x: 'Name', y: 'Principal' },
		color: '#FFA726',
		stack: 'a'
	}
]
const AGE_DISTRIBUTION_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		type: 'bar',
		name: 'Principal',
		encode: { x: 'Name', y: 'Principal' },
		color: '#7E57C2',
		stack: 'a'
	}
]

interface LoanRow {
	id: string
	borrower: string
	pool: string
	asset: string
	principal: number
	interestRate: number
	isCalled: boolean
	isImpaired: boolean
	interestPaid: number
	fundingDate: number
	ageDays: number
	state: string
	paymentIntervalDays: number
}

const loanColumns: ColumnDef<LoanRow>[] = [
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
		accessorKey: 'principal',
		cell: ({ getValue }) => formattedNum(getValue<number>(), true),
		meta: { align: 'end' as const },
		size: 130
	},
	{
		header: 'Rate',
		accessorKey: 'interestRate',
		cell: ({ getValue }) => formatPct(getValue<number>()),
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
		accessorKey: 'ageDays',
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
		accessorKey: 'interestPaid',
		cell: ({ getValue }) => formattedNum(getValue<number>(), true),
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Pay Interval',
		accessorKey: 'paymentIntervalDays',
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

function LoansTable({ data }: { data: LoanRow[] }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'principal', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = useReactTable({
		data,
		columns: loanColumns,
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
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">Open-Term Loans</h3>
			<VirtualTable instance={instance} skipVirtualization />
			{data.length > 15 && <Pagination table={instance} />}
		</div>
	)
}

const RATE_BUCKETS = [
	{ label: '0-2%', min: 0, max: 2 },
	{ label: '2-4%', min: 2, max: 4 },
	{ label: '4-6%', min: 4, max: 6 },
	{ label: '6-10%', min: 6, max: 10 },
	{ label: '10%+', min: 10, max: Infinity }
]

const AGE_BUCKETS = [
	{ label: '< 1mo', min: 0, max: 30 },
	{ label: '1-3mo', min: 30, max: 90 },
	{ label: '3-6mo', min: 90, max: 180 },
	{ label: '6-12mo', min: 180, max: 365 },
	{ label: '1y+', min: 365, max: Infinity }
]

export default function Loans() {
	const { pools, isLoading } = useMaplePoolsWithLoans()

	const [nowSec] = useState(() => Math.floor(Date.now() / 1000))

	const loanRows = useMemo<LoanRow[]>(() => {
		const rows: LoanRow[] = []
		for (const pool of pools) {
			for (const loan of pool.openTermLoans) {
				const fundingTs = parseInt(loan.fundingDate)
				const ageDays = fundingTs > 0 ? Math.floor((nowSec - fundingTs) / 86400) : 0
				rows.push({
					id: loan.id,
					borrower: loan.borrower.id,
					pool: pool.name,
					asset: pool.asset.symbol,
					principal: parseTokenAmount(loan.principalOwed, pool.asset.decimals),
					interestRate: parseInterestRate(loan.interestRate),
					isCalled: loan.isCalled,
					isImpaired: loan.isImpaired,
					interestPaid: parseTokenAmount(loan.interestPaid, pool.asset.decimals),
					fundingDate: fundingTs,
					ageDays,
					state: loan.state,
					paymentIntervalDays: parseInt(loan.paymentIntervalDays)
				})
			}
		}
		return rows.sort((a, b) => b.principal - a.principal)
	}, [pools, nowSec])

	const view = useMemo(() => {
		const poolMap = new Map<string, number>()
		const ratePrincipal = new Array<number>(RATE_BUCKETS.length).fill(0)
		const agePrincipal = new Array<number>(AGE_BUCKETS.length).fill(0)
		let totalPrincipal = 0
		let totalInterestPaid = 0
		let weightedRateSum = 0
		let totalAge = 0

		for (const loan of loanRows) {
			poolMap.set(loan.pool, (poolMap.get(loan.pool) ?? 0) + loan.principal)
			totalPrincipal += loan.principal
			totalInterestPaid += loan.interestPaid
			weightedRateSum += loan.interestRate * loan.principal
			totalAge += loan.ageDays

			for (let index = 0; index < RATE_BUCKETS.length; index++) {
				const bucket = RATE_BUCKETS[index]
				if (loan.interestRate >= bucket.min && loan.interestRate < bucket.max) {
					ratePrincipal[index] += loan.principal
					break
				}
			}
			for (let index = 0; index < AGE_BUCKETS.length; index++) {
				const bucket = AGE_BUCKETS[index]
				if (loan.ageDays >= bucket.min && loan.ageDays < bucket.max) {
					agePrincipal[index] += loan.principal
					break
				}
			}
		}

		const principalByPool: MultiSeriesChart2Dataset = {
			dimensions: ['Name', 'Principal'],
			source: Array.from(poolMap.entries())
				.sort((a, b) => b[1] - a[1])
				.map(([Name, principal]) => ({ Name, Principal: principal }))
		}
		const rateDistribution: MultiSeriesChart2Dataset = {
			dimensions: ['Name', 'Principal'],
			source: RATE_BUCKETS.flatMap((bucket, index) =>
				ratePrincipal[index] > 0 ? [{ Name: bucket.label, Principal: ratePrincipal[index] }] : []
			)
		}
		const ageDistribution: MultiSeriesChart2Dataset = {
			dimensions: ['Name', 'Principal'],
			source: AGE_BUCKETS.flatMap((bucket, index) =>
				agePrincipal[index] > 0 ? [{ Name: bucket.label, Principal: agePrincipal[index] }] : []
			)
		}

		return {
			kpis:
				isLoading || loanRows.length === 0
					? null
					: {
							totalLoans: loanRows.length,
							totalPrincipal: formattedNum(totalPrincipal, true),
							avgRate: `${(totalPrincipal > 0 ? weightedRateSum / totalPrincipal : 0).toFixed(2)}%`,
							totalInterestPaid: formattedNum(totalInterestPaid, true),
							avgAge: `${Math.round(totalAge / loanRows.length)}d`
						},
			principalByPool,
			rateDistribution,
			ageDistribution
		}
	}, [loanRows, isLoading])

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{view.kpis ? (
					<>
						<KpiCard label="Active Loans" value={view.kpis.totalLoans} />
						<KpiCard label="Total Principal" value={view.kpis.totalPrincipal} />
						<KpiCard label="Avg Interest Rate" value={view.kpis.avgRate} />
						<KpiCard label="Total Interest Paid" value={view.kpis.totalInterestPaid} />
						<KpiCard label="Avg Loan Age" value={view.kpis.avgAge} />
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
			) : view.principalByPool.source.length > 0 ? (
				<ChartCard title="Principal by Pool">
					<MultiSeriesChart2
						dataset={view.principalByPool}
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
				) : view.rateDistribution.source.length > 0 ? (
					<ChartCard title="Interest Rate Distribution">
						<MultiSeriesChart2
							dataset={view.rateDistribution}
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
				) : view.ageDistribution.source.length > 0 ? (
					<ChartCard title="Loan Age Distribution">
						<MultiSeriesChart2
							dataset={view.ageDistribution}
							charts={AGE_DISTRIBUTION_CHART}
							valueSymbol="$"
							height="400px"
							chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</ChartCard>
				) : null}
			</div>

			{isLoading ? <CardSkeleton title="Open-Term Loans" /> : <LoansTable data={loanRows} />}
		</div>
	)
}
