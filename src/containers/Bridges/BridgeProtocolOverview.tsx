import * as React from 'react'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { useLocalSelection } from '~/components/Select/localSelection'
import { LinkPreviewCard } from '~/components/SEO'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { chartColor } from '~/constants/colors'
import { BridgeAddressesTable } from '~/containers/Bridges/BridgeAddressesTable'
import { BridgeTokensTable } from '~/containers/Bridges/BridgeTokensTable'
import { BRIDGES_SHOWING_ADDRESSES, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { usePageClockSec } from '~/hooks/usePageClock'
import { Change } from '~/ui/Change'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { Panel } from '~/ui/Panel'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { TableToolbar } from '~/ui/Toolbar'
import { getPercentChange, slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import {
	buildBridgeProtocolAllChainsVolumeData,
	buildBridgeProtocolInflowsData,
	getBridgeProtocolCompletedDayVolumes,
	getBridgeProtocolPrevDayVolumeValue,
	hasFreshBridgeRollingStats
} from './bridgeProtocolChartData'
import type { BridgePageData, BridgeTableData } from './types'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const CHART_TYPES = ['Inflows', 'Volume', 'Tokens To', 'Tokens From'] as const
type ChartType = (typeof CHART_TYPES)[number]

// A fresh object literal here would make every value destructured out of it look mutable to the
// compiler, which then refuses to preserve the memoization below.
const EMPTY_TOKEN_ROWS: BridgeTableData['tokensTableData'] = []
const EMPTY_ADDRESS_ROWS: BridgeTableData['addressesTableData'] = []

// Kept out of the component: a reassigned local also stops the memoization being preserved.
function getVolumePercentChange(
	completedDayVolumes: ReturnType<typeof getBridgeProtocolCompletedDayVolumes>,
	currentDailyVolume: number | null
) {
	if (!completedDayVolumes || currentDailyVolume == null) return null
	const { Deposited, Withdrawn } = completedDayVolumes.previous
	if (Deposited == null || Withdrawn == null) return null
	const previousVolume = Deposited - Withdrawn
	if (previousVolume <= 0) return null
	return getPercentChange(currentDailyVolume, previousVolume)
}

const BRIDGE_TABLE_VIEWS = ['tokens', 'addresses'] as const
type BridgeTableView = (typeof BRIDGE_TABLE_VIEWS)[number]
const BRIDGE_TABLE_VIEW_OPTIONS = [
	{
		value: 'tokens',
		label: (
			<span className="flex items-center gap-1">
				<Icon name="trending-up" className="size-3.5" />
				Tokens
			</span>
		),
		ariaLabel: 'Tokens'
	},
	{
		value: 'addresses',
		label: (
			<span className="flex items-center gap-1">
				<Icon name="users" className="size-3.5" />
				Addresses
			</span>
		),
		ariaLabel: 'Addresses'
	}
] satisfies ReadonlyArray<SegmentedControlOption<BridgeTableView>>

export function BridgeInfo({
	displayName,
	logo,
	chains,
	defaultChain,
	volumeDataByChain,
	tableDataByChain,
	config
}: BridgePageData) {
	const [chartType, setChartType] = React.useState<ChartType>('Volume')
	const [groupBy, setGroupBy] = React.useState<LowercaseDwmGrouping>('daily')
	const [currentChain, setCurrentChain] = React.useState(defaultChain)
	const exportChartExport = useGetChartInstance()
	// The completed days are the data's, so they follow the clock the props were built with, not the visitor's.
	const nowSec = usePageClockSec()

	// Read through rather than destructured from a fallback object: a fresh literal there makes every
	// value taken out of it look mutable to the compiler, which then refuses to preserve the
	// memoization below and skips the whole component.
	const currentTableData = tableDataByChain[currentChain]
	const tokensTableData = currentTableData?.tokensTableData ?? EMPTY_TOKEN_ROWS
	const addressesTableData = currentTableData?.addressesTableData ?? EMPTY_ADDRESS_ROWS
	const tokenDeposits = currentTableData?.tokenDeposits ?? null
	const tokenWithdrawals = currentTableData?.tokenWithdrawals ?? null
	const totalDepositedUSD = currentTableData?.totalDepositedUSD
	const totalWithdrawnUSD = currentTableData?.totalWithdrawnUSD
	const dataTimestamp = currentTableData?.dataTimestamp

	const volumeChartDataByChain = volumeDataByChain[currentChain]
	const completedDayVolumes = getBridgeProtocolCompletedDayVolumes(volumeChartDataByChain, nowSec)
	const prevDayChart = completedDayVolumes?.current
	const hasFreshRollingStats = hasFreshBridgeRollingStats(dataTimestamp, nowSec)
	const currentDepositsUSD = hasFreshRollingStats ? (totalDepositedUSD ?? null) : (prevDayChart?.Deposited ?? null)
	const currentWithdrawalsUSD = hasFreshRollingStats
		? (totalWithdrawnUSD ?? null)
		: prevDayChart?.Withdrawn == null
			? null
			: -prevDayChart.Withdrawn
	const currentDailyVolume =
		prevDayChart?.Deposited == null || prevDayChart.Withdrawn == null
			? null
			: prevDayChart.Deposited - prevDayChart.Withdrawn

	const isAllChains = currentChain === 'All Chains'
	const rollingHours = config.name === 'wormhole' ? 28 : 24
	const windowLabel = rollingHours === 24 ? '24h' : `${rollingHours}h`

	const volPercentChange = getVolumePercentChange(completedDayVolumes, currentDailyVolume)

	const volumeDataset = React.useMemo(
		() =>
			buildBridgeProtocolAllChainsVolumeData({
				active: chartType === 'Volume' && isAllChains,
				groupBy,
				volumeChartDataByChain
			}),
		[chartType, isAllChains, groupBy, volumeChartDataByChain]
	)

	const prevDayVolumeValue = React.useMemo(() => {
		return getBridgeProtocolPrevDayVolumeValue({
			isAllChains,
			volumeChartDataByChain,
			totalDepositedUSD,
			totalWithdrawnUSD,
			...(dataTimestamp !== undefined ? { dataTimestamp } : {}),
			nowSec
		})
	}, [isAllChains, volumeChartDataByChain, totalDepositedUSD, totalWithdrawnUSD, dataTimestamp, nowSec])

	const chartTypes = (
		isAllChains ? (['Volume', 'Tokens To', 'Tokens From'] as const) : (['Inflows', 'Tokens To', 'Tokens From'] as const)
	) as ReadonlyArray<ChartType>
	const activeTokenSeries =
		chartType === 'Tokens To' ? tokenWithdrawals : chartType === 'Tokens From' ? tokenDeposits : null
	const tokenColors = React.useMemo(() => {
		const colorByToken: Record<string, string> = {}
		let count = 0
		for (const series of [tokenWithdrawals, tokenDeposits]) {
			if (!series) continue
			for (const peer of series.peers) {
				if (!Object.hasOwn(colorByToken, peer.name)) colorByToken[peer.name] = chartColor(count++)
			}
		}
		return colorByToken
	}, [tokenDeposits, tokenWithdrawals])
	const activeTokenSeriesNames = React.useMemo(
		() => activeTokenSeries?.peers.map((peer) => peer.name) ?? [],
		[activeTokenSeries]
	)
	const {
		activeSeries: selectedTokens,
		selectedCharts: selectedTokenSet,
		setSelectedSeries: setSelectedTokens
	} = useLocalSelection({
		allowEmptySelection: true,
		availableSeries: activeTokenSeriesNames,
		scope: `${displayName}-${currentChain}`
	})
	const visibleTokenPresentation = React.useMemo(
		() =>
			activeTokenSeries
				? buildRuntimePieChartPresentation({
						series: activeTokenSeries,
						selectedSeries: selectedTokenSet,
						colorByPeer: tokenColors
					})
				: { chartData: [], stackColors: {} },
		[activeTokenSeries, selectedTokenSet, tokenColors]
	)

	const inflowsDataset = React.useMemo(
		() =>
			buildBridgeProtocolInflowsData({
				active: chartType === 'Inflows' && !isAllChains,
				groupBy,
				volumeChartDataByChain
			}),
		[chartType, isAllChains, groupBy, volumeChartDataByChain]
	)

	const chartScopeTitle = isAllChains ? displayName : `${displayName} on ${currentChain}`
	const chartFilename = `${slug(displayName)}-${isAllChains ? 'all-chains' : slug(currentChain)}-${chartType === 'Volume' ? 'volume' : chartType === 'Inflows' ? 'inflows' : chartType === 'Tokens To' ? 'tokens-to' : 'tokens-from'}`
	const csvSource: ChartCsvSource | null =
		chartType === 'Volume' && isAllChains
			? { type: 'dataset', prepare: () => ({ ...volumeDataset, groupBy }) }
			: chartType === 'Inflows' && !isAllChains
				? { type: 'dataset', prepare: () => ({ ...inflowsDataset, groupBy }) }
				: activeTokenSeries
					? {
							type: 'dataset',
							prepare: () =>
								buildRuntimePieChartCsvDataset({
									series: activeTokenSeries,
									selectedSeries: selectedTokenSet
								})
						}
					: null

	return (
		<>
			<EntityTitleStrip
				media={<Logo src={logo} size={28} alt={`Logo of ${displayName}`} />}
				title={displayName}
				actions={
					<>
						{config?.url ? (
							<WebsiteGlobeLink
								url={config.url}
								name={displayName}
								event="bridge-website-click"
								eventData={{ bridge: displayName }}
							/>
						) : null}
						<SelectWithCombobox
							allValues={chains}
							selectedValues={[currentChain]}
							setSelectedValues={(values) => {
								const chain = values[0]
								if (!chain) return
								setCurrentChain(chain)
								setChartType(chain === 'All Chains' ? 'Volume' : 'Inflows')
							}}
							label="Chain"
							labelType="regular"
							singleSelect
							variant="filter"
							size="md"
						/>
					</>
				}
			/>
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					{isAllChains ? (
						<StatItem
							label={<>Total Volume ({windowLabel})</>}
							tooltip="Volume equals (Deposited + Withdrawn)/2 over the same rolling window used by the bridges overview."
							value={
								prevDayVolumeValue == null
									? 'N/A'
									: formatUsd(prevDayVolumeValue, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})
							}
						/>
					) : (
						<>
							<StatItem
								label={
									<>
										Deposited to {currentChain} ({windowLabel})
									</>
								}
								value={
									currentDepositsUSD == null
										? 'N/A'
										: formatUsd(currentDepositsUSD, {
												compact: true,
												minimumCompactValue: 1_000_000,
												compactSuffix: 'lowercase'
											})
								}
							/>
							<StatItem
								label={
									<>
										Withdrawn from {currentChain} ({windowLabel})
									</>
								}
								value={
									currentWithdrawalsUSD == null
										? 'N/A'
										: formatUsd(currentWithdrawalsUSD, {
												compact: true,
												minimumCompactValue: 1_000_000,
												compactSuffix: 'lowercase'
											})
								}
							/>
						</>
					)}

					{volPercentChange != null ? (
						<StatItem label="Volume Change (prev day)" value={<Change value={volPercentChange} />} />
					) : null}
					{config?.url ? (
						<ExternalLinkButton
							href={config.url}
							icon="globe"
							className="mt-auto mr-auto"
							data-umami-event="bridge-website-click"
							data-umami-event-bridge={displayName}
							data-umami-event-placement="info"
							data-umami-event-url={config.url}
						>
							Website
						</ExternalLinkButton>
					) : null}
				</SummaryStatsCard>

				<Panel className="col-span-2">
					<ChartPanelToolbar>
						<SegmentedControl
							variant="default"
							size="md"
							value={chartType}
							onValueChange={(v) => setChartType(v)}
							options={chartTypes.map((value) => ({ value, label: value }))}
							label="Chart type"
							className="mr-auto"
						/>
						{activeTokenSeries && activeTokenSeriesNames.length > 1 ? (
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
						{chartType === 'Volume' || chartType === 'Inflows' ? (
							<ChartGroupingSelector value={groupBy} setValue={setGroupBy} options={DWM_GROUPING_OPTIONS_LOWERCASE} />
						) : null}
						<ChartExportButtons
							chart={exportChartExport}
							filename={chartFilename}
							title={`${chartScopeTitle} ${chartType}`}
							iconUrl={logo}
							csvSource={csvSource}
						/>
					</ChartPanelToolbar>
					<>
						{chartType === 'Volume' && isAllChains && volumeDataset.source.length > 0 ? (
							<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
								<MultiSeriesChart
									exportButtons={exportChartExport}
									dataset={volumeDataset}
									charts={VOLUME_CHARTS}
									groupBy={groupBy}
									valueSymbol="$"
								/>
							</React.Suspense>
						) : null}
						{chartType === 'Inflows' && !isAllChains && inflowsDataset.source.length > 0 ? (
							<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
								<MultiSeriesChart
									exportButtons={exportChartExport}
									dataset={inflowsDataset}
									charts={INFLOW_CHARTS}
									groupBy={groupBy}
									valueSymbol="$"
								/>
							</React.Suspense>
						) : null}
						{chartType === 'Tokens To' && tokenWithdrawals && tokenWithdrawals.peers.length > 0 ? (
							<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
								<PieChart
									exportButtons={exportChartExport}
									chartData={visibleTokenPresentation.chartData}
									stackColors={visibleTokenPresentation.stackColors}
								/>
							</React.Suspense>
						) : null}
						{chartType === 'Tokens From' && tokenDeposits && tokenDeposits.peers.length > 0 ? (
							<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
								<PieChart
									exportButtons={exportChartExport}
									chartData={visibleTokenPresentation.chartData}
									stackColors={visibleTokenPresentation.stackColors}
								/>
							</React.Suspense>
						) : null}
					</>
				</Panel>
			</SummaryCardGrid>
			<BridgeTablePanel tokensTableData={tokensTableData} addressesTableData={addressesTableData} />
		</>
	)
}

export function BridgeTablePanel({
	tokensTableData,
	addressesTableData
}: Pick<BridgeTableData, 'tokensTableData' | 'addressesTableData'>) {
	const [bridgesSettings, toggleBridgesSettings] = useLocalStorageSettingsManager('bridges')
	const tableView: BridgeTableView = bridgesSettings[BRIDGES_SHOWING_ADDRESSES] ? 'addresses' : 'tokens'

	return (
		<Panel>
			<Tabs
				value={tableView}
				values={BRIDGE_TABLE_VIEWS}
				onValueChange={() => toggleBridgesSettings(BRIDGES_SHOWING_ADDRESSES)}
			>
				<TableToolbar>
					<p className="mr-auto body-sm text-tertiary">All stats in table use the same rolling window.</p>
					<SegmentedControl
						semantics="tabs"
						options={BRIDGE_TABLE_VIEW_OPTIONS}
						label="Bridge table"
						variant="default"
						size="md"
					/>
				</TableToolbar>
				<TabPanel value={tableView}>
					{tableView === 'addresses' ? (
						<BridgeAddressesTable data={addressesTableData} />
					) : (
						<BridgeTokensTable data={tokensTableData} />
					)}
				</TabPanel>
			</Tabs>
		</Panel>
	)
}

export function BridgeProtocolOverview(props: BridgePageData) {
	return (
		<>
			<LinkPreviewCard cardName={props.displayName} token={props.displayName} />
			<BridgeInfo {...props} />
		</>
	)
}
const VOLUME_CHARTS = [{ type: 'bar' as const, name: 'Volume', encode: { x: 'timestamp', y: 'Volume' } }]

const INFLOW_CHARTS = [
	{
		type: 'bar' as const,
		name: 'Deposited',
		encode: { x: 'timestamp', y: 'Deposited' },
		stack: 'stackA',
		large: false
	},
	{ type: 'bar' as const, name: 'Withdrawn', encode: { x: 'timestamp', y: 'Withdrawn' }, stack: 'stackA', large: false }
]
