import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { preparePieChartData } from '~/components/ECharts/utils'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { buildStablecoinAssetCacheValue } from '~/containers/ProDashboard/server/stablecoinFetchers'
import {
	fetchStablecoinAssetViaProxy,
	fetchStablecoinsListViaProxy
} from '~/containers/ProDashboard/services/fetchViaProxy'
import {
	fetchStablecoinAssetApi,
	fetchStablecoinAssetsApi,
	fetchStablecoinPeggedConfigApi
} from '~/containers/Stablecoins/api'
import type { StablecoinDetailResponse } from '~/containers/Stablecoins/api.types'
import { buildAreaPayload, buildDominancePayload, buildTotalMcapPayload } from '~/containers/Stablecoins/chartSeries'
import { getStablecoinValueFromPoint } from '~/containers/Stablecoins/utils'
import type { StablecoinAssetChartType } from '../../../types'

interface UseStablecoinAssetChartDataResult {
	totalDataset: MultiSeriesChart2Dataset
	areaDataset: MultiSeriesChart2Dataset
	dominanceDataset: MultiSeriesChart2Dataset
	chainsCirculatingValues: Array<{ name: string; value: number }>
	chainsUnique: string[]
	stablecoinName: string
	stablecoinSymbol: string
	totalCirculating: number | null
	isLoading: boolean
	error: Error | null
}

export function useStablecoinAssetChartData(
	stablecoinSlug: string,
	chartType: StablecoinAssetChartType
): UseStablecoinAssetChartDataResult {
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const {
		data: rawData,
		isLoading,
		error
	} = useQuery({
		queryKey: ['pro-dashboard', 'stablecoin-asset-chart-data', stablecoinSlug],
		queryFn: async () => {
			if (!stablecoinSlug) return null

			let res: StablecoinDetailResponse | null
			if (authToken) {
				res = await fetchStablecoinAssetViaProxy(stablecoinSlug, authToken)
			} else {
				const peggedNameToPeggedIDMapping = await fetchStablecoinPeggedConfigApi()
				const peggedID = peggedNameToPeggedIDMapping[stablecoinSlug]
				if (!peggedID) return null
				res = await fetchStablecoinAssetApi(peggedID)
			}

			return buildStablecoinAssetCacheValue(res)
		},
		staleTime: 5 * 60 * 1000,
		refetchInterval: 5 * 60 * 1000,
		enabled: !!stablecoinSlug && streamDone
	})

	const chartData = useMemo(() => {
		if (!rawData) {
			return {
				totalDataset: { source: [], dimensions: ['timestamp', 'Circulating'] },
				areaDataset: { source: [], dimensions: ['timestamp'] },
				dominanceDataset: { source: [], dimensions: ['timestamp'] }
			}
		}

		const { chainsData, chainsUnique } = rawData

		const params = {
			chartDataByAssetOrChain: chainsData,
			assetsOrChainsList: chainsUnique,
			issuanceType: 'circulating',
			selectedChain: undefined,
			totalChartTooltipLabel: 'Circulating'
		}
		if (chartType === 'totalCirc') {
			return {
				totalDataset: buildTotalMcapPayload(params, { totalName: 'Circulating' }).dataset,
				areaDataset: { source: [], dimensions: ['timestamp'] },
				dominanceDataset: { source: [], dimensions: ['timestamp'] }
			}
		}
		if (chartType === 'chainDominance') {
			return {
				totalDataset: { source: [], dimensions: ['timestamp', 'Circulating'] },
				areaDataset: { source: [], dimensions: ['timestamp'] },
				dominanceDataset: buildDominancePayload(params, { normalizeTo100: true }).dataset
			}
		}
		return {
			totalDataset: { source: [], dimensions: ['timestamp', 'Circulating'] },
			areaDataset: buildAreaPayload(params, { stackName: 'chainMcaps', fillMissingValues: true }).dataset,
			dominanceDataset: { source: [], dimensions: ['timestamp'] }
		}
	}, [rawData, chartType])

	const chainsCirculatingValues = useMemo(() => {
		const latestData = chartData.areaDataset.source.at(-1)
		if (!rawData || !latestData) return []

		const chainData = rawData.chainsUnique.map((name: string) => ({
			name,
			circulating: (latestData[name] as number | undefined) ?? 0
		}))

		return preparePieChartData({ data: chainData, sliceIdentifier: 'name', sliceValue: 'circulating', limit: 10 })
	}, [rawData, chartData.areaDataset])

	const totalCirculating: number | null = useMemo(() => {
		const lastEntry = chartData.totalDataset.source.at(-1)
		if (lastEntry) return (lastEntry.Circulating as number | undefined) ?? null
		if (!rawData) return null
		const lastAreaEntry = chartData.areaDataset.source.at(-1)
		if (lastAreaEntry) {
			let total = 0
			for (const chain of rawData.chainsUnique) total += (lastAreaEntry[chain] as number | undefined) ?? 0
			return total
		}

		let latestTimestamp = 0
		for (const chain of rawData.chainsData) {
			const point = chain[chain.length - 1]
			if (point && Number(point.date) > latestTimestamp) latestTimestamp = Number(point.date)
		}
		let total = 0
		let hasValue = false
		for (const chain of rawData.chainsData) {
			const point = chain[chain.length - 1]
			if (!point || Number(point.date) !== latestTimestamp) continue
			const value = getStablecoinValueFromPoint(point, 'circulating')
			if (value == null) continue
			total += value
			hasValue = true
		}
		return hasValue ? total : null
	}, [chartData.totalDataset, chartData.areaDataset, rawData])

	return useMemo(
		() => ({
			totalDataset: chartData.totalDataset,
			areaDataset: chartData.areaDataset,
			dominanceDataset: chartData.dominanceDataset,
			chainsCirculatingValues,
			chainsUnique: rawData?.chainsUnique || [],
			stablecoinName: rawData?.stablecoinName || '',
			stablecoinSymbol: rawData?.stablecoinSymbol || '',
			totalCirculating,
			isLoading,
			error
		}),
		[
			chartData.totalDataset,
			chartData.areaDataset,
			chartData.dominanceDataset,
			chainsCirculatingValues,
			rawData?.chainsUnique,
			rawData?.stablecoinName,
			rawData?.stablecoinSymbol,
			totalCirculating,
			isLoading,
			error
		]
	)
}

export interface StablecoinAssetInfo {
	name: string
	symbol: string
	mcap: number
	geckoId: string | null
}

export function useStablecoinAssetsList() {
	const authToken = useContext(ProxyAuthTokenContext)
	return useQuery({
		queryKey: ['pro-dashboard', 'stablecoin-assets-list'],
		queryFn: async () => {
			const data = authToken ? await fetchStablecoinsListViaProxy(authToken) : await fetchStablecoinAssetsApi()
			const peggedAssets = data.peggedAssets
			return peggedAssets
				.map((asset) => {
					let mcap = 0
					for (const pegType in asset.circulating) mcap += asset.circulating[pegType]
					return {
						name: asset.name,
						symbol: asset.symbol,
						mcap,
						geckoId: asset.gecko_id
					}
				})
				.filter((a: StablecoinAssetInfo) => a.mcap > 0)
				.sort((a: StablecoinAssetInfo, b: StablecoinAssetInfo) => b.mcap - a.mcap)
		},
		staleTime: 60 * 60 * 1000
	})
}
