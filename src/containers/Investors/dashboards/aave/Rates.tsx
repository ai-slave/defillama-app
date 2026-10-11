import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { useTable } from '@tanstack/react-table'
import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { VirtualizedSelect } from '~/components/Select/VirtualizedSelect'
import { displayTableFeatures } from '~/components/Table/features/display'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBodyLoading,
	ChartPanelExportShellLoading,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelLoadingStatus } from '~/ui/Status'
import { InlineStatStrip } from '~/ui/SummaryStats'
import {
	formatPercent,
	formatUsd,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import type { TimeWindow } from './api'
import { useAaveAPYHistory, useAaveMarkets } from './api'
import {
	AAVE_AREA_EXPORT,
	AAVE_CATEGORY_PERCENT_CHART_OPTIONS,
	AAVE_PERCENT_TIME_CHART_OPTIONS,
	CardSkeleton,
	InvestorsTable
} from './shared'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const WINDOW_OPTIONS: Array<{ value: TimeWindow; label: string }> = [
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

const rateColumns: Array<ColumnDef<typeof displayTableFeatures, RateComparisonRow>> = [
	{ header: 'Chain', accessorKey: 'chain', size: 120 },
	{ header: 'Market', accessorKey: 'market', size: 200 },
	{
		header: 'Market Size',
		id: 'sizeUsd',
		accessorFn: (row) => row.sizeUsd ?? undefined,
		cell: ({ getValue }) => formatUsd(getValue<number>(), USD_LOWERCASE_MILLIONS_OPTIONS),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Supply APY',
		id: 'supplyApy',
		accessorFn: (row) => row.supplyApy ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Borrow APY',
		id: 'borrowApy',
		accessorFn: (row) => row.borrowApy ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number | null>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Utilization',
		id: 'utilization',
		accessorFn: (row) => row.utilization ?? undefined,
		cell: ({ getValue }) => formatPercent(getValue<number | null>(), PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
		meta: { align: 'end' as const },
		size: 100
	}
]

function RateComparisonTable({ data }: { data: Array<RateComparisonRow> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'sizeUsd', desc: true }])

	const instance = useTable({
		features: displayTableFeatures,
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: rateColumns,
		state: { sorting },
		onSortingChange: setSorting
	})

	if (data.length === 0) return null

	return (
		<div className="rounded-lg border border-subtle bg-surface p-5">
			<h3 className="heading-xs">Rate Comparison Across Chains</h3>
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
			.map((a) => ({ value: a.symbol, label: a.symbol }))
	}, [reserves])

	const [selectedAsset, setSelectedAsset] = useState<string>('')
	const [selectedWindow, setSelectedWindow] = useState<TimeWindow>('LAST_MONTH')
	const rateCurve = useGetChartInstance()

	const activeAsset = selectedAsset || assetOptions[0]?.value || ''

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
			source.push([
				formatPercent(u, { input: 'percent', maximumFractionDigits: 0 }),
				Math.round(borrowRate * 100) / 100,
				Math.round(supplyRate * 100) / 100
			])
		}
		return { source, dimensions: ['Name', 'Borrow Rate', 'Supply Rate'] }
	}, [primaryReserve])

	const kpis = useMemo(() => {
		if (!primaryReserve) return null
		return {
			supplyApy: formatPercent(primaryReserve.supplyApy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
			borrowApy: formatPercent(primaryReserve.borrowApy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
			utilization: formatPercent(primaryReserve.utilization, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—',
			marketSize: formatUsd(primaryReserve.sizeUsd, USD_LOWERCASE_MILLIONS_OPTIONS),
			marketsCount: assetReserves.length,
			optimalUtil:
				primaryReserve.optimalUsageRate != null
					? (formatPercent(primaryReserve.optimalUsageRate, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—')
					: null,
			slope1:
				primaryReserve.variableRateSlope1 != null
					? (formatPercent(primaryReserve.variableRateSlope1, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—')
					: null,
			slope2:
				primaryReserve.variableRateSlope2 != null
					? (formatPercent(primaryReserve.variableRateSlope2, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—')
					: null
		}
	}, [primaryReserve, assetReserves])

	if (marketsLoading) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{/* Controls bar — asset selector + time window, left-aligned */}
			<div className="flex flex-wrap items-center gap-3">
				<VirtualizedSelect
					variant="chip"
					label="Asset"
					options={assetOptions}
					selectedValue={activeAsset || null}
					placeholder="Select asset…"
					onChange={(option) => setSelectedAsset(option.value)}
				/>

				<SegmentedControl<TimeWindow>
					variant="default"
					size="md"
					label="Time window"
					options={WINDOW_OPTIONS}
					value={selectedWindow}
					onValueChange={setSelectedWindow}
				/>
			</div>

			{kpis && (
				<InlineStatStrip
					stacked
					items={[
						{ label: `${activeAsset} Supply APY`, value: kpis.supplyApy },
						{ label: `${activeAsset} Borrow APY`, value: kpis.borrowApy },
						{ label: 'Utilization', value: kpis.utilization },
						{ label: 'Market Size', value: kpis.marketSize },
						{ label: 'Markets', value: kpis.marketsCount }
					]}
				/>
			)}

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
				{supplyLoading ? (
					<PanelLoadingStatus className="min-h-[400px]" />
				) : supplyDataset.source.length > 0 ? (
					<ChartPanel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={supplyDataset}
								charts={SUPPLY_APY_CHART}
								valueSymbol="%"
								title={`${activeAsset} Supply APY \u00b7 ${primaryReserve?.chain}`}
								headingAs="h3"
								containerClassName={CHART_FILL}
								chartOptions={AAVE_PERCENT_TIME_CHART_OPTIONS}
								exportButtons={AAVE_AREA_EXPORT}
							/>
						</Suspense>
					</ChartPanel>
				) : null}

				{borrowLoading ? (
					<PanelLoadingStatus className="min-h-[400px]" />
				) : borrowDataset.source.length > 0 ? (
					<ChartPanel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={borrowDataset}
								charts={BORROW_APY_CHART}
								valueSymbol="%"
								title={`${activeAsset} Borrow APY \u00b7 ${primaryReserve?.chain}`}
								headingAs="h3"
								containerClassName={CHART_FILL}
								chartOptions={AAVE_PERCENT_TIME_CHART_OPTIONS}
								exportButtons={AAVE_AREA_EXPORT}
							/>
						</Suspense>
					</ChartPanel>
				) : null}
			</div>

			{rateCurveDataset ? (
				<ChartPanel>
					<ChartPanelToolbar
						leading={
							<ChartPanelTitle>
								{activeAsset} Interest Rate Model · {primaryReserve?.chain}
							</ChartPanelTitle>
						}
					>
						{kpis?.optimalUtil && (
							<span className="body-sm text-tertiary">
								Optimal <span className="mono-sm-bold text-secondary">{kpis.optimalUtil}</span>
							</span>
						)}
						{kpis?.slope1 && (
							<span className="body-sm text-tertiary">
								Slope 1 <span className="mono-sm-bold text-secondary">{kpis.slope1}</span>
							</span>
						)}
						{kpis?.slope2 && (
							<span className="body-sm text-tertiary">
								Slope 2 <span className="mono-sm-bold text-secondary">{kpis.slope2}</span>
							</span>
						)}
						<ChartExportButtons
							chartInstance={rateCurve.chartInstance}
							filename={`aave-${activeAsset.toLowerCase()}-interest-rate-model`}
							showPng={false}
							csvSource={{ type: 'dataset', prepare: () => rateCurveDataset }}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={rateCurveDataset}
							charts={RATE_CURVE_CHARTS}
							valueSymbol="%"
							containerClassName={CHART_FILL}
							showLegend
							chartOptions={AAVE_CATEGORY_PERCENT_CHART_OPTIONS}
							exportButtons="hidden"
							onReady={rateCurve.handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
			) : null}

			{marketsLoading ? (
				<CardSkeleton title="Rate Comparison Across Chains" />
			) : (
				<RateComparisonTable data={sortedAssetReserves} />
			)}
		</div>
	)
}
