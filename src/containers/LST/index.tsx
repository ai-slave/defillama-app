import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import {
	buildSelectedAdditiveChart,
	buildSelectedPercentageChart,
	buildSelectedSeriesCsv
} from '~/components/ECharts/MultiSeriesChart/selection'
import { createInflowsTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useAllSeriesSelection, useSeriesSelection } from '~/hooks/useSeriesSelection'
import { Card } from '~/ui/Card'
import { ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { PercentChange } from '~/ui/PercentChange'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { formatRatio, formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { buildActiveLstChartData } from './chartData'
import type { ILSTTokenRow, LSTOverviewProps } from './types'

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const DEFAULT_SORTING_STATE = [{ id: 'stakedEth', desc: true }]

const ETHPegTooltipContent = ({ marketRate, expectedRate }: { marketRate: number; expectedRate: number }) => {
	return (
		<span className="flex flex-col gap-1">
			<span>{`Market Rate: ${formatRatio(marketRate, { maximumFractionDigits: 4 })}`}</span>
			<span>{`Expected Rate: ${formatRatio(expectedRate, { maximumFractionDigits: 4 })}`}</span>
		</span>
	)
}

const columnHelper = createColumnHelper<ILSTTokenRow>()

const LST_COLUMNS = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const nameSlug = row.original.name.replace(/\s+/g, '-').toLowerCase()

			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo src={row.original.logo} alt={`Logo of ${row.original.name}`} data-lgonly />
					<span className="flex items-center gap-1 overflow-hidden">
						<BasicLink
							href={`/protocol/${nameSlug}`}
							className="min-w-0 truncate text-sm font-medium text-link hover:underline"
						>
							{getValue()}
						</BasicLink>
						{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
					</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(280px,40vw)]'
		}
	}),
	columnHelper.accessor('stakedEth', {
		header: 'Staked ETH',
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('stakedEthInUsd', {
		header: 'TVL',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('stakedEthPctChange7d', {
		header: '7d Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('stakedEthPctChange30d', {
		header: '30d Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('marketShare', {
		header: 'Market Share',
		cell: ({ getValue }) => {
			const value = getValue()
			return (
				<>
					{value != null
						? formatPercent(value, {
								input: 'percent',
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
								useGrouping: false
							})
						: null}
				</>
			)
		},
		meta: {
			headerClassName: 'w-[125px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('lsdSymbol', {
		header: 'LST',
		cell: ({ getValue, row }) => {
			const symbol = getValue() ?? ''
			if (!row.original.pegInfo) return symbol
			return (
				<span className="flex items-center justify-end gap-1">
					<QuestionHelper text={row.original.pegInfo} />
					{symbol}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('ethPeg', {
		header: 'ETH Peg',
		cell: ({ getValue, row }) => {
			const value = getValue()
			if (value == null) return null
			return (
				<Tooltip
					content={
						<ETHPegTooltipContent
							marketRate={row.original.marketRate ?? 0}
							expectedRate={row.original.expectedRate ?? 0}
						/>
					}
					className="justify-end"
				>
					<PercentChange percent={value} />
				</Tooltip>
			)
		},
		meta: {
			headerClassName: 'w-[115px]',
			align: 'end',
			headerHelperText:
				'Market Rate (pulled from 1inch) divided by Expected Rate. Hover for Market Rate and Expected Rate Info.'
		}
	}),
	columnHelper.accessor('mcapOverTvl', {
		header: 'Mcap/TVL',
		cell: ({ getValue }) => formatRatio(getValue()),
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end',
			headerHelperText: 'Market cap / TVL ratio'
		}
	}),
	columnHelper.accessor('apy', {
		header: 'Supply APY',
		cell: (info) =>
			info.getValue() != null
				? `${formatPercent(info.getValue(), { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
				: null,
		meta: {
			headerClassName: 'w-[130px]',
			align: 'end',
			headerHelperText: 'Annualized staking reward rate of the LST'
		}
	}),
	columnHelper.accessor('fee', {
		header: 'Fee',
		cell: (info) =>
			info.getValue() != null
				? `${formatPercent(info.getValue(), { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
				: null,
		meta: {
			headerClassName: 'w-[90px]',
			align: 'end',
			headerHelperText: 'Share of staking rewards taken by the protocol'
		}
	})
]

export const LSTOverview = ({
	areaChartData,
	pieSeries,
	tokensList,
	tokens,
	stakedEthSum,
	stakedEthInUsdSum,
	lsdColors,
	inflowsChartData,
	barChartStacks
}: LSTOverviewProps) => {
	const [tab, setTab] = React.useState('breakdown')
	const [groupBy, setGroupBy] = React.useState<LowercaseDwmcGrouping>('weekly')
	const {
		activeSeries: selectedBreakdownTokens,
		selectedCharts: selectedBreakdownTokensSet,
		setSelectedSeries: setSelectedBreakdownTokens
	} = useSeriesSelection({ availableSeries: tokens, selectionKey: 'breakdown' })
	const {
		activeSeries: selectedInflowTokens,
		selectedCharts: selectedInflowTokensSet,
		setSelectedSeries: setSelectedInflowTokens
	} = useSeriesSelection({ availableSeries: tokens, selectionKey: 'inflows' })
	const pieSelectableSeries = React.useMemo(() => pieSeries.peers.map((peer) => peer.name), [pieSeries.peers])
	const {
		activeSeries: selectedPieTokens,
		selectedCharts: selectedPieTokensSet,
		setSelectedSeries: setSelectedPieTokens,
		includeUpstreamOthers: includePieUpstreamOthers
	} = useAllSeriesSelection({
		availableSeries: pieSelectableSeries,
		selectionKey: 'breakdown-pie'
	})
	const visiblePieChartData = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: pieSeries,
				selectedSeries: selectedPieTokensSet,
				includeUpstreamOthers: includePieUpstreamOthers
			}).chartData,
		[includePieUpstreamOthers, pieSeries, selectedPieTokensSet]
	)
	const inflowsTooltipFormatter = React.useMemo(() => {
		return createInflowsTooltipFormatter({ groupBy, valueSymbol: 'ETH' })
	}, [groupBy])

	const { chartInstance: breakdownChartInstance, handleChartReady: handleBreakdownReady } = useGetChartInstance()
	const { chartInstance: inflowsChartInstance, handleChartReady: handleInflowsReady } = useGetChartInstance()
	const { chartInstance: pieChartInstance, handleChartReady: handlePieReady } = useGetChartInstance()

	const breakdownExportFilenameBase = 'lst-breakdown-dominance'
	const breakdownExportTitle = 'LST Breakdown (Dominance)'
	const inflowsExportFilenameBase = 'lst-inflows'
	const inflowsExportTitle = 'LST Inflows'

	const activeChartData = React.useMemo(
		() =>
			buildActiveLstChartData({
				view: tab === 'inflows' ? 'inflows' : 'breakdown',
				areaChartData,
				inflowsChartData,
				groupBy,
				tokens,
				lsdColors,
				barChartStacks
			}),
		[areaChartData, barChartStacks, groupBy, inflowsChartData, lsdColors, tab, tokens]
	)
	const deferredPieChartData = React.useDeferredValue(visiblePieChartData)
	const deferredActiveChartData = React.useDeferredValue(activeChartData)
	const renderedActiveChartData = deferredActiveChartData.kind === tab ? deferredActiveChartData : activeChartData
	const selectedBreakdownPresentation = React.useMemo(
		() =>
			renderedActiveChartData.kind === 'breakdown'
				? buildSelectedPercentageChart({
						dataset: renderedActiveChartData.data.dataset,
						charts: renderedActiveChartData.data.charts,
						selectedCharts: selectedBreakdownTokensSet
					})
				: null,
		[renderedActiveChartData, selectedBreakdownTokensSet]
	)
	const selectedInflowsPresentation = React.useMemo(
		() =>
			renderedActiveChartData.kind === 'inflows'
				? buildSelectedAdditiveChart({
						dataset: renderedActiveChartData.data.dataset,
						charts:
							groupBy === 'cumulative'
								? renderedActiveChartData.data.cumulativeCharts
								: renderedActiveChartData.data.barCharts,
						seriesOrder: tokens,
						selectedCharts: selectedInflowTokensSet
					})
				: null,
		[groupBy, renderedActiveChartData, selectedInflowTokensSet, tokens]
	)

	return (
		<>
			<Card as="header" padding="sm" className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="heading-sm">Total Value Locked ETH LSTs</h1>
				<span className="font-jetbrains">{`${formatCompactNumber(stakedEthSum, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} ETH (${formatUsd(stakedEthInUsdSum, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })})`}</span>
			</Card>

			<Card padding="none" className="flex w-full flex-col">
				<div className="flex flex-wrap overflow-x-auto border-b border-medium">
					<button
						className="border-medium px-6 py-2 label-md whitespace-nowrap text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary data-[selected=true]:border-b data-[selected=true]:border-b-brand data-[selected=true]:text-primary"
						onClick={() => setTab('breakdown')}
						data-selected={tab === 'breakdown'}
					>
						Breakdown
					</button>
					<button
						className="border-l border-medium px-6 py-2 label-md whitespace-nowrap text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary data-[selected=true]:border-b data-[selected=true]:border-b-brand data-[selected=true]:text-primary"
						onClick={() => setTab('inflows')}
						data-selected={tab === 'inflows'}
					>
						Inflows
					</button>
				</div>

				<div className="flex flex-col">
					{tab === 'breakdown' ? (
						<div className="grid grid-cols-1 gap-2 pt-2 xl:grid-cols-2">
							<div className="flex flex-col">
								<ChartPanelToolbar className="justify-end">
									{pieSelectableSeries.length > 1 ? (
										<SelectWithCombobox
											allValues={pieSelectableSeries}
											selectedValues={selectedPieTokens}
											setSelectedValues={setSelectedPieTokens}
											label="LST"
											labelType="smol"
											variant="filter"
											size="md"
										/>
									) : null}
									<ChartExportButtons chartInstance={pieChartInstance} filename="lst-breakdown" title="LST Breakdown" />
								</ChartPanelToolbar>
								<React.Suspense fallback={<ChartPanelBodyFallback />}>
									<PieChart chartData={deferredPieChartData} stackColors={lsdColors} onReady={handlePieReady} />
								</React.Suspense>
							</div>
							<div className="flex flex-col">
								<div className="flex items-center justify-end gap-2 px-2">
									{tokens.length > 1 ? (
										<SelectWithCombobox
											allValues={tokens}
											selectedValues={selectedBreakdownTokens}
											setSelectedValues={setSelectedBreakdownTokens}
											label="LST"
											labelType="smol"
											variant="filter"
											size="md"
										/>
									) : null}
									<ChartExportButtons
										chartInstance={breakdownChartInstance}
										filename={breakdownExportFilenameBase}
										title={breakdownExportTitle}
										prepareCsvDirect={
											renderedActiveChartData.kind === 'breakdown'
												? () =>
														buildSelectedSeriesCsv({
															dataset: selectedBreakdownPresentation!.dataset,
															charts: selectedBreakdownPresentation!.charts,
															selectedCharts: new Set(selectedBreakdownTokens),
															filename: breakdownExportFilenameBase
														})
												: undefined
										}
									/>
								</div>
								<React.Suspense fallback={<ChartPanelBodyFallback />}>
									<MultiSeriesChart
										dataset={selectedBreakdownPresentation?.dataset}
										charts={selectedBreakdownPresentation?.charts}
										stacked={true}
										expandTo100Percent={true}
										hideDefaultLegend
										valueSymbol="%"
										onReady={handleBreakdownReady}
									/>
								</React.Suspense>
							</div>
						</div>
					) : (
						<div className="flex flex-col">
							<div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto p-2 pb-0">
								<ChartGroupingSelector
									value={groupBy}
									setValue={setGroupBy}
									options={DWMC_GROUPING_OPTIONS_LOWERCASE}
									className="mr-auto shrink-0"
								/>
								{tokens.length > 1 ? (
									<SelectWithCombobox
										allValues={tokens}
										selectedValues={selectedInflowTokens}
										setSelectedValues={setSelectedInflowTokens}
										label={groupBy === 'cumulative' ? 'LST' : 'Protocol'}
										labelType="smol"
										variant="filter"
										size="md"
									/>
								) : null}
								<ChartExportButtons
									chartInstance={inflowsChartInstance}
									filename={inflowsExportFilenameBase}
									title={inflowsExportTitle}
									prepareCsvDirect={
										renderedActiveChartData.kind === 'inflows'
											? () =>
													buildSelectedSeriesCsv({
														dataset: selectedInflowsPresentation!.dataset,
														charts: selectedInflowsPresentation!.charts,
														selectedCharts: new Set(selectedInflowsPresentation!.charts.map((chart) => chart.name)),
														filename: inflowsExportFilenameBase
													})
											: undefined
									}
								/>
							</div>

							{groupBy === 'cumulative' ? (
								<React.Suspense fallback={<ChartPanelBodyFallback />}>
									<MultiSeriesChart
										dataset={selectedInflowsPresentation?.dataset}
										charts={selectedInflowsPresentation?.charts}
										hideDefaultLegend
										groupBy={groupBy}
										valueSymbol="ETH"
										showTotalInTooltip
										chartOptions={
											selectedInflowTokens.length > 1 ? { tooltip: { formatter: inflowsTooltipFormatter } } : undefined
										}
										onReady={handleInflowsReady}
									/>
								</React.Suspense>
							) : (
								<React.Suspense fallback={<ChartPanelBodyFallback />}>
									<MultiSeriesChart
										dataset={selectedInflowsPresentation?.dataset}
										charts={selectedInflowsPresentation?.charts}
										hideDefaultLegend
										groupBy={groupBy}
										valueSymbol="ETH"
										showTotalInTooltip
										chartOptions={
											selectedInflowTokens.length > 1 ? { tooltip: { formatter: inflowsTooltipFormatter } } : undefined
										}
										onReady={handleInflowsReady}
									/>
								</React.Suspense>
							)}
						</div>
					)}
				</div>
			</Card>

			<TableWithSearch
				data={tokensList}
				columns={LST_COLUMNS}
				columnToSearch={'name'}
				placeholder={'Search protocols...'}
				header="Liquid Staking Protocols"
				csvFileName="liquid-staking"
				sortingState={DEFAULT_SORTING_STATE}
			/>
		</>
	)
}
