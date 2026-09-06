import { skipToken, useQueries, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import type { CgChartResponse } from '~/api/coingecko.types'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { formatBarChart, formatLineChart, formatNullableBarChart } from '~/components/ECharts/shared/timeSeries'
import {
	useFetchProtocolActivityChart,
	useFetchProtocolMedianAPY,
	useFetchProtocolTVLChart
} from '~/containers/ProtocolOverview/queries.client'
import type { EmissionsChartRow, TokenIncentiveChartPoint } from '~/containers/Unlocks/api.types'
import { useIsClient } from '~/hooks/useIsClient'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { ADAPTER_CHART_DESCRIPTORS, type AdapterChartDescriptorLabel } from './chartDescriptors'
import { getGroupedTimestampSec, normalizeSeriesToMilliseconds, normalizeSeriesToSeconds } from './chartSeries.utils'
import { oracleProtocols, protocolCharts, type ProtocolChartsLabels } from './constants'
import {
	buildExtraTvlCharts,
	buildTvlChart,
	buildUsdInflowsFromTvlChart,
	getProtocolExtraTvlChartFetchState,
	getSelectedProtocolExtraTvlKeys,
	type ProtocolExtraTvlKey
} from './tvlChart'
import type { IProtocolOverviewPageData, IToggledMetrics } from './types'
import {
	getPrefetchedProtocolChartQueryOptions,
	usePrefetchedProtocolChartQuery
} from './usePrefetchedProtocolChartQuery'

type ChartInterval = ChartTimeGroupingWithCumulative
type AdapterChartState = { data: Array<[number, number]> | null; isLoading: boolean; enabled: boolean }
type UnlocksChartResponse = {
	chartData: { documented: Array<EmissionsChartRow>; realtime: Array<EmissionsChartRow> }
	unlockUsdChart: Array<TokenIncentiveChartPoint> | null
}

const buildChartRowsFromTimestampRecord = (
	valuesByTimestamp: Record<string, number>,
	timestampMultiplier = 1
): Array<[number, number]> => {
	const rows: Array<[number, number]> = []
	for (const timestamp in valuesByTimestamp) {
		const value = valuesByTimestamp[timestamp]
		if (value === undefined) continue
		rows.push([+timestamp * timestampMultiplier, value])
	}
	return rows.sort((a, b) => a[0] - b[0])
}

function getKnownChartValues(
	series: Array<[number, number | null]> | null | undefined
): Array<[number, number]> | null {
	if (!series) return null
	const known: Array<[number, number]> = []
	for (const [timestamp, value] of series) {
		if (value != null) known.push([timestamp, value])
	}
	return known
}

const buildProtocolChartApiUrl = (params: Record<string, string | undefined>) => {
	const searchParams = new URLSearchParams()
	for (const key in params) {
		const value = params[key]
		if (value != null) {
			searchParams.set(key, value)
		}
	}
	return `/api/public/protocols/charts?${searchParams.toString()}`
}

export const useFetchProtocolChartData = ({
	name,
	id: protocolId,
	geckoId,
	currentTvlByChain,
	initialMultiSeriesChartData,
	metrics,
	toggledMetrics,
	groupBy,
	availableCharts,
	chartDenominations,
	tvlSettings,
	isCEX
}: IProtocolOverviewPageData & {
	toggledMetrics: IToggledMetrics
	groupBy: ChartInterval
	tvlSettings: Partial<Record<ProtocolExtraTvlKey, boolean>>
}) => {
	const router = useRouter()
	const canFetchClientCharts = useIsClient() && router.isReady
	const protocolSlug = slug(name)
	const chartDenominationBySymbol = useMemo(
		() => new Map(chartDenominations.map((d) => [d.symbol, d])),
		[chartDenominations]
	)
	const selectedDenomination = toggledMetrics.denomination
		? chartDenominationBySymbol.get(toggledMetrics.denomination)
		: null
	const hasAnyToggledChart = availableCharts.some((chartLabel) => toggledMetrics[protocolCharts[chartLabel]] === 'true')
	const oracleProtocolName = oracleProtocols[name] ?? name
	const prefetchedChartsInSeconds = useMemo(() => {
		const normalized: Partial<Record<ProtocolChartsLabels, Array<[number, number | null]>>> = {}
		for (const typedLabel of availableCharts) {
			const series = initialMultiSeriesChartData[typedLabel]
			if (!series?.length) continue
			normalized[typedLabel] = normalizeSeriesToSeconds(series)
		}
		return normalized
	}, [availableCharts, initialMultiSeriesChartData])
	const prefetchedChartsForMsRender = useMemo(() => {
		const normalized: Partial<Record<ProtocolChartsLabels, Array<[number, number | null]>>> = {
			...prefetchedChartsInSeconds
		}
		const treasurySeries = prefetchedChartsInSeconds['Treasury']
		if (treasurySeries?.length) {
			normalized['Treasury'] = normalizeSeriesToMilliseconds(treasurySeries)
		}
		const bridgeVolumeSeries = prefetchedChartsInSeconds['Bridge Volume']
		if (bridgeVolumeSeries?.length) {
			normalized['Bridge Volume'] = normalizeSeriesToMilliseconds(bridgeVolumeSeries)
		}
		return normalized
	}, [prefetchedChartsInSeconds])
	const prefetchedNumericCharts = useMemo(() => {
		const numeric: Partial<Record<ProtocolChartsLabels, Array<[number, number]>>> = {}
		for (const label of availableCharts) {
			const series = getKnownChartValues(prefetchedChartsInSeconds[label])
			if (series?.length) numeric[label] = series
		}
		return numeric
	}, [availableCharts, prefetchedChartsInSeconds])
	const prefetchedTreasuryCharts = useMemo(() => {
		const treasury = getKnownChartValues(prefetchedChartsForMsRender['Treasury'])
		return treasury?.length ? { Treasury: treasury } : {}
	}, [prefetchedChartsForMsRender])

	const denominationGeckoId =
		canFetchClientCharts && hasAnyToggledChart ? (selectedDenomination?.geckoId ?? null) : null
	const { data: denominationPriceHistory = null, isLoading: fetchingDenominationPriceHistory } = useQuery<Record<
		string,
		number
	> | null>({
		queryKey: ['protocol-overview', protocolSlug, 'denomination-price-history', denominationGeckoId],
		queryFn: denominationGeckoId
			? () =>
					fetchJson<CgChartResponse | null>(
						`/api/public/tokens/charts/coingecko/${encodeURIComponent(denominationGeckoId)}?timeframe=MAX`
					).then((res) => {
						if (!res?.data?.prices?.length) return null
						const store: Record<string, number> = {}
						for (const [date, value] of res.data.prices) {
							store[String(date)] = value
							store[String(Math.floor(date / 1e3))] = value
						}
						return store
					})
			: skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!denominationGeckoId
	})

	const { data: protocolTokenData = null, isLoading: fetchingProtocolTokenData } = useQuery<
		(NonNullable<CgChartResponse['data']> & { prices: Array<[number, number]> }) | null
	>({
		queryKey: ['protocol-overview', protocolSlug, 'token-price-history', geckoId],
		queryFn: geckoId
			? () =>
					fetchJson<CgChartResponse | null>(
						`/api/public/tokens/charts/coingecko/${encodeURIComponent(geckoId)}?timeframe=MAX`
					).then((res) => {
						const data = res?.data
						const prices = data?.prices
						return prices?.length ? { ...data, prices } : null
					})
			: skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!(
			canFetchClientCharts &&
			(toggledMetrics.mcap === 'true' ||
				toggledMetrics.tokenPrice === 'true' ||
				toggledMetrics.tokenVolume === 'true' ||
				toggledMetrics.fdv === 'true') &&
			geckoId
		)
	})

	const { data: tokenTotalSupply = null, isLoading: fetchingTokenTotalSupply } = useQuery<number | null>({
		queryKey: ['protocol-overview', protocolSlug, 'token-supply', geckoId],
		queryFn: geckoId
			? () =>
					fetchJson<{ totalSupply: number | null }>(
						`/api/public/tokens/charts/coingecko/${encodeURIComponent(geckoId)}?kind=supply`
					).then((res) => res.totalSupply)
			: skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!(geckoId && toggledMetrics.fdv === 'true' && canFetchClientCharts)
	})
	const isTvlToggled = toggledMetrics.tvl === 'true'
	const isTotalAssetsToggled = toggledMetrics.totalAssets === 'true'
	const isTvsToggled = toggledMetrics.tvs === 'true'
	const isMcapToggled = toggledMetrics.mcap === 'true'
	const isTokenPriceToggled = toggledMetrics.tokenPrice === 'true'
	const isTokenVolumeToggled = toggledMetrics.tokenVolume === 'true'
	const isFdvToggled = toggledMetrics.fdv === 'true'
	const isUnlocksToggled = toggledMetrics.unlocks === 'true'
	const isIncentivesToggled = toggledMetrics.incentives === 'true'
	const isStakingTvlToggled = toggledMetrics.staking_tvl === 'true'
	const isBorrowedTvlToggled = toggledMetrics.borrowed_tvl === 'true'
	const isNftVolumeToggled = toggledMetrics.nftVolume === 'true'
	const isActiveAddressesToggled = toggledMetrics.activeAddresses === 'true'
	const isNewAddressesToggled = toggledMetrics.newAddresses === 'true'
	const isTransactionsToggled = toggledMetrics.transactions === 'true'
	const isGasUsedToggled = toggledMetrics.gasUsed === 'true'
	const isTreasuryToggled = toggledMetrics.treasury === 'true'
	const isUsdInflowsToggled = toggledMetrics.usdInflows === 'true'
	const isBridgeVolumeToggled = toggledMetrics.bridgeVolume === 'true'
	const primaryTvlChartLabel: ProtocolChartsLabels = isCEX ? 'Total Assets' : 'TVL'
	const isPrimaryTvlToggled = isCEX ? isTotalAssetsToggled : isTvlToggled
	const needsCompositeTvlChart = isPrimaryTvlToggled || isUsdInflowsToggled

	const {
		pool2: shouldFetchPool2Tvl,
		staking: shouldFetchStakingTvl,
		borrowed: shouldFetchBorrowedTvl,
		vesting: shouldFetchVestingTvl
	} = getProtocolExtraTvlChartFetchState({
		isRouterReady: canFetchClientCharts,
		currentTvlByChain,
		tvlSettings,
		needsCompositeTvlChart,
		isStakingTvlToggled,
		isBorrowedTvlToggled
	})
	const baseTvlChartData = useMemo((): Array<[number, number]> => {
		if (isCEX) {
			return prefetchedNumericCharts['Total Assets'] ?? prefetchedNumericCharts['TVL'] ?? []
		}
		return prefetchedNumericCharts['TVL'] ?? []
	}, [prefetchedNumericCharts, isCEX])
	const shouldFetchBaseTvlChart = !!(
		canFetchClientCharts &&
		metrics.tvl &&
		needsCompositeTvlChart &&
		baseTvlChartData.length === 0 &&
		availableCharts.includes(primaryTvlChartLabel)
	)
	const {
		data: fetchedBaseTvlChart,
		isLoading: fetchingBaseTvlChart,
		isError: baseTvlChartError
	} = useFetchProtocolTVLChart({
		protocol: protocolSlug,
		enabled: shouldFetchBaseTvlChart
	})
	const resolvedBaseTvlChartData = useMemo(
		(): Array<[number, number]> =>
			baseTvlChartData.length > 0
				? baseTvlChartData
				: fetchedBaseTvlChart
					? normalizeSeriesToSeconds(fetchedBaseTvlChart)
					: [],
		[baseTvlChartData, fetchedBaseTvlChart]
	)

	const {
		data: pool2TvlChart,
		isLoading: fetchingPool2TvlChart,
		isError: pool2TvlChartError
	} = useFetchProtocolTVLChart({
		protocol: protocolSlug,
		key: 'pool2',
		enabled: shouldFetchPool2Tvl
	})
	const {
		data: stakingTvlChart,
		isLoading: fetchingStakingTvlChart,
		isError: stakingTvlChartError
	} = useFetchProtocolTVLChart({
		protocol: protocolSlug,
		key: 'staking',
		enabled: shouldFetchStakingTvl
	})
	const {
		data: borrowedTvlChart,
		isLoading: fetchingBorrowedTvlChart,
		isError: borrowedTvlChartError
	} = useFetchProtocolTVLChart({
		protocol: protocolSlug,
		key: 'borrowed',
		enabled: shouldFetchBorrowedTvl
	})
	const {
		data: vestingTvlChart,
		isLoading: fetchingVestingTvlChart,
		isError: vestingTvlChartError
	} = useFetchProtocolTVLChart({
		protocol: protocolSlug,
		key: 'vesting',
		enabled: shouldFetchVestingTvl
	})

	const extraTvlCharts = useMemo(
		() =>
			buildExtraTvlCharts({
				pool2: pool2TvlChart,
				staking: stakingTvlChart,
				borrowed: borrowedTvlChart,
				vesting: vestingTvlChart
			}),
		[pool2TvlChart, stakingTvlChart, borrowedTvlChart, vestingTvlChart]
	)
	const isStakingRequiredForComposite = !!(
		needsCompositeTvlChart &&
		tvlSettings.staking &&
		currentTvlByChain?.staking != null
	)
	const isBorrowedRequiredForComposite = !!(
		needsCompositeTvlChart &&
		tvlSettings.borrowed &&
		currentTvlByChain?.borrowed != null
	)
	const isPool2RequiredForComposite = !!(
		needsCompositeTvlChart &&
		tvlSettings.pool2 &&
		currentTvlByChain?.pool2 != null
	)
	const isVestingRequiredForComposite = !!(
		needsCompositeTvlChart &&
		tvlSettings.vesting &&
		currentTvlByChain?.vesting != null
	)
	const isCompositeTvlUnavailable = !!(
		(shouldFetchBaseTvlChart && baseTvlChartError && fetchedBaseTvlChart === undefined) ||
		(isStakingRequiredForComposite && stakingTvlChartError && stakingTvlChart === undefined) ||
		(isBorrowedRequiredForComposite && borrowedTvlChartError && borrowedTvlChart === undefined) ||
		(isPool2RequiredForComposite && pool2TvlChartError && pool2TvlChart === undefined) ||
		(isVestingRequiredForComposite && vestingTvlChartError && vestingTvlChart === undefined)
	)
	const isCompositeTvlLoading = !!(
		(shouldFetchBaseTvlChart && fetchingBaseTvlChart) ||
		(isStakingRequiredForComposite && fetchingStakingTvlChart) ||
		(isBorrowedRequiredForComposite && fetchingBorrowedTvlChart) ||
		(isPool2RequiredForComposite && fetchingPool2TvlChart) ||
		(isVestingRequiredForComposite && fetchingVestingTvlChart)
	)
	const selectedExtraTvls = useMemo(
		() => getSelectedProtocolExtraTvlKeys(tvlSettings, currentTvlByChain),
		[tvlSettings, currentTvlByChain]
	)

	const tvlChart = useMemo(() => {
		if (isCompositeTvlUnavailable) return null
		return buildTvlChart({
			tvlChartData: resolvedBaseTvlChartData,
			extraTvlCharts,
			selectedExtraTvls,
			groupBy,
			denominationPriceHistory
		})
	}, [
		isCompositeTvlUnavailable,
		resolvedBaseTvlChartData,
		extraTvlCharts,
		selectedExtraTvls,
		groupBy,
		denominationPriceHistory
	])

	const adapterChartConfigs = useMemo(() => {
		const configs: Array<{
			descriptor: (typeof ADAPTER_CHART_DESCRIPTORS)[number]
			enabled: boolean
			prefetchedData: Array<[number, number]> | null
			queryOptions: ReturnType<typeof getPrefetchedProtocolChartQueryOptions>['queryOptions']
		}> = []

		for (const descriptor of ADAPTER_CHART_DESCRIPTORS) {
			let hasMetric = false
			for (const metricKey of descriptor.metricKeys) {
				if (metrics[metricKey]) {
					hasMetric = true
					break
				}
			}

			const queryParamKey = protocolCharts[descriptor.label]
			const enabled = !!(toggledMetrics[queryParamKey] === 'true' && hasMetric && canFetchClientCharts)
			const { prefetchedData, queryOptions } = getPrefetchedProtocolChartQueryOptions({
				label: descriptor.label,
				queryKey: ['protocol-overview', protocolSlug, descriptor.clientQueryKey],
				enabled,
				prefetchedCharts: prefetchedNumericCharts,
				queryFn: () =>
					fetchJson<Array<[number, number]> | null>(
						buildProtocolChartApiUrl({
							kind: 'adapter',
							adapterType: descriptor.chartRequest.adapterType,
							protocol: name,
							dataType: 'dataType' in descriptor.chartRequest ? descriptor.chartRequest.dataType : undefined
						})
					)
			})
			configs.push({
				descriptor,
				enabled,
				prefetchedData,
				queryOptions
			})
		}

		return configs
	}, [metrics, toggledMetrics, canFetchClientCharts, protocolSlug, name, prefetchedNumericCharts])

	const adapterChartQueryResults = useQueries({
		queries: adapterChartConfigs.map(({ queryOptions }) => queryOptions)
	})

	const adapterChartStates = useMemo(() => {
		const states = new Map<AdapterChartDescriptorLabel, AdapterChartState>()
		for (let index = 0; index < adapterChartConfigs.length; index++) {
			const config = adapterChartConfigs[index]
			if (config === undefined) continue
			const { descriptor, enabled, prefetchedData } = config
			const result = adapterChartQueryResults[index]
			if (!result) throw new Error(`Missing adapter chart query result for ${descriptor.label}`)
			states.set(descriptor.label, {
				data: result.data ?? prefetchedData,
				isLoading: result.isLoading,
				enabled
			})
		}
		return states
	}, [adapterChartConfigs, adapterChartQueryResults])

	const isUnlocksEnabled = !!(
		(toggledMetrics.unlocks === 'true' || toggledMetrics.incentives === 'true') &&
		(metrics.unlocks || metrics.incentives) &&
		canFetchClientCharts
	)
	const { data: unlocksAndIncentivesData = null, isLoading: fetchingUnlocksAndIncentives } =
		useQuery<UnlocksChartResponse | null>({
			queryKey: ['protocol-overview', protocolSlug, 'unlocks'],
			queryFn: () =>
				isUnlocksEnabled
					? fetchJson<UnlocksChartResponse | null>(buildProtocolChartApiUrl({ kind: 'unlocks', protocol: name }))
					: Promise.resolve(null),
			staleTime: 60 * 60 * 1000,
			refetchOnWindowFocus: false,
			retry: 0,
			enabled: isUnlocksEnabled
		})

	const isTreasuryEnabled = !!(toggledMetrics.treasury === 'true' && metrics.treasury && canFetchClientCharts)
	const { data: treasuryData, isLoading: fetchingTreasury } = usePrefetchedProtocolChartQuery({
		label: 'Treasury',
		prefetchedCharts: prefetchedTreasuryCharts,
		queryKey: ['protocol-overview', protocolSlug, 'treasury'],
		enabled: isTreasuryEnabled,
		queryFn: () =>
			fetchJson<Array<[number, number]> | null>(
				buildProtocolChartApiUrl({ kind: 'treasury', protocol: protocolSlug })
			).then((chart) => (chart ? normalizeSeriesToMilliseconds(chart) : null))
	})

	const isUsdInflowsEnabled = !!(toggledMetrics.usdInflows === 'true' && metrics.tvl && canFetchClientCharts)
	const usdInflowsData = useMemo(() => {
		if (!isUsdInflowsEnabled || isCompositeTvlUnavailable) return null

		const tvlChartInUsd = buildTvlChart({
			tvlChartData: resolvedBaseTvlChartData,
			extraTvlCharts,
			selectedExtraTvls,
			groupBy: 'daily',
			denominationPriceHistory: null
		})
		return buildUsdInflowsFromTvlChart(tvlChartInUsd)
	}, [isUsdInflowsEnabled, isCompositeTvlUnavailable, resolvedBaseTvlChartData, extraTvlCharts, selectedExtraTvls])
	const fetchingUsdInflows = isUsdInflowsEnabled && isCompositeTvlLoading

	const isBridgeVolumeEnabled = !!(toggledMetrics.bridgeVolume === 'true' && canFetchClientCharts)
	const prefetchedBridgeVolume = prefetchedChartsForMsRender['Bridge Volume'] ?? null
	const { data: fetchedBridgeVolume = null, isLoading: fetchingBridgeVolume } = useQuery<Array<
		[number, number | null]
	> | null>({
		queryKey: ['protocol-overview', protocolSlug, 'bridge-volume'],
		queryFn: () =>
			fetchJson<Array<[number, number | null]> | null>(
				buildProtocolChartApiUrl({ kind: 'bridge-volume', protocol: name })
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isBridgeVolumeEnabled && !prefetchedBridgeVolume
	})
	const bridgeVolumeData = fetchedBridgeVolume ?? prefetchedBridgeVolume

	const isTvsEnabled = !!(toggledMetrics.tvs === 'true' && canFetchClientCharts && availableCharts.includes('TVS'))
	const { data: tvsData, isLoading: fetchingTvs } = usePrefetchedProtocolChartQuery({
		label: 'TVS',
		prefetchedCharts: prefetchedNumericCharts,
		queryKey: ['protocol-overview', protocolSlug, 'tvs'],
		enabled: isTvsEnabled,
		queryFn: () =>
			fetchJson<Array<[number, number]>>(
				buildProtocolChartApiUrl({ kind: 'oracle-chart', protocol: oracleProtocolName })
			).then(normalizeSeriesToSeconds)
	})

	const { data: medianAPYData = null, isLoading: fetchingMedianAPY } = useFetchProtocolMedianAPY(
		canFetchClientCharts && toggledMetrics.medianApy === 'true' && metrics.yields && !protocolId.startsWith('parent#')
			? slug(name)
			: null
	)

	const { data: activeAddressesData = null, isLoading: fetchingActiveAddresses } = useFetchProtocolActivityChart({
		queryKey: 'active-users',
		protocol: canFetchClientCharts && toggledMetrics.activeAddresses === 'true' && metrics.activeUsers ? name : null,
		adapterType: 'active-users'
	})
	const { data: newAddressesData = null, isLoading: fetchingNewAddresses } = useFetchProtocolActivityChart({
		queryKey: 'new-users',
		protocol: canFetchClientCharts && toggledMetrics.newAddresses === 'true' && metrics.newUsers ? name : null,
		adapterType: 'new-users'
	})
	const { data: transactionsData = null, isLoading: fetchingTransactions } = useFetchProtocolActivityChart({
		queryKey: 'transactions',
		protocol: canFetchClientCharts && toggledMetrics.transactions === 'true' && metrics.txCount ? name : null,
		adapterType: 'active-users',
		dataType: 'dailyTransactionsCount'
	})
	const { data: gasUsedData = null, isLoading: fetchingGasUsed } = useFetchProtocolActivityChart({
		queryKey: 'gas-used-usd',
		protocol: canFetchClientCharts && toggledMetrics.gasUsed === 'true' && metrics.gasUsed ? name : null,
		adapterType: 'active-users',
		dataType: 'dailyGasUsedUsd'
	})

	const isNftVolumeEnabled = !!(toggledMetrics.nftVolume === 'true' && metrics.nfts && canFetchClientCharts)
	const { data: nftVolumeData = null, isLoading: fetchingNftVolume } = useQuery<Array<[number, number | null]>>({
		queryKey: ['protocol-overview', protocolSlug, 'nft-volume'],
		queryFn: () =>
			fetchJson<Array<[number, number | null]>>(buildProtocolChartApiUrl({ kind: 'nft-volume', protocol: name })),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isNftVolumeEnabled
	})

	const showNonUsdDenomination = !!(
		selectedDenomination &&
		selectedDenomination.symbol !== 'USD' &&
		denominationPriceHistory
	)
	const valueSymbol = showNonUsdDenomination && selectedDenomination ? selectedDenomination.symbol : '$'

	const chartData = useMemo(() => {
		const loadingStates: Array<{ isLoading: boolean; label: string }> = [
			{ isLoading: !!denominationGeckoId && fetchingDenominationPriceHistory, label: 'Denomination Price History' },
			{ isLoading: isMcapToggled && fetchingProtocolTokenData, label: 'Mcap' },
			{ isLoading: isTokenPriceToggled && fetchingProtocolTokenData, label: 'Token Price' },
			{ isLoading: isTokenVolumeToggled && fetchingProtocolTokenData, label: 'Token Volume' },
			{ isLoading: isFdvToggled && (fetchingProtocolTokenData || fetchingTokenTotalSupply), label: 'FDV' },
			{ isLoading: isPrimaryTvlToggled && isCompositeTvlLoading, label: primaryTvlChartLabel },
			{ isLoading: isStakingTvlToggled && shouldFetchStakingTvl && fetchingStakingTvlChart, label: 'Staking' },
			{
				isLoading: isBorrowedTvlToggled && shouldFetchBorrowedTvl && fetchingBorrowedTvlChart,
				label: 'Active Loans'
			},
			{ isLoading: isTvsToggled && fetchingTvs, label: 'TVS' },
			...ADAPTER_CHART_DESCRIPTORS.map((descriptor) => {
				const state = adapterChartStates.get(descriptor.label)
				return { isLoading: !!state?.enabled && !!state.isLoading, label: descriptor.label }
			}),
			{ isLoading: isUnlocksToggled && fetchingUnlocksAndIncentives, label: 'Unlocks' },
			{ isLoading: isIncentivesToggled && fetchingUnlocksAndIncentives, label: 'Incentives' },
			{ isLoading: isTreasuryToggled && fetchingTreasury, label: 'Treasury' },
			{ isLoading: isUsdInflowsToggled && fetchingUsdInflows, label: 'USD Inflows' },
			{ isLoading: toggledMetrics.medianApy === 'true' && fetchingMedianAPY, label: 'Median APY' },
			{ isLoading: isNftVolumeToggled && fetchingNftVolume, label: 'NFT Volume' },
			{ isLoading: isActiveAddressesToggled && fetchingActiveAddresses, label: 'Active Addresses' },
			{ isLoading: isNewAddressesToggled && fetchingNewAddresses, label: 'New Addresses' },
			{ isLoading: isTransactionsToggled && fetchingTransactions, label: 'Transactions' },
			{ isLoading: isGasUsedToggled && fetchingGasUsed, label: 'Gas Used' },
			{ isLoading: isBridgeVolumeToggled && fetchingBridgeVolume, label: 'Bridge Volume' }
		]
		const loadingCharts: Array<string> = []
		const loadingChartSet = new Set(loadingCharts)
		for (const state of loadingStates) {
			if (!state.isLoading || loadingChartSet.has(state.label)) continue
			loadingCharts.push(state.label)
			loadingChartSet.add(state.label)
		}

		const charts: { [key in ProtocolChartsLabels]?: Array<[number, number | null]> } = {}

		if (tvlChart !== null && (isTvlToggled || isTotalAssetsToggled)) {
			const chartName: ProtocolChartsLabels = isCEX ? 'Total Assets' : ('TVL' as const)
			charts[chartName] = tvlChart
		}
		if (tvsData !== null && isTvsToggled) {
			charts['TVS'] = formatLineChart({ data: tvsData, groupBy, denominationPriceHistory })
		}
		if (protocolTokenData) {
			if (isMcapToggled && protocolTokenData.mcaps)
				charts['Mcap'] = formatLineChart({
					data: protocolTokenData.mcaps,
					groupBy,
					dateInMs: true,
					denominationPriceHistory
				})
			if (isTokenPriceToggled)
				charts['Token Price'] = formatLineChart({
					data: protocolTokenData.prices,
					groupBy,
					dateInMs: true,
					denominationPriceHistory
				})
			if (isTokenVolumeToggled && protocolTokenData.volumes)
				charts['Token Volume'] = formatBarChart({
					data: protocolTokenData.volumes,
					groupBy,
					dateInMs: true,
					denominationPriceHistory
				})
			if (isFdvToggled && tokenTotalSupply != null) {
				const fdvData: Array<[number, number]> = []
				for (const [date, price] of protocolTokenData.prices) {
					fdvData.push([date, price * tokenTotalSupply])
				}
				charts['FDV'] = formatLineChart({
					data: fdvData,
					groupBy,
					dateInMs: true,
					denominationPriceHistory
				})
			}
		}
		for (const descriptor of ADAPTER_CHART_DESCRIPTORS) {
			const chart = adapterChartStates.get(descriptor.label)?.data
			if (!chart) continue
			charts[descriptor.label] =
				descriptor.renderKind === 'line'
					? formatLineChart({ data: chart, groupBy, denominationPriceHistory })
					: formatBarChart({ data: chart, groupBy, denominationPriceHistory })
		}

		if (
			isUnlocksToggled &&
			unlocksAndIncentivesData?.chartData?.documented &&
			unlocksAndIncentivesData.chartData.documented.length > 0
		) {
			const store: Record<string, number> = {}
			for (const { timestamp, ...rest } of unlocksAndIncentivesData.chartData.documented) {
				const dateSec = Math.floor(timestamp / 1e3)
				const dateKey = getGroupedTimestampSec(dateSec, groupBy)
				let total = 0
				for (const label in rest) {
					const val = rest[label]
					if (val != null) total += val
				}
				store[dateKey] = (store[dateKey] ?? 0) + total
			}
			charts['Unlocks'] = buildChartRowsFromTimestampRecord(store, 1e3)
		}

		if (isIncentivesToggled && unlocksAndIncentivesData?.unlockUsdChart) {
			const nonZeroIndex = unlocksAndIncentivesData.unlockUsdChart.findIndex(([_, value]) => value > 0)
			const startIndex = nonZeroIndex === -1 ? 0 : nonZeroIndex
			charts['Incentives'] = formatBarChart({
				data: unlocksAndIncentivesData.unlockUsdChart.slice(startIndex),
				groupBy,
				denominationPriceHistory
			})
		}

		if (extraTvlCharts.charts.staking && isStakingTvlToggled) {
			const stakingChartData = buildChartRowsFromTimestampRecord(extraTvlCharts.charts.staking, 1e3)
			charts['Staking'] = formatLineChart({
				data: stakingChartData,
				groupBy,
				dateInMs: true,
				denominationPriceHistory
			})
		}
		if (extraTvlCharts.charts.borrowed && isBorrowedTvlToggled) {
			const borrowedChartData = buildChartRowsFromTimestampRecord(extraTvlCharts.charts.borrowed, 1e3)
			charts['Active Loans'] = formatLineChart({
				data: borrowedChartData,
				groupBy,
				dateInMs: true,
				denominationPriceHistory
			})
		}

		if (medianAPYData) {
			const medianAPYChartData: Array<[number, number]> = []
			for (const item of medianAPYData) {
				medianAPYChartData.push([item.date * 1e3, item.medianAPY])
			}
			charts['Median APY'] = formatLineChart({
				data: medianAPYChartData,
				groupBy,
				dateInMs: true,
				denominationPriceHistory: null
			})
		}

		if (nftVolumeData && isNftVolumeToggled)
			charts['NFT Volume'] = formatNullableBarChart({
				data: nftVolumeData,
				groupBy,
				dateInMs: true,
				denominationPriceHistory
			})
		if (activeAddressesData && isActiveAddressesToggled)
			charts['Active Addresses'] = formatBarChart({
				data: activeAddressesData,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: true
			})
		if (newAddressesData && isNewAddressesToggled)
			charts['New Addresses'] = formatBarChart({
				data: newAddressesData,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: true
			})
		if (transactionsData && isTransactionsToggled)
			charts['Transactions'] = formatBarChart({
				data: transactionsData,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: true
			})
		if (gasUsedData && isGasUsedToggled)
			charts['Gas Used'] = formatBarChart({
				data: gasUsedData,
				groupBy,
				denominationPriceHistory,
				dateInMs: true
			})
		if (treasuryData && isTreasuryToggled)
			charts['Treasury'] = formatLineChart({ data: treasuryData, groupBy, dateInMs: true, denominationPriceHistory })
		if (usdInflowsData && isUsdInflowsToggled)
			charts['USD Inflows'] = formatBarChart({ data: usdInflowsData, groupBy, denominationPriceHistory })
		if (bridgeVolumeData && isBridgeVolumeToggled)
			charts['Bridge Volume'] = formatNullableBarChart({
				data: bridgeVolumeData,
				groupBy,
				dateInMs: true,
				denominationPriceHistory
			})

		const filteredCharts: Partial<Record<ProtocolChartsLabels, Array<[number, number | null]>>> = {}
		for (const chartLabel of availableCharts) {
			const chart = charts[chartLabel]
			if (!chart) continue
			const queryParamKey = protocolCharts[chartLabel]
			if (!queryParamKey || toggledMetrics[queryParamKey] === 'true') {
				filteredCharts[chartLabel] = chart
			}
		}

		const failedMetrics = availableCharts.filter((chartLabel) => {
			const queryParamKey = protocolCharts[chartLabel]
			if (!queryParamKey || toggledMetrics[queryParamKey] !== 'true') return false
			if (loadingChartSet.has(chartLabel)) return false
			return !Object.hasOwn(filteredCharts, chartLabel)
		})
		return { finalCharts: filteredCharts, valueSymbol, loadingCharts, failedMetrics }
	}, [
		tvlChart,
		fetchingDenominationPriceHistory,
		denominationPriceHistory,
		fetchingProtocolTokenData,
		protocolTokenData,
		fetchingTokenTotalSupply,
		tokenTotalSupply,
		isCompositeTvlLoading,
		fetchingStakingTvlChart,
		shouldFetchStakingTvl,
		fetchingBorrowedTvlChart,
		shouldFetchBorrowedTvl,
		denominationGeckoId,
		adapterChartStates,
		fetchingTvs,
		tvsData,
		fetchingUnlocksAndIncentives,
		unlocksAndIncentivesData,
		fetchingTreasury,
		treasuryData,
		fetchingUsdInflows,
		usdInflowsData,
		fetchingMedianAPY,
		medianAPYData,
		fetchingActiveAddresses,
		activeAddressesData,
		fetchingNewAddresses,
		newAddressesData,
		fetchingTransactions,
		transactionsData,
		fetchingGasUsed,
		gasUsedData,
		fetchingNftVolume,
		nftVolumeData,
		fetchingBridgeVolume,
		bridgeVolumeData,
		isTvlToggled,
		isTotalAssetsToggled,
		isPrimaryTvlToggled,
		isTvsToggled,
		isMcapToggled,
		isTokenPriceToggled,
		isTokenVolumeToggled,
		isFdvToggled,
		isUnlocksToggled,
		isIncentivesToggled,
		isStakingTvlToggled,
		isBorrowedTvlToggled,
		isNftVolumeToggled,
		isActiveAddressesToggled,
		isNewAddressesToggled,
		isTransactionsToggled,
		isGasUsedToggled,
		isTreasuryToggled,
		isUsdInflowsToggled,
		isBridgeVolumeToggled,
		primaryTvlChartLabel,
		toggledMetrics,
		groupBy,
		extraTvlCharts,
		availableCharts,
		valueSymbol,
		isCEX
	])

	return chartData
}
