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
	StablecoinConfigResponse,
	StablecoinDetailResponse,
	StablecoinPricesResponse,
	StablecoinRatesResponse,
	StablecoinsListResponse
} from '~/containers/Stablecoins/api.types'
import type { StablecoinOverviewChartInputs } from '~/containers/Stablecoins/types'
import { buildUniqueStablecoinChartLabels, formatPeggedAssetsData } from '~/containers/Stablecoins/utils'

/** Canonical normalized Stablecoin data shared by Pro server producers and browser fallbacks. */

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
	peggedConfig: StablecoinConfigResponse
}

export async function fetchStablecoinBaselineData(): Promise<StablecoinBaselineData> {
	const [peggedData, priceData, rateData, peggedConfig] = await Promise.all([
		fetchStablecoinAssetsApi(),
		fetchStablecoinPricesApi(),
		fetchStablecoinRatesApi(),
		fetchStablecoinPeggedConfigApi()
	])
	return { peggedData, priceData, rateData, peggedConfig }
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

	for (const [index, asset] of peggedAssets.entries()) {
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
	for (const [index, asset] of peggedAssets.entries()) {
		if (chain !== 'All' && !asset.chains.includes(chain)) continue
		const latestPoint = chartDataByPeggedAsset[index]?.at(-1)
		let mcap = 0
		if (latestPoint) {
			for (const pegType in latestPoint.mcap) {
				const value = latestPoint.mcap[pegType]
				if (value === undefined) throw new Error(`Missing stablecoin market cap for peg type ${pegType}`)
				mcap += value
			}
		}
		const symbol = pieAssetLabels[index]
		if (symbol === undefined) throw new Error(`Missing stablecoin chart label for asset ${asset.id}`)
		pieAssets.push({ symbol, mcap: latestPoint ? mcap : null })
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
		chain: chain === 'All' ? '' : chain
	})

	const slugByAssetId = new Map<string, string>()
	for (const assetSlug in baseline.peggedConfig) {
		const assetId = baseline.peggedConfig[assetSlug]
		if (assetId !== undefined) slugByAssetId.set(assetId, assetSlug)
	}

	return filteredPeggedAssets.map((asset) => {
		const assetSlug = slugByAssetId.get(asset.id)
		if (!assetSlug) throw new Error(`Missing stablecoin route slug for asset ${asset.id}`)
		return {
			name: asset.name,
			slug: assetSlug,
			symbol: asset.symbol,
			mcap: asset.mcap,
			price: asset.price,
			change_1d: asset.change_1d,
			change_7d: asset.change_7d,
			change_1m: asset.change_1m,
			pegDeviation: asset.pegDeviation,
			chains: asset.chains,
			pegType: asset.pegType
		}
	})
}

export type StablecoinsTableData = ReturnType<typeof buildStablecoinsTableData>

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

	const chainsUnique: string[] = []
	const chainsData: StablecoinAssetCacheValue['chainsData'] = []
	for (const chain in res.chainBalances) {
		const balance = res.chainBalances[chain]
		if (balance === undefined) throw new Error(`Missing stablecoin balance for ${chain}`)
		chainsUnique.push(chain)
		chainsData.push(balance.tokens)
	}

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
