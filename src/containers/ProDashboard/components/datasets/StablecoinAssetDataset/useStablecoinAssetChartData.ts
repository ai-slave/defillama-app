import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { prepareRuntimePieChartData, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import {
	buildStablecoinAssetCacheValue,
	type StablecoinAssetCacheValue
} from '~/containers/ProDashboard/server/stablecoinFetchers'
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
import {
	buildAreaPayloadFromCollection,
	buildDominancePayloadFromCollection,
	buildTotalMcapPayload,
	collectCanonicalStablecoinArea,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT,
	type StablecoinBreakdownSelectionOptions,
	type StablecoinCanonicalHistory
} from '~/containers/Stablecoins/chartSeries'
import { getStablecoinValueFromPoint, isStablecoinChartDateVisible } from '~/containers/Stablecoins/utils'
import type { StablecoinAssetChartType } from '../../../types'

type StablecoinAssetPresentation =
	| { chartType: 'totalCirc'; dataset: MultiSeriesChartDataset; totalCirculating: number | null }
	| {
			chartType: 'chainMcaps' | 'chainDominance'
			dataset: MultiSeriesChartDataset
			charts: MultiSeriesChartSeriesConfig[]
			availableSeries: string[]
			totalCirculating: number | null
	  }
	| { chartType: 'chainPie'; pieSeries: RuntimePieChartData; totalCirculating: number | null }

interface UseStablecoinAssetChartDataResult {
	presentation: StablecoinAssetPresentation
	chainsUnique: string[]
	stablecoinName: string
	stablecoinSymbol: string
	isLoading: boolean
	error: Error | null
}

const EMPTY_ASSET_PRESENTATIONS: Record<StablecoinAssetChartType, StablecoinAssetPresentation> = {
	totalCirc: {
		chartType: 'totalCirc',
		dataset: { source: [], dimensions: ['timestamp', 'Circulating'] },
		totalCirculating: null
	},
	chainMcaps: {
		chartType: 'chainMcaps',
		dataset: { source: [], dimensions: ['timestamp'] },
		charts: [],
		availableSeries: [],
		totalCirculating: null
	},
	chainDominance: {
		chartType: 'chainDominance',
		dataset: { source: [], dimensions: ['timestamp'] },
		charts: [],
		availableSeries: [],
		totalCirculating: null
	},
	chainPie: {
		chartType: 'chainPie',
		pieSeries: { peers: [], limit: 10, upstreamOthersValue: 0 },
		totalCirculating: null
	}
}

const getStablecoinAssetChartParams = (rawData: Pick<StablecoinAssetCacheValue, 'chainsData' | 'chainsUnique'>) => ({
	chartDataByAssetOrChain: rawData.chainsData,
	assetsOrChainsList: rawData.chainsUnique,
	issuanceType: 'circulating' as const,
	selectedChain: undefined,
	totalChartTooltipLabel: 'Circulating'
})

export function buildStablecoinAssetPresentation(
	rawData: Pick<StablecoinAssetCacheValue, 'chainsData' | 'chainsUnique'>,
	chartType: StablecoinAssetChartType,
	periodBounds?: { start: number; end: number } | null,
	selectionOptions?: StablecoinBreakdownSelectionOptions,
	canonicalHistory?: StablecoinCanonicalHistory | null
): StablecoinAssetPresentation {
	const params = getStablecoinAssetChartParams(rawData)
	if (chartType === 'totalCirc') {
		const dataset = buildTotalMcapPayload(params, { totalName: 'Circulating' }).dataset
		return {
			chartType,
			dataset,
			totalCirculating: (dataset.source.at(-1)?.[1] as number | undefined) ?? null
		}
	}
	if (chartType === 'chainMcaps') {
		const history =
			canonicalHistory ?? collectCanonicalStablecoinArea(params, { includeSummary: true, seriesMode: 'history' })
		const payload = buildAreaPayloadFromCollection(history, {
			stackName: 'chainMcaps',
			fillMissingValues: true,
			summary: true,
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
			...selectionOptions
		})
		const dataset = payload.dataset
		return {
			chartType,
			dataset,
			charts: payload.charts,
			availableSeries: payload.availableSeries ?? [],
			totalCirculating: payload.summary?.totalMcapCurrent ?? null
		}
	}
	if (chartType === 'chainDominance') {
		const history = canonicalHistory ?? collectCanonicalStablecoinArea(params, { seriesMode: 'history' })
		const payload = buildDominancePayloadFromCollection(history, {
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
			...selectionOptions
		})
		return {
			chartType,
			dataset: payload.dataset,
			charts: payload.charts,
			availableSeries: payload.availableSeries ?? [],
			totalCirculating: history.totals.at(-1) ?? null
		}
	}

	let latestTimestamp = Number.NEGATIVE_INFINITY
	for (const chain of rawData.chainsData) {
		for (let index = chain.length - 1; index >= 0; index--) {
			const timestamp = chain[index].date
			if (!isStablecoinChartDateVisible(undefined, timestamp)) continue
			if (periodBounds && (timestamp < periodBounds.start || timestamp > periodBounds.end)) continue
			if (timestamp > latestTimestamp) latestTimestamp = timestamp
			break
		}
	}
	if (!Number.isFinite(latestTimestamp)) return EMPTY_ASSET_PRESENTATIONS[chartType]
	const chainData: Array<{ name: string; circulating: number }> = []
	let totalCirculating = 0
	for (let chainIndex = 0; chainIndex < rawData.chainsData.length; chainIndex++) {
		const chain = rawData.chainsData[chainIndex]
		let value = 0
		for (let pointIndex = chain.length - 1; pointIndex >= 0; pointIndex--) {
			const point = chain[pointIndex]
			if (point.date < latestTimestamp) break
			if (point.date !== latestTimestamp) continue
			value = getStablecoinValueFromPoint(point, 'circulating') ?? 0
			break
		}
		chainData.push({ name: rawData.chainsUnique[chainIndex], circulating: value })
		totalCirculating += value
	}
	return {
		chartType,
		pieSeries: prepareRuntimePieChartData({
			data: chainData,
			sliceIdentifier: 'name',
			sliceValue: 'circulating',
			limit: 10
		}),
		totalCirculating
	}
}

export function useStablecoinAssetChartData(
	stablecoinSlug: string,
	chartType: StablecoinAssetChartType,
	periodBounds?: { start: number; end: number } | null,
	selectionOptions?: StablecoinBreakdownSelectionOptions
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
	const canonicalHistory = useMemo(() => {
		if (!rawData || (chartType !== 'chainMcaps' && chartType !== 'chainDominance')) return null
		return collectCanonicalStablecoinArea(getStablecoinAssetChartParams(rawData), {
			includeSummary: chartType === 'chainMcaps',
			seriesMode: 'history'
		})
	}, [chartType, rawData])

	const presentation = useMemo(
		() =>
			rawData
				? buildStablecoinAssetPresentation(rawData, chartType, periodBounds, selectionOptions, canonicalHistory)
				: EMPTY_ASSET_PRESENTATIONS[chartType],
		[rawData, chartType, periodBounds, selectionOptions, canonicalHistory]
	)

	return useMemo(
		() => ({
			presentation,
			chainsUnique: rawData?.chainsUnique || [],
			stablecoinName: rawData?.stablecoinName || '',
			stablecoinSymbol: rawData?.stablecoinSymbol || '',
			isLoading,
			error
		}),
		[presentation, rawData?.chainsUnique, rawData?.stablecoinName, rawData?.stablecoinSymbol, isLoading, error]
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
