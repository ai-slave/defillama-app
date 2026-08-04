import { STABLECOINS_SERVER_URL } from '~/constants'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import type {
	StablecoinBridgeInfoResponse,
	StablecoinChartResponse,
	StablecoinConfigResponse,
	StablecoinDetailResponse,
	StablecoinDominanceResponse,
	RawStablecoinDetailResponse,
	RawStablecoinPricesResponse,
	RawStablecoinsListResponse,
	StablecoinPricesResponse,
	StablecoinRatesResponse,
	StablecoinRecentCoinsDataResponse,
	StablecoinVolumeChainChartKind,
	StablecoinVolumeChartResponseFor,
	StablecoinVolumeGlobalChartKind,
	StablecoinVolumeTokenChartKind,
	StablecoinsListResponse
} from './api.types'

const PEGGEDS_API = `${STABLECOINS_SERVER_URL}/stablecoins`
const PEGGED_API = `${STABLECOINS_SERVER_URL}/stablecoin`
const PEGGEDCHART_API = `${STABLECOINS_SERVER_URL}/stablecoincharts2`
const PEGGEDCHART_DOMINANCE_ALL_API = `${STABLECOINS_SERVER_URL}/stablecoincharts2/all-dominance-chain-breakdown`
const PEGGEDCHART_COINS_RECENT_DATA_API = `${STABLECOINS_SERVER_URL}/stablecoincharts2/recent-protocol-data`
const PEGGEDCONFIG_API = `${STABLECOINS_SERVER_URL}/config`
const PEGGEDPRICES_API = `${STABLECOINS_SERVER_URL}/stablecoinprices`
const PEGGEDRATES_API = `${STABLECOINS_SERVER_URL}/rates`
const STABLECOIN_VOLUME_CHART_API = `${STABLECOINS_SERVER_URL}/chart/volume`

export type StablecoinVolumeChainMetadata = Record<string, { id: string; name: string }>

export const getStablecoinVolumeChainId = (
	chain: string,
	chainMetadata: StablecoinVolumeChainMetadata
): string | null => {
	const chainSlug = slug(chain)
	for (const key in chainMetadata) {
		const metadata = chainMetadata[key]
		if (!metadata) continue
		if (slug(metadata.name) === chainSlug) return metadata.id
	}
	return null
}

/**
 * Fetch the stablecoin assets list.
 */
export const fetchStablecoinAssetsApi = async (): Promise<StablecoinsListResponse> => {
	const response = await fetchJson<RawStablecoinsListResponse>(PEGGEDS_API)
	return {
		chains: response.chains,
		peggedAssets: response.peggedAssets.map((asset) => ({
			...asset,
			pegMechanism: asset.pegMechanism === 'crytpo-backed' ? 'crypto-backed' : asset.pegMechanism
		}))
	}
}

/**
 * Fetch stablecoin price snapshots.
 */
export const fetchStablecoinPricesApi = async (): Promise<StablecoinPricesResponse> => {
	const snapshots = await fetchJson<RawStablecoinPricesResponse>(PEGGEDPRICES_API)
	return snapshots.map((snapshot) => {
		const prices: Record<string, number> = {}
		for (const geckoId in snapshot.prices) {
			const price = snapshot.prices[geckoId]
			if (price === undefined) continue
			prices[geckoId] = typeof price === 'string' ? Number(price) : price
		}
		return { date: snapshot.date, prices }
	})
}

/**
 * Fetch stablecoin lending and savings rates.
 */
export const fetchStablecoinRatesApi = async (): Promise<StablecoinRatesResponse> => {
	return fetchJson<StablecoinRatesResponse>(PEGGEDRATES_API)
}

/**
 * Fetch pegged-asset configuration metadata.
 */
export const fetchStablecoinPeggedConfigApi = async (): Promise<StablecoinConfigResponse> => {
	return fetchJson<StablecoinConfigResponse>(PEGGEDCONFIG_API)
}

/**
 * Fetch stablecoin bridge information by asset.
 */
export const fetchStablecoinBridgeInfoApi = async (): Promise<StablecoinBridgeInfoResponse> => {
	return fetchJson<StablecoinBridgeInfoResponse>(
		'https://llama-stablecoins-data.s3.eu-central-1.amazonaws.com/bridgeInfo.json'
	)
}

/**
 * Fetch stablecoin chart data for a chain.
 */
export const fetchStablecoinChartApi = async (chainLabel: string): Promise<StablecoinChartResponse> => {
	return fetchJson<StablecoinChartResponse>(`${PEGGEDCHART_API}/${chainLabel}`)
}

/**
 * Fetch aggregated stablecoin chart data across all chains.
 */
export const fetchStablecoinChartAllApi = async (): Promise<StablecoinChartResponse> => {
	return fetchStablecoinChartApi('all')
}

/**
 * Fetch stablecoin volume chart data.
 */
export const fetchStablecoinVolumeChartApi = async <TChart extends StablecoinVolumeGlobalChartKind>(
	chart: TChart
): Promise<StablecoinVolumeChartResponseFor<TChart>> => {
	const pathByChart: Record<StablecoinVolumeGlobalChartKind, string> = {
		total: '',
		chain: '/chain-breakdown',
		token: '/token-breakdown',
		currency: '/currency-breakdown'
	}

	return fetchJson<StablecoinVolumeChartResponseFor<TChart>>(`${STABLECOIN_VOLUME_CHART_API}${pathByChart[chart]}`)
}

export const fetchStablecoinChainVolumeChartApi = async <TChart extends StablecoinVolumeChainChartKind>(
	chain: string,
	chart: TChart,
	chainMetadata: StablecoinVolumeChainMetadata
): Promise<StablecoinVolumeChartResponseFor<TChart>> => {
	const chainId = getStablecoinVolumeChainId(chain, chainMetadata)
	if (!chainId) throw new Error(`Stablecoin volume chain id not found for ${chain}`)
	const pathByChart: Record<StablecoinVolumeChainChartKind, string> = {
		total: `/chain/${encodeURIComponent(chainId)}`,
		token: `/chain/${encodeURIComponent(chainId)}/token-breakdown`,
		currency: `/chain/${encodeURIComponent(chainId)}/currency-breakdown`
	}

	return fetchJson<StablecoinVolumeChartResponseFor<TChart>>(`${STABLECOIN_VOLUME_CHART_API}${pathByChart[chart]}`)
}

export const fetchStablecoinTokenVolumeChartApi = async <TChart extends StablecoinVolumeTokenChartKind>(
	token: string,
	chart: TChart
): Promise<StablecoinVolumeChartResponseFor<TChart>> => {
	const encodedToken = encodeURIComponent(token)
	const pathByChart: Record<StablecoinVolumeTokenChartKind, string> = {
		total: `/token/${encodedToken}`,
		chain: `/token/${encodedToken}/chain-breakdown`
	}

	return fetchJson<StablecoinVolumeChartResponseFor<TChart>>(`${STABLECOIN_VOLUME_CHART_API}${pathByChart[chart]}`)
}

/**
 * Fetch global stablecoin dominance chart data.
 */
export const fetchStablecoinDominanceAllApi = async (): Promise<StablecoinDominanceResponse> => {
	return fetchJson<StablecoinDominanceResponse>(PEGGEDCHART_DOMINANCE_ALL_API)
}

/**
 * Fetch details for a single stablecoin.
 *
 * Unknown IDs and request failures are non-2xx responses and throw.
 */
export const fetchStablecoinAssetApi = async (peggedId: string): Promise<StablecoinDetailResponse> => {
	const response = await fetchJson<RawStablecoinDetailResponse>(`${PEGGED_API}/${peggedId}`)
	const auditLinks =
		response.auditLinks == null
			? null
			: Array.isArray(response.auditLinks)
				? response.auditLinks
				: [response.auditLinks]

	return {
		id: response.id,
		name: response.name,
		address: response.address,
		symbol: response.symbol,
		url: response.url,
		description: response.description,
		mintRedeemDescription: response.mintRedeemDescription,
		onCoinGecko: response.onCoinGecko === true || response.onCoinGecko === 'true',
		gecko_id: response.gecko_id,
		cmcId: response.cmcId,
		pegType: response.pegType,
		pegMechanism: response.pegMechanism === 'crytpo-backed' ? 'crypto-backed' : response.pegMechanism,
		priceSource: response.priceSource ?? null,
		auditLinks,
		twitter: response.twitter,
		wiki: response.wiki ?? null,
		price: response.price,
		module: response.module ?? response.gecko_id,
		...(response.deprecated === true ? { deprecated: true } : {}),
		...(response.delisted === true ? { delisted: true } : {}),
		...(response.yieldBearing === true ? { yieldBearing: true } : {}),
		...(response.doublecounted === true ? { doublecounted: true } : {}),
		...(response.deadFrom !== undefined ? { deadFrom: response.deadFrom } : {}),
		tokens: response.tokens,
		chainBalances: response.chainBalances,
		currentChainBalances: response.currentChainBalances
	}
}

/**
 * Fetch recent per-coin chart points for stablecoins.
 */
export const fetchStablecoinRecentCoinsDataApi = async (): Promise<StablecoinRecentCoinsDataResponse> => {
	return fetchJson<StablecoinRecentCoinsDataResponse>(PEGGEDCHART_COINS_RECENT_DATA_API)
}
