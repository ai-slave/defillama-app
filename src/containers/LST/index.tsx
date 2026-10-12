import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import {
	buildSelectedAdditiveChart,
	buildSelectedPercentageChart,
	selectChartDatasetColumns
} from '~/components/ECharts/MultiSeriesChart/selection'
import { createInflowsTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { useLocalSelection } from '~/components/Select/localSelection'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { ChartPanelBody, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Logo } from '~/ui/Logo'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { TabPanel, Tabs, UnderlineTabList } from '~/ui/Tabs'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { formatCompactNumber, formatPercent, formatPercentChange, formatRatio, formatUsd } from '~/utils/numberFormat'
import { buildActiveLstChartData } from './chartData'
import type { ILSTTokenRow, LSTOverviewProps } from './types'

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const DEFAULT_SORTING_STATE = [{ id: 'stakedEth', desc: true }]

const columnHelper = createColumnHelper<SearchTableFeatures, ILSTTokenRow>()

const LST_BASE_COLUMNS = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<Logo size={24} src={row.original.logo} alt={`Logo of ${row.original.name}`} data-lgonly />
					<span className="flex items-center gap-1 overflow-hidden">
						<TextLink href={`/protocol/${row.original.protocolSlug}`} truncate>
							{getValue()}
						</TextLink>
						{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
					</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(280px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.stakedEth ?? undefined, {
		id: 'stakedEth',
		header: 'Staked ETH',
		cell: (info) =>
			formatCompactNumber(info.getValue(), {
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Current amount of ETH represented by the provider’s tracked liquid staking deposits'
		}
	}),
	columnHelper.accessor((row) => row.stakedEthInUsd ?? undefined, {
		id: 'stakedEthInUsd',
		header: 'TVL',
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end',
			headerHelperText: 'Current USD value of the provider’s tracked staked ETH'
		}
	}),
	columnHelper.accessor((row) => row.stakedEthPctChange7d ?? undefined, {
		id: 'stakedEthPctChange7d',
		header: '7d Change',
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end',
			headerHelperText: 'Change in staked ETH from exactly 7 days before the latest observation'
		}
	}),
	columnHelper.accessor((row) => row.stakedEthPctChange30d ?? undefined, {
		id: 'stakedEthPctChange30d',
		header: '30d Change',
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Change in staked ETH from exactly 30 days before the latest observation'
		}
	}),
	columnHelper.accessor((row) => row.marketShare ?? undefined, {
		id: 'marketShare',
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
			align: 'end',
			headerHelperText: 'Share of current staked ETH across all providers shown in this table'
		}
	})
])

const LST_SYMBOL_COLUMN = columnHelper.accessor('lsdSymbol', {
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
		align: 'end',
		headerHelperText: 'Symbol of the liquid staking token tracked for peg and fee data'
	}
})

const LST_PEG_COLUMN = columnHelper.accessor((row) => row.ethPeg?.deviation ?? undefined, {
	id: 'ethPeg',
	header: 'ETH Peg',
	cell: ({ row }) => {
		const peg = row.original.ethPeg
		if (peg === null) return null
		return (
			<Tooltip
				content={
					<span className="flex flex-col gap-1">
						<span>{`Market Rate: ${formatRatio(peg.marketRate, { maximumFractionDigits: 4 })}`}</span>
						<span>{`Expected Rate: ${formatRatio(peg.expectedRate, { maximumFractionDigits: 4 })}`}</span>
					</span>
				}
				className="justify-end"
			>
				{formatPercentChange(peg.deviation)}
			</Tooltip>
		)
	},
	meta: {
		headerClassName: 'w-[115px]',
		align: 'end',
		headerHelperText:
			'Percentage deviation of the executable market rate from the contract-derived expected ETH redemption rate'
	}
})

const LST_MCAP_COLUMN = columnHelper.accessor((row) => row.mcapOverTvl ?? undefined, {
	id: 'mcapOverTvl',
	header: 'Mcap/TVL',
	cell: ({ getValue }) => formatRatio(getValue()),
	meta: {
		headerClassName: 'w-[110px]',
		align: 'end',
		headerHelperText: 'Protocol market capitalization divided by the USD value of its staked ETH'
	}
})

const LST_APY_COLUMN = columnHelper.accessor((row) => row.apy ?? undefined, {
	id: 'apy',
	header: 'Supply APY',
	cell: (info) =>
		info.getValue() != null
			? `${formatPercent(info.getValue(), { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
			: null,
	meta: {
		headerClassName: 'w-[130px]',
		align: 'end',
		headerHelperText: 'Current annualized staking yield of the selected Ethereum LST pool'
	}
})

const LST_FEE_COLUMN = columnHelper.accessor((row) => row.fee ?? undefined, {
	id: 'fee',
	header: 'Fee',
	cell: (info) =>
		info.getValue() != null
			? `${formatPercent(info.getValue(), { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
			: null,
	meta: {
		headerClassName: 'w-[90px]',
		align: 'end',
		headerHelperText: 'Percentage of staking rewards retained by the protocol'
	}
})

const LST_CORE_COLUMNS = [...LST_BASE_COLUMNS, LST_MCAP_COLUMN]
const LST_COLUMNS_WITH_APY = [...LST_BASE_COLUMNS, LST_MCAP_COLUMN, LST_APY_COLUMN]
const LST_COLUMNS_WITH_RATES = [...LST_BASE_COLUMNS, LST_SYMBOL_COLUMN, LST_PEG_COLUMN, LST_MCAP_COLUMN, LST_FEE_COLUMN]
const LST_COLUMNS_WITH_RATES_AND_APY = [
	...LST_BASE_COLUMNS,
	LST_SYMBOL_COLUMN,
	LST_PEG_COLUMN,
	LST_MCAP_COLUMN,
	LST_APY_COLUMN,
	LST_FEE_COLUMN
]

const LST_CHART_TABS = ['breakdown', 'inflows'] as const
type LstChartTab = (typeof LST_CHART_TABS)[number]

export function LSTOverview({
	areaChartData,
	pieSeries,
	tokensList,
	tokens,
	stakedEthSum,
	stakedEthInUsdSum,
	lsdColors,
	inflowsChartData,
	barChartStacks,
	ratesAvailable,
	apyAvailable
}: LSTOverviewProps) {
	const [tab, setTab] = React.useState<LstChartTab>('breakdown')
	const [groupBy, setGroupBy] = React.useState<LowercaseDwmcGrouping>('weekly')
	const {
		activeSeries: selectedBreakdownTokens,
		selectedCharts: selectedBreakdownTokensSet,
		setSelectedSeries: setSelectedBreakdownTokens
	} = useLocalSelection({
		availableSeries: tokens,
		scope: 'breakdown'
	})
	const {
		activeSeries: selectedInflowTokens,
		selectedCharts: selectedInflowTokensSet,
		setSelectedSeries: setSelectedInflowTokens
	} = useLocalSelection({ availableSeries: tokens, scope: 'inflows' })
	const pieSelectableSeries = React.useMemo(() => pieSeries.peers.map((peer) => peer.name), [pieSeries.peers])
	const {
		activeSeries: selectedPieTokens,
		selectedCharts: selectedPieTokensSet,
		setSelectedSeries: setSelectedPieTokens
	} = useLocalSelection({ allowEmptySelection: true, availableSeries: pieSelectableSeries, scope: 'breakdown-pie' })
	const piePresentation = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: pieSeries,
				selectedSeries: selectedPieTokensSet,
				colorByPeer: lsdColors
			}),
		[lsdColors, pieSeries, selectedPieTokensSet]
	)
	const breakdownChartExport = useGetChartInstance()
	const inflowsChartExport = useGetChartInstance()
	const pieChartExport = useGetChartInstance()
	const columns = ratesAvailable
		? apyAvailable
			? LST_COLUMNS_WITH_RATES_AND_APY
			: LST_COLUMNS_WITH_RATES
		: apyAvailable
			? LST_COLUMNS_WITH_APY
			: LST_CORE_COLUMNS

	const breakdownExportFilenameBase = 'lst-breakdown-dominance'
	const breakdownExportTitle = 'LST Breakdown (Dominance)'
	const inflowsExportFilenameBase = 'lst-inflows'
	const inflowsExportTitle = 'LST Inflows'

	const activeChartData = React.useMemo(
		() => ({
			...buildActiveLstChartData({
				view: tab === 'inflows' ? 'inflows' : 'breakdown',
				areaChartData,
				inflowsChartData,
				groupBy,
				tokens,
				lsdColors,
				barChartStacks
			}),
			// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
			groupBy
		}),
		[areaChartData, barChartStacks, groupBy, inflowsChartData, lsdColors, tab, tokens]
	)
	const deferredPiePresentation = React.useDeferredValue(piePresentation)
	const deferredActiveChartData = React.useDeferredValue(activeChartData)
	const renderedActiveChartData = deferredActiveChartData.kind === tab ? deferredActiveChartData : activeChartData
	const renderedGroupBy = renderedActiveChartData.groupBy
	const inflowsTooltipFormatter = React.useMemo(
		() => createInflowsTooltipFormatter({ groupBy: renderedGroupBy, valueSymbol: 'ETH' }),
		[renderedGroupBy]
	)
	// The panel branches on this kind, not on `tab` (they always match): the kind narrows the rows each chart draws.
	const chartPresentation = React.useMemo(
		() =>
			renderedActiveChartData.kind === 'breakdown'
				? {
						kind: 'breakdown' as const,
						...buildSelectedPercentageChart({
							dataset: renderedActiveChartData.data.dataset,
							charts: renderedActiveChartData.data.charts,
							selectedCharts: selectedBreakdownTokensSet,
							missingValuePolicy: 'sum-available'
						})
					}
				: {
						kind: 'inflows' as const,
						...buildSelectedAdditiveChart({
							dataset: renderedActiveChartData.data.dataset,
							charts:
								renderedGroupBy === 'cumulative'
									? renderedActiveChartData.data.cumulativeCharts
									: renderedActiveChartData.data.barCharts,
							seriesOrder: tokens,
							selectedCharts: selectedInflowTokensSet
						})
					},
		[renderedActiveChartData, renderedGroupBy, selectedBreakdownTokensSet, selectedInflowTokensSet, tokens]
	)

	return (
		<>
			<Card as="header" padding="sm" className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="heading-sm">Total Value Locked ETH LSTs</h1>
				<span className="mono-md">
					{formatCompactNumber(stakedEthSum, {
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}{' '}
					ETH (
					{formatUsd(stakedEthInUsdSum, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}) ?? '—'}
					)
				</span>
			</Card>

			<Card padding="none" className="flex w-full flex-col">
				<Tabs<LstChartTab> value={tab} values={LST_CHART_TABS} onValueChange={setTab}>
					<UnderlineTabList
						label="Chart view"
						tabs={[
							{ id: 'breakdown', label: 'Breakdown' },
							{ id: 'inflows', label: 'Inflows' }
						]}
					/>
					<TabPanel value={tab} className="flex flex-col">
						{chartPresentation.kind === 'breakdown' ? (
							<div className="grid grid-cols-1 gap-2 pt-2 xl:grid-cols-2">
								<div className="flex flex-col">
									<ChartPanelToolbar>
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
										<ChartExportButtons
											chart={pieChartExport}
											filename="lst-breakdown"
											title="LST breakdown"
											csvSource={{
												type: 'dataset',
												prepare: () =>
													buildRuntimePieChartCsvDataset({
														series: pieSeries,
														selectedSeries: selectedPieTokensSet
													})
											}}
										/>
									</ChartPanelToolbar>
									<ChartPanelBody>
										<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
											<PieChart
												exportButtons={pieChartExport}
												chartData={deferredPiePresentation.chartData}
												stackColors={deferredPiePresentation.stackColors}
											/>
										</React.Suspense>
									</ChartPanelBody>
								</div>
								<div className="flex flex-col">
									<ChartPanelToolbar>
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
											chart={breakdownChartExport}
											filename={breakdownExportFilenameBase}
											title={breakdownExportTitle}
											csvSource={chartPresentation.csvSource}
										/>
									</ChartPanelToolbar>
									<ChartPanelBody>
										<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
											<MultiSeriesChart
												exportButtons={breakdownChartExport}
												dataset={chartPresentation.dataset}
												charts={chartPresentation.charts}
												csvSource={chartPresentation.csvSource}
												stacked
												expandTo100Percent
												valueSymbol="%"
											/>
										</React.Suspense>
									</ChartPanelBody>
								</div>
							</div>
						) : (
							<div className="flex flex-col">
								<ChartPanelToolbar>
									<ChartGroupingSelector
										value={groupBy}
										setValue={setGroupBy}
										options={DWMC_GROUPING_OPTIONS_LOWERCASE}
										className="mr-auto"
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
										chart={inflowsChartExport}
										filename={inflowsExportFilenameBase}
										title={inflowsExportTitle}
										csvSource={
											renderedActiveChartData.kind === 'inflows'
												? {
														type: 'dataset',
														prepare: () => ({
															...selectChartDatasetColumns(
																renderedActiveChartData.data.dataset,
																(renderedGroupBy === 'cumulative'
																	? renderedActiveChartData.data.cumulativeCharts
																	: renderedActiveChartData.data.barCharts
																).filter((chart) => selectedInflowTokensSet.has(chart.name))
															),
															groupBy: renderedGroupBy
														})
													}
												: null
										}
									/>
								</ChartPanelToolbar>

								<ChartPanelBody>
									<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
										<MultiSeriesChart
											exportButtons={inflowsChartExport}
											dataset={chartPresentation.dataset}
											charts={chartPresentation.charts}
											csvSource={chartPresentation.csvSource}
											groupBy={renderedGroupBy}
											valueSymbol="ETH"
											showTotalInTooltip
											{...(selectedInflowTokens.length > 1
												? {
														chartOptions: {
															tooltip: { formatter: inflowsTooltipFormatter }
														}
													}
												: {})}
										/>
									</React.Suspense>
								</ChartPanelBody>
							</div>
						)}
					</TabPanel>
				</Tabs>
			</Card>

			<SearchTableProvider options={{ data: tokensList, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}>
				<Card padding="none">
					<TableToolbar>
						<h2 className="mr-auto label-md">Liquid staking protocols</h2>
						<TableSearchInput columnId="name" placeholder="Search protocols…" width="inline" />
						<TableCsvExport filename="liquid-staking" />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</>
	)
}
