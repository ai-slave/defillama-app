import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { BridgesTable, type BridgesTableHandle } from '~/containers/Bridges/BridgesTable'
import { BridgeVolumeChart } from '~/containers/Bridges/BridgeVolumeChart'
import { ChartSelector } from '~/containers/Bridges/ChartSelector'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Switch } from '~/ui/Switch'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { formattedNum, slug, toNiceCsvDate } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import {
	buildBridgeOverviewActiveChart,
	buildBridgeOverviewTokenPieSeries,
	getBridgeOverviewSummaryTotals,
	type BridgeOverviewChartType
} from './bridgeOverviewChartData'
import { BridgesLargeTxsTable, type BridgesLargeTxsTableHandle } from './BridgesLargeTxsTable'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const NetflowChart = React.lazy(() => import('~/components/ECharts/NetflowChart'))

const NET_FLOW_CHARTS = [{ type: 'bar' as const, name: 'Net Flow', encode: { x: 'timestamp', y: 'Net Flow' } }]

const NET_FLOW_PCT_CHARTS = [
	{ type: 'bar' as const, name: 'Inflows', encode: { x: 'timestamp', y: 'Inflows' }, stack: 'stackA', large: false },
	{ type: 'bar' as const, name: 'Outflows', encode: { x: 'timestamp', y: 'Outflows' }, stack: 'stackA', large: false }
]
const CHAIN_INFLOW_CHARTS = [
	{
		type: 'bar' as const,
		name: 'Deposits',
		encode: { x: 'timestamp', y: 'Deposits' },
		color: '#3b82f6',
		stack: 'inflows',
		large: false
	},
	{
		type: 'bar' as const,
		name: 'Withdrawals',
		encode: { x: 'timestamp', y: 'Withdrawals' },
		color: '#ef4444',
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
const EMPTY_CHAINS: string[] = []
const EMPTY_PROTOCOLS: any[] = []
const CHART_VIEW_OPTIONS = [
	{ key: 'netflow' as const, label: 'Net Flows By Chain' },
	{ key: 'volume' as const, label: 'Bridge Volume' }
]
const TABLE_VIEW_OPTIONS = [
	{ key: 'bridges' as const, label: 'Bridges' },
	{ key: 'messaging' as const, label: 'Messaging Protocols' },
	{ key: 'largeTxs' as const, label: 'Large Txs' }
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
}) {
	const [chartType, setChartType] = React.useState<BridgeOverviewChartType>(
		selectedChain === 'All' ? 'Volumes' : 'Bridge Volume'
	)
	const [chartView, setChartView] = React.useState<'default' | 'netflow' | 'volume'>('netflow')
	const [activeTab, setActiveTab] = React.useState<'bridges' | 'messaging' | 'largeTxs'>('bridges')
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
		if (!displaysTokenPie) return null
		return {
			deposited: buildBridgeOverviewTokenPieSeries(bridgeStatsCurrentDay?.totalTokensDeposited ?? {}),
			withdrawn: buildBridgeOverviewTokenPieSeries(bridgeStatsCurrentDay?.totalTokensWithdrawn ?? {})
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
				tokenPieSeries: activeTokenPieSeries ?? undefined
			}),
		[selectedChain, chartType, chainVolumeData, bridgeStatsCurrentDay, activeTokenPieSeries]
	)
	const tokenColorIndex = React.useMemo(() => {
		const indexByToken = new Map<string, number>()
		if (!tokenPieSeriesByDirection) return indexByToken
		for (const series of [tokenPieSeriesByDirection.deposited, tokenPieSeriesByDirection.withdrawn]) {
			for (const peer of series.peers) {
				if (!indexByToken.has(peer.name)) indexByToken.set(peer.name, indexByToken.size)
			}
		}
		return indexByToken
	}, [tokenPieSeriesByDirection])
	const activeTokenSeriesNames = React.useMemo(
		() => activeTokenPieSeries?.peers.map((peer) => peer.name) ?? EMPTY_CHAINS,
		[activeTokenPieSeries]
	)
	const {
		activeSeries: selectedTokens,
		selectedCharts: selectedTokenSet,
		setSelectedSeries: setSelectedTokens,
		includeUpstreamOthers
	} = useAllSeriesSelection({
		availableSeries: activeTokenSeriesNames,
		selectionKey: selectedChain
	})
	const visibleTokenPiePresentation = React.useMemo(
		() =>
			activeTokenPieSeries
				? buildRuntimePieChartPresentation({
						series: activeTokenPieSeries,
						selectedSeries: selectedTokenSet,
						colorIndexByPeer: tokenColorIndex,
						includeUpstreamOthers
					})
				: { chartData: [], stackColors: {} },
		[activeTokenPieSeries, includeUpstreamOthers, selectedTokenSet, tokenColorIndex]
	)

	const chartFilename = getBridgeChartFilename(selectedChain, chartType)
	const selectedChainIconUrl = selectedChain !== 'All' ? chainIconUrl(selectedChain) : undefined
	const completedDayVolumes = selectedChain !== 'All'

	const prepareCsv = () => {
		const resolvedFilteredBridges = filteredBridges ?? EMPTY_PROTOCOLS
		const resolvedMessagingProtocols = messagingProtocols ?? EMPTY_PROTOCOLS
		const allBridges = [...resolvedFilteredBridges, ...resolvedMessagingProtocols]
		const allBridgeNames = allBridges.map((bridge) => bridge.displayName)

		const filteredBridgeNames = allBridgeNames.filter((bridgeName) => {
			const chartDataIndex = bridgeNameToChartDataIndex[bridgeName]
			const charts = chartDataByBridge[chartDataIndex]
			return charts && charts.length
		})

		const fileName = 'bridge-and-messaging-volumes.csv'
		const rows = [['Timestamp', 'Date', ...filteredBridgeNames, 'Total']]
		const valuesByDate = new Map<number, Map<string, number>>()
		for (const bridgeName of filteredBridgeNames) {
			const chartDataIndex = bridgeNameToChartDataIndex[bridgeName]
			const charts = chartDataByBridge[chartDataIndex]
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
			const values = valuesByDate.get(date)!
			let total = 0
			for (const value of values.values()) total += value
			rows.push([
				date,
				toNiceCsvDate(date),
				...filteredBridgeNames.map((bridgeName) => values.get(bridgeName) ?? ''),
				total
			])
		}

		return { filename: fileName, rows }
	}

	const bridgesTableData = React.useMemo(() => {
		if (activeTab === 'messaging') return messagingProtocols
		if (includeMessaging) return [...(filteredBridges ?? []), ...(messagingProtocols ?? [])]
		return filteredBridges
	}, [activeTab, includeMessaging, filteredBridges, messagingProtocols])

	const { dayTotalVolume, weekTotalVolume, monthTotalVolume } = React.useMemo(() => {
		const bridgesToCalculate = activeTab === 'bridges' ? bridgesTableData : messagingProtocols
		return getBridgeOverviewSummaryTotals({ selectedChain, bridges: bridgesToCalculate, chainVolumeData })
	}, [chainVolumeData, selectedChain, bridgesTableData, messagingProtocols, activeTab])

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
			<RowLinksWithDropdown links={chainOptions} activeLink={selectedChain} />

			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					{dayTotalVolume != null ? (
						<StatItem
							label={completedDayVolumes ? 'Total volume (last completed day)' : 'Total volume (24h)'}
							labelAs="h1"
							value={formattedNum(dayTotalVolume, true)}
						/>
					) : null}
					{weekTotalVolume != null ? (
						<StatItem
							label={completedDayVolumes ? 'Total volume (7 completed days)' : 'Total volume (7d)'}
							labelAs={dayTotalVolume == null ? 'h1' : undefined}
							value={formattedNum(weekTotalVolume, true)}
							className="max-md:hidden"
						/>
					) : null}
					{monthTotalVolume != null ? (
						<StatItem
							label={completedDayVolumes ? 'Total volume (30 completed days)' : 'Total volume (1mo)'}
							labelAs={dayTotalVolume == null && weekTotalVolume == null ? 'h1' : undefined}
							value={formattedNum(monthTotalVolume, true)}
							className="max-md:hidden"
						/>
					) : null}

					<CSVDownloadButton prepareCsv={prepareCsv} smol size="sm" className="mt-auto mr-auto" />
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					{selectedChain === 'All' ? (
						<>
							<ChartPanelToolbar className="justify-end">
								<SegmentedControl
									value={chartView}
									onValueChange={(value) => setChartView(value as typeof chartView)}
									options={CHART_VIEW_OPTIONS.map(({ key, label }) => ({ value: key, label }))}
									label="Chart view"
									variant="default"
									size="md"
									className="mr-auto"
								/>

								<ChartExportButtons
									chartInstance={exportChartInstance}
									filename={chartView === 'volume' ? 'bridge-volume' : 'bridge-netflow-by-chain'}
									title={chartView === 'volume' ? 'Bridge Volume' : 'Bridge Net Flows'}
								/>
							</ChartPanelToolbar>

							{chartView === 'netflow' ? (
								<React.Suspense fallback={<div className="min-h-[600px]" />}>
									<NetflowChart height={600} onReady={handleChartReady} data={netflowsData} />
								</React.Suspense>
							) : (
								<BridgeVolumeChart data={rawBridgeVolumeData} height="360px" onReady={handleChartReady} />
							)}
						</>
					) : (
						<>
							{chartType !== 'Bridge Volume' && (
								<ChartPanelToolbar className="justify-end">
									<ChartSelector
										options={BRIDGE_CHAIN_CHART_OPTIONS}
										selectedChart={chartType}
										onClick={(value) => setChartType(value as BridgeOverviewChartType)}
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
									/>
								</ChartPanelToolbar>
							)}
							{chartType === 'Bridge Volume' ? (
								<BridgeVolumeChart
									data={rawBridgeVolumeData}
									height="360px"
									onReady={handleChartReady}
									headerStart={
										<ChartSelector
											options={BRIDGE_CHAIN_CHART_OPTIONS}
											selectedChart={chartType}
											onClick={(value) => setChartType(value as BridgeOverviewChartType)}
										/>
									}
									headerEnd={
										<ChartExportButtons
											chartInstance={exportChartInstance}
											filename={chartFilename}
											title={`${selectedChain} ${chartType}`}
											iconUrl={selectedChainIconUrl}
										/>
									}
								/>
							) : activeChart?.kind === 'Net Flow' ? (
								activeChart.dataset.source.length > 0 ? (
									<React.Suspense fallback={<ChartPanelBodyFallback />}>
										<MultiSeriesChart
											dataset={activeChart.dataset}
											charts={NET_FLOW_CHARTS}
											hideDefaultLegend={true}
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
											hideDefaultLegend={true}
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
											hideDefaultLegend={true}
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
				<TableToolbar className="w-full justify-end">
					<SegmentedControl
						value={activeTab}
						onValueChange={(value) => setActiveTab(value as typeof activeTab)}
						options={TABLE_VIEW_OPTIONS.map(({ key, label }) => ({ value: key, label }))}
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
								<input
									onInput={(e) => setSearchValue(e.currentTarget.value)}
									placeholder="Search..."
									className={searchFieldInputStyles}
								/>
							</label>
						)}
						<CSVDownloadButton prepareCsv={prepareActiveTabCsv} smol size="md" />
					</TableToolbarControlGroup>
				</TableToolbar>

				{activeTab === 'largeTxs' ? (
					<>
						<div className="flex flex-wrap items-center justify-end gap-2">
							<p className="px-4 text-right italic opacity-60">
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
						completedDayVolumes={completedDayVolumes}
						csvFileName={
							activeTab === 'messaging'
								? 'messaging-protocols'
								: includeMessaging
									? 'bridges-and-messaging-protocols'
									: 'bridges'
						}
					/>
				)}
			</Panel>
		</>
	)
}
