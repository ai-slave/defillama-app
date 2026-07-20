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
import { formatPeggedAssetsData, type FormattedStablecoinAsset } from '~/containers/Stablecoins/utils'

type StablecoinChartMcapPoint = {
	date: number
	mcap: Record<string, number>
}

export type StablecoinsChartCacheValue = StablecoinOverviewChartInputs & {
	filteredPeggedAssets: FormattedStablecoinAsset[]
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
	priceData,
	rateData,
	chain
}: {
	peggedData: StablecoinsListResponse
	chainData: StablecoinChartResponse
	priceData: StablecoinPricesResponse
	rateData: StablecoinRatesResponse
	chain: string
}): StablecoinsChartCacheValue {
	const { peggedAssets } = peggedData
	const chartDataByPeggedAsset: StablecoinChartMcapPoint[][] = []
	const peggedAssetNames: string[] = []
	const peggedNameToChartDataIndex: Record<string, number> = {}
	const doublecountedIds: number[] = []
	const doublecountedSourceIds = new Set(chainData.doublecountedIds ?? [])
	let lastTimestamp = 0

	for (let index = 0; index < peggedAssets.length; index++) {
		const asset = peggedAssets[index]
		peggedAssetNames.push(asset.name)
		peggedNameToChartDataIndex[asset.name] = index
		if (doublecountedSourceIds.has(asset.id)) doublecountedIds.push(index)

		const charts = chainData.breakdown[asset.id] ?? []
		const formattedCharts: StablecoinChartMcapPoint[] = []
		for (const chart of charts) {
			if (!chart.totalCirculatingUSD) continue
			formattedCharts.push({ date: Number(chart.date), mcap: chart.totalCirculatingUSD })
		}

		const last = formattedCharts[formattedCharts.length - 1]
		if (last && last.date > lastTimestamp) lastTimestamp = last.date
		chartDataByPeggedAsset.push(formattedCharts)
	}

	for (const chart of chartDataByPeggedAsset) {
		const last = chart[chart.length - 1]
		if (!last) continue

		let lastDate = last.date
		while (lastDate < lastTimestamp) {
			lastDate += 24 * 3600
			chart.push({ ...last, date: lastDate })
		}
	}

	return {
		chartDataByPeggedAsset,
		peggedAssetNames,
		peggedNameToChartDataIndex,
		doublecountedIds,
		filteredPeggedAssets: formatPeggedAssetsData({
			peggedAssets,
			chartDataByPeggedAsset,
			priceData,
			rateData,
			peggedNameToChartDataIndex,
			chain: chain === 'All' ? null : chain
		})
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
	const { filteredPeggedAssets } = buildStablecoinsChartCacheValue({
		...baseline,
		chainData,
		chain
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
