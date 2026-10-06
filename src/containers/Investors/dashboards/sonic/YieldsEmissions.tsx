import { createColumnHelper } from '@tanstack/react-table'
import { lazy } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { TablePager } from '~/containers/Investors/TablePager'
import { TabStatus } from '~/containers/Investors/TabStatus'
import { formatPercent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS } from '~/utils/numberFormat'
import { STACKED_UNITLESS_TIME_CHART_OPTIONS } from './chartDefaults'
import { useYieldsEmissionsData, type YieldPool } from './yieldsEmissionsApi'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

function KpiCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<span className="text-2xl font-semibold text-pro-text-primary">{value}</span>
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

function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="text-xs font-semibold tracking-wider text-pro-text-label uppercase">{children}</h2>
}

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
	const { data, isLoading } = useYieldsEmissionsData()

	const table = usePaginatedTable({
		defaultColumn: { sortUndefined: 'last' },
		data: data?.yields.pools ?? [],
		columns,
		initialState: {
			sorting: [{ id: 'tvlUsd', desc: true }],
			pagination: { pageIndex: 0, pageSize: 15 }
		}
	})

	if (isLoading) return <TabStatus variant="loading" />
	if (!data) return <TabStatus variant="error">Couldn't load Sonic yields and emissions.</TabStatus>

	return (
		<div className="flex flex-col gap-6">
			{/* Emissions */}
			<div className="flex flex-col gap-4">
				<SectionHeader>S Token Emissions</SectionHeader>
				<ChartCard title={data.emissions.title}>
					<MultiSeriesChart
						dataset={data.emissions.dataset}
						charts={data.emissions.charts}
						valueSymbol=""
						stacked
						solidChartAreaStyle
						chartOptions={STACKED_UNITLESS_TIME_CHART_OPTIONS}
						height="400px"
					/>
				</ChartCard>
			</div>

			{/* Burns */}
			{data.burn && (
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<SectionHeader>S Token Burns</SectionHeader>
						<a
							href="https://burn.soniclabs.com"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 text-sm font-medium text-sl-accent transition-colors hover:underline"
						>
							View Burn Counter
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3">
								<path d="M7 17L17 7M17 7H7M17 7v10" />
							</svg>
						</a>
					</div>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<KpiCard label="Permanent Burn / Day" value={data.burn.permanentBurnPerDay.formatted} />
						<KpiCard label="Permanent Burn / Year" value={data.burn.permanentBurnPerYear.formatted} />
						<KpiCard label="Burn Rate" value={data.burn.burnRate.formatted} />
						<KpiCard label="Fees / Day" value={data.burn.feesPerDay.formatted} />
					</div>
				</div>
			)}

			{/* Yield Pools */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Yield Pools</SectionHeader>
				<div className="grid grid-cols-3 gap-4">
					<KpiCard label="Total Pools" value={data.yields.kpis.totalPools.formatted} />
					<KpiCard label="Total TVL" value={data.yields.kpis.totalTvl.formatted} />
					<KpiCard label="Avg APY" value={data.yields.kpis.avgApy.formatted} />
				</div>
				<div className="overflow-x-auto rounded-lg border border-pro-cards-border bg-pro-cards-bg">
					<table className="w-full">
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
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
							{table.getRowModel().rows.map((row) => (
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
							className="border-t border-pro-cards-border px-4 py-3"
						/>
					)}
				</div>
			</div>
		</div>
	)
}
