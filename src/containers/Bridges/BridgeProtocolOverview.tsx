import * as React from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import type { IPieChartProps } from '~/components/ECharts/types'
import { Icon } from '~/components/Icon'
import { LinkPreviewCard } from '~/components/SEO'
import { TagGroup } from '~/components/TagGroup'
import { TokenLogo } from '~/components/TokenLogo'
import { BridgeAddressesTable } from '~/containers/Bridges/BridgeAddressesTable'
import { BridgeChainSelector } from '~/containers/Bridges/BridgeChainSelector'
import { BridgeTokensTable } from '~/containers/Bridges/BridgeTokensTable'
import { AddressesTableSwitch } from '~/containers/Bridges/TableSwitch'
import { BRIDGES_SHOWING_ADDRESSES, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Panel } from '~/ui/Panel'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { formattedNum, getPercentChange, slug } from '~/utils'
import {
	buildBridgeProtocolAllChainsVolumeData,
	buildBridgeProtocolAllChainsVolumePairs,
	buildBridgeProtocolInflowsData,
	getBridgeProtocolPrevDayVolumeValue
} from './bridgeProtocolChartData'
import type { BridgePageData } from './types'

const MultiSeriesChart2 = React.lazy(() => import('~/components/ECharts/MultiSeriesChart2'))
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

	const { tokensTableData, addressesTableData, tokenDeposits, tokenWithdrawals, totalDepositedUSD, totalWithdrawnUSD } =
		tableDataByChain[currentChain]

	const volumeChartDataByChain = volumeDataByChain[currentChain]
	const prevDayChart = volumeChartDataByChain[volumeChartDataByChain.length - 2]
	const currentDepositsUSD = totalDepositedUSD ?? prevDayChart?.Deposited ?? 0
	const currentWithdrawalsUSD = totalWithdrawnUSD ?? -(prevDayChart?.Withdrawn ?? 0)
	const currentDailyVolume = (prevDayChart?.Deposited ?? 0) + -(prevDayChart?.Withdrawn ?? 0)

	const isAllChains = currentChain === 'All Chains'
	const rollingHours = config.name === 'wormhole' ? 28 : 24
	const windowLabel = rollingHours === 24 ? '24h' : `${rollingHours}h`

	let volPercentChange = '0 '

	if (volumeChartDataByChain.length > 3) {
		const prev2DayChart = volumeChartDataByChain[volumeChartDataByChain.length - 3]
		const prevDepositsUSD = prev2DayChart.Deposited ?? 0
		const prevWithdrawalsUSD = -(prev2DayChart.Withdrawn ?? 0)
		const prevVolume = prevDepositsUSD + prevWithdrawalsUSD
		if (prevVolume > 0) {
			volPercentChange = getPercentChange(currentDailyVolume, prevVolume)?.toFixed(2)
		}
	}

	const chainOptions = chains.map((chain) => {
		return { name: chain, route: '' }
	})

	const allChainsVolumePairs = React.useMemo(
		() => buildBridgeProtocolAllChainsVolumePairs({ isAllChains, volumeChartDataByChain }),
		[isAllChains, volumeChartDataByChain]
	)

	const { groupedAllChainsVolumePairs, volumeDataset } = React.useMemo(
		() => buildBridgeProtocolAllChainsVolumeData({ groupBy, allChainsVolumePairs }),
		[groupBy, allChainsVolumePairs]
	)

	const prevDayVolumeValue = React.useMemo(() => {
		return getBridgeProtocolPrevDayVolumeValue({
			isAllChains,
			allChainsVolumePairs,
			totalDepositedUSD,
			totalWithdrawnUSD
		})
	}, [isAllChains, allChainsVolumePairs, totalDepositedUSD, totalWithdrawnUSD])

	const chartTypes = (
		isAllChains ? (['Volume', 'Tokens To', 'Tokens From'] as const) : (['Inflows', 'Tokens To', 'Tokens From'] as const)
	) as readonly ChartType[]

	const { groupedInflowsData, inflowsDataset } = React.useMemo(
		() => buildBridgeProtocolInflowsData({ isAllChains, groupBy, volumeChartDataByChain }),
		[isAllChains, groupBy, volumeChartDataByChain]
	)
	const deferredVolumeDataset = React.useDeferredValue(volumeDataset)
	const deferredInflowsDataset = React.useDeferredValue(inflowsDataset)
	const deferredTokenWithdrawals = React.useDeferredValue(tokenWithdrawals)
	const deferredTokenDeposits = React.useDeferredValue(tokenDeposits)

	const chartScopeTitle = isAllChains ? displayName : `${displayName} on ${currentChain}`
	const chartFilename = `${slug(displayName)}-${isAllChains ? 'all-chains' : slug(currentChain)}-${chartType === 'Volume' ? 'volume' : chartType === 'Inflows' ? 'inflows' : chartType === 'Tokens To' ? 'tokens-to' : 'tokens-from'}`

	return (
		<>
			<EntityTitleStrip
				media={<TokenLogo src={logo} size={28} alt={`Logo of ${displayName}`} />}
				title={displayName}
				actions={
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
				}
			/>
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					{isAllChains ? (
						<StatItem
							label={<>Total Volume ({windowLabel})</>}
							tooltip="Volume equals (Deposited + Withdrawn)/2 over the same rolling window used by the bridges overview."
							value={formattedNum(prevDayVolumeValue || '0', true)}
						/>
					) : (
						<>
							<StatItem
								label={
									<>
										Deposited to {currentChain} ({windowLabel})
									</>
								}
								value={formattedNum(currentDepositsUSD || '0', true)}
							/>
							<StatItem
								label={
									<>
										Withdrawn from {currentChain} ({windowLabel})
									</>
								}
								value={formattedNum(currentWithdrawalsUSD || '0', true)}
							/>
						</>
					)}

					<StatItem label="Volume Change (prev day)" value={volPercentChange + '%'} />
					{config?.url ? (
						<Button
							as="a"
							size="md"
							className="mt-auto mr-auto"
							href={config.url}
							target="_blank"
							rel="noreferrer noopener"
						>
							<span>Website</span> <Icon name="arrow-up-right" className="size-4" />
						</Button>
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
						{chartType === 'Volume' || chartType === 'Inflows' ? (
							<ChartGroupingSelector value={groupBy} setValue={setGroupBy} options={DWM_GROUPING_OPTIONS_LOWERCASE} />
						) : null}
						<ChartExportButtons
							chartInstance={exportChartInstance}
							filename={chartFilename}
							title={`${chartScopeTitle} ${chartType}`}
							iconUrl={logo}
						/>
					</ChartPanelToolbar>
					<>
						{chartType === 'Volume' && isAllChains && groupedAllChainsVolumePairs.length > 0 ? (
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<MultiSeriesChart2
									dataset={deferredVolumeDataset}
									charts={VOLUME_CHARTS}
									groupBy={groupBy}
									valueSymbol="$"
									onReady={handleChartReady}
								/>
							</React.Suspense>
						) : null}
						{chartType === 'Inflows' && !isAllChains && groupedInflowsData && groupedInflowsData.length > 0 ? (
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<MultiSeriesChart2
									dataset={deferredInflowsDataset}
									charts={INFLOW_CHARTS}
									groupBy={groupBy}
									valueSymbol="$"
									onReady={handleChartReady}
								/>
							</React.Suspense>
						) : null}
						{chartType === 'Tokens To' && deferredTokenWithdrawals && deferredTokenWithdrawals.length > 0 ? (
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<PieChart chartData={deferredTokenWithdrawals} onReady={handleChartReady} />
							</React.Suspense>
						) : null}
						{chartType === 'Tokens From' && deferredTokenDeposits && deferredTokenDeposits.length > 0 ? (
							<React.Suspense fallback={<ChartPanelBodyFallback />}>
								<PieChart chartData={deferredTokenDeposits} onReady={handleChartReady} />
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
