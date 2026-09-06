import {
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
	type ColumnDef,
	type Table
} from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { VirtualTable } from '~/components/Table/Table'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { TextLoader } from '../../Logo'
import {
	type HlpData,
	type HlpFill,
	type HlpOpenOrder,
	type HlpPosition,
	useHyperliquidHlpFunding,
	useHyperliquidHlpOpenOrders,
	useHyperliquidHlpPortfolio,
	useHyperliquidHlpPositions
} from './api'
import { buildPortfolioTrendDataset, PORTFOLIO_SERIES_NAME } from './chartData'

type VaultFilter = 'All' | 'A' | 'B'
const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const PORTFOLIO_CHARTS: NonNullable<IMultiSeriesChartProps['charts']> = [
	{
		type: 'line',
		name: PORTFOLIO_SERIES_NAME,
		encode: { x: 'timestamp', y: PORTFOLIO_SERIES_NAME },
		color: '#2172e5',
		stack: 'value'
	}
]
const PORTFOLIO_CHART_OPTIONS = createSingleSeriesChartOptions('$')

function MetricCard({ label, value, helper }: { label: string; value: string | number | null; helper?: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<span className="text-2xl font-semibold text-pro-text-primary">{value ?? '—'}</span>
			{helper ? <span className="text-[11px] text-pro-text-label">{helper}</span> : null}
		</div>
	)
}

function Pagination<Row>({ table }: { table: Table<Row> }) {
	const { pageIndex, pageSize } = table.getState().pagination
	const total = table.getFilteredRowModel().rows.length
	const from = total === 0 ? 0 : pageIndex * pageSize + 1
	const to = Math.min((pageIndex + 1) * pageSize, total)

	return (
		<div className="flex items-center justify-between pt-3">
			<span className="text-xs text-pro-text-label">
				{from}–{to} of {total}
			</span>
			<div className="flex gap-1">
				<button
					type="button"
					onClick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
					className="rounded-sm px-2.5 py-1 text-xs font-medium text-pro-text-label transition-colors hover:bg-sl-hover-bg disabled:opacity-30 disabled:hover:bg-transparent"
				>
					Prev
				</button>
				<button
					type="button"
					onClick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
					className="rounded-sm px-2.5 py-1 text-xs font-medium text-pro-text-label transition-colors hover:bg-sl-hover-bg disabled:opacity-30 disabled:hover:bg-transparent"
				>
					Next
				</button>
			</div>
		</div>
	)
}

function PnlCell({ value }: { value: number }) {
	const color = value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''
	return (
		<span className={color}>
			{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		</span>
	)
}

function PercentCell({ value }: { value: number }) {
	const color = value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''
	return (
		<span className={color}>
			{value >= 0 ? '+' : ''}
			{formatPercent(value, {
				input: 'percent',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
				useGrouping: false
			})}
		</span>
	)
}

function PortfolioTrend({
	points,
	window
}: {
	points: Array<{ time: number; accountValue: number; pnl: number }>
	window: 'day' | 'week' | 'month' | 'allTime'
}) {
	const dataset = useMemo(() => buildPortfolioTrendDataset(points), [points])

	if (points.length < 2) return null

	const first = points[0].accountValue
	const last = points[points.length - 1].accountValue
	const changePct = first ? ((last - first) / first) * 100 : 0

	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-sm font-medium text-pro-text-label">Portfolio Trend ({window})</h3>
				<span className={changePct >= 0 ? 'text-xs text-success' : 'text-xs text-error'}>
					{changePct >= 0 ? '+' : ''}
					{formatPercent(changePct, {
						input: 'percent',
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
						useGrouping: false
					})}
				</span>
			</div>
			<Suspense fallback={<div className="h-[220px]" />}>
				<MultiSeriesChart
					dataset={dataset}
					charts={PORTFOLIO_CHARTS}
					valueSymbol="$"
					chartOptions={PORTFOLIO_CHART_OPTIONS}
					hideDataZoom
					height="220px"
					exportButtons="hidden"
				/>
			</Suspense>
			<div className="mt-2 flex items-center justify-between text-xs text-pro-text-label">
				<span>{new Date(points[0].time).toLocaleDateString()}</span>
				<span>
					Last: {formatUsd(last, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</span>
				<span>{new Date(points[points.length - 1].time).toLocaleDateString()}</span>
			</div>
		</div>
	)
}

const positionColumns: Array<ColumnDef<HlpPosition>> = [
	{
		header: 'Coin',
		accessorKey: 'coin',
		cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
		size: 100
	},
	{ header: 'Vault', accessorKey: 'vault', size: 70 },
	{
		header: 'Side',
		accessorKey: 'side',
		cell: ({ getValue }) => {
			const value = getValue<string>()
			return <span className={value === 'Long' ? 'text-success' : 'text-error'}>{value}</span>
		},
		size: 80
	},
	{
		header: 'Size',
		id: 'size',
		accessorFn: (row) => row.size ?? undefined,
		cell: ({ getValue }) =>
			formatCompactNumber(getValue<number>(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Entry',
		id: 'entryPx',
		accessorFn: (row) => row.entryPx ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Pos Value',
		id: 'positionValue',
		accessorFn: (row) => row.positionValue ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 130
	},
	{
		header: 'Unrealized',
		id: 'unrealizedPnl',
		accessorFn: (row) => row.unrealizedPnl ?? undefined,
		cell: ({ getValue }) => <PnlCell value={getValue<number>()} />,
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'ROE',
		id: 'roe',
		accessorFn: (row) => row.roe ?? undefined,
		cell: ({ getValue }) => <PercentCell value={getValue<number>()} />,
		meta: { align: 'end' as const },
		size: 90
	},
	{
		header: 'Leverage',
		id: 'leverage',
		accessorFn: (row) => row.leverage ?? undefined,
		cell: ({ getValue }) => `${getValue<number>()}x`,
		meta: { align: 'end' as const },
		size: 90
	},
	{
		header: 'Liq Price',
		id: 'liquidationPx',
		accessorFn: (row) => row.liquidationPx ?? undefined,
		cell: ({ getValue }) => {
			const value = getValue<number | null>()
			return value != null
				? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: '—'
		},
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Funding',
		id: 'cumFundingSinceOpen',
		accessorFn: (row) => row.cumFundingSinceOpen ?? undefined,
		cell: ({ getValue }) => <PnlCell value={getValue<number>()} />,
		meta: { align: 'end' as const },
		size: 110
	}
]

const fillColumns: Array<ColumnDef<HlpFill>> = [
	{
		header: 'Time',
		id: 'time',
		accessorFn: (row) => row.time ?? undefined,
		cell: ({ getValue }) => new Date(getValue<number>()).toLocaleString(),
		size: 165
	},
	{ header: 'Vault', accessorKey: 'vault', size: 70 },
	{
		header: 'Coin',
		accessorKey: 'coin',
		cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
		size: 80
	},
	{
		header: 'Side',
		accessorKey: 'side',
		cell: ({ getValue }) => {
			const value = getValue<string>()
			return <span className={value === 'Buy' ? 'text-success' : 'text-error'}>{value}</span>
		},
		size: 80
	},
	{
		header: 'Price',
		id: 'px',
		accessorFn: (row) => row.px ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Size',
		id: 'sz',
		accessorFn: (row) => row.sz ?? undefined,
		cell: ({ getValue }) =>
			formatCompactNumber(getValue<number>(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 90
	},
	{
		header: 'Closed PnL',
		id: 'closedPnl',
		accessorFn: (row) => row.closedPnl ?? undefined,
		cell: ({ getValue }) => <PnlCell value={getValue<number>()} />,
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Fee',
		id: 'fee',
		accessorFn: (row) => row.fee ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 100
	},
	{ header: 'Fee Token', accessorKey: 'feeToken', size: 90 },
	{ header: 'Dir', accessorKey: 'dir', size: 120 },
	{
		header: 'Hash',
		accessorKey: 'hash',
		cell: ({ getValue }) => {
			const value = getValue<string | null>()
			if (!value) return '—'
			return `${value.slice(0, 8)}...${value.slice(-6)}`
		},
		size: 150
	}
]

const openOrderColumns: Array<ColumnDef<HlpOpenOrder>> = [
	{
		header: 'Time',
		id: 'timestamp',
		accessorFn: (row) => row.timestamp ?? undefined,
		cell: ({ getValue }) => new Date(getValue<number>()).toLocaleString(),
		size: 160
	},
	{ header: 'Vault', accessorKey: 'vault', size: 70 },
	{
		header: 'Coin',
		accessorKey: 'coin',
		cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
		size: 90
	},
	{
		header: 'Side',
		accessorKey: 'side',
		cell: ({ getValue }) => {
			const value = getValue<string>()
			return <span className={value === 'Buy' ? 'text-success' : 'text-error'}>{value}</span>
		},
		size: 80
	},
	{
		header: 'Price',
		id: 'limitPx',
		accessorFn: (row) => row.limitPx ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Size',
		id: 'sz',
		accessorFn: (row) => row.sz ?? undefined,
		cell: ({ getValue }) =>
			formatCompactNumber(getValue<number>(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Order ID',
		id: 'oid',
		accessorFn: (row) => row.oid ?? undefined,
		meta: { align: 'end' as const },
		size: 120
	}
]

function DataTable<T>({
	title,
	data,
	columns,
	defaultSort,
	pageSize
}: {
	title: string
	data: Array<T>
	columns: Array<ColumnDef<T>>
	defaultSort: SortingState
	pageSize: number
}) {
	const [sorting, setSorting] = useState<SortingState>(defaultSort)
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })

	const instance = useReactTable({
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			<VirtualTable instance={instance} skipVirtualization />
			{data.length > pageSize ? <Pagination table={instance} /> : null}
		</div>
	)
}

export default function Positions() {
	const [vaultFilter, setVaultFilter] = useState<VaultFilter>('All')
	const [fundingWindow, setFundingWindow] = useState<'24h' | '7d' | '30d'>('24h')
	const [portfolioWindow, setPortfolioWindow] = useState<'day' | 'week' | 'month' | 'allTime'>('week')

	const { hlpData, isLoading } = useHyperliquidHlpPositions()
	const { openOrders } = useHyperliquidHlpOpenOrders()
	const { funding: funding24h } = useHyperliquidHlpFunding('24h')
	const { funding: funding7d } = useHyperliquidHlpFunding('7d')
	const { funding } = useHyperliquidHlpFunding(fundingWindow)
	const { portfolio } = useHyperliquidHlpPortfolio(portfolioWindow)

	const data = hlpData as HlpData

	const filteredPositions = useMemo(
		() =>
			vaultFilter === 'All' ? data.positions : data.positions.filter((position) => position.vault === vaultFilter),
		[data.positions, vaultFilter]
	)
	const filteredFills = useMemo(
		() => (vaultFilter === 'All' ? data.recentFills : data.recentFills.filter((fill) => fill.vault === vaultFilter)),
		[data.recentFills, vaultFilter]
	)
	const filteredOpenOrders = useMemo(
		() => (vaultFilter === 'All' ? openOrders : openOrders.filter((order) => order.vault === vaultFilter)),
		[openOrders, vaultFilter]
	)
	const filteredFundingEvents = useMemo(
		() => (vaultFilter === 'All' ? funding.events : funding.events.filter((event) => event.vault === vaultFilter)),
		[funding.events, vaultFilter]
	)

	const kpis = useMemo(() => {
		const summary = data.summary
		return {
			accountValue:
				summary.accountValue > 0
					? formatUsd(summary.accountValue, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})
					: '—',
			totalNtlPos:
				summary.totalNtlPos > 0
					? formatUsd(summary.totalNtlPos, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})
					: '—',
			totalMarginUsed:
				summary.totalMarginUsed > 0
					? formatUsd(summary.totalMarginUsed, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})
					: '—',
			withdrawable:
				summary.withdrawable > 0
					? formatUsd(summary.withdrawable, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})
					: '—',
			positionCount: filteredPositions.length,
			fundingPnl24h: formatUsd(funding24h.totalUsdc, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
			fundingPnl7d: formatUsd(funding7d.totalUsdc, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
			snapshotTime: summary.snapshotTime ? new Date(summary.snapshotTime).toLocaleString() : '—',
			portfolioVolume: formatUsd(portfolio.volume, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		}
	}, [data.summary, filteredPositions.length, funding24h.totalUsdc, funding7d.totalUsdc, portfolio.volume])

	if (isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center py-20">
				<TextLoader />
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="text-xs font-medium tracking-wide text-pro-text-label">Vault:</div>
				{(['All', 'A', 'B'] as Array<VaultFilter>).map((value) => (
					<button
						type="button"
						key={value}
						onClick={() => setVaultFilter(value)}
						className={`rounded-sm px-3 py-1.5 text-xs ${vaultFilter === value ? 'bg-brand text-on-brand' : 'bg-sl-btn-inactive-bg text-pro-text-label'}`}
					>
						{value}
					</button>
				))}

				<div className="ml-auto text-xs text-pro-text-label">Snapshot: {kpis.snapshotTime}</div>
			</div>

			<div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
				<MetricCard label="Account Value" value={kpis.accountValue} />
				<MetricCard label="Total Notional" value={kpis.totalNtlPos} />
				<MetricCard label="Margin Used" value={kpis.totalMarginUsed} />
				<MetricCard label="Withdrawable" value={kpis.withdrawable} />
				<MetricCard label="Active Positions" value={kpis.positionCount} />
				<MetricCard label="Funding PnL 24h" value={kpis.fundingPnl24h} />
				<MetricCard label="Funding PnL 7d" value={kpis.fundingPnl7d} />
				<MetricCard label="Portfolio Volume" value={kpis.portfolioVolume} helper={portfolio.window} />
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<div className="text-xs font-medium tracking-wide text-pro-text-label">Portfolio Window:</div>
				{(['day', 'week', 'month', 'allTime'] as const).map((value) => (
					<button
						type="button"
						key={value}
						onClick={() => setPortfolioWindow(value)}
						className={`rounded-sm px-3 py-1.5 text-xs ${portfolioWindow === value ? 'bg-brand text-on-brand' : 'bg-sl-btn-inactive-bg text-pro-text-label'}`}
					>
						{value}
					</button>
				))}
			</div>

			<PortfolioTrend points={portfolio.points} window={portfolioWindow} />

			<div className="flex flex-wrap items-center gap-2">
				<div className="text-xs font-medium tracking-wide text-pro-text-label">Funding Window:</div>
				{(['24h', '7d', '30d'] as const).map((value) => (
					<button
						type="button"
						key={value}
						onClick={() => setFundingWindow(value)}
						className={`rounded-sm px-3 py-1.5 text-xs ${fundingWindow === value ? 'bg-brand text-on-brand' : 'bg-sl-btn-inactive-bg text-pro-text-label'}`}
					>
						{value}
					</button>
				))}
			</div>

			<DataTable
				title="HLP Positions"
				data={filteredPositions}
				columns={positionColumns}
				defaultSort={[{ id: 'positionValue', desc: true }]}
				pageSize={15}
			/>

			{filteredOpenOrders.length > 0 ? (
				<DataTable
					title="Open Orders"
					data={filteredOpenOrders}
					columns={openOrderColumns}
					defaultSort={[{ id: 'timestamp', desc: true }]}
					pageSize={10}
				/>
			) : null}

			{filteredFundingEvents.length > 0 ? (
				<DataTable
					title={`Funding Events (${fundingWindow})`}
					data={filteredFundingEvents}
					columns={[
						{
							header: 'Time',
							id: 'time',
							accessorFn: (row) => row.time ?? undefined,
							cell: ({ getValue }) => new Date(getValue<number>()).toLocaleString(),
							size: 160
						},
						{ header: 'Vault', accessorKey: 'vault', size: 70 },
						{ header: 'Coin', accessorKey: 'coin', size: 80 },
						{
							header: 'Rate',
							id: 'fundingRate',
							accessorFn: (row) => row.fundingRate ?? undefined,
							cell: ({ getValue }) =>
								`${formatPercent(getValue<number>(), { input: 'fraction', minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false })}`,
							meta: { align: 'end' as const },
							size: 90
						},
						{
							header: 'Szi',
							id: 'szi',
							accessorFn: (row) => row.szi ?? undefined,
							cell: ({ getValue }) =>
								formatCompactNumber(getValue<number>(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
							meta: { align: 'end' as const },
							size: 90
						},
						{
							header: 'USDC',
							id: 'usdc',
							accessorFn: (row) => row.usdc ?? undefined,
							cell: ({ getValue }) => <PnlCell value={getValue<number>()} />,
							meta: { align: 'end' as const },
							size: 110
						},
						{
							header: 'Hash',
							accessorKey: 'hash',
							cell: ({ getValue }) => {
								const value = getValue<string>()
								return `${value.slice(0, 8)}...${value.slice(-6)}`
							},
							size: 150
						}
					]}
					defaultSort={[{ id: 'time', desc: true }]}
					pageSize={10}
				/>
			) : null}

			{filteredFills.length > 0 ? (
				<DataTable
					title="Recent HLP Fills"
					data={filteredFills}
					columns={fillColumns}
					defaultSort={[{ id: 'time', desc: true }]}
					pageSize={12}
				/>
			) : null}
		</div>
	)
}
