import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import type { CompareTokenProtocol } from './types'

function getTokenFdvSupply(coin: IResponseCGTokenRankingsDatasetItem): number | null {
	const supply = coin.max_supply ?? coin.total_supply
	return supply != null && Number.isFinite(supply) ? supply : null
}

function getCompareValues(
	type: string,
	coin0: IResponseCGTokenRankingsDatasetItem,
	coin1: IResponseCGTokenRankingsDatasetItem,
	protocolsByGeckoId: Map<string, CompareTokenProtocol>,
	protocolsByName: Map<string, CompareTokenProtocol>
): [number | null, number | null] {
	const p0 = protocolsByGeckoId.get(coin0.id) ?? protocolsByName.get(coin0.name)
	const p1 = protocolsByGeckoId.get(coin1.id) ?? protocolsByName.get(coin1.name)

	switch (type) {
		case 'mcap':
			return [coin0.market_cap ?? null, coin1.market_cap ?? null]
		case 'fdv': {
			return [getTokenFdvSupply(coin0), getTokenFdvSupply(coin1)]
		}
		case 'volume':
			return [coin0.total_volume ?? null, coin1.total_volume ?? null]
		case 'tvl':
			return [p0?.tvl ?? null, p1?.tvl ?? null]
		case 'fees':
			return [p0?.fees ?? null, p1?.fees ?? null]
		case 'revenue':
			return [p0?.revenue ?? null, p1?.revenue ?? null]
		default:
			return [null, null]
	}
}

export function computeComparison(
	compareType: { value: string },
	selectedCoins: Array<IResponseCGTokenRankingsDatasetItem | undefined>,
	coinPrices: readonly [number, number],
	protocolsByGeckoId: Map<string, CompareTokenProtocol>,
	protocolsByName: Map<string, CompareTokenProtocol>
): { newPrice: number; increase: number } | null {
	const coin0 = selectedCoins[0]
	const coin1 = selectedCoins[1]
	if (!coin0 || !coin1) return null

	const [val0, val1] = getCompareValues(compareType.value, coin0, coin1, protocolsByGeckoId, protocolsByName)
	if (val0 == null || val1 == null || !Number.isFinite(val0) || !Number.isFinite(val1) || val0 === 0) return null

	const basePrice = coinPrices[0]
	const quotePrice = coinPrices[1]
	if (!Number.isFinite(basePrice) || !Number.isFinite(quotePrice) || basePrice === 0) return null

	const newPrice = ((compareType.value === 'fdv' ? quotePrice : basePrice) * val1) / val0
	if (!Number.isFinite(newPrice)) return null
	const increase = newPrice / basePrice
	if (!Number.isFinite(increase)) return null

	return { newPrice, increase }
}
