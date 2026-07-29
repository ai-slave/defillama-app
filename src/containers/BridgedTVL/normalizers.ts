import type {
	ChainAsset,
	ChainAssetCategory,
	ChainAssetTotals,
	ChainAssetsChartResponse,
	ChainAssetsFlowEntry,
	ChainsAssetsFlows1dResponse,
	ChainsAssetsResponse,
	ChainsAssetTotalsResponse,
	RawChainAsset,
	RawChainAssetCategory,
	RawChainAssetsChartResponse,
	RawChainAssetsFlows1dResponse,
	RawChainsAssetsResponse
} from './api.types'
import { CHAIN_ASSET_FLOW_CATEGORIES } from './api.types'

function parseChainAssetNumber(value: string): number {
	return Number(value)
}

function normalizeChainAssetCategory(category: RawChainAssetCategory): ChainAssetCategory {
	const breakdown: Record<string, number> = {}
	for (const token in category.breakdown) {
		const value = category.breakdown[token]
		if (value === undefined) continue
		breakdown[token] = parseChainAssetNumber(value)
	}

	return {
		total: parseChainAssetNumber(category.total),
		breakdown
	}
}

function normalizeChainAsset(asset: RawChainAsset): ChainAsset {
	return {
		total: normalizeChainAssetCategory(asset.total),
		canonical: normalizeChainAssetCategory(asset.canonical),
		thirdParty: normalizeChainAssetCategory(asset.thirdParty),
		...(asset.native !== undefined ? { native: normalizeChainAssetCategory(asset.native) } : {}),
		...(asset.ownTokens !== undefined ? { ownTokens: normalizeChainAssetCategory(asset.ownTokens) } : {})
	}
}

export function normalizeChainsAssetsResponse(response: RawChainsAssetsResponse): ChainsAssetsResponse {
	const assets: ChainsAssetsResponse = {}
	for (const chain in response) {
		const asset = response[chain]
		if (asset === undefined || chain === 'timestamp' || typeof asset === 'number') continue
		assets[chain] = normalizeChainAsset(asset)
	}
	return assets
}

function normalizeChainAssetTotals(asset: RawChainAsset): ChainAssetTotals {
	return {
		total: { total: parseChainAssetNumber(asset.total.total) },
		canonical: { total: parseChainAssetNumber(asset.canonical.total) },
		thirdParty: { total: parseChainAssetNumber(asset.thirdParty.total) },
		...(asset.native !== undefined ? { native: { total: parseChainAssetNumber(asset.native.total) } } : {}),
		...(asset.ownTokens !== undefined ? { ownTokens: { total: parseChainAssetNumber(asset.ownTokens.total) } } : {})
	}
}

/** Project only category totals for list/page payloads that never consume token breakdowns. */
export function normalizeChainsAssetTotalsResponse(response: RawChainsAssetsResponse): ChainsAssetTotalsResponse {
	const assets: ChainsAssetTotalsResponse = {}
	for (const chain in response) {
		const asset = response[chain]
		if (asset === undefined || chain === 'timestamp' || typeof asset === 'number') continue
		assets[chain] = normalizeChainAssetTotals(asset)
	}
	return assets
}

export function normalizeChainAssetsFlows1dResponse(
	response: RawChainAssetsFlows1dResponse
): ChainsAssetsFlows1dResponse {
	const flows: ChainsAssetsFlows1dResponse = {}
	for (const chain in response) {
		const rawEntry = response[chain]
		if (rawEntry === undefined) continue
		const entry: ChainAssetsFlowEntry = {}
		for (const category of CHAIN_ASSET_FLOW_CATEGORIES) {
			const rawValue = rawEntry[category]
			if (rawValue === undefined) continue
			entry[category] = {
				perc: parseChainAssetNumber(rawValue.perc),
				raw: parseChainAssetNumber(rawValue.raw)
			}
		}
		flows[chain] = entry
	}
	return flows
}

export function normalizeChainAssetsChartResponse(response: RawChainAssetsChartResponse): ChainAssetsChartResponse {
	const chart: ChainAssetsChartResponse = []
	for (const point of response) {
		const data: ChainAssetsChartResponse[number]['data'] = {
			total: parseChainAssetNumber(point.data.total)
		}
		for (const section in point.data) {
			if (section === 'total') continue
			const value = point.data[section]
			if (value === undefined) continue
			data[section] = parseChainAssetNumber(value)
		}
		chart.push({
			timestamp: point.timestamp,
			data
		})
	}
	return chart
}
