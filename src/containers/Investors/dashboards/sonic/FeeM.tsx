import { createColumnHelper } from '@tanstack/react-table'
import type { EChartsOption } from 'echarts'
import { TreemapChart as EChartsTreemap } from 'echarts/charts'
import { GraphicComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { lazy, useEffect, useMemo, useRef } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { TreemapLabelContrast } from '~/components/ECharts/TreemapChart/labelContrast'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { TablePager } from '~/containers/Investors/TablePager'
import { TabStatus } from '~/containers/Investors/TabStatus'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { lastNDaysZoom } from './chartDefaults'
import { useFeeMData, type FeeMLeaderboardEntry } from './feemApi'
import { formatSonicCount } from './format'
import { SonicIcon } from './SonicIcon'

echarts.use([TreemapLabelContrast, EChartsTreemap, TooltipComponent, GraphicComponent, CanvasRenderer])

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

function KpiCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="label-sm tracking-wide text-pro-text-label">{label}</span>
			<span className="mono-xl text-pro-text-primary">{value}</span>
		</div>
	)
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 label-md text-pro-text-label">{title}</h3>
			{children}
		</div>
	)
}

function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-pro-text-label uppercase">{children}</h2>
}

function getTreemapValue(value: unknown): number {
	const rawValue = Array.isArray(value) ? value[0] : value
	return typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0
}

const TREEMAP_COLORS = [
	'#4691ce',
	'#4cae4f',
	'#e3570a',
	'#fac461',
	'#7f6562',
	'#3b5d88',
	'#cf6a87',
	'#63cdda',
	'#f78fb3',
	'#778beb',
	'#e77f67',
	'#786fa6',
	'#f5cd79',
	'#ea8685',
	'#596275',
	'#574b90',
	'#f19066',
	'#3dc1d3',
	'#e15f41',
	'#c44569',
	'#546de5',
	'#574b90',
	'#f78fb3',
	'#3dc1d3',
	'#e66767',
	'#303952',
	'#574b90',
	'#fc5c65',
	'#45aaf2',
	'#26de81'
]

function FeeMTreemap({ leaderboard }: { leaderboard: Array<FeeMLeaderboardEntry> }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const [isDark] = useDarkModeManager()
	useChartResize(chartRef, containerRef)

	const treeData = useMemo(() => {
		const data: Array<{ name: string; value: number; itemStyle: { color: string } }> = []
		for (const item of leaderboard) {
			if (!(item.collectedRewards > 0)) continue
			data.push({
				name: item.name || 'Sonic',
				value: item.collectedRewards,
				itemStyle: { color: TREEMAP_COLORS[data.length % TREEMAP_COLORS.length] }
			})
		}
		return data
	}, [leaderboard])

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const option: EChartsOption = {
			tooltip: {
				formatter(rawInfo: unknown) {
					const info = normalizeTooltipItems(rawInfo)[0]
					return `<b>${escapeHtml(info?.name ?? '')}</b><br/>Collected: ${formatSonicCount(getTreemapValue(info?.value))} S`
				}
			},
			series: [
				{
					type: 'treemap',
					top: 4,
					left: 4,
					right: 4,
					bottom: 4,
					roam: false,
					nodeClick: false,
					breadcrumb: { show: false },
					label: {
						show: true,
						position: 'insideTopLeft',
						formatter(params) {
							return `{name|${params.name}}\n{val|${formatSonicCount(getTreemapValue(params.value))} S}`
						},
						rich: {
							name: { fontSize: 13, fontWeight: 600, lineHeight: 20 },
							val: { fontSize: 11, lineHeight: 18 }
						}
					},
					itemStyle: {
						borderColor: isDark ? '#1a1a2e' : '#fff',
						borderWidth: 2,
						gapWidth: 1
					},
					emphasis: {
						itemStyle: { borderColor: isDark ? '#444' : '#ccc' }
					},
					data: treeData
				}
			]
		}
		instance.setOption(option, { notMerge: true })
	}, [treeData, isDark])

	return <div ref={containerRef} className="w-full" style={{ height: '400px' }} />
}

const columnHelper = createColumnHelper<typeof paginatedTableFeatures, FeeMLeaderboardEntry>()

const columns = columnHelper.columns([
	columnHelper.display({
		id: 'rank',
		header: '#',
		cell: (info) => <span className="text-pro-text-label">{info.row.index + 1}</span>,
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
						<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sl-accent-muted label-xs text-sl-accent">
							{displayName.charAt(0)}
						</span>
					)}
					<span className="truncate font-medium">{displayName}</span>
					{!row.isActive && (
						<span className="shrink-0 rounded-sm bg-warning-tint-strong px-1.5 py-0.5 label-xs text-warning">
							Inactive
						</span>
					)}
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
	const { data, isLoading } = useFeeMData()

	const table = usePaginatedTable({
		defaultColumn: { sortUndefined: 'last' },
		data: data?.leaderboard ?? [],
		columns,
		initialState: {
			sorting: [{ id: 'collectedRewards', desc: true }],
			pagination: { pageIndex: 0, pageSize: 15 }
		}
	})

	if (isLoading) return <TabStatus variant="loading" />
	if (!data) return <TabStatus variant="error">Couldn't load FeeM data.</TabStatus>

	return (
		<div className="flex flex-col gap-6">
			{/* FeeM Introduction */}
			<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
				<p className="body-md text-pro-text-secondary">
					FeeM lets builders earn directly from the transaction activity they generate on Sonic. It creates a built-in
					revenue stream at the network layer, allowing apps to capture value from usage without needing a separate
					chain.
				</p>
				<h3 className="mt-4 title-sm tracking-wider text-pro-text-label uppercase">Fee Distribution</h3>
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
						<span className="font-medium text-pro-text-primary">App / Builder</span>
						<span className="ml-2 body-sm text-pro-text-label">Direct revenue, app incentives, or gas subsidies</span>
					</div>
					<div className="text-right" style={{ minWidth: '80px' }}>
						<span className="font-medium text-pro-text-primary">Validators</span>
						<span className="ml-2 body-sm text-pro-text-label">50% burned</span>
					</div>
				</div>
			</div>

			{/* Global KPIs */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<KpiCard label="Total Contracts" value={data.globalKpis.totalContracts.formatted} />
				<KpiCard label="Total Transactions" value={data.globalKpis.totalTransactions.formatted} />
				<KpiCard label="Total Collected" value={data.globalKpis.totalCollected.formatted} />
				<KpiCard label="Total Claimed" value={data.globalKpis.totalClaimed.formatted} />
			</div>

			{/* Daily Stats Chart */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Daily Activity</SectionHeader>
				<ChartCard title={data.dailyStatsTitle}>
					<MultiSeriesChart
						dataset={data.dailyStatsModel.dataset}
						charts={data.dailyStatsModel.charts}
						valueSymbol=""
						height="400px"
						chartOptions={lastNDaysZoom(data.dailyStatsLength)}
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				</ChartCard>
			</div>

			{/* Rewards Treemap */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Rewards Distribution</SectionHeader>
				<ChartCard title="Collected Rewards by Protocol">
					<FeeMTreemap leaderboard={data.leaderboard} />
				</ChartCard>
			</div>

			{/* FeeM Leaderboard */}
			<div className="flex flex-col gap-4">
				<SectionHeader>FeeM Leaderboard</SectionHeader>
				<div className="overflow-x-auto rounded-lg border border-pro-cards-border bg-pro-cards-bg">
					<table className="w-full">
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id} className="border-b border-pro-cards-border">
									{headerGroup.headers.map((header) => (
										<th
											key={header.id}
											className="px-4 py-3 text-left title-sm tracking-wide text-pro-text-label uppercase"
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
										<td key={cell.id} className="px-4 py-2.5 body-md text-pro-text-primary">
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
							className="border-t border-pro-cards-border px-4 py-3"
						/>
					)}
				</div>
			</div>
		</div>
	)
}
