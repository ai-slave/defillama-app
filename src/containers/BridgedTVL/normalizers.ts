import { slug } from '~/utils'
import type {
	ChainAsset,
	ChainAssetCategory,
	ChainAssetsDetailResponse,
	ChainAssetTotals,
	ChainAssetsChartResponse,
	ChainAssetsFlowEntry,
	ChainsAssetsFlows1dResponse,
	ChainsAssetTotalsResponse,
	RawChainAsset,
	RawChainAssetCategory,
	RawChainAssetsChartResponse,
	RawChainAssetsFlows1dResponse,
	RawChainsAssetsResponse
} from './api.types'
import { CHAIN_ASSET_CATEGORIES, CHAIN_ASSET_OPTIONAL_CATEGORIES } from './api.types'

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
	const normalized: ChainAsset = {
		total: normalizeChainAssetCategory(asset.total),
		canonical: normalizeChainAssetCategory(asset.canonical),
		thirdParty: normalizeChainAssetCategory(asset.thirdParty)
	}
	// driven off the category list so a producer adding a section needs no change here
	for (const category of CHAIN_ASSET_OPTIONAL_CATEGORIES) {
		const raw = asset[category]
		if (raw !== undefined) normalized[category] = normalizeChainAssetCategory(raw)
	}
	return normalized
}

function normalizeChainAssetTotals(asset: RawChainAsset): ChainAssetTotals {
	const totals: ChainAssetTotals = {
		total: { total: parseChainAssetNumber(asset.total.total) },
		canonical: { total: parseChainAssetNumber(asset.canonical.total) },
		thirdParty: { total: parseChainAssetNumber(asset.thirdParty.total) }
	}
	for (const category of CHAIN_ASSET_OPTIONAL_CATEGORIES) {
		const raw = asset[category]
		if (raw !== undefined) totals[category] = { total: parseChainAssetNumber(raw.total) }
	}
	return totals
}

export function normalizeChainAssetsDetailResponse(
	response: RawChainsAssetsResponse,
	selectedChain: string
): ChainAssetsDetailResponse {
	const targetSlug = slug(selectedChain)
	const totals: ChainsAssetTotalsResponse = {}
	let chainData: ChainAsset | null = null
	for (const chain in response) {
		const asset = response[chain]
		if (asset === undefined || chain === 'timestamp' || typeof asset === 'number') continue
		totals[chain] = normalizeChainAssetTotals(asset)
		if (slug(chain) === targetSlug) chainData = normalizeChainAsset(asset)
	}
	return { chainData, totals }
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
		for (const category of CHAIN_ASSET_CATEGORIES) {
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
		for (const section of CHAIN_ASSET_CATEGORIES) {
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
