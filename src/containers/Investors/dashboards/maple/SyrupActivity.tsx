import { getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { VirtualTable } from '~/components/Table/Table'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { formatRatio, formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import {
	useStSyrupTxes,
	useSyrupTxes,
	useSyrupGlobals,
	useStSyrupState,
	useSyrupDripTxes,
	parseWad,
	parseTokenAmount
} from './api'
import { aggregateByMonth, aggregateDripByMonth, monthTimestampMs, type DripRow, type TxRow } from './chartData'
import {
	ChartCard,
	CardSkeleton,
	KpiCard,
	KpiSkeleton,
	MAPLE_CSV_ONLY_EXPORT,
	MAPLE_DOLLAR_TIME_CHART_OPTIONS,
	MAPLE_UNITLESS_TIME_CHART_OPTIONS,
	Pagination
} from './shared'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const MONTHLY_ACTIVITY_CHARTS: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Deposits',
		encode: { x: 'timestamp', y: 'Deposits' },
		color: '#4CAF50',
		stack: 'a'
	},
	{
		type: 'bar',
		name: 'Withdrawals',
		encode: { x: 'timestamp', y: 'Withdrawals' },
		color: '#E91E63',
		stack: 'b'
	}
]
const MIGRATIONS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Tokens Migrated',
		encode: { x: 'timestamp', y: 'Tokens Migrated' },
		color: '#9C27B0',
		stack: 'a'
	}
]
const DRIP_CLAIMS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		type: 'bar',
		name: 'Claimed',
		encode: { x: 'timestamp', y: 'Claimed' },
		color: '#FF7043',
		stack: 'a'
	}
]

const txColumns: ColumnDef<TxRow>[] = [
	{
		header: 'Date',
		id: 'timestamp',
		accessorFn: (row) => row.timestamp ?? undefined,
		cell: ({ getValue }) => {
			const timestamp = getValue<number>()
			return (
				<span title={formatDateTime(timestamp, { input: 'seconds', timeZone: 'UTC' }) ?? undefined}>
					{formatDate(timestamp, { input: 'seconds' }) ?? '-'}
				</span>
			)
		},
		size: 140
	},
	{
		header: 'Type',
		accessorKey: 'type',
		cell: ({ getValue }) => {
			const t = getValue<string>()
			return (
				<span className={t === 'deposit' ? 'text-success' : 'text-error'}>
					{t === 'deposit' ? 'Deposit' : 'Withdraw'}
				</span>
			)
		},
		size: 100
	},
	{
		header: 'Amount',
		id: 'assetsAmount',
		accessorFn: (row) => row.assetsAmount ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Account',
		accessorKey: 'account',
		cell: ({ getValue }) => {
			const addr = getValue<string>()
			return `${addr.slice(0, 6)}...${addr.slice(-4)}`
		},
		size: 140
	}
]

const dripColumns: ColumnDef<DripRow>[] = [
	{
		header: 'Date',
		id: 'timestamp',
		accessorFn: (row) => row.timestamp ?? undefined,
		cell: ({ getValue }) => {
			const timestamp = getValue<number>()
			return (
				<span title={formatDateTime(timestamp, { input: 'seconds', timeZone: 'UTC' }) ?? undefined}>
					{formatDate(timestamp, { input: 'seconds' }) ?? '-'}
				</span>
			)
		},
		size: 140
	},
	{
		header: 'Type',
		accessorKey: 'type',
		cell: ({ getValue }) => <span className="capitalize">{getValue<string>()}</span>,
		size: 100
	},
	{
		header: 'Amount',
		id: 'amount',
		accessorFn: (row) => row.amount ?? undefined,
		cell: ({ getValue }) =>
			formatCompactNumber(getValue<number>(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Account',
		accessorKey: 'account',
		cell: ({ getValue }) => {
			const addr = getValue<string>()
			return `${addr.slice(0, 6)}...${addr.slice(-4)}`
		},
		size: 140
	}
]

function TxTable({ data }: { data: TxRow[] }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = useReactTable({
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: txColumns,
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
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">Recent stSyrup Transactions</h3>
			<VirtualTable instance={instance} skipVirtualization />
			{data.length > 15 && <Pagination table={instance} />}
		</div>
	)
}

function DripTable({ data }: { data: DripRow[] }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = useReactTable({
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: dripColumns,
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
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">Recent Drip Reward Claims</h3>
			<VirtualTable instance={instance} skipVirtualization />
			{data.length > 15 && <Pagination table={instance} />}
		</div>
	)
}

export default function SyrupActivity() {
	const { txes: stSyrupTxes, isLoading: stLoading } = useStSyrupTxes()
	const { txes: syrupTxes, isLoading: syrupLoading } = useSyrupTxes()
	const { globals, isLoading: globalsLoading } = useSyrupGlobals()
	const { state: stSyrupState, isLoading: stStateLoading } = useStSyrupState()
	const { txes: dripTxes, isLoading: dripLoading } = useSyrupDripTxes()

	const protocolKpis = useMemo(() => {
		if (globalsLoading || stStateLoading) return null
		if (!globals && !stSyrupState) return null

		const syrupTvl = globals ? parseTokenAmount(globals.tvl, 6) : null
		const syrupApy = globals ? parseWad(globals.apy, 28) : null

		let exchangeRate: number | null = null
		let stSupply: number | null = null
		if (stSyrupState) {
			const totalSupply = parseWad(stSyrupState.totalSupply, stSyrupState.precision)
			const freeAssets = parseWad(stSyrupState.freeAssets, stSyrupState.precision)
			exchangeRate = totalSupply > 0 ? freeAssets / totalSupply : null
			stSupply = totalSupply
		}

		return {
			tvl:
				syrupTvl != null
					? formatUsd(syrupTvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: null,
			apy:
				syrupApy != null
					? `${formatPercent(syrupApy, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
					: null,
			exchangeRate: exchangeRate != null ? formatRatio(exchangeRate, { maximumFractionDigits: 4 }) : null,
			stSupply:
				stSupply != null
					? formatCompactNumber(stSupply, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: null
		}
	}, [globals, stSyrupState, globalsLoading, stStateLoading])

	const txRows = useMemo<TxRow[]>(() => {
		return stSyrupTxes.map((tx) => ({
			id: tx.id,
			timestamp: parseInt(tx.timestamp),
			type: tx.type,
			assetsAmount: parseWad(tx.assetsAmount, 18),
			account: tx.account.id
		}))
	}, [stSyrupTxes])

	const dripRows = useMemo<DripRow[]>(() => {
		return dripTxes.map((tx) => ({
			id: tx.id,
			timestamp: parseInt(tx.timestamp),
			type: tx.type,
			amount: parseWad(tx.amount, 18),
			account: tx.account.id
		}))
	}, [dripTxes])

	const activityKpis = useMemo(() => {
		if (stLoading || syrupLoading) return null

		let deposits = 0
		let withdrawals = 0
		let totalMigrated = 0
		for (const tx of txRows) {
			if (tx.type === 'deposit') deposits++
			else withdrawals++
		}
		for (const tx of syrupTxes) totalMigrated += parseWad(tx.tokensMigrated, 18)

		return {
			totalMigrations: syrupTxes.length,
			tokensMigrated: formatCompactNumber(totalMigrated, {
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
			deposits,
			withdrawals
		}
	}, [txRows, syrupTxes, stLoading, syrupLoading])

	const dripKpis = useMemo(() => {
		if (dripLoading || dripRows.length === 0) return null

		let totalClaimed = 0
		const claimers = new Set<string>()
		for (const row of dripRows) {
			totalClaimed += row.amount
			claimers.add(row.account)
		}

		return {
			totalClaims: dripRows.length,
			totalClaimed: formatCompactNumber(totalClaimed, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
			uniqueClaimers: claimers.size
		}
	}, [dripRows, dripLoading])

	const monthlyChart = useMemo(() => aggregateByMonth(txRows), [txRows])
	const dripMonthlyChart = useMemo(() => aggregateDripByMonth(dripRows), [dripRows])

	const migrationChart = useMemo<MultiSeriesChartDataset>(() => {
		const map = new Map<number, number>()
		for (const tx of syrupTxes) {
			const ts = parseInt(tx.timestamp)
			const mk = monthTimestampMs(ts)
			const amount = parseWad(tx.tokensMigrated, 18)
			map.set(mk, (map.get(mk) ?? 0) + amount)
		}
		const entries = Array.from(map.entries()).sort(([a], [b]) => a - b)
		const source = new Array<MultiSeriesChartDataset['source'][number]>(entries.length)
		for (let index = 0; index < entries.length; index++) {
			const [timestamp, amount] = entries[index]
			source[index] = [timestamp, amount]
		}
		return { dimensions: ['timestamp', 'Tokens Migrated'], source }
	}, [syrupTxes])

	const isLoading = stLoading || syrupLoading

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h3 className="mb-3 text-sm font-semibold tracking-wide text-pro-text-label uppercase">Syrup Protocol</h3>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					{protocolKpis ? (
						<>
							<KpiCard label="Syrup TVL" value={protocolKpis.tvl} />
							<KpiCard label="Syrup APY" value={protocolKpis.apy} />
							<KpiCard label="stSyrup Rate" value={protocolKpis.exchangeRate} />
							<KpiCard label="stSyrup Supply" value={protocolKpis.stSupply} />
						</>
					) : (
						<>
							<KpiSkeleton label="Syrup TVL" />
							<KpiSkeleton label="Syrup APY" />
							<KpiSkeleton label="stSyrup Rate" />
							<KpiSkeleton label="stSyrup Supply" />
						</>
					)}
				</div>
			</div>

			<div>
				<h3 className="mb-3 text-sm font-semibold tracking-wide text-pro-text-label uppercase">stSyrup Activity</h3>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					{activityKpis ? (
						<>
							<KpiCard label="Total Migrations" value={activityKpis.totalMigrations} />
							<KpiCard label="Tokens Migrated" value={activityKpis.tokensMigrated} />
							<KpiCard label="stSyrup Deposits" value={activityKpis.deposits} />
							<KpiCard label="stSyrup Withdrawals" value={activityKpis.withdrawals} />
						</>
					) : (
						<>
							<KpiSkeleton label="Total Migrations" />
							<KpiSkeleton label="Tokens Migrated" />
							<KpiSkeleton label="stSyrup Deposits" />
							<KpiSkeleton label="stSyrup Withdrawals" />
						</>
					)}
				</div>
			</div>

			{isLoading ? (
				<CardSkeleton title="Monthly stSyrup Deposits vs Withdrawals" />
			) : monthlyChart.source.length > 0 ? (
				<ChartCard title="Monthly stSyrup Deposits vs Withdrawals">
					<MultiSeriesChart
						dataset={monthlyChart}
						charts={MONTHLY_ACTIVITY_CHARTS}
						valueSymbol="$"
						height="400px"
						hideDefaultLegend={false}
						chartOptions={MAPLE_DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={MAPLE_CSV_ONLY_EXPORT}
					/>
				</ChartCard>
			) : null}

			{isLoading ? (
				<CardSkeleton title="Monthly Syrup Token Migrations" />
			) : migrationChart.source.length > 0 ? (
				<ChartCard title="Monthly Syrup Token Migrations">
					<MultiSeriesChart
						dataset={migrationChart}
						charts={MIGRATIONS_CHART}
						valueSymbol=""
						height="400px"
						chartOptions={MAPLE_UNITLESS_TIME_CHART_OPTIONS}
						exportButtons={MAPLE_CSV_ONLY_EXPORT}
					/>
				</ChartCard>
			) : null}

			{isLoading ? <CardSkeleton title="Recent stSyrup Transactions" /> : <TxTable data={txRows} />}

			<div>
				<h3 className="mb-3 text-sm font-semibold tracking-wide text-pro-text-label uppercase">Drip Rewards</h3>
				<div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
					{dripKpis ? (
						<>
							<KpiCard label="Total Claims" value={dripKpis.totalClaims} />
							<KpiCard label="Total Claimed" value={dripKpis.totalClaimed} />
							<KpiCard label="Unique Claimers" value={dripKpis.uniqueClaimers} />
						</>
					) : (
						<>
							<KpiSkeleton label="Total Claims" />
							<KpiSkeleton label="Total Claimed" />
							<KpiSkeleton label="Unique Claimers" />
						</>
					)}
				</div>

				{dripLoading ? (
					<CardSkeleton title="Monthly Drip Claims" />
				) : dripMonthlyChart.source.length > 0 ? (
					<ChartCard title="Monthly Drip Claims">
						<MultiSeriesChart
							dataset={dripMonthlyChart}
							charts={DRIP_CLAIMS_CHART}
							valueSymbol=""
							height="400px"
							chartOptions={MAPLE_UNITLESS_TIME_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</ChartCard>
				) : null}
			</div>

			{dripLoading ? <CardSkeleton title="Recent Drip Reward Claims" /> : <DripTable data={dripRows} />}
		</div>
	)
}
