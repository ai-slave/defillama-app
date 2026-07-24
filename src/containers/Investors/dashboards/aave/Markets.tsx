import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
import { useAaveMarkets } from './api'
import type { FlatReserve } from './api'
import {
	InvestorsTable,
	PageLoader,
	ChartCard,
	KpiCard,
	MetricStrip,
	SectionHeader,
	formatPct,
	AAVE_BAR_EXPORT,
	AAVE_CATEGORY_DOLLAR_CHART_OPTIONS,
	AAVE_CATEGORY_PERCENT_CHART_OPTIONS
} from './shared'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const MARKET_SIZE_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Market Size',
		type: 'bar',
		encode: { x: 'Name', y: 'Market Size' },
		color: '#4FC3F7',
		stack: 'a'
	}
]
const UTILIZATION_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Utilization',
		type: 'bar',
		encode: { x: 'Name', y: 'Utilization' },
		color: '#AB47BC',
		stack: 'a'
	}
]

const reserveColumns: ColumnDef<FlatReserve>[] = [
	{ header: 'Asset', accessorKey: 'symbol', size: 100 },
	{ header: 'Chain', accessorKey: 'chain', size: 100 },
	{
		header: 'Market Size',
		accessorKey: 'sizeUsd',
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 130
	},
	{
		header: 'Oracle Price',
		accessorKey: 'oraclePrice',
		cell: ({ getValue }) => {
			const v = getValue<number | null>()
			if (v == null) return '—'
			return formatUsd(v, {
				minimumFractionDigits: v >= 1 ? 2 : undefined,
				maximumFractionDigits: v >= 1 ? 2 : 10,
				maximumSignificantDigits: v >= 1 ? undefined : 4
			})
		},
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Supply APY',
		accessorKey: 'supplyApy',
		cell: ({ getValue, row }) => {
			const apy = formatPct(getValue<number>())
			const reward = row.original.rewardSupplyApr
			if (reward && reward > 0) {
				return (
					<span>
						{apy} <span className="text-success">+{formatPct(reward)}</span>
					</span>
				)
			}
			return apy
		},
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Borrow APY',
		accessorKey: 'borrowApy',
		cell: ({ getValue, row }) => {
			const apy = formatPct(getValue<number | null>())
			const discount = row.original.rewardBorrowDiscount
			if (discount && discount > 0) {
				return (
					<span>
						{apy} <span className="text-success">-{formatPct(discount)}</span>
					</span>
				)
			}
			return apy
		},
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Utilization',
		accessorKey: 'utilization',
		cell: ({ getValue }) => formatPct(getValue<number | null>()),
		meta: { align: 'end' as const },
		size: 90
	},
	{
		header: 'LTV',
		accessorKey: 'maxLTV',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 70
	},
	{
		header: 'Liq. Threshold',
		accessorKey: 'liquidationThreshold',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Status',
		accessorKey: 'isFrozen',
		cell: ({ row }) => {
			if (row.original.isPaused) return <span className="text-pro-text-tertiary">Paused</span>
			if (row.original.isFrozen) return <span className="text-pro-text-tertiary">Frozen</span>
			return <span className="text-success">Active</span>
		},
		size: 70
	}
]

const PAGE_SIZE = 15

function ReservesTable({ data }: { data: FlatReserve[] }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'sizeUsd', desc: true }])
	const [page, setPage] = useState(0)

	const instance = useReactTable({
		data,
		columns: reserveColumns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	const allRows = instance.getSortedRowModel().rows
	const totalPages = Math.ceil(allRows.length / PAGE_SIZE)
	const pagedRows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

	if (data.length === 0) return null

	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
			<SectionHeader title="All Reserves" />
			<div className="mt-4">
				<InvestorsTable instance={instance} overrideRows={pagedRows} />
			</div>
			{totalPages > 1 && (
				<div className="mt-3 flex items-center justify-between border-t border-subtle pt-3 text-[11px] text-pro-text-tertiary">
					<span className="tabular-nums">
						{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, allRows.length)} of {allRows.length}
					</span>
					<div className="flex gap-1">
						<button
							onClick={() => setPage((p) => p - 1)}
							disabled={page === 0}
							className="rounded-sm px-2 py-1 transition-colors hover:bg-sl-hover-bg disabled:opacity-30"
						>
							Prev
						</button>
						<button
							onClick={() => setPage((p) => p + 1)}
							disabled={page >= totalPages - 1}
							className="rounded-sm px-2 py-1 transition-colors hover:bg-sl-hover-bg disabled:opacity-30"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

export default function Markets() {
	const { markets, reserves, isLoading } = useAaveMarkets()

	const kpis = useMemo(() => {
		if (markets.length === 0) return null

		const totalMarketSize = markets.reduce((s, m) => s + parseFloat(m.totalMarketSize), 0)
		const totalAvailableLiquidity = markets.reduce((s, m) => s + parseFloat(m.totalAvailableLiquidity), 0)
		const totalBorrowed = totalMarketSize - totalAvailableLiquidity
		const chainSet = new Set(markets.map((m) => m.chain.name))
		const assetSet = new Set(reserves.map((r) => r.symbol))

		const weightedApySum = reserves.reduce((s, r) => s + r.supplyApy * r.sizeUsd, 0)
		const totalReserveSize = reserves.reduce((s, r) => s + r.sizeUsd, 0)
		const avgSupplyApy = totalReserveSize > 0 ? weightedApySum / totalReserveSize : 0

		return {
			totalMarketSize: formatUsd(totalMarketSize, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
			totalAvailableLiquidity: formatUsd(totalAvailableLiquidity, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
			totalBorrowed: formatUsd(totalBorrowed, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
			numChains: chainSet.size,
			numAssets: assetSet.size,
			avgSupplyApy: `${formatPercent(avgSupplyApy, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
		}
	}, [markets, reserves])

	const marketSizeDataset = useMemo<MultiSeriesChartDataset>(() => {
		const chainMap = new Map<string, number>()
		for (const m of markets) {
			const prev = chainMap.get(m.chain.name) ?? 0
			chainMap.set(m.chain.name, prev + parseFloat(m.totalMarketSize))
		}
		const entries = Array.from(chainMap.entries()).sort((a, b) => b[1] - a[1])
		const source = new Array<Array<string | number>>(entries.length)
		for (let i = 0; i < entries.length; i++) {
			const [name, size] = entries[i]
			source[i] = [name, size]
		}
		return { source, dimensions: ['Name', 'Market Size'] }
	}, [markets])

	const utilizationDataset = useMemo<MultiSeriesChartDataset>(() => {
		const assetMap = new Map<string, { totalBorrowed: number; totalSize: number }>()
		for (const r of reserves) {
			if (r.utilization == null) continue
			const prev = assetMap.get(r.symbol) ?? { totalBorrowed: 0, totalSize: 0 }
			assetMap.set(r.symbol, {
				totalBorrowed: prev.totalBorrowed + r.totalBorrowedUsd,
				totalSize: prev.totalSize + r.sizeUsd
			})
		}
		const ranked: Array<{ Name: string; Utilization: number; size: number }> = []
		for (const [symbol, data] of assetMap) {
			ranked.push({
				Name: symbol,
				Utilization: data.totalSize > 0 ? (data.totalBorrowed / data.totalSize) * 100 : 0,
				size: data.totalSize
			})
		}
		ranked.sort((a, b) => b.size - a.size)
		const source: Array<Array<string | number>> = []
		const count = Math.min(20, ranked.length)
		for (let i = 0; i < count; i++) {
			const row = ranked[i]
			if (row.Utilization > 0) source.push([row.Name, row.Utilization])
		}
		return { source, dimensions: ['Name', 'Utilization'] }
	}, [reserves])

	if (isLoading) return <PageLoader />

	return (
		<div className="flex flex-col gap-6">
			{kpis && (
				<MetricStrip>
					<KpiCard label="Total Market Size" value={kpis.totalMarketSize} />
					<KpiCard label="Available Liquidity" value={kpis.totalAvailableLiquidity} />
					<KpiCard label="Total Borrowed" value={kpis.totalBorrowed} />
					<KpiCard label="Chains" value={kpis.numChains} />
					<KpiCard label="Assets" value={kpis.numAssets} />
					<KpiCard label="Avg Supply APY" value={kpis.avgSupplyApy} />
				</MetricStrip>
			)}

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<ChartCard title="Market Size by Chain">
					<MultiSeriesChart
						dataset={marketSizeDataset}
						charts={MARKET_SIZE_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={AAVE_CATEGORY_DOLLAR_CHART_OPTIONS}
						exportButtons={AAVE_BAR_EXPORT}
					/>
				</ChartCard>

				{utilizationDataset.source.length > 0 && (
					<ChartCard title="Utilization by Top Assets">
						<MultiSeriesChart
							dataset={utilizationDataset}
							charts={UTILIZATION_CHART}
							valueSymbol="%"
							title=""
							height="400px"
							chartOptions={AAVE_CATEGORY_PERCENT_CHART_OPTIONS}
							exportButtons={AAVE_BAR_EXPORT}
						/>
					</ChartCard>
				)}
			</div>

			<ReservesTable data={reserves} />
		</div>
	)
}
