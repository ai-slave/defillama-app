import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChartProps, MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { PercentChange } from '~/ui/PercentChange'
import { TagGroup } from '~/ui/SegmentedControl'
import { formattedNum } from '~/utils'
import { buildNarrativeTreemapTreeData, calculateDenominatedTimeSeries } from './chartData'
import type { CategoryPerformanceProps, IPctChangeRow } from './types'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>
const TreemapChart = React.lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>

const DEFAULT_SORTING_STATE = [{ id: 'change', desc: true }]
const MAX_VISIBLE_TIME_SERIES = 30
const columnHelper = createColumnHelper<IPctChangeRow>()

// for bar + heatmap
function calculateDenominatedChange2(
	data: IPctChangeRow[],
	denominatedCoin: string,
	field: PeriodConfig['field']
): IPctChangeRow[] {
	const denomRow = data.find((i) => i.name === denominatedCoin)
	const denomChange = denomRow?.[field]
	if (denomChange == null) return data

	const denominatedCoinPerformance = 1 + denomChange / 100
	if (denominatedCoinPerformance === 0) return data

	const denominatedReturns: IPctChangeRow[] = []
	for (const i of data) {
		const change = i[field]
		if (change == null) {
			denominatedReturns.push(i)
			continue
		}
		const categoryPerformance = 1 + change / 100
		const relativePerformance = (categoryPerformance / denominatedCoinPerformance - 1) * 100
		denominatedReturns.push({ ...i, [field]: relativePerformance })
	}

	return denominatedReturns
}

const PERIODS = ['7D', '30D', 'YTD', '365D'] as const
const DENOMS = ['$', 'BTC', 'ETH', 'SOL'] as const

type Period = (typeof PERIODS)[number]
type Denom = (typeof DENOMS)[number]
type PeriodField = 'change1W' | 'change1M' | 'changeYtd' | 'change1Y'
type PeriodConfig = { field: PeriodField; seriesKey: string }

// Unified period configuration to avoid redundant lookups
const PERIOD_CONFIG: Record<Period, PeriodConfig> = {
	'7D': { field: 'change1W', seriesKey: '7' },
	'30D': { field: 'change1M', seriesKey: '30' },
	YTD: { field: 'changeYtd', seriesKey: 'ytd' },
	'365D': { field: 'change1Y', seriesKey: '365' }
}

const DENOM_COIN_MAP: Record<Denom, string> = {
	$: '$',
	BTC: 'Bitcoin',
	ETH: 'Ethereum',
	SOL: 'Solana'
}
const DENOM_COIN_NAMES = ['Bitcoin', 'Ethereum', 'Solana'] as const
const DENOM_COIN_NAME_SET = new Set<string>(DENOM_COIN_NAMES)
const BAR_CHART_OPTIONS: MultiSeriesChartOptions = { yAxis: { position: 'right' } }
const LINE_CHART_OPTIONS: MultiSeriesChartOptions = { yAxis: { position: 'right' } }

export const CategoryPerformanceContainer = ({
	pctChanges,
	performanceTimeSeries,
	areaChartLegend,
	isCoinPage,
	categoryName
}: CategoryPerformanceProps) => {
	const [tab, setTab] = React.useState('linechart')
	const [groupBy, setGroupBy] = React.useState<Period>('30D')
	const [groupByDenom, setGroupByDenom] = React.useState<Denom>('$')

	const [selectedSeries, setSelectedSeries] = React.useState<string[]>(() =>
		(areaChartLegend ?? []).slice(0, MAX_VISIBLE_TIME_SERIES)
	)
	const setBoundedSelectedSeries = React.useCallback((values: string[]) => {
		setSelectedSeries((current) => {
			if (values.length <= MAX_VISIBLE_TIME_SERIES) return values
			const addedValues = values.filter((value) => !current.includes(value))
			if (addedValues.length === 1) {
				const added = addedValues[0]
				return [...values.filter((value) => value !== added).slice(0, MAX_VISIBLE_TIME_SERIES - 1), added]
			}
			return values.slice(0, MAX_VISIBLE_TIME_SERIES)
		})
	}, [])

	// Keep selection in sync when legend options change.
	React.useEffect(() => {
		const nextOptions = areaChartLegend ?? []
		setSelectedSeries((prev) => {
			// Preserve any existing selection that still exists in the new options.
			const preserved = prev.filter((s) => nextOptions.includes(s))
			const next = preserved.length > 0 ? preserved : nextOptions.slice(0, MAX_VISIBLE_TIME_SERIES)
			// Avoid re-render loops when callers pass a new array instance each render.
			if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev
			return next
		})
	}, [areaChartLegend])

	const disabledDenoms = React.useMemo(() => {
		const { field, seriesKey } = PERIOD_CONFIG[groupBy]
		const series = performanceTimeSeries?.[seriesKey] ?? []
		const timeSeriesDenoms = new Set<string>()
		const pctDenoms = new Set<string>()

		for (const row of series) {
			for (const coinName of DENOM_COIN_NAMES) {
				if (row[coinName] != null) {
					timeSeriesDenoms.add(coinName)
				}
			}
		}

		for (const row of pctChanges) {
			if (row[field] != null && DENOM_COIN_NAME_SET.has(row.name)) {
				pctDenoms.add(row.name)
			}
		}

		const disabled: Denom[] = []
		for (const denom of DENOMS) {
			if (denom === '$') continue
			const coinName = DENOM_COIN_MAP[denom]
			if (!timeSeriesDenoms.has(coinName) || !pctDenoms.has(coinName)) disabled.push(denom)
		}
		return disabled
	}, [groupBy, performanceTimeSeries, pctChanges])

	React.useEffect(() => {
		// Prevent selecting a denom that can't be applied (would look like "filter doesn't work").
		if (disabledDenoms.includes(groupByDenom)) setGroupByDenom('$')
	}, [disabledDenoms, groupByDenom])

	// All values here are returns / relative returns expressed in percent.
	const chartValueSymbol = '%'

	// Keep axis on the right like before; avoid `yAxis.name` because it renders
	// at the top of the axis and can get clipped by the chart container.
	const barChartOptions = BAR_CHART_OPTIONS
	const lineChartOptions = LINE_CHART_OPTIONS

	const { sortedPctChanges, timeSeries } = React.useMemo(() => {
		const { field, seriesKey } = PERIOD_CONFIG[groupBy]
		const denomCoin = DENOM_COIN_MAP[groupByDenom]

		let pctChangesDenom = denomCoin === '$' ? pctChanges : calculateDenominatedChange2(pctChanges, denomCoin, field)
		pctChangesDenom = isCoinPage
			? pctChangesDenom.filter((i) => !['bitcoin', 'ethereum', 'solana'].includes(i.id))
			: pctChangesDenom

		const sorted = pctChangesDenom
			.toSorted((a, b) => {
				const bValue = b[field] ?? Number.NEGATIVE_INFINITY
				const aValue = a[field] ?? Number.NEGATIVE_INFINITY
				return bValue - aValue
			})
			.map((i) => ({ ...i, change: i[field] ?? null }))

		let chart = performanceTimeSeries?.[seriesKey]
		chart = denomCoin === '$' ? chart : calculateDenominatedTimeSeries(chart, denomCoin)

		return { sortedPctChanges: sorted, timeSeries: chart }
	}, [pctChanges, groupBy, performanceTimeSeries, groupByDenom, isCoinPage])

	const dataset = React.useMemo(() => {
		const seriesKeys = selectedSeries
		const dimensions = ['timestamp', ...seriesKeys]

		const source: Array<Array<string | number | null | undefined>> = []
		for (const row of timeSeries ?? []) {
			const out = new Array<string | number | null>(seriesKeys.length + 1)
			out[0] = row.date * 1e3
			for (let seriesIndex = 0; seriesIndex < seriesKeys.length; seriesIndex++) {
				out[seriesIndex + 1] = row[seriesKeys[seriesIndex]] ?? null
			}
			source.push(out)
		}

		return { dimensions, source }
	}, [timeSeries, selectedSeries])
	const canonicalColorIndex = React.useMemo(
		() => new Map((areaChartLegend ?? []).map((name, index) => [name, index])),
		[areaChartLegend]
	)

	const lineCharts = React.useMemo(() => {
		const seriesKeys = selectedSeries
		return seriesKeys.map((name, index) => ({
			type: 'line' as const,
			name,
			encode: { x: 0, y: index + 1 },
			// Keep colors stable across tabs.
			color: CHART_COLORS[(canonicalColorIndex.get(name) ?? index) % CHART_COLORS.length],
			yAxisIndex: undefined,
			large: true
		}))
	}, [canonicalColorIndex, selectedSeries])

	const barCharts = React.useMemo(() => {
		const seriesKeys = selectedSeries
		return seriesKeys.map((name, index) => ({
			type: 'bar' as const,
			name,
			encode: { x: 0, y: index + 1 },
			color: CHART_COLORS[(canonicalColorIndex.get(name) ?? index) % CHART_COLORS.length],
			stack: 'A',
			large: false
		}))
	}, [canonicalColorIndex, selectedSeries])
	const chartDataBundle = React.useMemo(() => ({ dataset, barCharts, lineCharts }), [dataset, barCharts, lineCharts])
	const deferredChartData = React.useDeferredValue(chartDataBundle)

	const treemapTreeData = React.useMemo(
		() => (tab === 'heatmap' ? buildNarrativeTreemapTreeData(sortedPctChanges, PERIOD_CONFIG[groupBy].field) : []),
		[tab, sortedPctChanges, groupBy]
	)

	const { chartInstance: exportChartInstance, handleChartReady: onChartReady } = useGetChartInstance()

	return (
		<>
			<div className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-3">
				{isCoinPage && categoryName ? <h1 className="heading-sm">Category: {categoryName ?? ''}</h1> : null}
				<p className="text-sm text-secondary">
					MCap-Weighted Category Performance: Shows how a category of coins has performed over your chosen time period
					and in your selected denomination (e.g., $, BTC). Method: 1. calculating the percentage change for each
					individual coin in the category. 2. weighting these changes based on each coin's market capitalization. 3.
					averaging these weighted changes to get the overall category performance.
				</p>
			</div>

			<div className="rounded-lg border border-subtle bg-surface">
				<div className="flex flex-wrap overflow-x-auto border-b border-medium">
					<button
						className="border-b border-medium px-6 py-2 whitespace-nowrap hover:bg-hover-row focus-visible:bg-hover-row data-[selected=true]:border-b-brand"
						onClick={() => setTab('linechart')}
						data-selected={tab === 'linechart'}
					>
						Linechart
					</button>
					<button
						className="border-b border-l border-medium px-6 py-2 whitespace-nowrap hover:bg-hover-row focus-visible:bg-hover-row data-[selected=true]:border-b-brand"
						onClick={() => setTab('barchart')}
						data-selected={tab === 'barchart'}
					>
						Barchart
					</button>
					<button
						className="border-b border-l border-medium px-6 py-2 whitespace-nowrap hover:bg-hover-row focus-visible:bg-hover-row data-[selected=true]:border-b-brand"
						onClick={() => setTab('heatmap')}
						data-selected={tab === 'heatmap'}
					>
						Heatmap
					</button>
				</div>

				<div className="flex items-center justify-end gap-2 p-2">
					<TagGroup
						variant="default"
						size="md"
						values={PERIODS}
						selectedValue={groupBy}
						setValue={(val) => setGroupBy(val)}
					/>
					<TagGroup
						variant="default"
						size="md"
						values={DENOMS}
						selectedValue={groupByDenom}
						setValue={(val) => setGroupByDenom(val)}
						label="Denom (vs):"
						disabledValues={disabledDenoms}
					/>
					{tab === 'barchart' || tab === 'linechart' ? (
						<>
							{areaChartLegend?.length > 1 ? (
								<SelectWithCombobox
									allValues={areaChartLegend}
									selectedValues={selectedSeries}
									setSelectedValues={setBoundedSelectedSeries}
									label={isCoinPage ? 'Coins' : 'Categories'}
									labelType="smol"
									variant="filter"
									size="md"
								/>
							) : null}
							<ChartExportButtons
								chartInstance={exportChartInstance}
								filename={`category-performance-${tab}`}
								title={`Category Performance ${tab}`}
							/>
						</>
					) : null}
				</div>

				<div className="min-h-[360px]">
					{tab === 'barchart' ? (
						<React.Suspense fallback={<div className="h-[533px]" />}>
							<MultiSeriesChart
								dataset={deferredChartData.dataset}
								charts={deferredChartData.barCharts}
								valueSymbol={chartValueSymbol}
								height="533px"
								hideDataZoom={false}
								chartOptions={barChartOptions}
								exportButtons="hidden"
								onReady={onChartReady}
							/>
						</React.Suspense>
					) : tab === 'linechart' ? (
						<React.Suspense fallback={<div className="h-[533px]" />}>
							<MultiSeriesChart
								dataset={deferredChartData.dataset}
								charts={deferredChartData.lineCharts}
								valueSymbol={chartValueSymbol}
								height="533px"
								solidChartAreaStyle={false}
								chartOptions={lineChartOptions}
								tooltipMaxItems={30}
								exportButtons="hidden"
								onReady={onChartReady}
							/>
						</React.Suspense>
					) : (
						<React.Suspense fallback={<div className="h-[533px]" />}>
							<TreemapChart treeData={treemapTreeData} variant="narrative" height="533px" />
						</React.Suspense>
					)}
				</div>
			</div>

			<TableWithSearch
				data={sortedPctChanges}
				columns={isCoinPage ? CoinPerformanceColumn : CategoryPerformanceColumn}
				columnToSearch={'name'}
				placeholder={'Search...'}
				header="Categories"
				csvFileName={isCoinPage ? 'narrative-tracker-coin' : 'narrative-tracker-category'}
				sortingState={DEFAULT_SORTING_STATE}
			/>
		</>
	)
}

const CoinPerformanceColumn = [
	columnHelper.accessor('name', {
		header: 'Coin',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<BasicLink
						href={`https://www.coingecko.com/en/coins/${row.original.id}`}
						target="_blank"
						className="truncate text-sm font-medium text-link hover:underline"
					>
						{getValue()}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor('change', {
		header: 'Δ%',
		cell: ({ getValue }) => <PercentChange percent={getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: `Shows how a coin has performed over your chosen time period and in your selected denomination (e.g., $, BTC).`
		}
	}),
	columnHelper.accessor('mcap', {
		header: 'Market Cap',
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('volume1D', {
		header: '24h Volume',
		cell: ({ getValue }) => {
			const value = getValue()
			return <>{value != null ? formattedNum(value, true) : null}</>
		},
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	})
]

const CategoryPerformanceColumn = [
	columnHelper.accessor('name', {
		header: 'Category',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					{['bitcoin', 'ethereum', 'solana'].includes(row.original.id) ? (
						<BasicLink
							href={`https://www.coingecko.com/en/coins/${row.original.id}`}
							target="_blank"
							className="truncate text-sm font-medium text-link hover:underline"
						>
							{getValue()}
						</BasicLink>
					) : (
						<BasicLink
							href={`/narrative-tracker/${row.original.id}`}
							className="truncate text-sm font-medium text-link hover:underline"
						>
							{getValue()}
						</BasicLink>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor('change', {
		header: 'Δ%',
		cell: ({ getValue }) => <PercentChange percent={getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: `Shows how a category of coins has performed over your chosen time period and in your selected denomination (e.g., $, BTC). Method: 1. calculating the percentage change for each individual coin in the category. 2. weighting these changes based on each coin's market capitalization. 3. averaging these weighted changes to get the overall category performance.`
		}
	}),
	columnHelper.accessor('mcap', {
		header: 'Market Cap',
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('volume1D', {
		header: '24h Volume',
		cell: (info) => (info.getValue() != null ? formattedNum(info.getValue(), true) : null),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('nbCoins', {
		header: '# of Coins',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	})
]
