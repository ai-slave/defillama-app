import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { formattedNum } from '~/utils'
import { useAaveMarkets, useAaveAPYHistory } from './api'
import type { TimeWindow } from './api'
import {
	InvestorsTable,
	PageLoader,
	ChartCard,
	CardSkeleton,
	KpiCard,
	MetricStrip,
	SectionHeader,
	WindowToggle,
	formatPct,
	AAVE_AREA_EXPORT,
	AAVE_BAR_EXPORT,
	AAVE_CATEGORY_PERCENT_CHART_OPTIONS,
	AAVE_PERCENT_TIME_CHART_OPTIONS
} from './shared'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
	{ value: 'LAST_DAY', label: '1D' },
	{ value: 'LAST_WEEK', label: '1W' },
	{ value: 'LAST_MONTH', label: '1M' },
	{ value: 'LAST_SIX_MONTHS', label: '6M' },
	{ value: 'LAST_YEAR', label: '1Y' }
]

const SUPPLY_APY_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Supply APY',
		type: 'line',
		encode: { x: 'timestamp', y: 'Supply APY' },
		color: '#66BB6A'
	}
]
const BORROW_APY_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Borrow APY',
		type: 'line',
		encode: { x: 'timestamp', y: 'Borrow APY' },
		color: '#EF5350'
	}
]
const RATE_CURVE_CHARTS: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Borrow Rate',
		type: 'bar',
		encode: { x: 'Name', y: 'Borrow Rate' },
		color: '#EF5350',
		stack: 'a'
	},
	{
		name: 'Supply Rate',
		type: 'bar',
		encode: { x: 'Name', y: 'Supply Rate' },
		color: '#66BB6A',
		stack: 'b'
	}
]

interface RateComparisonRow {
	chain: string
	market: string
	supplyApy: number
	borrowApy: number | null
	utilization: number | null
	sizeUsd: number
}

const rateColumns: ColumnDef<RateComparisonRow>[] = [
	{ header: 'Chain', accessorKey: 'chain', size: 120 },
	{ header: 'Market', accessorKey: 'market', size: 200 },
	{
		header: 'Market Size',
		accessorKey: 'sizeUsd',
		cell: ({ getValue }) => formattedNum(getValue<number>(), true),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Supply APY',
		accessorKey: 'supplyApy',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Borrow APY',
		accessorKey: 'borrowApy',
		cell: ({ getValue }) => formatPct(getValue<number | null>()),
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Utilization',
		accessorKey: 'utilization',
		cell: ({ getValue }) => formatPct(getValue<number | null>()),
		meta: { align: 'end' as const },
		size: 100
	}
]

function RateComparisonTable({ data }: { data: RateComparisonRow[] }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'sizeUsd', desc: true }])

	const instance = useReactTable({
		data,
		columns: rateColumns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	if (data.length === 0) return null

	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
			<SectionHeader title="Rate Comparison Across Chains" />
			<div className="mt-4">
				<InvestorsTable instance={instance} />
			</div>
		</div>
	)
}

export default function Rates() {
	const { reserves, isLoading: marketsLoading } = useAaveMarkets()

	const assetOptions = useMemo(() => {
		const assetMap = new Map<string, { symbol: string; totalSize: number }>()
		for (const r of reserves) {
			const prev = assetMap.get(r.symbol)
			if (prev) {
				prev.totalSize += r.sizeUsd
			} else {
				assetMap.set(r.symbol, { symbol: r.symbol, totalSize: r.sizeUsd })
			}
		}
		return Array.from(assetMap.values())
			.sort((a, b) => b.totalSize - a.totalSize)
			.map((a) => a.symbol)
	}, [reserves])

	const [selectedAsset, setSelectedAsset] = useState<string>('')
	const [selectedWindow, setSelectedWindow] = useState<TimeWindow>('LAST_MONTH')

	const activeAsset = selectedAsset || assetOptions[0] || ''

	const assetReserves = useMemo(() => reserves.filter((r) => r.symbol === activeAsset), [reserves, activeAsset])

	const sortedAssetReserves = useMemo(() => assetReserves.toSorted((a, b) => b.sizeUsd - a.sizeUsd), [assetReserves])

	const primaryReserve = sortedAssetReserves[0] ?? null

	const { dataset: supplyDataset, isLoading: supplyLoading } = useAaveAPYHistory(
		primaryReserve?.chainId,
		primaryReserve?.marketAddress,
		primaryReserve?.tokenAddress,
		selectedWindow,
		'supply'
	)

	const { dataset: borrowDataset, isLoading: borrowLoading } = useAaveAPYHistory(
		primaryReserve?.chainId,
		primaryReserve?.marketAddress,
		primaryReserve?.tokenAddress,
		selectedWindow,
		'borrow'
	)

	const rateComparisonRows = useMemo<RateComparisonRow[]>(
		() =>
			sortedAssetReserves.map((r) => ({
				chain: r.chain,
				market: r.market,
				supplyApy: r.supplyApy,
				borrowApy: r.borrowApy,
				utilization: r.utilization,
				sizeUsd: r.sizeUsd
			})),
		[sortedAssetReserves]
	)

	const rateCurveDataset = useMemo<MultiSeriesChartDataset | null>(() => {
		if (!primaryReserve) return null
		const { baseVariableBorrowRate, variableRateSlope1, variableRateSlope2, optimalUsageRate } = primaryReserve
		if (
			baseVariableBorrowRate == null ||
			variableRateSlope1 == null ||
			variableRateSlope2 == null ||
			optimalUsageRate == null
		)
			return null
		if (optimalUsageRate === 0) return null

		const source: Array<Array<string | number>> = []
		for (let u = 0; u <= 100; u += 1) {
			let borrowRate: number
			if (u <= optimalUsageRate) {
				borrowRate = baseVariableBorrowRate + (u / optimalUsageRate) * variableRateSlope1
			} else {
				borrowRate =
					baseVariableBorrowRate +
					variableRateSlope1 +
					((u - optimalUsageRate) / (100 - optimalUsageRate)) * variableRateSlope2
			}
			const supplyRate = borrowRate * (u / 100)
			source.push([`${u}%`, Math.round(borrowRate * 100) / 100, Math.round(supplyRate * 100) / 100])
		}
		return { source, dimensions: ['Name', 'Borrow Rate', 'Supply Rate'] }
	}, [primaryReserve])

	const kpis = useMemo(() => {
		if (!primaryReserve) return null
		return {
			supplyApy: formatPct(primaryReserve.supplyApy),
			borrowApy: formatPct(primaryReserve.borrowApy),
			utilization: formatPct(primaryReserve.utilization),
			marketSize: formattedNum(primaryReserve.sizeUsd, true),
			marketsCount: assetReserves.length,
			optimalUtil: primaryReserve.optimalUsageRate != null ? formatPct(primaryReserve.optimalUsageRate) : null,
			slope1: primaryReserve.variableRateSlope1 != null ? formatPct(primaryReserve.variableRateSlope1) : null,
			slope2: primaryReserve.variableRateSlope2 != null ? formatPct(primaryReserve.variableRateSlope2) : null
		}
	}, [primaryReserve, assetReserves])

	if (marketsLoading) return <PageLoader />

	return (
		<div className="flex flex-col gap-6">
			{/* Controls bar — asset selector + time window, left-aligned */}
			<div className="flex flex-wrap items-center gap-3">
				<select
					value={activeAsset}
					onChange={(e) => setSelectedAsset(e.target.value)}
					className="rounded-md border border-pro-cards-border bg-pro-cards-bg px-3 py-1.5 text-sm font-medium text-pro-text-primary outline-hidden transition-colors focus:border-sl-accent"
				>
					{assetOptions.map((a) => (
						<option key={a} value={a}>
							{a}
						</option>
					))}
				</select>

				<WindowToggle
					options={WINDOW_OPTIONS}
					value={selectedWindow}
					onChange={(v) => setSelectedWindow(v as TimeWindow)}
				/>
			</div>

			{kpis && (
				<MetricStrip>
					<KpiCard label={`${activeAsset} Supply APY`} value={kpis.supplyApy} />
					<KpiCard label={`${activeAsset} Borrow APY`} value={kpis.borrowApy} />
					<KpiCard label="Utilization" value={kpis.utilization} />
					<KpiCard label="Market Size" value={kpis.marketSize} />
					<KpiCard label="Markets" value={kpis.marketsCount} />
				</MetricStrip>
			)}

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
				{supplyLoading ? (
					<CardSkeleton title="Supply APY History" />
				) : supplyDataset.source.length > 0 ? (
					<ChartCard title={`${activeAsset} Supply APY \u00b7 ${primaryReserve?.chain}`}>
						<MultiSeriesChart
							dataset={supplyDataset}
							charts={SUPPLY_APY_CHART}
							valueSymbol="%"
							title=""
							height="400px"
							chartOptions={AAVE_PERCENT_TIME_CHART_OPTIONS}
							exportButtons={AAVE_AREA_EXPORT}
						/>
					</ChartCard>
				) : null}

				{borrowLoading ? (
					<CardSkeleton title="Borrow APY History" />
				) : borrowDataset.source.length > 0 ? (
					<ChartCard title={`${activeAsset} Borrow APY \u00b7 ${primaryReserve?.chain}`}>
						<MultiSeriesChart
							dataset={borrowDataset}
							charts={BORROW_APY_CHART}
							valueSymbol="%"
							title=""
							height="400px"
							chartOptions={AAVE_PERCENT_TIME_CHART_OPTIONS}
							exportButtons={AAVE_AREA_EXPORT}
						/>
					</ChartCard>
				) : null}
			</div>

			{rateCurveDataset ? (
				<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5">
					<div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
						<h3 className="text-[11px] font-semibold tracking-wider text-pro-text-tertiary uppercase">
							{activeAsset} Interest Rate Model{' '}
							<span className="font-normal normal-case">\u00b7 {primaryReserve?.chain}</span>
						</h3>
						{kpis?.optimalUtil && (
							<span className="text-[11px] text-pro-text-tertiary">
								Optimal <span className="font-jetbrains font-semibold text-pro-text-secondary">{kpis.optimalUtil}</span>
							</span>
						)}
						{kpis?.slope1 && (
							<span className="text-[11px] text-pro-text-tertiary">
								Slope 1 <span className="font-jetbrains font-semibold text-pro-text-secondary">{kpis.slope1}</span>
							</span>
						)}
						{kpis?.slope2 && (
							<span className="text-[11px] text-pro-text-tertiary">
								Slope 2 <span className="font-jetbrains font-semibold text-pro-text-secondary">{kpis.slope2}</span>
							</span>
						)}
					</div>
					<MultiSeriesChart
						dataset={rateCurveDataset}
						charts={RATE_CURVE_CHARTS}
						valueSymbol="%"
						title=""
						height="400px"
						hideDefaultLegend={false}
						chartOptions={AAVE_CATEGORY_PERCENT_CHART_OPTIONS}
						exportButtons={AAVE_BAR_EXPORT}
					/>
				</div>
			) : null}

			{marketsLoading ? (
				<CardSkeleton title="Rate Comparison Across Chains" />
			) : (
				<RateComparisonTable data={rateComparisonRows} />
			)}
		</div>
	)
}
