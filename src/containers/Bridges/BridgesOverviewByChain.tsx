import * as React from 'react'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { CHART_DOWN, CHART_UP, chartColor } from '~/constants/colors'
import { BridgesTable, type BridgesTableHandle } from '~/containers/Bridges/BridgesTable'
import { BridgeVolumeChart } from '~/containers/Bridges/BridgeVolumeChart'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { usePageClockSec } from '~/hooks/usePageClock'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import {
	Input,
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputPlacementStyles
} from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { ScopeNote } from '~/ui/ScopeNote'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Switch } from '~/ui/Switch'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { formatIsoDate } from '~/utils/dateFormat'
import { chainIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import {
	buildBridgeOverviewActiveChart,
	buildBridgeOverviewTokenPieSeries,
	getBridgeOverviewSummaryTotals,
	type BridgeOverviewChartType
} from './bridgeOverviewChartData'
import { BridgesLargeTxsTable, type BridgesLargeTxsTableHandle } from './BridgesLargeTxsTable'
import type { getBridgeOverviewPageData } from './queries.server'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const NetflowChart = React.lazy(() => import('~/components/ECharts/NetflowChart'))

const NET_FLOW_CHARTS = [{ type: 'bar' as const, name: 'Net Flow', encode: { x: 'timestamp', y: 'Net Flow' } }]

const NET_FLOW_PCT_CHARTS = [
	{
		type: 'bar' as const,
		name: 'Inflows',
		encode: { x: 'timestamp', y: 'Inflows' },
		color: CHART_UP,
		stack: 'stackA',
		large: false
	},
	{
		type: 'bar' as const,
		name: 'Outflows',
		encode: { x: 'timestamp', y: 'Outflows' },
		color: CHART_DOWN,
		stack: 'stackA',
		large: false
	}
]
const CHAIN_INFLOW_CHARTS = [
	{
		type: 'bar' as const,
		name: 'Deposits',
		encode: { x: 'timestamp', y: 'Deposits' },
		color: CHART_UP,
		stack: 'inflows',
		large: false
	},
	{
		type: 'bar' as const,
		name: 'Withdrawals',
		encode: { x: 'timestamp', y: 'Withdrawals' },
		color: CHART_DOWN,
		stack: 'inflows',
		large: false
	}
]
const BRIDGE_CHAIN_CHART_OPTIONS = [
	'Bridge Volume',
	'Net Flow',
	'Net Flow (%)',
	'Inflows',
	'24h Tokens Deposited',
	'24h Tokens Withdrawn'
]
type BridgeOverviewPageData = Awaited<ReturnType<typeof getBridgeOverviewPageData>>
type BridgesOverviewByChainProps = Omit<BridgeOverviewPageData, 'chain'> & { selectedChain?: string }
const EMPTY_CHAINS: Array<string> = []
const EMPTY_PROTOCOLS: BridgeOverviewPageData['filteredBridges'] = []
const CHART_VIEW_OPTIONS = [
	{ value: 'netflow', label: 'Net Flows By Chain' },
	{ value: 'volume', label: 'Bridge Volume' }
] as const
const TABLE_VIEWS = ['bridges', 'messaging', 'largeTxs'] as const
type TableView = (typeof TABLE_VIEWS)[number]
const TABLE_VIEW_OPTIONS: ReadonlyArray<{ value: TableView; label: string }> = [
	{ value: 'bridges', label: 'Bridges' },
	{ value: 'messaging', label: 'Messaging Protocols' },
	{ value: 'largeTxs', label: 'Large Txs' }
]

const handleRouting = (selectedChain: string) => {
	if (selectedChain === 'All') return `/bridges`
	return `/bridges/${slug(selectedChain)}`
}

const getBridgeChartFilename = (selectedChain: string, chartType: string) => {
	let suffix: string
	switch (chartType) {
		case '24h Tokens Deposited':
			suffix = 'tokens-deposited'
			break
		case '24h Tokens Withdrawn':
			suffix = 'tokens-withdrawn'
			break
		case 'Net Flow':
			suffix = 'netflow'
			break
		case 'Net Flow (%)':
			suffix = 'netflow-pct'
			break
		case 'Inflows':
			suffix = 'inflows'
			break
		default:
			suffix = 'bridge-volume'
			break
	}

	return `${selectedChain}-${suffix}`
}

export function BridgesOverviewByChain({
	selectedChain = 'All',
	chains = EMPTY_CHAINS,
	filteredBridges,
	messagingProtocols = EMPTY_PROTOCOLS,
	bridgeNames: _bridgeNames,
	bridgeNameToChartDataIndex,
	chartDataByBridge,
	chainVolumeData,
	rawBridgeVolumeData,
	netflowsData,
	bridgeStatsCurrentDay,
	largeTxsData
}: BridgesOverviewByChainProps) {
	const [chartType, setChartType] = React.useState<BridgeOverviewChartType>(
		selectedChain === 'All' ? 'Volumes' : 'Bridge Volume'
	)
	const [chartView, setChartView] = React.useState<'netflow' | 'volume'>('netflow')
	const [activeTab, setActiveTab] = React.useState<TableView>('bridges')
	const [includeMessaging, setIncludeMessaging] = React.useState(false)
	const [searchValue, setSearchValue] = React.useState('')
	const deferredSearchValue = React.useDeferredValue(searchValue)
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()
	const bridgesTableRef = React.useRef<BridgesTableHandle | null>(null)
	const largeTxsTableRef = React.useRef<BridgesLargeTxsTableHandle | null>(null)

	const chainOptions = React.useMemo(() => {
		const uniqueChains = Array.from(new Set(chains)).filter((chain) => chain !== 'All')
		return ['All', ...uniqueChains].map((label) => ({ label, to: handleRouting(label) }))
	}, [chains])

	const displaysTokenPie = chartType === '24h Tokens Deposited' || chartType === '24h Tokens Withdrawn'
	const tokenPieSeriesByDirection = React.useMemo(() => {
		if (!displaysTokenPie || !bridgeStatsCurrentDay) return null
		return {
			deposited: buildBridgeOverviewTokenPieSeries(bridgeStatsCurrentDay.totalTokensDeposited),
			withdrawn: buildBridgeOverviewTokenPieSeries(bridgeStatsCurrentDay.totalTokensWithdrawn)
		}
	}, [bridgeStatsCurrentDay, displaysTokenPie])
	const activeTokenPieSeries =
		chartType === '24h Tokens Deposited'
			? (tokenPieSeriesByDirection?.deposited ?? null)
			: chartType === '24h Tokens Withdrawn'
				? (tokenPieSeriesByDirection?.withdrawn ?? null)
				: null
	const activeChart = React.useMemo(
		() =>
			buildBridgeOverviewActiveChart({
				selectedChain,
				chartType,
				chainVolumeData,
				bridgeStatsCurrentDay,
				...(displaysTokenPie ? { tokenPieSeries: activeTokenPieSeries } : {})
			}),
		[selectedChain, chartType, chainVolumeData, bridgeStatsCurrentDay, activeTokenPieSeries, displaysTokenPie]
	)
	const tokenColors = React.useMemo(() => {
		const colorByToken: Record<string, string> = {}
		if (!tokenPieSeriesByDirection) return colorByToken
		let count = 0
		for (const series of [tokenPieSeriesByDirection.deposited, tokenPieSeriesByDirection.withdrawn]) {
			if (!series) continue
			for (const peer of series.peers) {
				if (!Object.hasOwn(colorByToken, peer.name)) colorByToken[peer.name] = chartColor(count++)
			}
		}
		return colorByToken
	}, [tokenPieSeriesByDirection])
	const activeTokenSeriesNames = React.useMemo(
		() => activeTokenPieSeries?.peers.map((peer) => peer.name) ?? EMPTY_CHAINS,
		[activeTokenPieSeries]
	)
	const {
		activeSeries: selectedTokens,
		selectedCharts: selectedTokenSet,
		setSelectedSeries: setSelectedTokens
	} = useLocalSelection({ allowEmptySelection: true, availableSeries: activeTokenSeriesNames, scope: selectedChain })
	const visibleTokenPiePresentation = React.useMemo(
		() =>
			activeTokenPieSeries
				? buildRuntimePieChartPresentation({
						series: activeTokenPieSeries,
						selectedSeries: selectedTokenSet,
						colorByPeer: tokenColors
					})
				: { chartData: [], stackColors: {} },
		[activeTokenPieSeries, selectedTokenSet, tokenColors]
	)

	const chartFilename = getBridgeChartFilename(selectedChain, chartType)
	const selectedChainIconUrl = selectedChain !== 'All' ? chainIconUrl(selectedChain) : undefined
	const activeChartCsvSource: ChartCsvSource | null = activeChart
		? 'dataset' in activeChart
			? { type: 'dataset', prepare: () => activeChart.dataset }
			: {
					type: 'dataset',
					prepare: () =>
						buildRuntimePieChartCsvDataset({
							series: activeChart.series,
							selectedSeries: selectedTokenSet
						})
				}
		: null
	const prepareCsv = () => {
		const resolvedFilteredBridges = filteredBridges ?? EMPTY_PROTOCOLS
		const resolvedMessagingProtocols = messagingProtocols ?? EMPTY_PROTOCOLS
		const allBridges = [...resolvedFilteredBridges, ...resolvedMessagingProtocols]
		const allBridgeNames = allBridges.map((bridge) => bridge.displayName)

		const filteredBridgeNames = allBridgeNames.filter((bridgeName) => {
			const chartDataIndex = bridgeNameToChartDataIndex[bridgeName]
			if (chartDataIndex === undefined) return false
			const charts = chartDataByBridge[chartDataIndex]
			return !!charts?.length
		})

		const fileName = 'bridge-and-messaging-volumes.csv'
		const rows: Array<Array<string | number>> = [['Timestamp', 'Date', ...filteredBridgeNames, 'Total']]
		const valuesByDate = new Map<number, Map<string, number | null>>()
		for (const bridgeName of filteredBridgeNames) {
			const chartDataIndex = bridgeNameToChartDataIndex[bridgeName]
			if (chartDataIndex === undefined) continue
			const charts = chartDataByBridge[chartDataIndex]
			if (!charts) continue
			for (const chart of charts) {
				let values = valuesByDate.get(chart.date)
				if (!values) {
					values = new Map()
					valuesByDate.set(chart.date, values)
				}
				values.set(bridgeName, chart.volume)
			}
		}
		const sortedDates = Array.from(valuesByDate.keys()).sort((a, b) => a - b)
		for (const date of sortedDates) {
			const values = valuesByDate.get(date)
			if (!values) throw new Error(`Missing bridge CSV values for ${date}`)
			let total: number | null = 0
			for (const value of values.values()) {
				if (value === null) total = null
				else if (total !== null) total += value
			}
			rows.push([
				date,
				formatIsoDate(date, { input: 'seconds' }) ?? '',
				...filteredBridgeNames.map((bridgeName) => {
					const value = values.get(bridgeName)
					return value === undefined ? 0 : (value ?? '')
				}),
				total ?? ''
			])
		}

		return { filename: fileName, rows }
	}

	// The volume series come from the bridges API, so the messaging switch reaches only the table and its totals.
	const chartScopeNote =
		activeTab === 'bridges' && includeMessaging ? (
			<ScopeNote>This chart ignores the Include Messaging Protocols switch and shows bridge volume only.</ScopeNote>
		) : null

	const bridgesTableData = React.useMemo(() => {
		if (activeTab === 'messaging') return messagingProtocols
		if (includeMessaging) return [...(filteredBridges ?? []), ...(messagingProtocols ?? [])]
		return filteredBridges
	}, [activeTab, includeMessaging, filteredBridges, messagingProtocols])

	// The completed days are the data's, so they follow the clock the props were built with, not the visitor's.
	const nowSec = usePageClockSec()
	const { dayTotalVolume, weekTotalVolume, monthTotalVolume } = React.useMemo(() => {
		const bridgesToCalculate = activeTab === 'bridges' ? bridgesTableData : messagingProtocols
		return getBridgeOverviewSummaryTotals({ selectedChain, bridges: bridgesToCalculate, chainVolumeData, nowSec })
	}, [chainVolumeData, selectedChain, bridgesTableData, messagingProtocols, activeTab, nowSec])

	const prepareActiveTabCsv = React.useCallback(() => {
		if (activeTab === 'largeTxs') {
			return largeTxsTableRef.current?.prepareCsv() ?? { filename: 'bridge-transactions', rows: [] }
		}

		return (
			bridgesTableRef.current?.prepareCsv() ?? {
				filename: activeTab === 'messaging' ? 'messaging-protocols' : 'bridges',
				rows: []
			}
		)
	}, [activeTab])

	return (
		<>
			<RowLinksWithDropdown heading="Chains" links={chainOptions} activeLink={selectedChain} />

			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					{dayTotalVolume != null ? (
						<StatItem
							label="Total volume (last completed day)"
							labelAs="h1"
							value={formatUsd(dayTotalVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
					) : null}
					{weekTotalVolume != null ? (
						<StatItem
							label="Total volume (7 completed days)"
							{...(dayTotalVolume == null ? { labelAs: 'h1' as const } : {})}
							value={formatUsd(weekTotalVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							className="max-md:hidden"
						/>
					) : null}
					{monthTotalVolume != null ? (
						<StatItem
							label="Total volume (30 completed days)"
							{...(dayTotalVolume == null && weekTotalVolume == null ? { labelAs: 'h1' as const } : {})}
							value={formatUsd(monthTotalVolume, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							className="max-md:hidden"
						/>
					) : null}

					<CSVDownloadButton prepareCsv={prepareCsv} smol size="sm" className="mt-auto mr-auto" />
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					{selectedChain === 'All' ? (
						<>
							<ChartPanelToolbar>
								<SegmentedControl
									value={chartView}
									onValueChange={(value) => setChartView(value)}
									options={CHART_VIEW_OPTIONS}
									label="Chart view"
									variant="default"
									size="md"
									className="mr-auto"
								/>

								<ChartExportButtons
									chartInstance={exportChartInstance}
									filename={chartView === 'volume' ? 'bridge-volume' : 'bridge-netflow-by-chain'}
									title={chartView === 'volume' ? 'Bridge Volume' : 'Bridge Net Flows'}
									csvSource="rendered-chart"
								/>
							</ChartPanelToolbar>
							{chartScopeNote}

							{chartView === 'netflow' && netflowsData ? (
								<React.Suspense fallback={<div className="min-h-[600px]" />}>
									<NetflowChart height={600} onReady={handleChartReady} data={netflowsData} />
								</React.Suspense>
							) : chartView === 'volume' ? (
								<BridgeVolumeChart data={rawBridgeVolumeData} height="360px" onReady={handleChartReady} />
							) : null}
						</>
					) : (
						<>
							{chartType !== 'Bridge Volume' && (
								<ChartPanelToolbar>
									<SelectWithCombobox
										allValues={BRIDGE_CHAIN_CHART_OPTIONS}
										selectedValues={[chartType]}
										setSelectedValues={(values) => {
											if (values[0]) setChartType(values[0] as BridgeOverviewChartType)
										}}
										label="Chart"
										labelType="regular"
										singleSelect
										variant="filter"
										size="md"
										className="mr-auto"
									/>
									{activeTokenPieSeries && activeTokenSeriesNames.length > 1 ? (
										<SelectWithCombobox
											allValues={activeTokenSeriesNames}
											selectedValues={selectedTokens}
											setSelectedValues={setSelectedTokens}
											label="Token"
											labelType="smol"
											variant="filter"
											size="md"
										/>
									) : null}
									<ChartExportButtons
										chartInstance={exportChartInstance}
										filename={chartFilename}
										title={`${selectedChain} ${chartType}`}
										iconUrl={selectedChainIconUrl}
										csvSource={activeChartCsvSource}
									/>
								</ChartPanelToolbar>
							)}
							{chartType !== 'Bridge Volume' ? chartScopeNote : null}
							{chartType === 'Bridge Volume' ? (
								<BridgeVolumeChart
									data={rawBridgeVolumeData}
									height="360px"
									onReady={handleChartReady}
									scopeNote={chartScopeNote}
									headerStart={
										<SelectWithCombobox
											allValues={BRIDGE_CHAIN_CHART_OPTIONS}
											selectedValues={[chartType]}
											setSelectedValues={(values) => {
												if (values[0]) setChartType(values[0] as BridgeOverviewChartType)
											}}
											label="Chart"
											labelType="regular"
											singleSelect
											variant="filter"
											size="md"
											className="mr-auto"
										/>
									}
									headerEnd={
										<ChartExportButtons
											chartInstance={exportChartInstance}
											filename={chartFilename}
											title={`${selectedChain} ${chartType}`}
											iconUrl={selectedChainIconUrl}
											csvSource="rendered-chart"
										/>
									}
								/>
							) : activeChart?.kind === 'Net Flow' ? (
								activeChart.dataset.source.length > 0 ? (
									<React.Suspense fallback={<ChartPanelBodyFallback />}>
										<MultiSeriesChart
											dataset={activeChart.dataset}
											charts={NET_FLOW_CHARTS}
											hideDefaultLegend
											valueSymbol="$"
											onReady={handleChartReady}
										/>
									</React.Suspense>
								) : null
							) : activeChart?.kind === 'Net Flow (%)' ? (
								activeChart.dataset.source.length > 0 ? (
									<React.Suspense fallback={<ChartPanelBodyFallback />}>
										<MultiSeriesChart
											dataset={activeChart.dataset}
											charts={NET_FLOW_PCT_CHARTS}
											hideDefaultLegend
											valueSymbol="%"
											onReady={handleChartReady}
										/>
									</React.Suspense>
								) : null
							) : activeChart?.kind === 'Inflows' ? (
								activeChart.dataset.source.length > 0 ? (
									<React.Suspense fallback={<ChartPanelBodyFallback />}>
										<MultiSeriesChart
											dataset={activeChart.dataset}
											charts={CHAIN_INFLOW_CHARTS}
											hideDefaultLegend
											valueSymbol="$"
											onReady={handleChartReady}
										/>
									</React.Suspense>
								) : null
							) : activeChart?.kind === '24h Tokens Deposited' ? (
								<React.Suspense fallback={<ChartPanelBodyFallback />}>
									<PieChart
										chartData={visibleTokenPiePresentation.chartData}
										stackColors={visibleTokenPiePresentation.stackColors}
										onReady={handleChartReady}
									/>
								</React.Suspense>
							) : activeChart?.kind === '24h Tokens Withdrawn' ? (
								<React.Suspense fallback={<ChartPanelBodyFallback />}>
									<PieChart
										chartData={visibleTokenPiePresentation.chartData}
										stackColors={visibleTokenPiePresentation.stackColors}
										onReady={handleChartReady}
									/>
								</React.Suspense>
							) : null}
						</>
					)}
				</ChartPanel>
			</SummaryCardGrid>

			<Panel padding="none">
				<Tabs<TableView> value={activeTab} values={TABLE_VIEWS} onValueChange={setActiveTab}>
					<TableToolbar>
						<SegmentedControl
							semantics="tabs"
							options={TABLE_VIEW_OPTIONS}
							label="Table view"
							variant="default"
							size="md"
							className="mr-auto"
						/>

						<TableToolbarControlGroup>
							{activeTab === 'bridges' ? (
								<Switch
									label="Include Messaging Protocols"
									value="include-messaging-protocols"
									checked={includeMessaging}
									onChange={() => setIncludeMessaging((prev) => !prev)}
								/>
							) : null}

							{activeTab === 'largeTxs' ? null : (
								<label className={searchFieldInlineWrapperStyles}>
									<span className="sr-only">Search bridges</span>
									<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
									<Input
										onInput={(e) => setSearchValue(e.currentTarget.value)}
										placeholder="Search…"
										className={searchFieldInputPlacementStyles}
									/>
								</label>
							)}
							<CSVDownloadButton prepareCsv={prepareActiveTabCsv} smol size="md" />
						</TableToolbarControlGroup>
					</TableToolbar>

					<TabPanel value={activeTab}>
						{activeTab === 'largeTxs' ? (
							<>
								<div className="flex flex-wrap items-center justify-end gap-2">
									<p className="px-4 text-right text-tertiary italic">
										Displaying {largeTxsData.length} transactions from the past {selectedChain === 'All' ? '1d' : '7d'}
									</p>
								</div>
								<BridgesLargeTxsTable ref={largeTxsTableRef} data={largeTxsData} />
							</>
						) : (
							<BridgesTable
								ref={bridgesTableRef}
								data={bridgesTableData}
								searchValue={deferredSearchValue}
								csvFileName={
									activeTab === 'messaging'
										? 'messaging-protocols'
										: includeMessaging
											? 'bridges-and-messaging-protocols'
											: 'bridges'
								}
							/>
						)}
					</TabPanel>
				</Tabs>
			</Panel>
		</>
	)
}
