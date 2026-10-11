import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { useTable } from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { displayTableFeatures } from '~/components/Table/features/display'
import { Card } from '~/ui/Card'
import { CHART_FILL, ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { InlineStatStrip } from '~/ui/SummaryStats'
import {
	formatPercent,
	formatUsd,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import type { TimeWindow } from './api'
import { num, pct, useAaveAPYHistory, useAaveGHOReserve, useAaveMarkets } from './api'
import { AAVE_AREA_EXPORT, AAVE_PERCENT_TIME_CHART_OPTIONS, InvestorsTable } from './shared'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const GHO_TOKEN = '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f'
const ETH_MAIN_MARKET = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'

const WINDOW_OPTIONS: Array<{ value: TimeWindow; label: string }> = [
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

const ghoMarketColumns: Array<ColumnDef<typeof displayTableFeatures, GHOMarketRow>> = [
	{ header: 'Chain', accessorKey: 'chain', size: 120 },
	{
		header: 'Market Size',
		id: 'sizeUsd',
		accessorFn: (row) => row.sizeUsd ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Total Borrowed',
		id: 'totalBorrowedUsd',
		accessorFn: (row) => row.totalBorrowedUsd ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Available Liquidity',
		id: 'availableLiquidityUsd',
		accessorFn: (row) => row.availableLiquidityUsd ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 150
	},
	{
		header: 'Borrow APY',
		id: 'borrowApy',
		accessorFn: (row) => row.borrowApy ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Utilization',
		id: 'utilization',
		accessorFn: (row) => row.utilization ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 110
	}
]

function GHOMarketsTable({ data }: { data: Array<GHOMarketRow> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'sizeUsd', desc: true }])

	const instance = useTable({
		features: displayTableFeatures,
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: ghoMarketColumns,
		state: { sorting },
		onSortingChange: setSorting
	})

	if (data.length === 0) return null

	return (
		<Card padding="md">
			<h3 className="heading-xs">GHO across markets</h3>
			<div className="mt-4">
				<InvestorsTable instance={instance} />
			</div>
		</Card>
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

	const ghoMarketRows = useMemo<Array<GHOMarketRow>>(
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
				? formatUsd(aggregated.totalSize, USD_LOWERCASE_MILLIONS_OPTIONS)
				: formatUsd(num(reserve.size?.usd), USD_LOWERCASE_MILLIONS_OPTIONS),
			totalBorrowed: aggregated
				? formatUsd(aggregated.totalBorrowed, USD_LOWERCASE_MILLIONS_OPTIONS)
				: formatUsd(num(bi?.total?.usd), USD_LOWERCASE_MILLIONS_OPTIONS),
			availableLiquidity: aggregated
				? formatUsd(aggregated.totalLiquidity, USD_LOWERCASE_MILLIONS_OPTIONS)
				: formatUsd(num(bi?.availableLiquidity?.usd), USD_LOWERCASE_MILLIONS_OPTIONS),
			borrowApy: formatPercent(pct(bi?.apy?.value), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
			utilization: formatPercent(pct(bi?.utilizationRate?.value), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
			borrowCap: formatUsd(num(bi?.borrowCap?.usd), USD_LOWERCASE_MILLIONS_OPTIONS),
			markets: aggregated?.marketsCount ?? 1
		}
	}, [reserve, aggregated])

	if (reserveLoading || marketsLoading) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{kpis && (
				<InlineStatStrip
					stacked
					items={[
						{ label: 'Total GHO Size', value: kpis.totalSize },
						{ label: 'Total Borrowed', value: kpis.totalBorrowed },
						{ label: 'Available Liquidity', value: kpis.availableLiquidity },
						{ label: 'Borrow APY (Main)', value: kpis.borrowApy },
						{ label: 'Utilization (Main)', value: kpis.utilization },
						{ label: 'Borrow Cap (Main)', value: kpis.borrowCap },
						{ label: 'Markets', value: kpis.markets }
					]}
				/>
			)}

			{/* Chart section with inline time window toggle */}
			<div>
				<div className="mb-4 flex items-center justify-between">
					<h3 className="heading-xs">GHO borrow APY history</h3>
					<SegmentedControl<TimeWindow>
						variant="default"
						size="md"
						label="GHO borrow APY window"
						options={WINDOW_OPTIONS}
						value={selectedWindow}
						onValueChange={setSelectedWindow}
					/>
				</div>

				{apyLoading ? (
					<PanelLoadingStatus className="min-h-[400px]" />
				) : borrowApyDataset.source.length > 0 ? (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={borrowApyDataset}
								charts={BORROW_APY_CHART}
								valueSymbol="%"
								containerClassName={CHART_FILL}
								chartOptions={AAVE_PERCENT_TIME_CHART_OPTIONS}
								exportButtons={AAVE_AREA_EXPORT}
							/>
						</Suspense>
					</Panel>
				) : (
					<PanelStatus variant="empty" className="min-h-[400px]">
						No GHO borrow APY history for this window.
					</PanelStatus>
				)}
			</div>

			<GHOMarketsTable data={ghoMarketRows} />
		</div>
	)
}
