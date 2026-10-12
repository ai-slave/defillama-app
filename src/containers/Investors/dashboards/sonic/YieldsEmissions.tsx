import { createColumnHelper } from '@tanstack/react-table'
import { lazy, Suspense } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { BasicLink } from '~/components/Link'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { TablePager } from '~/components/Table/TablePager'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatPercent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { STACKED_UNITLESS_TIME_CHART_OPTIONS } from './chartDefaults'
import { useYieldsEmissionsData, type YieldPool } from './yieldsEmissionsApi'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const columnHelper = createColumnHelper<typeof paginatedTableFeatures, YieldPool>()

const columns = columnHelper.columns([
	columnHelper.accessor('project', {
		header: 'Project',
		cell: (info) => <span className="font-medium">{info.getValue()}</span>,
		size: 160
	}),
	columnHelper.accessor('symbol', {
		header: 'Symbol',
		cell: (info) => <span>{info.getValue()}</span>,
		size: 140
	}),
	columnHelper.accessor((row) => row.tvlUsd ?? undefined, {
		id: 'tvlUsd',
		header: 'TVL',
		cell: (info) => <span className="tabular-nums">{info.row.original.tvlFormatted}</span>,
		size: 120
	}),
	columnHelper.accessor((row) => row.apy ?? undefined, {
		id: 'apy',
		header: 'APY',
		cell: (info) => <span className="font-medium text-success tabular-nums">{info.row.original.apyFormatted}</span>,
		size: 100
	}),
	columnHelper.accessor((row) => row.apyBase ?? undefined, {
		id: 'apyBase',
		header: 'Base APY',
		cell: (info) => (
			<span className="tabular-nums">{formatPercent(info.getValue(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}</span>
		),
		size: 100
	}),
	columnHelper.accessor((row) => row.apyReward ?? undefined, {
		id: 'apyReward',
		header: 'Reward APY',
		cell: (info) => (
			<span className="tabular-nums">{formatPercent(info.getValue(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}</span>
		),
		size: 110
	})
])

export default function YieldsEmissions() {
	const { query, data } = useYieldsEmissionsData()

	const table = usePaginatedTable({
		defaultColumn: { sortUndefined: 'last' },
		data: data?.yields.pools ?? [],
		columns,
		initialState: {
			sorting: [{ id: 'tvlUsd', desc: true }],
			pagination: { pageIndex: 0, pageSize: 15 }
		}
	})

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query))
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Sonic yields and emissions.
			</PanelStatus>
		)
	if (!data) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{/* Emissions */}
			<div className="flex flex-col gap-4">
				<h2 className="heading-xs">S Token Emissions</h2>
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title={data.emissions.title}
							headingAs="h3"
							dataset={data.emissions.dataset}
							charts={data.emissions.charts}
							valueSymbol=""
							stacked
							solidChartAreaStyle
							chartOptions={STACKED_UNITLESS_TIME_CHART_OPTIONS}
						/>
					</Suspense>
				</Panel>
			</div>

			{/* Burns */}
			{data.burn && (
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<h2 className="heading-xs">S Token Burns</h2>
						<Button
							as={BasicLink}
							href="https://burn.soniclabs.com"
							target="_blank"
							rel="noopener noreferrer"
							variant="link"
							className="label-md"
						>
							View Burn Counter
							<Icon name="arrow-up-right" className="size-3.5" />
						</Button>
					</div>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<StatTile label="Permanent Burn / Day" value={data.burn.permanentBurnPerDay.formatted} />
						<StatTile label="Permanent Burn / Year" value={data.burn.permanentBurnPerYear.formatted} />
						<StatTile label="Burn Rate" value={data.burn.burnRate.formatted} />
						<StatTile label="Fees / Day" value={data.burn.feesPerDay.formatted} />
					</div>
				</div>
			)}

			{/* Yield Pools */}
			<div className="flex flex-col gap-4">
				<h2 className="heading-xs">Yield pools</h2>
				<div className="grid grid-cols-3 gap-4">
					<StatTile label="Total Pools" value={data.yields.kpis.totalPools.formatted} />
					<StatTile label="Total TVL" value={data.yields.kpis.totalTvl.formatted} />
					<StatTile label="Avg APY" value={data.yields.kpis.avgApy.formatted} />
				</div>
				<Card padding="none" className="overflow-x-auto">
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
					{table.getPageCount() > 1 && (
						<TablePager
							pageIndex={table.state.pagination.pageIndex}
							pageCount={table.getPageCount()}
							onPageChange={(index) => table.setPageIndex(index)}
							className="border-t border-subtle px-4 py-3"
						/>
					)}
				</Card>
			</div>
		</div>
	)
}
