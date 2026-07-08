import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/ButtonStyled/CsvButton'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import { DWMC_GROUPING_OPTIONS_LOWERCASE, type LowercaseDwmcGrouping } from '~/components/ECharts/ChartGroupingSelector'
import { Icon } from '~/components/Icon'
import { TokenLogo } from '~/components/TokenLogo'
import { Tooltip } from '~/components/Tooltip'
import { chainCoingeckoIdsForGasNotMcap } from '~/constants/chainTokens'
import { useAuthContext } from '~/containers/Subscription/auth'
import { TVL_SETTINGS_KEYS, useDarkModeManager, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { buttonStyles } from '~/ui/Button'
import { formattedNum } from '~/utils'
import { downloadCSV } from '~/utils/download'
import { ChainChartPanel } from './ChainChartPanel'
import { BAR_CHARTS, type ChainChartLabels, chainCharts } from './constants'
import { KeyMetrics } from './KeyMetrics'
import type { IChainOverviewData } from './types'
import { useFetchChainChartData } from './useFetchChainChartData'

const normalizeChartInterval = (value: string | null | undefined): LowercaseDwmcGrouping | null => {
	const normalizedValue = value?.toLowerCase() ?? null
	if (DWMC_GROUPING_OPTIONS_LOWERCASE.some((option) => option.value === normalizedValue)) {
		return normalizedValue as LowercaseDwmcGrouping
	}
	return null
}
interface IStatsProps extends IChainOverviewData {
	hideChart?: boolean
}

export function Stats(props: IStatsProps) {
	const router = useRouter()

	const searchParams = useMemo(() => {
		const queryString = router.asPath.split('?')[1]?.split('#')[0] ?? ''
		return new URLSearchParams(queryString)
	}, [router.asPath])

	const [darkMode] = useDarkModeManager()

	const [tvlSettings] = useLocalStorageSettingsManager('tvl')
	const [feesSettings] = useLocalStorageSettingsManager('fees')

	const { isAuthenticated } = useAuthContext()

	const { toggledCharts, DENOMINATIONS, chainGeckoId, hasAtleasOneBarChart, groupBy, denomination } = useMemo(() => {
		let CHAIN_SYMBOL = props.chainTokenInfo?.token_symbol ?? null
		let chainGeckoId = props.chainTokenInfo?.gecko_id ?? null

		if (props.metadata.name !== 'All') {
			const gasToken = chainCoingeckoIdsForGasNotMcap[props.metadata.name]

			if (!chainGeckoId) {
				chainGeckoId = gasToken?.geckoId ?? null
			}

			if (!CHAIN_SYMBOL) {
				CHAIN_SYMBOL = gasToken?.symbol ?? null
			}
		}

		const DENOMINATIONS = CHAIN_SYMBOL ? ['USD', CHAIN_SYMBOL] : ['USD']

		const toggledCharts = props.charts.filter((tchart, index) =>
			index === 0 ? searchParams.get(chainCharts[tchart]) !== 'false' : searchParams.get(chainCharts[tchart]) === 'true'
		) as ChainChartLabels[]

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
	}, [searchParams, props.chainTokenInfo, props.metadata.name, props.charts])

	const { totalValueUSD, change24h, valueChange24hUSD, finalCharts, valueSymbol, isFetchingChartData, failedMetrics } =
		useFetchChainChartData({
			denomination,
			selectedChain: props.metadata.name,
			tvlChart: props.tvlChart,
			tvlChartSummary: props.tvlChartSummary,
			extraTvlCharts: props.extraTvlCharts,
			tvlSettings,
			feesSettings,
			chainGeckoId,
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
		<div className="relative isolate grid h-full grid-cols-2 gap-2 xl:grid-cols-3">
			<div
				className={`col-span-2 flex w-full flex-col gap-6 overflow-x-auto rounded-lg border border-subtle bg-surface px-2 py-3 ${
					props.hideChart ? 'xl:col-span-full' : 'xl:col-span-1'
				}`}
			>
				{props.metadata.name !== 'All' ? (
					<h1 className="flex flex-nowrap items-center gap-2 *:last:ml-auto">
						<TokenLogo name={props.metadata.name} kind="chain" size={24} alt={`Logo of ${props.metadata.name}`} />
						<span className="heading-xs">{props.metadata.name}</span>
						{props.metadata.deprecated ? <DeprecatedEntityText /> : null}
						<span className="-m-2 ml-auto flex items-center justify-end gap-1">
							{props.website ? (
								<a
									href={props.website}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={`${props.metadata.name} website`}
									className={buttonStyles({ variant: 'ghost', size: 'md', square: true })}
								>
									<Icon name="globe" width={16} height={16} className="shrink-0" />
								</a>
							) : null}
							<Bookmark
								readableName={props.metadata.name}
								isChain
								className={buttonStyles({ variant: 'ghost', size: 'md', square: true })}
							/>
						</span>
					</h1>
				) : null}
				{props.protocols.length > 0 ? (
					<div className="flex flex-nowrap items-end justify-between gap-8">
						{props.metadata.name === 'All' ? (
							<div className="flex flex-col">
								<Tooltip
									content={
										props.metadata.name === 'All'
											? 'Sum of value of all coins held in smart contracts of all the protocols on all chains'
											: 'Sum of value of all coins held in smart contracts of all the protocols on the chain'
									}
									render={<h1 />}
									className="inline text-secondary underline decoration-dotted"
								>
									Total Value Locked in DeFi
								</Tooltip>
								<p className="min-h-8 overflow-hidden font-jetbrains text-2xl font-semibold text-ellipsis whitespace-nowrap">
									{formattedNum(totalValueUSD, true)}
								</p>
							</div>
						) : (
							<div className="flex flex-col">
								<Tooltip
									content={
										props.metadata.name === 'All'
											? 'Sum of value of all coins held in smart contracts of all the protocols on all chains'
											: 'Sum of value of all coins held in smart contracts of all the protocols on the chain'
									}
									render={<h2 />}
									className="inline text-secondary underline decoration-dotted"
								>
									Total Value Locked in DeFi
								</Tooltip>
								<p className="min-h-8 overflow-hidden font-jetbrains text-2xl font-semibold text-ellipsis whitespace-nowrap">
									{formattedNum(totalValueUSD, true)}
								</p>
							</div>
						)}
						{change24h != null && valueChange24hUSD != null ? (
							<Tooltip
								content={`${formattedNum(valueChange24hUSD, true)}`}
								render={<p />}
								className="relative bottom-0.5 flex flex-nowrap items-center gap-1"
							>
								<span
									className={`overflow-hidden mono-md text-ellipsis whitespace-nowrap underline decoration-dotted ${
										change24h >= 0 ? 'text-data-up' : 'text-data-down'
									}`}
								>
									{`${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`}
								</span>
								<span className="body-md text-tertiary">24h</span>
							</Tooltip>
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
					feeExtras={props.feeExtras}
					chainIncentives={props.chainIncentives}
					appRevenue={props.appRevenue}
					appFees={props.appFees}
					dexs={props.dexs}
					perps={props.perps}
					inflows={props.inflows}
					users={props.users}
					treasury={props.treasury}
					chainRaises={props.chainRaises}
					chainAssets={props.chainAssets}
					nfts={props.nfts}
					chainTokenInfo={props.chainTokenInfo}
					protocols={props.protocols}
					totalValueUSD={totalValueUSD}
					tvlSettingsGovtokens={!!tvlSettings.govtokens}
				/>
				<CSVDownloadButton
					onClick={handleDownloadChartCsv}
					isLoading={isDownloadingChartCsv}
					smol
					className="ml-auto"
				/>
			</div>
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
		</div>
	)
}
