import { createColumnHelper, useTable } from '@tanstack/react-table'
import { lazy, Suspense } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { displayTableFeatures } from '~/components/Table/features/display'
import { ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { PanelStatus, PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatCompactNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { useBlockchainData, type TopToken } from './blockchainApi'
import { AREA_CHART_EXPORTS, BAR_CHART_EXPORTS, createChartOptions } from './chartDefaults'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			{children}
		</div>
	)
}

function SectionHeader({ title }: { title: string }) {
	return <h2 className="title-sm tracking-wider text-secondary uppercase">{title}</h2>
}

const TRANSACTIONS_CHART = [
	{
		type: 'bar',
		name: 'Transactions',
		encode: { x: 0, y: 1 },
		color: '#4FC3F7',
		stack: 'a'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

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
] satisfies Array<MultiSeriesChartSeriesConfig>

const GAS_FEES_CHART = [
	{
		type: 'bar',
		name: 'Total Fees (USD)',
		encode: { x: 0, y: 1 },
		color: '#AB47BC',
		stack: 'a'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const UTILIZATION_CHART = [
	{
		type: 'line',
		name: 'Utilization %',
		encode: { x: 0, y: 1 },
		color: '#4FC3F7'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const CONTRACTS_CHART = [
	{
		type: 'bar',
		name: 'New Contracts',
		encode: { x: 0, y: 1 },
		color: '#FFA726',
		stack: 'a'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const TRANSFERS_CHART = [
	{
		type: 'bar',
		name: 'Volume (USD)',
		encode: { x: 0, y: 1 },
		color: '#66BB6A',
		stack: 'a'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const DEFAULT_CHART_OPTIONS = createChartOptions('')
const DOLLAR_CHART_OPTIONS = createChartOptions('$')
const PERCENT_CHART_OPTIONS = createChartOptions('%')

const tokenColumnHelper = createColumnHelper<typeof displayTableFeatures, TopToken>()

const tokenColumns = tokenColumnHelper.columns([
	tokenColumnHelper.accessor('symbol', {
		header: 'Token',
		cell: (info) => <span className="font-medium">{info.getValue()}</span>,
		size: 120
	}),
	tokenColumnHelper.accessor((row) => row.volumeUsd ?? undefined, {
		id: 'volumeFormatted',
		header: '30d Volume (USD)',
		cell: ({ row }) => <span className="tabular-nums">{row.original.volumeFormatted}</span>,
		size: 150
	}),
	tokenColumnHelper.accessor((row) => row.transferCount ?? undefined, {
		id: 'transferCount',
		header: 'Transfers',
		cell: (info) => (
			<span className="tabular-nums">
				{formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
		),
		size: 120
	}),
	tokenColumnHelper.accessor((row) => row.uniqueSenders ?? undefined, {
		id: 'uniqueSenders',
		header: 'Unique Senders',
		cell: (info) => (
			<span className="tabular-nums">
				{formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
		),
		size: 120
	})
])

export default function Blockchain() {
	const query = useBlockchainData()
	const data = query.data

	const tokenTable = useTable({
		features: displayTableFeatures,
		defaultColumn: { sortUndefined: 'last' },
		data: data?.topTokens ?? [],
		columns: tokenColumns,
		initialState: {
			sorting: [{ id: 'volumeFormatted', desc: true }]
		}
	})

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query) && !query.data)
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Berachain blockchain data.
			</PanelStatus>
		)
	if (!data) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{/* Chain Activity */}
			<SectionHeader title="Chain Activity" />
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatTile label="Latest Daily Txs" value={data.activityKpis.latestTxCount.formatted} />
				<StatTile label="Active Addresses" value={data.activityKpis.latestActiveAddresses.formatted} />
				<StatTile label="Avg Daily Txs (7d)" value={data.activityKpis.avgDailyTxs7d.formatted} />
				<StatTile label="Total Txs (All Time)" value={data.activityKpis.totalTxsAllTime.formatted} />
			</div>

			<ChartCard title="Daily Transactions">
				<Suspense fallback={<ChartPanelExportShellFallback style={{ minHeight: '440px' }} />}>
					<MultiSeriesChart
						dataset={data.chartDatasets.transactions}
						charts={TRANSACTIONS_CHART}
						chartOptions={DEFAULT_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol=""
						title=""
						height="400px"
					/>
				</Suspense>
			</ChartCard>

			<ChartCard title="Active & New Addresses">
				<Suspense fallback={<ChartPanelExportShellFallback style={{ minHeight: '440px' }} />}>
					<MultiSeriesChart
						dataset={data.chartDatasets.addresses}
						charts={ADDRESSES_CHARTS}
						chartOptions={DEFAULT_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol=""
						title=""
						height="400px"
					/>
				</Suspense>
			</ChartCard>

			{/* Gas & Fee Economics */}
			<SectionHeader title="Gas & Fee Economics" />
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatTile label="Fees (7d)" value={data.gasKpis.totalFees7d.formatted} />
				<StatTile label="Fees (30d)" value={data.gasKpis.totalFees30d.formatted} />
				<StatTile label="Fees (All Time)" value={data.gasKpis.totalFeesAllTime.formatted} />
				<StatTile label="Avg Fee per Tx" value={data.gasKpis.avgFeePerTx.formatted} />
			</div>

			<ChartCard title="Daily Gas Fees (USD)">
				<Suspense fallback={<ChartPanelExportShellFallback style={{ minHeight: '440px' }} />}>
					<MultiSeriesChart
						dataset={data.chartDatasets.gasFees}
						charts={GAS_FEES_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</Suspense>
			</ChartCard>

			<ChartCard title="Block Utilization (%)">
				<Suspense fallback={<ChartPanelExportShellFallback style={{ minHeight: '440px' }} />}>
					<MultiSeriesChart
						dataset={data.chartDatasets.blockUtilization}
						charts={UTILIZATION_CHART}
						chartOptions={PERCENT_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol="%"
						title=""
						height="400px"
					/>
				</Suspense>
			</ChartCard>

			{/* Contract Deployments */}
			<SectionHeader title="Contract Deployments" />
			<ChartCard title="New Contracts Deployed (Monthly)">
				<Suspense fallback={<ChartPanelExportShellFallback style={{ minHeight: '440px' }} />}>
					<MultiSeriesChart
						dataset={data.chartDatasets.contractDeployments}
						charts={CONTRACTS_CHART}
						chartOptions={DEFAULT_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol=""
						title=""
						height="400px"
					/>
				</Suspense>
			</ChartCard>

			{/* Token Transfers */}
			<SectionHeader title="Token Transfers" />
			<ChartCard title="Daily Token Transfer Volume (USD)">
				<Suspense fallback={<ChartPanelExportShellFallback style={{ minHeight: '440px' }} />}>
					<MultiSeriesChart
						dataset={data.chartDatasets.tokenTransfers}
						charts={TRANSFERS_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</Suspense>
			</ChartCard>

			{data.topTokens.length > 0 && (
				<div className="flex flex-col gap-4">
					<SectionHeader title="Top Tokens by 30d Transfer Volume" />
					<div className="overflow-x-auto rounded-lg border border-subtle bg-surface">
						<table className="w-full">
							<thead>
								{tokenTable.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id} className="border-b border-subtle">
										{headerGroup.headers.map((header) => (
											<th
												key={header.id}
												className="px-4 py-3 text-left title-sm tracking-wide text-secondary uppercase"
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
									<tr key={row.id} className="border-b border-subtle last:border-b-0 hover:bg-hover-row">
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} className="px-4 py-2.5 body-md text-primary">
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
