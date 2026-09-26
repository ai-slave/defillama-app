import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import {
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { TokenLogo } from '~/components/TokenLogo'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { TVL_SETTINGS_KEYS, useDarkModeManager, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { StatItem, SummaryCardGrid, SummaryChange, SummaryStatsCard } from '~/ui/SummaryStats'
import { downloadCSV } from '~/utils/download'
import { getChainDenominations } from '~/utils/metadata/chainDenominations'
import { formatUsd } from '~/utils/numberFormat'
import { ChainChartPanel } from './ChainChartPanel'
import { BAR_CHARTS, chainCharts } from './constants'
import { KeyMetrics } from './KeyMetrics'
import type { IChainOverviewData } from './types'
import { useFetchChainChartData } from './useFetchChainChartData'

const normalizeChartInterval = (value: string | null | undefined): LowercaseDwmcGrouping | null => {
	const normalizedValue = value?.toLowerCase() ?? null
	for (const option of DWMC_GROUPING_OPTIONS_LOWERCASE) {
		if (option.value === normalizedValue) return option.value
	}
	return null
}
interface IStatsProps extends IChainOverviewData {
	hideChart?: boolean
}

export function Stats(props: IStatsProps) {
	const router = useRouter()
	const summaryStatsCardProps: { padding: 'sm'; className?: string } = props.hideChart
		? { padding: 'sm', className: 'xl:col-span-full' }
		: { padding: 'sm' }

	const searchParams = useMemo(() => {
		const queryString = router.asPath.split('?')[1]?.split('#')[0] ?? ''
		return new URLSearchParams(queryString)
	}, [router.asPath])

	const [darkMode] = useDarkModeManager()

	const [tvlSettings] = useLocalStorageSettingsManager('tvl')

	const { isAuthenticated } = useAuthContext()

	const { toggledCharts, DENOMINATIONS, chainGeckoId, hasAtleasOneBarChart, groupBy, denomination } = useMemo(() => {
		const DENOMINATIONS = getChainDenominations(props.metadata).map(({ symbol }) => symbol)
		const chainGeckoId = props.chainTokenInfo?.gecko_id ?? null

		const toggledCharts = props.charts.filter((tchart, index) =>
			index === 0 ? searchParams.get(chainCharts[tchart]) !== 'false' : searchParams.get(chainCharts[tchart]) === 'true'
		)

		const hasAtleasOneBarChart = toggledCharts.some((chart) => BAR_CHARTS.includes(chart))
		const groupByParam = searchParams.get('groupBy')

		const groupBy = hasAtleasOneBarChart && groupByParam ? (normalizeChartInterval(groupByParam) ?? 'daily') : 'daily'

		const currencyInSearchParams = searchParams.get('currency')?.toLowerCase()

		return {
			DENOMINATIONS,
			chainGeckoId,
			hasAtleasOneBarChart,
			toggledCharts,
			groupBy,
			denomination: DENOMINATIONS.find((d) => d.toLowerCase() === currencyInSearchParams) ?? 'USD'
		}
	}, [searchParams, props.chainTokenInfo, props.metadata, props.charts])

	const { totalValueUSD, change24h, valueChange24hUSD, finalCharts, valueSymbol, isFetchingChartData, failedMetrics } =
		useFetchChainChartData({
			denomination,
			selectedChain: props.metadata.name,
			tvlChart: props.tvlChart,
			tvlChartSummary: props.tvlChartSummary,
			extraTvlCharts: props.extraTvlCharts,
			tvlSettings,
			chainGeckoId,
			gasTokenGeckoId: props.metadata.gasTokenGeckoId ?? null,
			toggledCharts,
			groupBy
		})

	const { mutate: downloadAndPrepareChartCsv, isPending: isDownloadingChartCsv } = useMutation({
		mutationFn: async () => {
			if (!isAuthenticated) {
				toast.error('Please sign in to download CSV data')
				return
			}

			try {
				const enabledParams = TVL_SETTINGS_KEYS.flatMap((key) => (tvlSettings[key] ? [`${key}=true`] : []))
				const url = `https://api.llama.fi/simpleChainDataset/${encodeURIComponent(props.metadata.name)}?${enabledParams.join('&')}`

				const response = await fetch(url)

				if (!response.ok) {
					toast.error('Failed to download CSV data')
					return
				}

				const csvData = await response.text()

				downloadCSV(`${props.metadata.name}.csv`, csvData)
			} catch (error) {
				console.log('CSV download error:', error)
				toast.error('Failed to download CSV data')
			}
		}
	})
	const handleDownloadChartCsv = () => downloadAndPrepareChartCsv()

	return (
		<SummaryCardGrid className="h-full">
			<SummaryStatsCard {...summaryStatsCardProps}>
				{props.metadata.name !== 'All' ? (
					<h1 className="flex flex-nowrap items-center gap-2 *:last:ml-auto">
						<TokenLogo name={props.metadata.name} kind="chain" size={24} alt={`Logo of ${props.metadata.name}`} />
						<span className="heading-xs">{props.metadata.name}</span>
						{props.metadata.deprecated ? <DeprecatedEntityText /> : null}
						<span className="-m-2 ml-auto flex items-center justify-end gap-1">
							{props.website ? (
								<WebsiteGlobeLink
									url={props.website}
									name={props.metadata.name}
									event="chain-website-click"
									eventData={{ chain: props.metadata.name }}
								/>
							) : null}
							<Bookmark size="md" readableName={props.metadata.name} isChain />
						</span>
					</h1>
				) : null}
				{props.protocols.length > 0 ? (
					<div className="flex flex-nowrap items-end justify-between gap-8">
						<StatItem
							label="Total Value Locked in DeFi"
							labelAs={props.metadata.name === 'All' ? 'h1' : 'h2'}
							tooltip={
								props.metadata.name === 'All'
									? 'Sum of value of all coins held in smart contracts of all the protocols on all chains'
									: 'Sum of value of all coins held in smart contracts of all the protocols on the chain'
							}
							value={formatUsd(totalValueUSD, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							truncate
						/>
						{change24h != null && valueChange24hUSD != null ? (
							<SummaryChange
								percent={change24h}
								comparison="over 24h"
								tooltip={formatUsd(valueChange24hUSD, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
					</div>
				) : null}
				<KeyMetrics
					metadata={props.metadata}
					stablecoins={props.stablecoins}
					rwaActiveMcap={props.rwaActiveMcap}
					chainStablecoins={props.chainStablecoins}
					chainFees={props.chainFees}
					chainRevenue={props.chainRevenue}
					chainIncentives={props.chainIncentives}
					appRevenue={props.appRevenue}
					appFees={props.appFees}
					dexs={props.dexs}
					perps={props.perps}
					inflows={props.inflows}
					users={props.users}
					chainRaises={props.chainRaises}
					chainAssets={props.chainAssets}
					chainTokenInfo={props.chainTokenInfo}
					protocols={props.protocols}
					totalValueUSD={totalValueUSD}
					tvlSettingsGovtokens={!!tvlSettings.govtokens}
					footerAction={<CSVDownloadButton onClick={handleDownloadChartCsv} isLoading={isDownloadingChartCsv} smol />}
				/>
			</SummaryStatsCard>
			{!props.hideChart ? (
				<ChainChartPanel
					charts={props.charts}
					chainTokenInfo={props.chainTokenInfo}
					metadata={props.metadata}
					chain={props.chain}
					toggledCharts={toggledCharts}
					denominations={DENOMINATIONS}
					denomination={denomination}
					hasBarChart={hasAtleasOneBarChart}
					groupBy={groupBy}
					chainGeckoId={chainGeckoId}
					finalCharts={finalCharts}
					valueSymbol={valueSymbol}
					isFetchingChartData={isFetchingChartData}
					failedMetrics={failedMetrics}
					darkMode={darkMode}
				/>
			) : null}
		</SummaryCardGrid>
	)
}
