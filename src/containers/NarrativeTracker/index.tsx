import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { selectChartDatasetColumns } from '~/components/ECharts/MultiSeriesChart/selection'
import type { IMultiSeriesChartProps, MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { useLocalSelection } from '~/components/Select/localSelection'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { ChartPanelBody, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { formatUsd } from '~/utils/numberFormat'
import {
	editVisibleSelection,
	buildNarrativeTreemapTreeData,
	calculateDenominatedChange,
	calculateDenominatedTimeSeries,
	filterNarrativeTreemapTreeData
} from './chartData'
import type { CategoryPerformanceProps, IPctChangeRow } from './types'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>
const TreemapChart = React.lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>

const DEFAULT_SORTING_STATE = [{ id: 'change', desc: true }]
const MAX_VISIBLE_TIME_SERIES = 30
const columnHelper = createColumnHelper<SearchTableFeatures, IPctChangeRow>()

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
const EMPTY_SERIES: Array<string> = []

type NarrativeChartType = 'linechart' | 'barchart' | 'heatmap'
const NARRATIVE_CHART_TYPE_OPTIONS: ReadonlyArray<{ value: NarrativeChartType; label: string }> = [
	{ value: 'linechart', label: 'Linechart' },
	{ value: 'barchart', label: 'Barchart' },
	{ value: 'heatmap', label: 'Heatmap' }
]

export function CategoryPerformanceContainer({
	pctChanges,
	performanceTimeSeries,
	areaChartLegend,
	isCoinPage,
	categoryName
}: CategoryPerformanceProps) {
	const [chartType, setChartType] = React.useState<NarrativeChartType>('linechart')
	const [groupBy, setGroupBy] = React.useState<Period>('30D')
	const [groupByDenom, setGroupByDenom] = React.useState<Denom>('$')

	const availableSeries = areaChartLegend ?? EMPTY_SERIES
	const { activeSeries: selectedSeries, setSelectedSeries } = useLocalSelection({
		scope: `narrative-${categoryName ?? 'all'}`,
		availableSeries,
		allowEmptySelection: true
	})
	const displayedSelectedSeries = React.useMemo(
		() => (chartType === 'heatmap' ? selectedSeries : selectedSeries.slice(0, MAX_VISIBLE_TIME_SERIES)),
		[selectedSeries, chartType]
	)
	const setBoundedSelectedSeries = React.useCallback(
		(values: Array<string>) => {
			if (chartType === 'heatmap') {
				setSelectedSeries(values)
				return
			}
			setSelectedSeries(editVisibleSelection(selectedSeries, values, MAX_VISIBLE_TIME_SERIES))
		},
		[selectedSeries, setSelectedSeries, chartType]
	)
	const displayedSelectedCharts = React.useMemo(() => new Set(displayedSelectedSeries), [displayedSelectedSeries])

	const disabledDenoms = React.useMemo(() => {
		const { field, seriesKey } = PERIOD_CONFIG[groupBy]
		const series = performanceTimeSeries?.[seriesKey] ?? []
		const timeSeriesDenoms = new Set<string>()
		const pctDenoms = new Set<string>()

		for (const row of series) {
			for (const coinName of DENOM_COIN_NAMES) {
				if (row[coinName] != null && row[coinName] !== -100) {
					timeSeriesDenoms.add(coinName)
				}
			}
		}

		for (const row of pctChanges) {
			if (row[field] != null && row[field] !== -100 && DENOM_COIN_NAME_SET.has(row.name)) {
				pctDenoms.add(row.name)
			}
		}

		const disabled: Array<Denom> = []
		for (const denom of DENOMS) {
			if (denom === '$') continue
			const coinName = DENOM_COIN_MAP[denom]
			if (!timeSeriesDenoms.has(coinName) || !pctDenoms.has(coinName)) disabled.push(denom)
		}
		return disabled
	}, [groupBy, performanceTimeSeries, pctChanges])

	// All values here are returns / relative returns expressed in percent.
	const chartValueSymbol = '%'

	// Keep axis on the right like before; avoid `yAxis.name` because it renders
	// at the top of the axis and can get clipped by the chart container.
	const barChartOptions = BAR_CHART_OPTIONS
	const lineChartOptions = LINE_CHART_OPTIONS

	const { sortedPctChanges, timeSeries } = React.useMemo(() => {
		const { field, seriesKey } = PERIOD_CONFIG[groupBy]
		const denomCoin = DENOM_COIN_MAP[groupByDenom]

		let pctChangesDenom = calculateDenominatedChange(pctChanges, denomCoin, field)
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
		chart = calculateDenominatedTimeSeries(chart, denomCoin)

		return { sortedPctChanges: sorted, timeSeries: chart }
	}, [pctChanges, groupBy, performanceTimeSeries, groupByDenom, isCoinPage])

	const dataset = React.useMemo(() => {
		const seriesKeys = availableSeries
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
	}, [timeSeries, availableSeries])
	const canonicalColorIndex = React.useMemo(
		() => new Map(availableSeries.map((name, index) => [name, index])),
		[availableSeries]
	)

	const lineCharts = React.useMemo(() => {
		const seriesKeys = availableSeries
		return seriesKeys.map((name, index) => ({
			type: 'line' as const,
			name,
			encode: { x: 0, y: index + 1 },
			// Keep colors stable across tabs.
			color: CHART_COLORS[(canonicalColorIndex.get(name) ?? index) % CHART_COLORS.length],
			yAxisIndex: undefined,
			large: true
		}))
	}, [availableSeries, canonicalColorIndex])

	const barCharts = React.useMemo(() => {
		const seriesKeys = availableSeries
		return seriesKeys.map((name, index) => ({
			type: 'bar' as const,
			name,
			encode: { x: 0, y: index + 1 },
			color: CHART_COLORS[(canonicalColorIndex.get(name) ?? index) % CHART_COLORS.length],
			stack: 'A',
			large: false
		}))
	}, [availableSeries, canonicalColorIndex])
	const chartDataBundle = React.useMemo(() => ({ dataset, barCharts, lineCharts }), [dataset, barCharts, lineCharts])
	const deferredChartData = React.useDeferredValue(chartDataBundle)

	const canonicalTreemapTreeData = React.useMemo(
		() =>
			chartType === 'heatmap' ? buildNarrativeTreemapTreeData(sortedPctChanges, PERIOD_CONFIG[groupBy].field) : [],
		[groupBy, sortedPctChanges, chartType]
	)
	const treemapTreeData = React.useMemo(
		() => filterNarrativeTreemapTreeData(canonicalTreemapTreeData, displayedSelectedCharts),
		[canonicalTreemapTreeData, displayedSelectedCharts]
	)

	const { chartInstance: exportChartInstance, handleChartReady: onChartReady } = useGetChartInstance()

	return (
		<>
			<Card padding="base" className="flex flex-col gap-3">
				{isCoinPage && categoryName ? <h1 className="heading-sm">Category: {categoryName ?? ''}</h1> : null}
				<p className="body-md text-secondary">
					Market-cap-weighted category performance: Shows how a category of coins has performed over your chosen time
					period and in your selected denomination (e.g., $, BTC). Method: 1. calculating the percentage change for each
					individual coin in the category. 2. weighting these changes based on each coin's market capitalization. 3.
					averaging these weighted changes to get the overall category performance. Stablecoins are excluded from sector
					baskets.
				</p>
				{disabledDenoms.includes(groupByDenom) ? (
					<p role="status" className="body-md text-secondary">
						{groupByDenom} benchmark data is unavailable for this period. Relative returns are shown only where
						benchmark data exists.
					</p>
				) : null}
			</Card>

			<Panel>
				<ChartPanelToolbar
					leading={
						<SegmentedControl<NarrativeChartType>
							value={chartType}
							onValueChange={setChartType}
							options={NARRATIVE_CHART_TYPE_OPTIONS}
							label="Chart type"
							variant="default"
							size="md"
						/>
					}
				>
					<SegmentedControl
						variant="default"
						size="md"
						label="Period"
						options={PERIODS.map((value) => ({ value, label: value }))}
						value={groupBy}
						onValueChange={(val) => setGroupBy(val)}
					/>
					<SegmentedControl
						variant="default"
						size="md"
						options={DENOMS.map((value) => ({ value, label: value, disabled: disabledDenoms.includes(value) }))}
						value={groupByDenom}
						onValueChange={(val) => setGroupByDenom(val)}
						label="Denom (vs)"
						leading="Denom (vs):"
					/>
					{availableSeries.length > 1 ? (
						<SelectWithCombobox
							allValues={availableSeries}
							selectedValues={displayedSelectedSeries}
							setSelectedValues={setBoundedSelectedSeries}
							label={isCoinPage ? 'Coin' : 'Category'}
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={exportChartInstance}
						showCsv={chartType !== 'heatmap'}
						filename={`category-performance-${chartType}`}
						title={`Category Performance ${chartType}`}
						csvSource={{
							type: 'dataset',
							prepare: () =>
								selectChartDatasetColumns(
									deferredChartData.dataset,
									(chartType === 'barchart' ? deferredChartData.barCharts : deferredChartData.lineCharts).filter(
										(chart) => displayedSelectedCharts.has(chart.name)
									)
								)
						}}
					/>
				</ChartPanelToolbar>

				<ChartPanelBody className="min-h-[533px]">
					<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[533px]" />}>
						{chartType === 'barchart' ? (
							<MultiSeriesChart
								dataset={deferredChartData.dataset}
								charts={deferredChartData.barCharts}
								selectedCharts={displayedSelectedCharts}
								valueSymbol={chartValueSymbol}
								containerClassName="min-h-[533px]"
								hideDataZoom={false}
								chartOptions={barChartOptions}
								exportButtons="hidden"
								onReady={onChartReady}
							/>
						) : chartType === 'linechart' ? (
							<MultiSeriesChart
								dataset={deferredChartData.dataset}
								charts={deferredChartData.lineCharts}
								selectedCharts={displayedSelectedCharts}
								valueSymbol={chartValueSymbol}
								containerClassName="min-h-[533px]"
								solidChartAreaStyle={false}
								chartOptions={lineChartOptions}
								tooltipMaxItems={30}
								exportButtons="hidden"
								onReady={onChartReady}
							/>
						) : (
							<TreemapChart
								treeData={treemapTreeData}
								variant="narrative"
								containerClassName="min-h-[533px]"
								onReady={onChartReady}
							/>
						)}
					</React.Suspense>
				</ChartPanelBody>
			</Panel>

			<SearchTableProvider
				options={{
					data: sortedPctChanges,
					columns: isCoinPage ? CoinPerformanceColumn : CategoryPerformanceColumn,
					initialState: { sorting: DEFAULT_SORTING_STATE }
				}}
			>
				<Card padding="none">
					<TableToolbar>
						<h2 className="mr-auto label-md">Categories</h2>
						<TableSearchInput columnId="name" placeholder="Search…" width="inline" />
						<TableCsvExport filename={isCoinPage ? 'narrative-tracker-coin' : 'narrative-tracker-category'} />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</>
	)
}

const CoinPerformanceColumn = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Coin',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TextLink href={`https://www.coingecko.com/en/coins/${row.original.id}`} target="_blank" truncate>
						{getValue()}
					</TextLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.change ?? undefined, {
		id: 'change',
		header: 'Δ%',
		cell: ({ getValue }) => <Change value={getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: `Shows how a coin has performed over your chosen time period and in your selected denomination (e.g., $, BTC).`
		}
	}),
	columnHelper.accessor((row) => row.mcap ?? undefined, {
		id: 'mcap',
		header: 'Market Cap',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.volume1D ?? undefined, {
		id: 'volume1D',
		header: '24h Volume',
		cell: ({ getValue }) => {
			const value = getValue()
			return (
				<>
					{value != null
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null}
				</>
			)
		},
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	})
])

const CategoryPerformanceColumn = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Category',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					{['bitcoin', 'ethereum', 'solana'].includes(row.original.id) ? (
						<TextLink href={`https://www.coingecko.com/en/coins/${row.original.id}`} target="_blank" truncate>
							{getValue()}
						</TextLink>
					) : (
						<TextLink href={`/narrative-tracker/${row.original.id}`} truncate>
							{getValue()}
						</TextLink>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.change ?? undefined, {
		id: 'change',
		header: 'Δ%',
		cell: ({ getValue }) => <Change value={getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: `Shows how a category of coins has performed over your chosen time period and in your selected denomination (e.g., $, BTC). Method: 1. calculating the percentage change for each individual coin in the category. 2. weighting these changes based on each coin's market capitalization. 3. averaging these weighted changes to get the overall category performance.`
		}
	}),
	columnHelper.accessor((row) => row.mcap ?? undefined, {
		id: 'mcap',
		header: 'Market Cap',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.volume1D ?? undefined, {
		id: 'volume1D',
		header: '24h Volume',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.nbCoins ?? undefined, {
		id: 'nbCoins',
		header: '# of Coins',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	})
])
