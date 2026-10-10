import { createColumnHelper } from '@tanstack/react-table'
import { lazy, Suspense } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { TreemapChartProps, TreemapNode } from '~/components/ECharts/TreemapChart/types'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { TablePager } from '~/containers/Investors/TablePager'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBody,
	ChartPanelBodyFallback,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { PanelStatus, PanelLoadingStatus } from '~/ui/Status'
import { StatusBadge } from '~/ui/StatusBadge'
import { StatTile } from '~/ui/SummaryStats'
import { queryReadFailed } from '~/utils/query'
import { lastNDaysZoom } from './chartDefaults'
import { useFeeMData, type FeeMLeaderboardEntry } from './feemApi'
import { formatSonicCount } from './format'
import { SonicIcon } from './SonicIcon'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>

function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-secondary uppercase">{children}</h2>
}

function FeeMTreemap({ leaderboard }: { leaderboard: Array<FeeMLeaderboardEntry> }) {
	const treeData: Array<TreemapNode> = []
	for (const item of leaderboard) {
		if (!(item.collectedRewards > 0)) continue
		treeData.push({ name: item.name || 'Sonic', value: [item.collectedRewards, null, null] })
	}
	return (
		<ChartPanelBody>
			<Suspense fallback={<ChartPanelBodyFallback />}>
				<TreemapChart
					treeData={treeData}
					variant="flat"
					colorMode="categorical"
					valueLabel="Collected"
					valueSymbol="S"
					containerClassName={CHART_FILL}
				/>
			</Suspense>
		</ChartPanelBody>
	)
}

const columnHelper = createColumnHelper<typeof paginatedTableFeatures, FeeMLeaderboardEntry>()

const columns = columnHelper.columns([
	columnHelper.display({
		id: 'rank',
		header: '#',
		cell: (info) => <span className="text-secondary">{info.row.index + 1}</span>,
		size: 40
	}),
	columnHelper.accessor('name', {
		header: 'Protocol',
		cell: (info) => {
			const row = info.row.original
			const displayName = row.name || 'Sonic'
			const isSonicFallback = !row.name
			const content = (
				<div className="flex items-center gap-2">
					{isSonicFallback ? (
						<SonicIcon className="size-5 shrink-0" />
					) : row.imageUrl ? (
						<img
							src={row.imageUrl}
							alt=""
							className="size-5 shrink-0 rounded-full"
							loading="lazy"
							onError={(e) => {
								;(e.target as HTMLImageElement).style.display = 'none'
							}}
						/>
					) : (
						<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-tint label-xs text-link">
							{displayName.charAt(0)}
						</span>
					)}
					<span className="truncate font-medium">{displayName}</span>
					{!row.isActive && <StatusBadge status="caution">Inactive</StatusBadge>}
				</div>
			)
			if (row.websiteUrl) {
				return (
					<a href={row.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
						{content}
					</a>
				)
			}
			return content
		},
		size: 200
	}),
	columnHelper.accessor((row) => row.contractsCount ?? undefined, {
		id: 'contractsCount',
		header: 'Contracts',
		cell: (info) => <span className="tabular-nums">{formatSonicCount(info.getValue())}</span>,
		size: 100
	}),
	columnHelper.accessor((row) => row.transactionsCount ?? undefined, {
		id: 'transactionsCount',
		header: 'Transactions',
		cell: (info) => <span className="tabular-nums">{info.row.original.transactionsFormatted}</span>,
		size: 120
	}),
	columnHelper.accessor((row) => row.collectedRewards ?? undefined, {
		id: 'collectedRewards',
		header: 'Collected Rewards',
		cell: (info) => <span className="tabular-nums">{info.row.original.collectedRewardsFormatted}</span>,
		size: 140
	}),
	columnHelper.accessor((row) => row.claimedRewards ?? undefined, {
		id: 'claimedRewards',
		header: 'Claimed',
		cell: (info) => <span className="tabular-nums">{formatSonicCount(info.getValue())} S</span>,
		size: 120
	}),
	columnHelper.accessor((row) => row.rewardsToClaim ?? undefined, {
		id: 'rewardsToClaim',
		header: 'Unclaimed',
		cell: (info) => <span className="tabular-nums">{formatSonicCount(info.getValue())} S</span>,
		size: 120
	})
])

export default function FeeM() {
	const query = useFeeMData()
	const data = query.data

	const table = usePaginatedTable({
		defaultColumn: { sortUndefined: 'last' },
		data: data?.leaderboard ?? [],
		columns,
		initialState: {
			sorting: [{ id: 'collectedRewards', desc: true }],
			pagination: { pageIndex: 0, pageSize: 15 }
		}
	})

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query) && !query.data)
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load FeeM data.
			</PanelStatus>
		)
	if (!data) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{/* FeeM Introduction */}
			<div className="rounded-lg border border-subtle bg-surface p-5">
				<p className="body-md text-secondary">
					FeeM lets builders earn directly from the transaction activity they generate on Sonic. It creates a built-in
					revenue stream at the network layer, allowing apps to capture value from usage without needing a separate
					chain.
				</p>
				<h3 className="mt-4 title-sm tracking-wider text-secondary uppercase">Fee Distribution</h3>
				<div className="mt-3 flex h-10 overflow-hidden rounded-lg">
					<div className="flex items-center justify-center" style={{ width: '90%', background: '#3b5d88' }}>
						<span className="title-md text-on-brand">90%</span>
					</div>
					<div className="flex items-center justify-center" style={{ width: '10%', background: '#7f6562' }}>
						<span className="label-xs text-on-brand">10%</span>
					</div>
				</div>
				<div className="mt-2.5 flex items-start body-md">
					<div className="flex-1">
						<span className="font-medium text-primary">App / Builder</span>
						<span className="ml-2 body-sm text-secondary">Direct revenue, app incentives, or gas subsidies</span>
					</div>
					<div className="text-right" style={{ minWidth: '80px' }}>
						<span className="font-medium text-primary">Validators</span>
						<span className="ml-2 body-sm text-secondary">50% burned</span>
					</div>
				</div>
			</div>

			{/* Global KPIs */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatTile label="Total Contracts" value={data.globalKpis.totalContracts.formatted} />
				<StatTile label="Total Transactions" value={data.globalKpis.totalTransactions.formatted} />
				<StatTile label="Total Collected" value={data.globalKpis.totalCollected.formatted} />
				<StatTile label="Total Claimed" value={data.globalKpis.totalClaimed.formatted} />
			</div>

			{/* Daily Stats Chart */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Daily Activity</SectionHeader>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>{data.dailyStatsTitle}</ChartPanelTitle>} />
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={data.dailyStatsModel.dataset}
							charts={data.dailyStatsModel.charts}
							valueSymbol=""
							containerClassName={CHART_FILL}
							chartOptions={lastNDaysZoom(data.dailyStatsLength)}
							showLegend
							exportButtons="hidden"
						/>
					</Suspense>
				</ChartPanel>
			</div>

			{/* Rewards Treemap */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Rewards Distribution</SectionHeader>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>Collected Rewards by Protocol</ChartPanelTitle>} />
					<FeeMTreemap leaderboard={data.leaderboard} />
				</ChartPanel>
			</div>

			{/* FeeM Leaderboard */}
			<div className="flex flex-col gap-4">
				<SectionHeader>FeeM Leaderboard</SectionHeader>
				<div className="overflow-x-auto rounded-lg border border-subtle bg-surface">
					<table className="w-full">
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
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
							{table.getRowModel().rows.map((row) => (
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

					{/* Pagination */}
					{table.getPageCount() > 1 && (
						<TablePager
							label={
								<>
									Page {table.state.pagination.pageIndex + 1} of {table.getPageCount()}
								</>
							}
							canPrevious={table.getCanPreviousPage()}
							canNext={table.getCanNextPage()}
							onPrevious={() => table.previousPage()}
							onNext={() => table.nextPage()}
							className="border-t border-subtle px-4 py-3"
						/>
					)}
				</div>
			</div>
		</div>
	)
}
