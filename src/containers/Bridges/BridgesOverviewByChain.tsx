import * as React from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { CSVDownloadButton } from '~/components/ButtonStyled/CsvButton'
import type { IPieChartProps } from '~/components/ECharts/types'
import { Icon } from '~/components/Icon'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SegmentedControl } from '~/components/SegmentedControl'
import { BridgesTable, type BridgesTableHandle } from '~/containers/Bridges/BridgesTable'
import { BridgeVolumeChart } from '~/containers/Bridges/BridgeVolumeChart'
import { ChartSelector } from '~/containers/Bridges/ChartSelector'
import { useBuildBridgeChartData } from '~/containers/Bridges/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { searchFieldIconStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Switch } from '~/ui/Switch'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { formattedNum, getPrevVolumeFromChart, slug, toNiceCsvDate } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { BridgesLargeTxsTable, type BridgesLargeTxsTableHandle } from './BridgesLargeTxsTable'

const MultiSeriesChart2 = React.lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const NetflowChart = React.lazy(() => import('~/components/ECharts/BarChart/NetflowChart')) as React.FC<any>

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
	const [chartType, setChartType] = React.useState(selectedChain === 'All' ? 'Volumes' : 'Bridge Volume')
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

	const { tokenDeposits, tokenWithdrawals } = useBuildBridgeChartData(bridgeStatsCurrentDay)

	const chainNetFlowData = React.useMemo(() => {
		return chainVolumeData.map((entry) => {
			return {
				date: entry.date,
				'Net Flow': entry.Deposits + entry.Withdrawals
			}
		})
	}, [chainVolumeData])

	const chainPercentageNet = React.useMemo(() => {
		return chainVolumeData.map((entry) => {
			return {
				date: entry.date,
				Inflows: (+entry.Deposits / (entry.Deposits + Math.abs(entry.Withdrawals))) * 100 || 0,
				Outflows: (Math.abs(entry.Withdrawals) / (entry.Deposits + Math.abs(entry.Withdrawals))) * 100 || 0
			}
		})
	}, [chainVolumeData])

	const netFlowDataset = React.useMemo(
		() => ({
			source: chainNetFlowData.map(({ date, ...rest }) => ({ timestamp: +date * 1e3, ...rest })),
			dimensions: ['timestamp', 'Net Flow']
		}),
		[chainNetFlowData]
	)

	const netFlowPctDataset = React.useMemo(
		() => ({
			source: chainPercentageNet.map(({ date, ...rest }) => ({ timestamp: +date * 1e3, ...rest })),
			dimensions: ['timestamp', 'Inflows', 'Outflows']
		}),
		[chainPercentageNet]
	)

	const chainInflowsDataset = React.useMemo(
		() => ({
			source: chainVolumeData.map((entry: any) => ({
				timestamp: +entry.date * 1e3,
				Deposits: entry.Deposits ?? 0,
				Withdrawals: entry.Withdrawals ?? 0
			})),
			dimensions: ['timestamp', 'Deposits', 'Withdrawals']
		}),
		[chainVolumeData]
	)
	const deferredNetFlowDataset = React.useDeferredValue(netFlowDataset)
	const deferredNetFlowPctDataset = React.useDeferredValue(netFlowPctDataset)
	const deferredChainInflowsDataset = React.useDeferredValue(chainInflowsDataset)
	const deferredTokenDeposits = React.useDeferredValue(tokenDeposits)
	const deferredTokenWithdrawals = React.useDeferredValue(tokenWithdrawals)

	const chartFilename = getBridgeChartFilename(selectedChain, chartType)
	const selectedChainIconUrl = selectedChain !== 'All' ? chainIconUrl(selectedChain) : undefined

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
		let stackedDatasetObject = {} as any
		for (const bridgeName of filteredBridgeNames) {
			const chartDataIndex = bridgeNameToChartDataIndex[bridgeName]
			const charts = chartDataByBridge[chartDataIndex]
			for (const chart of charts) {
				const date = chart.date
				stackedDatasetObject[date] = stackedDatasetObject[date] || {}
				stackedDatasetObject[date][bridgeName] = chart.volume
			}
		}
		const stackedData = Object.entries(stackedDatasetObject).map((data: [string, object]) => {
			return { date: parseInt(data[0]), ...data[1] }
		})
		const sortedStackedData = stackedData.sort((a, b) => a.date - b.date)
		for (const day of sortedStackedData) {
			rows.push([
				day.date,
				toNiceCsvDate(day.date),
				...filteredBridgeNames.map((chain) => day[chain] ?? ''),
				filteredBridgeNames.reduce((acc, curr) => {
					return (acc += day[curr] ?? 0)
				}, 0)
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
		let dayTotalVolume, weekTotalVolume, monthTotalVolume
		dayTotalVolume = weekTotalVolume = monthTotalVolume = 0

		const bridgesToCalculate = activeTab === 'bridges' ? bridgesTableData : messagingProtocols

		if (bridgesToCalculate) {
			for (const bridge of bridgesToCalculate ?? []) {
				dayTotalVolume += Number(bridge?.lastDailyVolume) || 0
				weekTotalVolume += Number(bridge?.weeklyVolume) || 0
				monthTotalVolume += Number(bridge?.monthlyVolume) || 0
			}
		} else {
			for (let i = 1; i < 31; i++) {
				const dailyVolume = getPrevVolumeFromChart(chainVolumeData, i, false, selectedChain !== 'All')
				if (i < 2) {
					dayTotalVolume += dailyVolume
				}
				if (i < 8) {
					weekTotalVolume += dailyVolume
				}
				monthTotalVolume += dailyVolume
			}
		}
		return { dayTotalVolume, weekTotalVolume, monthTotalVolume }
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
					<StatItem label="Total volume (24h)" labelAs="h1" value={formattedNum(dayTotalVolume, true)} />
					<StatItem label="Total volume (7d)" value={formattedNum(weekTotalVolume, true)} className="max-md:hidden" />
					<StatItem label="Total volume (1mo)" value={formattedNum(monthTotalVolume, true)} className="max-md:hidden" />

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
										onClick={setChartType}
									/>
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
											onClick={setChartType}
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
							) : chartType === 'Net Flow' ? (
								chainNetFlowData && chainNetFlowData.length > 0 ? (
									<React.Suspense fallback={<ChartPanelBodyFallback />}>
										<MultiSeriesChart2
											dataset={deferredNetFlowDataset}
											charts={NET_FLOW_CHARTS}
											hideDefaultLegend={true}
											valueSymbol="$"
											onReady={handleChartReady}
										/>
									</React.Suspense>
								) : null
							) : chartType === 'Net Flow (%)' ? (
								chainPercentageNet && chainPercentageNet.length > 0 ? (
									<React.Suspense fallback={<ChartPanelBodyFallback />}>
										<MultiSeriesChart2
											dataset={deferredNetFlowPctDataset}
											charts={NET_FLOW_PCT_CHARTS}
											hideDefaultLegend={true}
											valueSymbol="%"
											onReady={handleChartReady}
										/>
									</React.Suspense>
								) : null
							) : chartType === 'Inflows' ? (
								chainVolumeData && chainVolumeData.length > 0 ? (
									<React.Suspense fallback={<ChartPanelBodyFallback />}>
										<MultiSeriesChart2
											dataset={deferredChainInflowsDataset}
											charts={CHAIN_INFLOW_CHARTS}
											hideDefaultLegend={true}
											valueSymbol="$"
											onReady={handleChartReady}
										/>
									</React.Suspense>
								) : null
							) : chartType === '24h Tokens Deposited' ? (
								<React.Suspense fallback={<ChartPanelBodyFallback />}>
									<PieChart chartData={deferredTokenDeposits} onReady={handleChartReady} />
								</React.Suspense>
							) : chartType === '24h Tokens Withdrawn' ? (
								<React.Suspense fallback={<ChartPanelBodyFallback />}>
									<PieChart chartData={deferredTokenWithdrawals} onReady={handleChartReady} />
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
							<label className="relative w-full max-w-full sm:max-w-[280px]">
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
