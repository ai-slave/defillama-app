import { createColumnHelper, useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table'
import { lazy, useEffect } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { useContentReady } from '~/containers/Investors/ContentReadyContext'
import { formatCompactNumber } from '~/utils/numberFormat'
import { useBlockchainData, type TopToken } from './blockchainApi'
import { AREA_CHART_EXPORTS, BAR_CHART_EXPORTS, createChartOptions } from './chartDefaults'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

function KpiCard({ label, value }: { label: string; value: string | number | null }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<span className="text-2xl font-semibold text-pro-text-primary">{value ?? '—'}</span>
		</div>
	)
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			{children}
		</div>
	)
}

function SectionHeader({ title }: { title: string }) {
	return <h2 className="text-xs font-semibold tracking-wider text-pro-text-label uppercase">{title}</h2>
}

const TRANSACTIONS_CHART = [
	{
		type: 'bar',
		name: 'Transactions',
		encode: { x: 0, y: 1 },
		color: '#4FC3F7',
		stack: 'a'
	}
] satisfies MultiSeriesChartSeriesConfig[]

const ADDRESSES_CHARTS = [
	{
		type: 'line',
		name: 'Active Addresses',
		encode: { x: 0, y: 1 },
		color: '#FFA726'
	},
	{
		type: 'line',
		name: 'New Addresses',
		encode: { x: 0, y: 2 },
		color: '#66BB6A'
	}
] satisfies MultiSeriesChartSeriesConfig[]

const GAS_FEES_CHART = [
	{
		type: 'bar',
		name: 'Total Fees (USD)',
		encode: { x: 0, y: 1 },
		color: '#AB47BC',
		stack: 'a'
	}
] satisfies MultiSeriesChartSeriesConfig[]

const UTILIZATION_CHART = [
	{
		type: 'line',
		name: 'Utilization %',
		encode: { x: 0, y: 1 },
		color: '#4FC3F7'
	}
] satisfies MultiSeriesChartSeriesConfig[]

const CONTRACTS_CHART = [
	{
		type: 'bar',
		name: 'New Contracts',
		encode: { x: 0, y: 1 },
		color: '#FFA726',
		stack: 'a'
	}
] satisfies MultiSeriesChartSeriesConfig[]

const TRANSFERS_CHART = [
	{
		type: 'bar',
		name: 'Volume (USD)',
		encode: { x: 0, y: 1 },
		color: '#66BB6A',
		stack: 'a'
	}
] satisfies MultiSeriesChartSeriesConfig[]

const DEFAULT_CHART_OPTIONS = createChartOptions('')
const DOLLAR_CHART_OPTIONS = createChartOptions('$')
const PERCENT_CHART_OPTIONS = createChartOptions('%')

const tokenColumnHelper = createColumnHelper<TopToken>()

const tokenColumns = [
	tokenColumnHelper.accessor('symbol', {
		header: 'Token',
		cell: (info) => <span className="font-medium">{info.getValue()}</span>,
		size: 120
	}),
	tokenColumnHelper.accessor('volumeFormatted', {
		header: '30d Volume (USD)',
		cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
		size: 150
	}),
	tokenColumnHelper.accessor('transferCount', {
		header: 'Transfers',
		cell: (info) => (
			<span className="tabular-nums">
				{formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
		),
		size: 120
	}),
	tokenColumnHelper.accessor('uniqueSenders', {
		header: 'Unique Senders',
		cell: (info) => (
			<span className="tabular-nums">
				{formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
		),
		size: 120
	})
]

export default function Blockchain() {
	const { data, isLoading } = useBlockchainData()
	const onContentReady = useContentReady()

	useEffect(() => {
		if (data && !isLoading) onContentReady()
	}, [data, isLoading, onContentReady])

	const tokenTable = useReactTable({
		data: data?.topTokens ?? [],
		columns: tokenColumns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		initialState: {
			sorting: [{ id: 'volumeFormatted', desc: true }]
		}
	})

	if (isLoading || !data) return null

	return (
		<div className="flex flex-col gap-6">
			{/* Chain Activity */}
			<SectionHeader title="Chain Activity" />
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<KpiCard label="Latest Daily Txs" value={data.activityKpis.latestTxCount.formatted} />
				<KpiCard label="Active Addresses" value={data.activityKpis.latestActiveAddresses.formatted} />
				<KpiCard label="Avg Daily Txs (7d)" value={data.activityKpis.avgDailyTxs7d.formatted} />
				<KpiCard label="Total Txs (All Time)" value={data.activityKpis.totalTxsAllTime.formatted} />
			</div>

			<ChartCard title="Daily Transactions">
				<MultiSeriesChart
					dataset={data.chartDatasets.transactions}
					charts={TRANSACTIONS_CHART}
					chartOptions={DEFAULT_CHART_OPTIONS}
					exportButtons={BAR_CHART_EXPORTS}
					valueSymbol=""
					title=""
					height="400px"
				/>
			</ChartCard>

			<ChartCard title="Active & New Addresses">
				<MultiSeriesChart
					dataset={data.chartDatasets.addresses}
					charts={ADDRESSES_CHARTS}
					chartOptions={DEFAULT_CHART_OPTIONS}
					exportButtons={AREA_CHART_EXPORTS}
					valueSymbol=""
					title=""
					height="400px"
				/>
			</ChartCard>

			{/* Gas & Fee Economics */}
			<SectionHeader title="Gas & Fee Economics" />
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<KpiCard label="Fees (7d)" value={data.gasKpis.totalFees7d.formatted} />
				<KpiCard label="Fees (30d)" value={data.gasKpis.totalFees30d.formatted} />
				<KpiCard label="Fees (All Time)" value={data.gasKpis.totalFeesAllTime.formatted} />
				<KpiCard label="Avg Fee per Tx" value={data.gasKpis.avgFeePerTx.formatted} />
			</div>

			<ChartCard title="Daily Gas Fees (USD)">
				<MultiSeriesChart
					dataset={data.chartDatasets.gasFees}
					charts={GAS_FEES_CHART}
					chartOptions={DOLLAR_CHART_OPTIONS}
					exportButtons={BAR_CHART_EXPORTS}
					valueSymbol="$"
					title=""
					height="400px"
				/>
			</ChartCard>

			<ChartCard title="Block Utilization (%)">
				<MultiSeriesChart
					dataset={data.chartDatasets.blockUtilization}
					charts={UTILIZATION_CHART}
					chartOptions={PERCENT_CHART_OPTIONS}
					exportButtons={AREA_CHART_EXPORTS}
					valueSymbol="%"
					title=""
					height="400px"
				/>
			</ChartCard>

			{/* Contract Deployments */}
			<SectionHeader title="Contract Deployments" />
			<ChartCard title="New Contracts Deployed (Monthly)">
				<MultiSeriesChart
					dataset={data.chartDatasets.contractDeployments}
					charts={CONTRACTS_CHART}
					chartOptions={DEFAULT_CHART_OPTIONS}
					exportButtons={BAR_CHART_EXPORTS}
					valueSymbol=""
					title=""
					height="400px"
				/>
			</ChartCard>

			{/* Token Transfers */}
			<SectionHeader title="Token Transfers" />
			<ChartCard title="Daily Token Transfer Volume (USD)">
				<MultiSeriesChart
					dataset={data.chartDatasets.tokenTransfers}
					charts={TRANSFERS_CHART}
					chartOptions={DOLLAR_CHART_OPTIONS}
					exportButtons={BAR_CHART_EXPORTS}
					valueSymbol="$"
					title=""
					height="400px"
				/>
			</ChartCard>

			{data.topTokens.length > 0 && (
				<div className="flex flex-col gap-4">
					<SectionHeader title="Top Tokens by 30d Transfer Volume" />
					<div className="overflow-x-auto rounded-lg border border-pro-cards-border bg-pro-cards-bg">
						<table className="w-full">
							<thead>
								{tokenTable.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id} className="border-b border-pro-cards-border">
										{headerGroup.headers.map((header) => (
											<th
												key={header.id}
												className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-pro-text-label uppercase"
												style={{ width: header.getSize() }}
												onClick={header.column.getToggleSortingHandler()}
											>
												<div className="flex cursor-pointer items-center gap-1">
													{typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : null}
													{header.column.getIsSorted() === 'asc'
														? ' \u2191'
														: header.column.getIsSorted() === 'desc'
															? ' \u2193'
															: ''}
												</div>
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody>
								{tokenTable.getRowModel().rows.map((row) => (
									<tr key={row.id} className="border-b border-pro-cards-border last:border-b-0 hover:bg-sl-hover-bg">
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} className="px-4 py-2.5 text-sm text-pro-text-primary">
												{typeof cell.column.columnDef.cell === 'function'
													? cell.column.columnDef.cell(cell.getContext())
													: (cell.getValue() as string)}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	)
}
