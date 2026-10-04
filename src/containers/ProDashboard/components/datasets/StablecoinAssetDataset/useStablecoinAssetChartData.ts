import { useQuery } from '@tanstack/react-query'
import { useCallback, useContext, useMemo } from 'react'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { prepareRuntimePieChartData, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import {
	buildStablecoinAssetCacheValue,
	type StablecoinAssetCacheValue
} from '~/containers/ProDashboard/stablecoinData'
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
import {
	getStablecoinValueFromPoint,
	isInactiveStablecoin,
	isStablecoinChartDateVisible,
	sumStablecoinPegBalances
} from '~/containers/Stablecoins/utils'
import { queryReadFailed } from '~/utils/query'
import type { StablecoinAssetChartType } from '../../../types'

type StablecoinAssetPresentation =
	| { chartType: 'totalCirc'; dataset: MultiSeriesChartDataset; totalCirculating: number | null }
	| {
			chartType: 'chainMcaps' | 'chainDominance'
			dataset: MultiSeriesChartDataset
			charts: Array<MultiSeriesChartSeriesConfig>
			availableSeries: Array<string>
			totalCirculating: number | null
	  }
	| { chartType: 'chainPie'; pieSeries: RuntimePieChartData; totalCirculating: number | null }

interface UseStablecoinAssetChartDataResult {
	presentation: StablecoinAssetPresentation
	chainsUnique: Array<string>
	stablecoinName: string
	stablecoinSymbol: string
	isInactive: boolean
	prepareCsvDataset: () => MultiSeriesChartDataset
	isLoading: boolean
	isFetching: boolean
	readFailed: boolean
	refetch: () => void
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
	totalChartTooltipLabel: 'Circulating'
})

export function buildStablecoinAssetPresentation(
	rawData: Pick<StablecoinAssetCacheValue, 'chainsData' | 'chainsUnique' | 'stablecoinSymbol'>,
	chartType: StablecoinAssetChartType,
	periodBounds?: { start: number; end: number } | null,
	selectionOptions?: StablecoinBreakdownSelectionOptions,
	canonicalHistory?: StablecoinCanonicalHistory | null
): StablecoinAssetPresentation {
	const params = getStablecoinAssetChartParams(rawData)
	if (chartType === 'totalCirc') {
		const dataset = buildTotalMcapPayload(params, {
			totalName: 'Circulating',
			valueSymbol: rawData.stablecoinSymbol
		}).dataset
		const latestTotal = dataset.source.at(-1)?.[1]
		return {
			chartType,
			dataset,
			totalCirculating: typeof latestTotal === 'number' ? latestTotal : null
		}
	}
	if (chartType === 'chainMcaps') {
		const history = canonicalHistory ?? collectCanonicalStablecoinArea(params, { seriesMode: 'history' })
		const payload = buildAreaPayloadFromCollection(history, {
			stackName: 'chainMcaps',
			valueSymbol: rawData.stablecoinSymbol,
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
			...selectionOptions
		})
		const dataset = payload.dataset
		return {
			chartType,
			dataset,
			charts: payload.charts,
			availableSeries: payload.availableSeries ?? [],
			totalCirculating: history.totals.at(-1) ?? null
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
			const point = chain[index]
			if (!point) continue
			const timestamp = point.date
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
		const chainName = rawData.chainsUnique[chainIndex]
		if (!chain || !chainName) throw new Error('Stablecoin chain names and histories must have matching indexes')
		let value: number | null = null
		for (let pointIndex = chain.length - 1; pointIndex >= 0; pointIndex--) {
			const point = chain[pointIndex]
			if (!point) continue
			if (point.date < latestTimestamp) break
			if (point.date !== latestTimestamp) continue
			value = getStablecoinValueFromPoint(point, 'circulating')
			break
		}
		if (value == null) continue
		chainData.push({ name: chainName, circulating: value })
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

/** The chart's picked chains without the series limit; the chain pie exports from its own pie selection. */
export function buildStablecoinAssetCsvDataset(
	rawData: Pick<StablecoinAssetCacheValue, 'chainsData' | 'chainsUnique' | 'stablecoinSymbol'>,
	chartType: StablecoinAssetChartType,
	periodBounds: { start: number; end: number } | null | undefined,
	selectionOptions: StablecoinBreakdownSelectionOptions | undefined,
	canonicalHistory?: StablecoinCanonicalHistory | null
): MultiSeriesChartDataset {
	const presentation = buildStablecoinAssetPresentation(
		rawData,
		chartType,
		periodBounds,
		{ ...selectionOptions, seriesLimit: Number.POSITIVE_INFINITY },
		canonicalHistory
	)
	if (presentation.chartType === 'chainPie') throw new Error('The chain pie exports from its own pie selection')
	return presentation.dataset
}

export function useStablecoinAssetChartData(
	stablecoinSlug: string,
	chartType: StablecoinAssetChartType,
	periodBounds?: { start: number; end: number } | null,
	selectionOptions?: StablecoinBreakdownSelectionOptions
): UseStablecoinAssetChartDataResult {
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const chartQuery = useQuery({
		queryKey: ['pro-dashboard', 'stablecoin-asset-chart-data', stablecoinSlug],
		queryFn: async () => {
			if (!stablecoinSlug) return null

			let res: StablecoinDetailResponse | null
			if (authToken) {
				res = await fetchProDashboardProxy('stablecoinAsset', { slug: stablecoinSlug }, authToken)
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
	const { data: rawData, isLoading, isFetching, refetch } = chartQuery
	const canonicalHistory = useMemo(() => {
		if (!rawData || (chartType !== 'chainMcaps' && chartType !== 'chainDominance')) return null
		return collectCanonicalStablecoinArea(getStablecoinAssetChartParams(rawData), { seriesMode: 'history' })
	}, [chartType, rawData])

	const presentation = useMemo(
		() =>
			rawData
				? buildStablecoinAssetPresentation(rawData, chartType, periodBounds, selectionOptions, canonicalHistory)
				: EMPTY_ASSET_PRESENTATIONS[chartType],
		[rawData, chartType, periodBounds, selectionOptions, canonicalHistory]
	)
	const isInactive = rawData ? isInactiveStablecoin(rawData.peggedAssetData) : false
	const readFailed = queryReadFailed(chartQuery)
	const prepareCsvDataset = useCallback(() => {
		if (!rawData) throw new Error('Stablecoin asset data is unavailable')
		return buildStablecoinAssetCsvDataset(rawData, chartType, periodBounds, selectionOptions, canonicalHistory)
	}, [canonicalHistory, chartType, periodBounds, rawData, selectionOptions])

	return useMemo(
		() => ({
			presentation,
			chainsUnique: rawData?.chainsUnique ?? [],
			stablecoinName: rawData?.stablecoinName ?? '',
			stablecoinSymbol: rawData?.stablecoinSymbol ?? '',
			isInactive,
			prepareCsvDataset,
			isLoading,
			isFetching,
			readFailed,
			refetch
		}),
		[
			presentation,
			rawData?.chainsUnique,
			rawData?.stablecoinName,
			rawData?.stablecoinSymbol,
			isInactive,
			prepareCsvDataset,
			isLoading,
			isFetching,
			readFailed,
			refetch
		]
	)
}

export interface StablecoinAssetInfo {
	name: string
	symbol: string
	mcap: number | null
	geckoId: string | null
}

export function useStablecoinAssetsList() {
	const authToken = useContext(ProxyAuthTokenContext)
	return useQuery({
		queryKey: ['pro-dashboard', 'stablecoin-assets-list'],
		queryFn: async () => {
			const data = authToken
				? await fetchProDashboardProxy('stablecoinsList', {}, authToken)
				: await fetchStablecoinAssetsApi()
			const assets: Array<StablecoinAssetInfo> = []
			for (const asset of data.peggedAssets) {
				const mcap = sumStablecoinPegBalances(asset.circulating)
				const isInactive = isInactiveStablecoin(asset)
				if (mcap > 0 || isInactive) {
					assets.push({
						name: asset.name,
						symbol: asset.symbol,
						mcap: isInactive ? null : mcap,
						geckoId: asset.gecko_id
					})
				}
			}
			assets.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))
			return assets
		},
		staleTime: 60 * 60 * 1000
	})
}
