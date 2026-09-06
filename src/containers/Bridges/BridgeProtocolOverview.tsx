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
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { LinkPreviewCard } from '~/components/SEO'
import { TokenLogo } from '~/components/TokenLogo'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { BridgeAddressesTable } from '~/containers/Bridges/BridgeAddressesTable'
import { BridgeChainSelector } from '~/containers/Bridges/BridgeChainSelector'
import { BridgeTokensTable } from '~/containers/Bridges/BridgeTokensTable'
import { AddressesTableSwitch } from '~/containers/Bridges/TableSwitch'
import { BRIDGES_SHOWING_ADDRESSES, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Panel } from '~/ui/Panel'
import { TagGroup } from '~/ui/SegmentedControl'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { getPercentChange, slug } from '~/utils'
import { formatUsd, formatPercentChange } from '~/utils/numberFormat'
import { getFreshTimeSeriesCurrentPoint } from '~/utils/timeSeries'
import {
	buildBridgeProtocolAllChainsVolumeData,
	buildBridgeProtocolInflowsData,
	getBridgeProtocolCompletedDayVolumes,
	getBridgeProtocolPrevDayVolumeValue
} from './bridgeProtocolChartData'
import type { BridgePageData } from './types'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const CHART_TYPES = ['Inflows', 'Volume', 'Tokens To', 'Tokens From'] as const
type ChartType = (typeof CHART_TYPES)[number]

export const BridgeInfo = ({
	displayName,
	logo,
	chains,
	defaultChain,
	volumeDataByChain,
	tableDataByChain,
	config
}: BridgePageData) => {
	const [chartType, setChartType] = React.useState<ChartType>('Volume')
	const [groupBy, setGroupBy] = React.useState<LowercaseDwmGrouping>('daily')
	const [currentChain, setChain] = React.useState(defaultChain)
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const [bridgesSettings] = useLocalStorageSettingsManager('bridges')
	const isBridgesShowingAddresses = bridgesSettings[BRIDGES_SHOWING_ADDRESSES]

	const currentTableData = tableDataByChain[currentChain]
	const {
		tokensTableData,
		addressesTableData,
		tokenDeposits,
		tokenWithdrawals,
		totalDepositedUSD,
		totalWithdrawnUSD,
		dataTimestamp
	} = currentTableData ?? {
		tokensTableData: [],
		addressesTableData: [],
		tokenDeposits: null,
		tokenWithdrawals: null
	}

	const volumeChartDataByChain = volumeDataByChain[currentChain]
	const completedDayVolumes = getBridgeProtocolCompletedDayVolumes(volumeChartDataByChain)
	const prevDayChart = completedDayVolumes?.current
	const hasFreshRollingStats =
		dataTimestamp != null && getFreshTimeSeriesCurrentPoint([{ date: dataTimestamp }], (point) => point.date) != null
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

	let volPercentChange: number | null = null

	if (completedDayVolumes) {
		const prev2DayChart = completedDayVolumes.previous
		const prevVolume =
			prev2DayChart.Deposited == null || prev2DayChart.Withdrawn == null
				? null
				: prev2DayChart.Deposited - prev2DayChart.Withdrawn
		if (currentDailyVolume != null && prevVolume != null && prevVolume > 0) {
			volPercentChange = getPercentChange(currentDailyVolume, prevVolume)
		}
	}

	const chainOptions = chains.map((chain) => {
		return { name: chain, route: '' }
	})

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
			...(dataTimestamp !== undefined ? { dataTimestamp } : {})
		})
	}, [isAllChains, volumeChartDataByChain, totalDepositedUSD, totalWithdrawnUSD, dataTimestamp])

	const chartTypes = (
		isAllChains ? (['Volume', 'Tokens To', 'Tokens From'] as const) : (['Inflows', 'Tokens To', 'Tokens From'] as const)
	) as ReadonlyArray<ChartType>
	const activeTokenSeries =
		chartType === 'Tokens To' ? tokenWithdrawals : chartType === 'Tokens From' ? tokenDeposits : null
	const tokenColorIndex = React.useMemo(() => {
		const indexByToken = new Map<string, number>()
		for (const series of [tokenWithdrawals, tokenDeposits]) {
			if (!series) continue
			for (const peer of series.peers) {
				if (!indexByToken.has(peer.name)) indexByToken.set(peer.name, indexByToken.size)
			}
		}
		return indexByToken
	}, [tokenDeposits, tokenWithdrawals])
	const activeTokenSeriesNames = React.useMemo(
		() => activeTokenSeries?.peers.map((peer) => peer.name) ?? [],
		[activeTokenSeries]
	)
	const {
		activeSeries: selectedTokens,
		selectedCharts: selectedTokenSet,
		setSelectedSeries: setSelectedTokens,
		includeUpstreamOthers
	} = useAllSeriesSelection({
		availableSeries: activeTokenSeriesNames,
		selectionKey: `${displayName}-${currentChain}`
	})
	const visibleTokenPresentation = React.useMemo(
		() =>
			activeTokenSeries
				? buildRuntimePieChartPresentation({
						series: activeTokenSeries,
						selectedSeries: selectedTokenSet,
						colorIndexByPeer: tokenColorIndex,
						includeUpstreamOthers
					})
				: { chartData: [], stackColors: {} },
		[activeTokenSeries, includeUpstreamOthers, selectedTokenSet, tokenColorIndex]
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
			? { type: 'dataset', prepare: () => volumeDataset }
			: chartType === 'Inflows' && !isAllChains
				? { type: 'dataset', prepare: () => inflowsDataset }
				: activeTokenSeries
					? { type: 'dataset', prepare: () => buildRuntimePieChartCsvDataset(activeTokenSeries) }
					: null

	return (
		<>
			<EntityTitleStrip
				media={<TokenLogo src={logo} size={28} alt={`Logo of ${displayName}`} />}
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
						<BridgeChainSelector
							currentChain={currentChain}
							options={chainOptions}
							handleClick={(chain) => {
								setChain(chain)
								if (chain === 'All Chains') {
									setChartType('Volume')
								} else {
									setChartType('Inflows')
								}
							}}
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
							value={formatUsd(prevDayVolumeValue, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
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
						<StatItem label="Volume Change (prev day)" value={formatPercentChange(volPercentChange)} />
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

				<ChartPanel className="col-span-2">
					<ChartPanelToolbar className="justify-end">
						<TagGroup
							variant="default"
							size="md"
							selectedValue={chartType}
							setValue={(v) => setChartType(v)}
							values={chartTypes}
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
							chartInstance={exportChartInstance}
							filename={chartFilename}
							title={`${chartScopeTitle} ${chartType}`}
							iconUrl={logo}
							csvSource={csvSource}
						/>
					</ChartPanelToolbar>
					<>
						{chartType === 'Volume' && isAllChains && volumeDataset.source.length > 0 ? (
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<MultiSeriesChart
									dataset={volumeDataset}
									charts={VOLUME_CHARTS}
									groupBy={groupBy}
									valueSymbol="$"
									onReady={handleChartReady}
								/>
							</React.Suspense>
						) : null}
						{chartType === 'Inflows' && !isAllChains && inflowsDataset.source.length > 0 ? (
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<MultiSeriesChart
									dataset={inflowsDataset}
									charts={INFLOW_CHARTS}
									groupBy={groupBy}
									valueSymbol="$"
									onReady={handleChartReady}
								/>
							</React.Suspense>
						) : null}
						{chartType === 'Tokens To' && tokenWithdrawals && tokenWithdrawals.peers.length > 0 ? (
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<PieChart
									chartData={visibleTokenPresentation.chartData}
									stackColors={visibleTokenPresentation.stackColors}
									onReady={handleChartReady}
								/>
							</React.Suspense>
						) : null}
						{chartType === 'Tokens From' && tokenDeposits && tokenDeposits.peers.length > 0 ? (
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<PieChart
									chartData={visibleTokenPresentation.chartData}
									stackColors={visibleTokenPresentation.stackColors}
									onReady={handleChartReady}
								/>
							</React.Suspense>
						) : null}
					</>
				</ChartPanel>
			</SummaryCardGrid>
			<Panel padding="none">
				<TableToolbar className="items-end justify-between">
					<AddressesTableSwitch />
					<p className="text-sm italic opacity-60">All stats in table use the same rolling window.</p>
				</TableToolbar>
				{isBridgesShowingAddresses ? (
					<BridgeAddressesTable data={addressesTableData} />
				) : (
					<BridgeTokensTable data={tokensTableData} />
				)}
			</Panel>
		</>
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
