import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { buildSelectedPercentageChart } from '~/components/ECharts/MultiSeriesChart/selection'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useAllSeriesSelection, useSeriesSelection } from '~/hooks/useSeriesSelection'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingDots } from '~/ui/Loaders'
import { Panel } from '~/ui/Panel'
import { PanelStatus } from '~/ui/Status'
import { slug } from '~/utils'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
import { getEnabledForkOracleExtraTvlChartApiKeys } from '~/utils/tvlOverlap'
import { buildForksOverviewDisplayData, mergeForkOverviewChartData } from './overviewData'
import { useForksOverviewExtraSeries } from './queries.client'
import type { ForkOverviewPageData } from './types'

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart'))

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const columnHelper = createColumnHelper<ReturnType<typeof buildForksOverviewDisplayData>['tableData'][number]>()

const forksColumn = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const name = getValue()
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${name}`} />
					<span className="flex items-center gap-1 overflow-hidden">
						<BasicLink
							href={`/forks/${slug(name)}`}
							className="min-w-0 truncate text-sm font-medium text-link hover:underline"
						>
							{name}
						</BasicLink>
						{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
					</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor('forkedProtocols', {
		header: 'Forked Protocols',
		meta: {
			headerClassName: 'w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('tvl', {
		header: 'Forks TVL',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('ftot', {
		header: 'Forks TVL / Original TVL',
		cell: (info) =>
			info.getValue() != null
				? `${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
				: null,
		meta: {
			headerClassName: 'w-[min(210px,40vw)]',
			align: 'end'
		}
	})
]

const DEFAULT_SORTING_STATE = [{ id: 'tvl', desc: true }]

export const ForksOverview = ({
	forks,
	forkLinks,
	forkColors,
	tableData: baseTableData,
	chartData
}: ForkOverviewPageData) => {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const enabledExtraApiKeys = React.useMemo(
		() => getEnabledForkOracleExtraTvlChartApiKeys(extraTvlsEnabled),
		[extraTvlsEnabled]
	)
	const { isFetchingExtraSeries, extraBreakdownByTimestamp } = useForksOverviewExtraSeries({
		enabledExtraApiKeys
	})

	const shouldApplyExtraSeries = enabledExtraApiKeys.length > 0 && !isFetchingExtraSeries

	const mergedChartData = React.useMemo(() => {
		return mergeForkOverviewChartData({ chartData, extraBreakdownByTimestamp, shouldApplyExtraSeries })
	}, [chartData, extraBreakdownByTimestamp, shouldApplyExtraSeries])

	const { tableData, pieSeries, dominanceDataset, dominanceCharts, chartColors } = React.useMemo(() => {
		return buildForksOverviewDisplayData({ forks, forkColors, baseTableData, chartData: mergedChartData })
	}, [baseTableData, forkColors, forks, mergedChartData])

	const isLoading = enabledExtraApiKeys.length > 0 && isFetchingExtraSeries
	const forkSeries = React.useMemo(() => dominanceCharts.map((chart) => chart.name), [dominanceCharts])
	const pieSelectableSeries = React.useMemo(() => pieSeries.peers.map((peer) => peer.name), [pieSeries.peers])
	const { activeSeries, selectedCharts, setSelectedSeries } = useSeriesSelection({ availableSeries: forkSeries })
	const selectedDominance = React.useMemo(
		() =>
			buildSelectedPercentageChart({
				dataset: dominanceDataset,
				charts: dominanceCharts,
				selectedCharts,
				missingValuePolicy: 'sum-available'
			}),
		[dominanceCharts, dominanceDataset, selectedCharts]
	)
	const {
		activeSeries: activePieSeries,
		selectedCharts: selectedPieSeries,
		setSelectedSeries: setSelectedPieSeries,
		includeUpstreamOthers: includePieUpstreamOthers
	} = useAllSeriesSelection({
		availableSeries: pieSelectableSeries,
		selectionKey: 'fork-pie'
	})
	const visibleTokenTvls = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: pieSeries,
				selectedSeries: selectedPieSeries,
				includeUpstreamOthers: includePieUpstreamOthers
			}).chartData,
		[includePieUpstreamOthers, pieSeries, selectedPieSeries]
	)
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const { chartInstance: pieChartInstance, handleChartReady: handlePieChartReady } = useGetChartInstance()
	return (
		<>
			<RowLinksWithDropdown links={forkLinks} activeLink="All" />
			{isLoading ? (
				<PanelStatus variant="loading" textClassName="flex items-center gap-1">
					Loading
					<LoadingDots />
				</PanelStatus>
			) : (
				<>
					<div className="flex flex-col gap-2 xl:flex-row">
						<ChartPanel className="isolate flex-1">
							<ChartPanelToolbar className="justify-end">
								{pieSelectableSeries.length > 1 ? (
									<SelectWithCombobox
										allValues={pieSelectableSeries}
										selectedValues={activePieSeries}
										setSelectedValues={setSelectedPieSeries}
										label="Fork"
										labelType="smol"
										variant="filter"
										size="md"
									/>
								) : null}
								<ChartExportButtons
									chartInstance={pieChartInstance}
									filename="forks-tvl-pie"
									title="Forks TVL Breakdown"
									csvSource={{
										type: 'prepare-dataset',
										prepare: () => buildRuntimePieChartCsvDataset(pieSeries)
									}}
								/>
							</ChartPanelToolbar>
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<PieChart chartData={visibleTokenTvls} stackColors={chartColors} onReady={handlePieChartReady} />
							</React.Suspense>
						</ChartPanel>
						<ChartPanel className="flex-1">
							<ChartPanelToolbar className="justify-end">
								<h2 className="mr-auto heading-xs">Forks TVL Dominance (%)</h2>
								{forkSeries.length > 1 ? (
									<SelectWithCombobox
										allValues={forkSeries}
										selectedValues={activeSeries}
										setSelectedValues={setSelectedSeries}
										label="Fork"
										labelType="smol"
										variant="filter"
										size="md"
									/>
								) : null}
								<ChartExportButtons
									chartInstance={chartInstance}
									filename="forks-dominance-chart"
									title="Forks TVL Dominance (%)"
									csvSource={selectedDominance.csvSource}
								/>
							</ChartPanelToolbar>
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<MultiSeriesChart
									dataset={selectedDominance.dataset}
									charts={selectedDominance.charts}
									csvSource={selectedDominance.csvSource}
									stacked={true}
									expandTo100Percent={true}
									hideDefaultLegend
									valueSymbol="%"
									onReady={handleChartReady}
								/>
							</React.Suspense>
						</ChartPanel>
					</div>
					<React.Suspense fallback={<Panel padding="none" style={{ minHeight: `${tableData.length * 50 + 200}px` }} />}>
						<TableWithSearch
							data={tableData}
							columns={forksColumn}
							placeholder="Search protocols..."
							columnToSearch="name"
							header="Protocol Rankings"
							headingAs="h1"
							csvFileName="forks-overview"
							sortingState={DEFAULT_SORTING_STATE}
						/>
					</React.Suspense>
				</>
			)}
		</>
	)
}
