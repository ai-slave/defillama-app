import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { Table } from '~/components/Table/Table'
import { Card } from '~/ui/Card'
import { CHART_FILL, ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { formatCompactNumber, formatPercent, formatRatio, formatUsd } from '~/utils/numberFormat'
import {
	parseTokenAmount,
	parseWad,
	useStSyrupState,
	useStSyrupTxes,
	useSyrupDripTxes,
	useSyrupGlobals,
	useSyrupTxes
} from './api'
import { aggregateByMonth, aggregateDripByMonth, monthTimestampMs, type DripRow, type TxRow } from './chartData'
import {
	CardSkeleton,
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

const txColumns: Array<ColumnDef<typeof paginatedTableFeatures, TxRow>> = [
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
			return `${addr.slice(0, 6)}…${addr.slice(-4)}`
		},
		size: 140
	}
]

const dripColumns: Array<ColumnDef<typeof paginatedTableFeatures, DripRow>> = [
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
			return `${addr.slice(0, 6)}…${addr.slice(-4)}`
		},
		size: 140
	}
]

function TxTable({ data }: { data: Array<TxRow> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = usePaginatedTable({
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: txColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination
	})

	if (data.length === 0) return null

	return (
		<Card padding="md">
			<h3 className="mb-3 label-md text-secondary">Recent stSyrup transactions</h3>
			<Table table={instance} />
			{data.length > 15 && <Pagination table={instance} />}
		</Card>
	)
}

function DripTable({ data }: { data: Array<DripRow> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = usePaginatedTable({
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: dripColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination
	})

	if (data.length === 0) return null

	return (
		<Card padding="md">
			<h3 className="mb-3 label-md text-secondary">Recent drip reward claims</h3>
			<Table table={instance} />
			{data.length > 15 && <Pagination table={instance} />}
		</Card>
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

	const txRows = useMemo<Array<TxRow>>(() => {
		return stSyrupTxes.map((tx) => ({
			id: tx.id,
			timestamp: parseInt(tx.timestamp, 10),
			type: tx.type,
			assetsAmount: parseWad(tx.assetsAmount, 18),
			account: tx.account.id
		}))
	}, [stSyrupTxes])

	const dripRows = useMemo<Array<DripRow>>(() => {
		return dripTxes.map((tx) => ({
			id: tx.id,
			timestamp: parseInt(tx.timestamp, 10),
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
			const ts = parseInt(tx.timestamp, 10)
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
				<h3 className="mb-3 heading-xs">Syrup protocol</h3>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					{protocolKpis ? (
						<>
							<StatTile label="Syrup TVL" value={protocolKpis.tvl ?? '—'} />
							<StatTile label="Syrup APY" value={protocolKpis.apy ?? '—'} />
							<StatTile label="stSyrup Rate" value={protocolKpis.exchangeRate ?? '—'} />
							<StatTile label="stSyrup Supply" value={protocolKpis.stSupply ?? '—'} />
						</>
					) : (
						<>
							<StatTile label="Syrup TVL" loading />
							<StatTile label="Syrup APY" loading />
							<StatTile label="stSyrup Rate" loading />
							<StatTile label="stSyrup Supply" loading />
						</>
					)}
				</div>
			</div>

			<div>
				<h3 className="mb-3 heading-xs">stSyrup activity</h3>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					{activityKpis ? (
						<>
							<StatTile label="Total Migrations" value={activityKpis.totalMigrations} />
							<StatTile label="Tokens Migrated" value={activityKpis.tokensMigrated} />
							<StatTile label="stSyrup Deposits" value={activityKpis.deposits} />
							<StatTile label="stSyrup Withdrawals" value={activityKpis.withdrawals} />
						</>
					) : (
						<>
							<StatTile label="Total Migrations" loading />
							<StatTile label="Tokens Migrated" loading />
							<StatTile label="stSyrup Deposits" loading />
							<StatTile label="stSyrup Withdrawals" loading />
						</>
					)}
				</div>
			</div>

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : monthlyChart.source.length > 0 ? (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Monthly stSyrup deposits vs withdrawals"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={monthlyChart}
							groupBy="monthly"
							charts={MONTHLY_ACTIVITY_CHARTS}
							valueSymbol="$"
							showLegend
							chartOptions={MAPLE_DOLLAR_TIME_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</Suspense>
				</Panel>
			) : null}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : migrationChart.source.length > 0 ? (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Monthly Syrup token migrations"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={migrationChart}
							groupBy="monthly"
							charts={MIGRATIONS_CHART}
							valueSymbol=""
							chartOptions={MAPLE_UNITLESS_TIME_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</Suspense>
				</Panel>
			) : null}

			{isLoading ? <CardSkeleton title="Recent stSyrup transactions" /> : <TxTable data={txRows} />}

			<div>
				<h3 className="mb-3 heading-xs">Drip rewards</h3>
				<div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
					{dripKpis ? (
						<>
							<StatTile label="Total Claims" value={dripKpis.totalClaims} />
							<StatTile label="Total Claimed" value={dripKpis.totalClaimed} />
							<StatTile label="Unique Claimers" value={dripKpis.uniqueClaimers} />
						</>
					) : (
						<>
							<StatTile label="Total Claims" loading />
							<StatTile label="Total Claimed" loading />
							<StatTile label="Unique Claimers" loading />
						</>
					)}
				</div>

				{dripLoading ? (
					<PanelLoadingStatus className="min-h-[400px]" />
				) : dripMonthlyChart.source.length > 0 ? (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="Monthly drip claims"
								headingAs="h3"
								containerClassName={CHART_FILL}
								dataset={dripMonthlyChart}
								groupBy="monthly"
								charts={DRIP_CLAIMS_CHART}
								valueSymbol=""
								chartOptions={MAPLE_UNITLESS_TIME_CHART_OPTIONS}
								exportButtons={MAPLE_CSV_ONLY_EXPORT}
							/>
						</Suspense>
					</Panel>
				) : null}
			</div>

			{dripLoading ? <CardSkeleton title="Recent drip reward claims" /> : <DripTable data={dripRows} />}
		</div>
	)
}
