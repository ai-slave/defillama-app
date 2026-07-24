import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { formatUsd } from '~/utils/numberFormat'
import { useAaveGHOReserve, useAaveMarkets, useAaveAPYHistory, num, pct } from './api'
import type { TimeWindow } from './api'
import {
	InvestorsTable,
	PageLoader,
	CardSkeleton,
	KpiCard,
	MetricStrip,
	SectionHeader,
	WindowToggle,
	formatPct,
	AAVE_AREA_EXPORT,
	AAVE_PERCENT_TIME_CHART_OPTIONS
} from './shared'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const GHO_TOKEN = '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f'
const ETH_MAIN_MARKET = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
	{ value: 'LAST_WEEK', label: '1W' },
	{ value: 'LAST_MONTH', label: '1M' },
	{ value: 'LAST_SIX_MONTHS', label: '6M' },
	{ value: 'LAST_YEAR', label: '1Y' }
]

const BORROW_APY_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Borrow APY',
		type: 'line',
		encode: { x: 'timestamp', y: 'Borrow APY' },
		color: '#AB47BC'
	}
]

interface GHOMarketRow {
	market: string
	chain: string
	sizeUsd: number
	totalBorrowedUsd: number
	availableLiquidityUsd: number
	borrowApy: number
	utilization: number
}

const ghoMarketColumns: ColumnDef<GHOMarketRow>[] = [
	{ header: 'Chain', accessorKey: 'chain', size: 120 },
	{
		header: 'Market Size',
		accessorKey: 'sizeUsd',
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Total Borrowed',
		accessorKey: 'totalBorrowedUsd',
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Available Liquidity',
		accessorKey: 'availableLiquidityUsd',
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 150
	},
	{
		header: 'Borrow APY',
		accessorKey: 'borrowApy',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Utilization',
		accessorKey: 'utilization',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 110
	}
]

function GHOMarketsTable({ data }: { data: GHOMarketRow[] }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'sizeUsd', desc: true }])

	const instance = useReactTable({
		data,
		columns: ghoMarketColumns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	if (data.length === 0) return null

	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
			<SectionHeader title="GHO Across Markets" />
			<div className="mt-4">
				<InvestorsTable instance={instance} />
			</div>
		</div>
	)
}

export default function GHO() {
	const { reserve, isLoading: reserveLoading } = useAaveGHOReserve()
	const { reserves, isLoading: marketsLoading } = useAaveMarkets()
	const [selectedWindow, setSelectedWindow] = useState<TimeWindow>('LAST_SIX_MONTHS')

	const { dataset: borrowApyDataset, isLoading: apyLoading } = useAaveAPYHistory(
		1,
		ETH_MAIN_MARKET,
		GHO_TOKEN,
		selectedWindow,
		'borrow'
	)

	const ghoMarketRows = useMemo<GHOMarketRow[]>(
		() =>
			reserves
				.filter((r) => r.symbol === 'GHO')
				.map((r) => ({
					market: r.market,
					chain: r.chain,
					sizeUsd: r.sizeUsd,
					totalBorrowedUsd: r.totalBorrowedUsd,
					availableLiquidityUsd: r.availableLiquidityUsd,
					borrowApy: r.borrowApy ?? 0,
					utilization: r.utilization ?? 0
				})),
		[reserves]
	)

	const aggregated = useMemo(() => {
		if (ghoMarketRows.length === 0) return null
		return {
			totalSize: ghoMarketRows.reduce((s, r) => s + r.sizeUsd, 0),
			totalBorrowed: ghoMarketRows.reduce((s, r) => s + r.totalBorrowedUsd, 0),
			totalLiquidity: ghoMarketRows.reduce((s, r) => s + r.availableLiquidityUsd, 0),
			marketsCount: ghoMarketRows.length
		}
	}, [ghoMarketRows])

	const kpis = useMemo(() => {
		if (!reserve) return null
		const bi = reserve.borrowInfo
		return {
			totalSize: aggregated
				? formatUsd(aggregated.totalSize, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: formatUsd(num(reserve.size?.usd), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
			totalBorrowed: aggregated
				? formatUsd(aggregated.totalBorrowed, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				: formatUsd(num(bi?.total?.usd), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
			availableLiquidity: aggregated
				? formatUsd(aggregated.totalLiquidity, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				: formatUsd(num(bi?.availableLiquidity?.usd), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
			borrowApy: formatPct(pct(bi?.apy?.value)),
			utilization: formatPct(pct(bi?.utilizationRate?.value)),
			borrowCap: formatUsd(num(bi?.borrowCap?.usd), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
			markets: aggregated?.marketsCount ?? 1
		}
	}, [reserve, aggregated])

	if (reserveLoading || marketsLoading) return <PageLoader />

	return (
		<div className="flex flex-col gap-6">
			{kpis && (
				<MetricStrip>
					<KpiCard label="Total GHO Size" value={kpis.totalSize} />
					<KpiCard label="Total Borrowed" value={kpis.totalBorrowed} />
					<KpiCard label="Available Liquidity" value={kpis.availableLiquidity} />
					<KpiCard label="Borrow APY (Main)" value={kpis.borrowApy} />
					<KpiCard label="Utilization (Main)" value={kpis.utilization} />
					<KpiCard label="Borrow Cap (Main)" value={kpis.borrowCap} />
					<KpiCard label="Markets" value={kpis.markets} />
				</MetricStrip>
			)}

			{/* Chart section with inline time window toggle */}
			<div>
				<div className="mb-4 flex items-center justify-between">
					<SectionHeader title="GHO Borrow APY History" />
					<WindowToggle
						options={WINDOW_OPTIONS}
						value={selectedWindow}
						onChange={(v) => setSelectedWindow(v as TimeWindow)}
					/>
				</div>

				{apyLoading ? (
					<CardSkeleton title="" />
				) : borrowApyDataset.source.length > 0 ? (
					<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
						<MultiSeriesChart
							dataset={borrowApyDataset}
							charts={BORROW_APY_CHART}
							valueSymbol="%"
							title=""
							height="400px"
							chartOptions={AAVE_PERCENT_TIME_CHART_OPTIONS}
							exportButtons={AAVE_AREA_EXPORT}
						/>
					</div>
				) : (
					<CardSkeleton title="" />
				)}
			</div>

			<GHOMarketsTable data={ghoMarketRows} />
		</div>
	)
}
