import {
	fetchStablecoinAssetApi,
	fetchStablecoinAssetsApi,
	fetchStablecoinChartApi,
	fetchStablecoinPeggedConfigApi,
	fetchStablecoinPricesApi,
	fetchStablecoinRatesApi
} from '~/containers/Stablecoins/api'
import type {
	StablecoinChartResponse,
	StablecoinChainBalanceToken,
	StablecoinDetailResponse,
	StablecoinPricesResponse,
	StablecoinRatesResponse,
	StablecoinsListResponse
} from '~/containers/Stablecoins/api.types'
import type { StablecoinOverviewChartInputs } from '~/containers/Stablecoins/types'
import { buildUniqueStablecoinChartLabels, formatPeggedAssetsData } from '~/containers/Stablecoins/utils'

type StablecoinChartMcapPoint = {
	date: number
	mcap: Record<string, number>
}

export type StablecoinsChartCacheValue = StablecoinOverviewChartInputs & {
	pieAssets: Array<{ symbol: string; mcap: number | null }>
}

export interface StablecoinBaselineData {
	peggedData: StablecoinsListResponse
	priceData: StablecoinPricesResponse
	rateData: StablecoinRatesResponse
}

export async function fetchStablecoinBaselineData(): Promise<StablecoinBaselineData> {
	const [peggedData, priceData, rateData] = await Promise.all([
		fetchStablecoinAssetsApi(),
		fetchStablecoinPricesApi(),
		fetchStablecoinRatesApi()
	])
	return { peggedData, priceData, rateData }
}

/** Use the full `/all` chart response when double-count exclusions matter; `all-llama-app` omits those IDs. */
export function buildStablecoinsChartCacheValue({
	peggedData,
	chainData,
	chain
}: {
	peggedData: StablecoinsListResponse
	chainData: StablecoinChartResponse
	chain: string
}): StablecoinsChartCacheValue {
	const { peggedAssets } = peggedData
	const chartDataByPeggedAsset: StablecoinChartMcapPoint[][] = []
	const peggedAssetNames = buildUniqueStablecoinChartLabels(peggedAssets, 'name')
	const pieAssetLabels = buildUniqueStablecoinChartLabels(peggedAssets, 'symbol')
	const peggedAssetIdToChartDataIndex: Record<string, number> = {}
	const doublecountedIds: number[] = []
	const doublecountedSourceIds = new Set(chainData.doublecountedIds ?? [])

	for (let index = 0; index < peggedAssets.length; index++) {
		const asset = peggedAssets[index]
		peggedAssetIdToChartDataIndex[asset.id] = index
		if (doublecountedSourceIds.has(asset.id)) doublecountedIds.push(index)

		const charts = chainData.breakdown[asset.id] ?? []
		const formattedCharts: StablecoinChartMcapPoint[] = []
		for (const chart of charts) {
			if (!chart.totalCirculatingUSD) continue
			formattedCharts.push({ date: Number(chart.date), mcap: chart.totalCirculatingUSD })
		}

		chartDataByPeggedAsset.push(formattedCharts)
	}

	const pieAssets: StablecoinsChartCacheValue['pieAssets'] = []
	for (let index = 0; index < peggedAssets.length; index++) {
		const asset = peggedAssets[index]
		if (chain !== 'All' && !asset.chains.includes(chain)) continue
		const latestPoint = chartDataByPeggedAsset[index]?.at(-1)
		let mcap = 0
		for (const pegType in latestPoint?.mcap) mcap += latestPoint.mcap[pegType]
		pieAssets.push({ symbol: pieAssetLabels[index], mcap: latestPoint ? mcap : null })
	}

	return {
		chartDataByPeggedAsset,
		peggedAssetNames,
		peggedAssetIdToChartDataIndex,
		doublecountedIds,
		pieAssets
	}
}

export function buildStablecoinsTableData({
	baseline,
	chainData,
	chain
}: {
	baseline: StablecoinBaselineData
	chainData: StablecoinChartResponse
	chain: string
}) {
	const chartCache = buildStablecoinsChartCacheValue({
		peggedData: baseline.peggedData,
		chainData,
		chain
	})
	const filteredPeggedAssets = formatPeggedAssetsData({
		peggedAssets: baseline.peggedData.peggedAssets,
		chartDataByPeggedAsset: chartCache.chartDataByPeggedAsset,
		priceData: baseline.priceData,
		rateData: baseline.rateData,
		peggedAssetIdToChartDataIndex: chartCache.peggedAssetIdToChartDataIndex,
		chain: chain === 'All' ? null : chain
	})

	return filteredPeggedAssets.map((asset) => {
		return {
			name: asset.name,
			symbol: asset.symbol,
			mcap: asset.mcap ?? 0,
			price: asset.price ?? 1,
			change_1d: asset.change_1d ?? 0,
			change_7d: asset.change_7d ?? 0,
			change_1m: asset.change_1m ?? 0,
			pegDeviation: asset.pegDeviation,
			chains: asset.chains,
			pegType: asset.pegType,
			gecko_id: asset.gecko_id
		}
	})
}

export async function fetchStablecoinsTableData(chain: string) {
	const [baseline, chainData] = await Promise.all([
		fetchStablecoinBaselineData(),
		// The table does not apply chart double-count exclusions, so keep its reduced payload.
		fetchStablecoinChartApi(chain === 'All' ? 'all-llama-app' : chain)
	])
	return buildStablecoinsTableData({ baseline, chainData, chain })
}

export interface StablecoinAssetCacheValue {
	peggedAssetData: StablecoinDetailResponse
	chainsUnique: string[]
	chainsData: StablecoinChainBalanceToken[][]
	stablecoinName: string
	stablecoinSymbol: string
}

export function buildStablecoinAssetCacheValue(res: StablecoinDetailResponse | null): StablecoinAssetCacheValue | null {
	if (!res) return null

	const chainsUnique = Object.keys(res.chainBalances)
	const chainsData = chainsUnique.map((chain) => res.chainBalances[chain].tokens)

	return {
		peggedAssetData: res,
		chainsUnique,
		chainsData,
		stablecoinName: res.name,
		stablecoinSymbol: res.symbol
	}
}

export async function fetchStablecoinAssetChartCacheValue(stablecoinSlug: string) {
	if (!stablecoinSlug) return null

	const peggedNameToPeggedIDMapping = await fetchStablecoinPeggedConfigApi()
	const peggedID = peggedNameToPeggedIDMapping[stablecoinSlug]
	if (!peggedID) return null

	const res = await fetchStablecoinAssetApi(peggedID)
	return buildStablecoinAssetCacheValue(res)
}
