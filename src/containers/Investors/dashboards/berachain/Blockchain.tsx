import { createColumnHelper, useTable } from '@tanstack/react-table'
import { lazy, Suspense } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { displayTableFeatures } from '~/components/Table/features/display'
import { Card } from '~/ui/Card'
import { CHART_FILL, ChartPanel, ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatCompactNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { useBlockchainData, type TopToken } from './blockchainApi'
import { AREA_CHART_EXPORTS, BAR_CHART_EXPORTS, createChartOptions } from './chartDefaults'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

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
	if (queryReadFailed(query))
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Berachain blockchain data.
			</PanelStatus>
		)
	if (!data) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{/* Chain Activity */}
			<h2 className="heading-xs">Chain Activity</h2>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatTile label="Latest Daily Txs" value={data.activityKpis.latestTxCount.formatted} />
				<StatTile label="Active Addresses" value={data.activityKpis.latestActiveAddresses.formatted} />
				<StatTile label="Avg Daily Txs (7d)" value={data.activityKpis.avgDailyTxs7d.formatted} />
				<StatTile label="Total Txs (All Time)" value={data.activityKpis.totalTxsAllTime.formatted} />
			</div>

			<ChartPanel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						title="Daily Transactions"
						headingAs="h3"
						containerClassName={CHART_FILL}
						dataset={data.chartDatasets.transactions}
						charts={TRANSACTIONS_CHART}
						chartOptions={DEFAULT_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol=""
					/>
				</Suspense>
			</ChartPanel>

			<ChartPanel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						title="Active & New Addresses"
						headingAs="h3"
						containerClassName={CHART_FILL}
						dataset={data.chartDatasets.addresses}
						charts={ADDRESSES_CHARTS}
						chartOptions={DEFAULT_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol=""
					/>
				</Suspense>
			</ChartPanel>

			{/* Gas & Fee Economics */}
			<h2 className="heading-xs">Gas & Fee Economics</h2>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatTile label="Fees (7d)" value={data.gasKpis.totalFees7d.formatted} />
				<StatTile label="Fees (30d)" value={data.gasKpis.totalFees30d.formatted} />
				<StatTile label="Fees (All Time)" value={data.gasKpis.totalFeesAllTime.formatted} />
				<StatTile label="Avg Fee per Tx" value={data.gasKpis.avgFeePerTx.formatted} />
			</div>

			<ChartPanel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						title="Daily Gas Fees (USD)"
						headingAs="h3"
						containerClassName={CHART_FILL}
						dataset={data.chartDatasets.gasFees}
						charts={GAS_FEES_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol="$"
					/>
				</Suspense>
			</ChartPanel>

			<ChartPanel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						title="Block Utilization (%)"
						headingAs="h3"
						containerClassName={CHART_FILL}
						dataset={data.chartDatasets.blockUtilization}
						charts={UTILIZATION_CHART}
						chartOptions={PERCENT_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol="%"
					/>
				</Suspense>
			</ChartPanel>

			{/* Contract Deployments */}
			<h2 className="heading-xs">Contract Deployments</h2>
			<ChartPanel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						title="New Contracts Deployed (Monthly)"
						headingAs="h3"
						containerClassName={CHART_FILL}
						dataset={data.chartDatasets.contractDeployments}
						charts={CONTRACTS_CHART}
						chartOptions={DEFAULT_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol=""
					/>
				</Suspense>
			</ChartPanel>

			{/* Token Transfers */}
			<h2 className="heading-xs">Token Transfers</h2>
			<ChartPanel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						title="Daily Token Transfer Volume (USD)"
						headingAs="h3"
						containerClassName={CHART_FILL}
						dataset={data.chartDatasets.tokenTransfers}
						charts={TRANSFERS_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol="$"
					/>
				</Suspense>
			</ChartPanel>

			{data.topTokens.length > 0 && (
				<div className="flex flex-col gap-4">
					<h2 className="heading-xs">Top Tokens by 30d Transfer Volume</h2>
					<Card padding="none" className="overflow-x-auto">
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
					</Card>
				</div>
			)}
		</div>
	)
}
