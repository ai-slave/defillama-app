import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { useTable } from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { displayTableFeatures } from '~/components/Table/features/display'
import { TablePager } from '~/components/Table/TablePager'
import { Card } from '~/ui/Card'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus } from '~/ui/Status'
import { InlineStatStrip } from '~/ui/SummaryStats'
import {
	formatPercent,
	formatUsd,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import type { FlatReserve } from './api'
import { useAaveMarkets } from './api'
import {
	AAVE_BAR_EXPORT,
	AAVE_CATEGORY_DOLLAR_CHART_OPTIONS,
	AAVE_CATEGORY_PERCENT_CHART_OPTIONS,
	InvestorsTable
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

const reserveColumns: Array<ColumnDef<typeof displayTableFeatures, FlatReserve>> = [
	{ header: 'Asset', accessorKey: 'symbol', size: 100 },
	{ header: 'Chain', accessorKey: 'chain', size: 100 },
	{
		header: 'Market Size',
		id: 'sizeUsd',
		accessorFn: (row) => row.sizeUsd ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 130
	},
	{
		header: 'Oracle Price',
		id: 'oraclePrice',
		accessorFn: (row) => row.oraclePrice ?? undefined,
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
		id: 'supplyApy',
		accessorFn: (row) => row.supplyApy ?? undefined,
		cell: ({ getValue, row }) => {
			const apy = formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'
			const reward = row.original.rewardSupplyApr
			if (reward && reward > 0) {
				return (
					<span>
						{apy}{' '}
						<span className="text-success">+{formatPercent(reward, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}</span>
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
		id: 'borrowApy',
		accessorFn: (row) => row.borrowApy ?? undefined,
		cell: ({ getValue, row }) => {
			const apy = formatPercent(getValue<number | null>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'
			const discount = row.original.rewardBorrowDiscount
			if (discount && discount > 0) {
				return (
					<span>
						{apy}{' '}
						<span className="text-success">-{formatPercent(discount, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}</span>
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
		id: 'utilization',
		accessorFn: (row) => row.utilization ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number | null>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 90
	},
	{
		header: 'LTV',
		id: 'maxLTV',
		accessorFn: (row) => row.maxLTV ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 70
	},
	{
		header: 'Liq. Threshold',
		id: 'liquidationThreshold',
		accessorFn: (row) => row.liquidationThreshold ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Status',
		accessorKey: 'isFrozen',
		cell: ({ row }) => {
			if (row.original.isPaused) return <span className="text-tertiary">Paused</span>
			if (row.original.isFrozen) return <span className="text-tertiary">Frozen</span>
			return <span className="text-success">Active</span>
		},
		size: 70
	}
]

const PAGE_SIZE = 15

function ReservesTable({ data }: { data: Array<FlatReserve> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'sizeUsd', desc: true }])
	const [page, setPage] = useState(0)

	const instance = useTable({
		features: displayTableFeatures,
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: reserveColumns,
		state: { sorting },
		onSortingChange: setSorting
	})

	const allRows = instance.getSortedRowModel().rows
	const totalPages = Math.ceil(allRows.length / PAGE_SIZE)
	const pagedRows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

	if (data.length === 0) return null

	return (
		<Card padding="md">
			<h3 className="heading-xs">All reserves</h3>
			<div className="mt-4">
				<InvestorsTable instance={instance} overrideRows={pagedRows} />
			</div>
			{totalPages > 1 && (
				<TablePager
					pageIndex={page}
					pageCount={totalPages}
					onPageChange={setPage}
					range={{
						from: page * PAGE_SIZE + 1,
						to: Math.min((page + 1) * PAGE_SIZE, allRows.length),
						total: allRows.length
					}}
					className="mt-3 border-t border-subtle pt-3"
				/>
			)}
		</Card>
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
			totalMarketSize: formatUsd(totalMarketSize, USD_LOWERCASE_MILLIONS_OPTIONS),
			totalAvailableLiquidity: formatUsd(totalAvailableLiquidity, USD_LOWERCASE_MILLIONS_OPTIONS),
			totalBorrowed: formatUsd(totalBorrowed, USD_LOWERCASE_MILLIONS_OPTIONS),
			numChains: chainSet.size,
			numAssets: assetSet.size,
			avgSupplyApy: `${formatPercent(avgSupplyApy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS)}`
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

	if (isLoading) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{kpis && (
				<InlineStatStrip
					stacked
					items={[
						{ label: 'Total Market Size', value: kpis.totalMarketSize },
						{ label: 'Available Liquidity', value: kpis.totalAvailableLiquidity },
						{ label: 'Total Borrowed', value: kpis.totalBorrowed },
						{ label: 'Chains', value: kpis.numChains },
						{ label: 'Assets', value: kpis.numAssets },
						{ label: 'Avg Supply APY', value: kpis.avgSupplyApy }
					]}
				/>
			)}

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							dataset={marketSizeDataset}
							charts={MARKET_SIZE_CHART}
							valueSymbol="$"
							title="Market size by chain"
							headingAs="h3"
							chartOptions={AAVE_CATEGORY_DOLLAR_CHART_OPTIONS}
							exportButtons={AAVE_BAR_EXPORT}
						/>
					</Suspense>
				</Panel>

				{utilizationDataset.source.length > 0 && (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={utilizationDataset}
								charts={UTILIZATION_CHART}
								valueSymbol="%"
								title="Utilization by top assets"
								headingAs="h3"
								chartOptions={AAVE_CATEGORY_PERCENT_CHART_OPTIONS}
								exportButtons={AAVE_BAR_EXPORT}
							/>
						</Suspense>
					</Panel>
				)}
			</div>

			<ReservesTable data={reserves} />
		</div>
	)
}
