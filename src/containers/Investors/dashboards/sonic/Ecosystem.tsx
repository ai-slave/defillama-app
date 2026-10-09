import {
	columnSizingFeature,
	createColumnHelper,
	createPaginatedRowModel,
	createSortedRowModel,
	rowExpandingFeature,
	rowPaginationFeature,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { columnVisibilityFeature } from '~/components/Table/features/display'
import { sortingFeatures } from '~/components/Table/features/sorting'
import { TablePager } from '~/containers/Investors/TablePager'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBodyFallback,
	ChartPanelExportShellFallback,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { PanelStatus, PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatPercent } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { CSV_ONLY_EXPORT } from './chartDefaults'
import { useEcosystemData, type AssetCategory, type TopProtocolEntry } from './ecosystemApi'
import { formatSonicUsd } from './format'

const tableFeaturesConfig = tableFeatures({
	...sortingFeatures,
	columnVisibilityFeature,
	columnSizingFeature,
	rowExpandingFeature,
	rowPaginationFeature,
	sortedRowModel: createSortedRowModel(),
	paginatedRowModel: createPaginatedRowModel()
})

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-secondary uppercase">{children}</h2>
}

const protocolColumnHelper = createColumnHelper<typeof tableFeaturesConfig, TopProtocolEntry>()

function makeProtocolColumns(valueLabel: string) {
	return protocolColumnHelper.columns([
		protocolColumnHelper.display({
			id: 'rank',
			header: '#',
			cell: (info) => <span className="text-secondary">{info.row.index + 1}</span>,
			size: 40
		}),
		protocolColumnHelper.accessor('name', {
			header: 'Name',
			cell: (info) => {
				const row = info.row.original
				return (
					<div className="flex items-center gap-2">
						{row.logo ? (
							<img
								src={row.logo}
								alt=""
								className="size-5 shrink-0 rounded-full"
								loading="lazy"
								onError={(e) => {
									;(e.target as HTMLImageElement).style.display = 'none'
								}}
							/>
						) : (
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-tint label-xs text-link">
								{row.name.charAt(0)}
							</span>
						)}
						<span className="truncate font-medium">{row.name}</span>
					</div>
				)
			},
			size: 200
		}),
		protocolColumnHelper.accessor('category', {
			header: 'Category',
			cell: (info) => <span className="text-secondary">{info.getValue() ?? '—'}</span>,
			size: 120
		}),
		protocolColumnHelper.accessor((row) => row.total24h ?? undefined, {
			id: 'total24h',
			header: `24h ${valueLabel}`,
			cell: (info) => <span className="tabular-nums">{info.row.original.total24hFormatted}</span>,
			size: 120
		}),
		protocolColumnHelper.accessor((row) => row.total7d ?? undefined, {
			id: 'total7d',
			header: `7d ${valueLabel}`,
			cell: (info) => <span className="tabular-nums">{formatSonicUsd(info.getValue())}</span>,
			size: 120
		}),
		protocolColumnHelper.accessor((row) => row.total30d ?? undefined, {
			id: 'total30d',
			header: `30d ${valueLabel}`,
			cell: (info) => <span className="tabular-nums">{formatSonicUsd(info.getValue())}</span>,
			size: 120
		}),
		protocolColumnHelper.accessor((row) => row.totalAllTime ?? undefined, {
			id: 'totalAllTime',
			header: `All-Time ${valueLabel}`,
			cell: (info) => <span className="tabular-nums">{formatSonicUsd(info.getValue())}</span>,
			size: 130
		})
	])
}

function ProtocolTable({ data, valueLabel }: { data: Array<TopProtocolEntry>; valueLabel: string }) {
	const columns = useMemo(() => makeProtocolColumns(valueLabel), [valueLabel])

	const table = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns,
		initialState: {
			sorting: [{ id: 'total24h', desc: true }],
			pagination: { pageIndex: 0, pageSize: 10 }
		}
	})

	return (
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
	)
}

function AssetBreakdownSection({
	categories,
	pieColors,
	totalFormatted,
	title
}: {
	categories: Array<AssetCategory>
	pieColors: Record<string, string>
	totalFormatted: string
	title: string
}) {
	const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

	const toggleRow = (idx: number) => {
		setExpandedRows((prev) => {
			const next = new Set(prev)
			if (next.has(idx)) next.delete(idx)
			else next.add(idx)
			return next
		})
	}

	return (
		<ChartPanel>
			<ChartPanelToolbar leading={<ChartPanelTitle>{title}</ChartPanelTitle>} />
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="min-h-[320px]">
					<Suspense fallback={<ChartPanelBodyFallback style={{ minHeight: '320px' }} />}>
						<PieChart
							chartData={categories}
							stackColors={pieColors}
							radius={['40%', '70%']}
							height="320px"
							valueSymbol="$"
						/>
					</Suspense>
				</div>
				<div className="px-2 pb-2">
					<div className="max-h-[400px] overflow-y-auto">
						{categories.map((cat, idx) => {
							const breakdownEntries = Object.entries(cat.breakdown).sort(([, a], [, b]) => b - a)
							const hasChildren = breakdownEntries.length > 0
							const isOpen = expandedRows.has(idx)
							const color = pieColors[cat.name] || 'var(--text-tertiary)'
							const row = (
								<>
									<span className="flex w-4 shrink-0 justify-center">
										{hasChildren ? (
											<Icon
												name="chevron-right"
												className={`size-3.5 text-tertiary transition-transform ${isOpen ? 'rotate-90' : ''}`}
											/>
										) : null}
									</span>
									<span className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
									<span className="min-w-0 flex-1 truncate body-md text-primary capitalize">{cat.name}</span>
									<span className="shrink-0 label-md text-primary">{cat.formatted}</span>
									<span className="w-12 shrink-0 text-right body-sm text-secondary">
										{formatPercent(cat.pct, { input: 'percent' })}
									</span>
								</>
							)
							return (
								<div key={cat.name} className="border-b border-subtle last:border-b-0">
									{hasChildren ? (
										<button
											type="button"
											aria-expanded={isOpen}
											className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-2.5 text-left hover:bg-hover-row"
											onClick={() => toggleRow(idx)}
										>
											{row}
										</button>
									) : (
										<div className="flex w-full items-center gap-2 px-1 py-2.5">{row}</div>
									)}
									{isOpen && (
										<div className="pb-2 pl-8">
											{breakdownEntries.map(([symbol, value]) => (
												<div key={symbol} className="flex items-center py-1.5 body-sm text-secondary">
													<span className="min-w-0 flex-1 truncate">{symbol}</span>
													<span className="shrink-0">{formatSonicUsd(value)}</span>
												</div>
											))}
										</div>
									)}
								</div>
							)
						})}
					</div>
					<div className="mt-3 flex items-center justify-between border-t border-subtle pt-3">
						<span className="body-md text-secondary">Total</span>
						<span className="title-md text-primary">{totalFormatted}</span>
					</div>
				</div>
			</div>
		</ChartPanel>
	)
}

export default function Ecosystem() {
	const query = useEcosystemData()
	const data = query.data

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query) && !query.data)
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Sonic ecosystem data.
			</PanelStatus>
		)
	if (!data) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{/* TVL */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Total Value Locked</SectionHeader>
				<StatTile label="Current TVL" value={data.tvl.currentFormatted} />
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title={data.tvl.title}
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={data.tvl.dataset}
							charts={data.tvl.charts}
							valueSymbol="$"
							chartOptions={data.tvl.chartOptions}
						/>
					</Suspense>
				</ChartPanel>
			</div>

			{/* Fees */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Protocol Fees</SectionHeader>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<StatTile label="24h Fees" value={data.fees.kpis.total24h.formatted} change={data.fees.kpis.change1d} />
					<StatTile label="7d Fees" value={data.fees.kpis.total7d.formatted} change={data.fees.kpis.change7d} />
					<StatTile label="30d Fees" value={data.fees.kpis.total30d.formatted} change={data.fees.kpis.change1m} />
					<StatTile label="All-Time Fees" value={data.fees.kpis.totalAllTime.formatted} />
				</div>
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title={data.fees.title}
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={data.fees.dataset}
							charts={data.fees.charts}
							valueSymbol="$"
							showLegend={data.fees.charts.length > 1}
							stacked
							chartOptions={data.fees.chartOptions}
							exportButtons={CSV_ONLY_EXPORT}
						/>
					</Suspense>
				</ChartPanel>
				<SectionHeader>Top Protocols by Fees</SectionHeader>
				<ProtocolTable data={data.fees.topProtocols} valueLabel="Fees" />
			</div>

			{/* DEX Volume */}
			<div className="flex flex-col gap-4">
				<SectionHeader>DEX Volume</SectionHeader>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<StatTile
						label="24h Volume"
						value={data.dexVolume.kpis.total24h.formatted}
						change={data.dexVolume.kpis.change1d}
					/>
					<StatTile
						label="7d Volume"
						value={data.dexVolume.kpis.total7d.formatted}
						change={data.dexVolume.kpis.change7d}
					/>
					<StatTile
						label="30d Volume"
						value={data.dexVolume.kpis.total30d.formatted}
						change={data.dexVolume.kpis.change1m}
					/>
					<StatTile label="All-Time Volume" value={data.dexVolume.kpis.totalAllTime.formatted} />
				</div>
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title={data.dexVolume.title}
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={data.dexVolume.dataset}
							charts={data.dexVolume.charts}
							valueSymbol="$"
							showLegend={data.dexVolume.charts.length > 1}
							stacked
							chartOptions={data.dexVolume.chartOptions}
							exportButtons={CSV_ONLY_EXPORT}
						/>
					</Suspense>
				</ChartPanel>
				<SectionHeader>Top DEXes by Volume</SectionHeader>
				<ProtocolTable data={data.dexVolume.topDexes} valueLabel="Volume" />
			</div>

			{/* Stablecoins */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Stablecoins</SectionHeader>
				<div className="grid grid-cols-3 gap-4">
					<StatTile label="Circulating" value={data.stablecoins.kpis.currentCirculating.formatted} />
					<StatTile label="Minted (Native)" value={data.stablecoins.kpis.currentMinted.formatted} />
					<StatTile label="Bridged" value={data.stablecoins.kpis.currentBridged.formatted} />
				</div>
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title={data.stablecoins.title}
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={data.stablecoins.dataset}
							charts={data.stablecoins.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							chartOptions={data.stablecoins.chartOptions}
						/>
					</Suspense>
				</ChartPanel>
			</div>

			{/* Stablecoin Supply Breakdown */}
			{data.stablecoins.breakdown.length > 0 && (
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>Stablecoin Supply Breakdown</ChartPanelTitle>} />
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="min-h-[320px]">
							<Suspense fallback={<ChartPanelBodyFallback style={{ minHeight: '320px' }} />}>
								<PieChart
									chartData={data.stablecoins.breakdown}
									stackColors={data.stablecoins.pieColors}
									radius={['40%', '70%']}
									height="320px"
									valueSymbol="$"
								/>
							</Suspense>
						</div>
						<div className="px-2 pb-2">
							<div className="max-h-[400px] overflow-y-auto">
								{data.stablecoins.breakdown.map((coin) => {
									const color = data.stablecoins.pieColors[coin.name] || 'var(--text-tertiary)'
									return (
										<div
											key={coin.name}
											className="flex items-center gap-2 border-b border-subtle py-2.5 last:border-b-0"
										>
											<span className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
											<span className="min-w-0 flex-1 truncate body-md text-primary">{coin.name}</span>
											<span className="shrink-0 title-md text-primary">{coin.formatted}</span>
											<span className="w-12 shrink-0 text-right body-sm text-secondary">
												{formatPercent(coin.pct, { input: 'percent' })}
											</span>
										</div>
									)
								})}
							</div>
							<div className="mt-3 flex items-center justify-between border-t border-subtle pt-3">
								<span className="body-md text-secondary">Total</span>
								<span className="title-md text-primary">{data.stablecoins.breakdownTotalFormatted}</span>
							</div>
						</div>
					</div>
				</ChartPanel>
			)}

			{/* Chain Assets */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Chain Assets</SectionHeader>
				<AssetBreakdownSection
					categories={data.chainAssets.categories}
					pieColors={data.chainAssets.pieColors}
					totalFormatted={data.chainAssets.totalFormatted}
					title={data.chainAssets.title}
				/>
			</div>
		</div>
	)
}
