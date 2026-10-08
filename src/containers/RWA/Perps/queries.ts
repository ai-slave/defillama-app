import { fetchRWAPerpsFundingHistory, fetchRWAPerpsMarketChart, fetchRWAPerpsMarketsByContract } from './api'
import type { IRWAPerpsFundingHistoryPoint, IRWAPerpsMarket, IRWAPerpsMarketChartPoint } from './api.types'
import type { IRWAPerpsContractData, IRWAPerpsContractFundingHistoryPoint } from './types'

function getPrimaryAssetClass(assetClass: Array<string> | null): string | null {
	return assetClass?.[0] ?? null
}

function normalizeMarketChart(points: Array<IRWAPerpsMarketChartPoint>): Array<IRWAPerpsMarketChartPoint> | null {
	if (points.length === 0) return null

	return points.map((point) => ({
		...point,
		timestamp: point.timestamp * 1e3
	}))
}

function normalizeFundingHistory(
	points: Array<IRWAPerpsFundingHistoryPoint>
): Array<IRWAPerpsContractFundingHistoryPoint> | null {
	if (points.length === 0) return null

	return points
}

function resolveContractMarket(markets: Array<IRWAPerpsMarket>, contract: string): IRWAPerpsMarket | null {
	let match: IRWAPerpsMarket | null = null
	for (const market of markets) {
		if (market.contract !== contract) continue
		if (match) return null
		match = market
	}
	return match
}

export async function getRWAPerpsContractData({
	contract
}: {
	contract: string
}): Promise<IRWAPerpsContractData | null> {
	try {
		const markets = await fetchRWAPerpsMarketsByContract(contract)
		if (markets.length === 0) {
			return null
		}

		const market = resolveContractMarket(markets, contract)
		if (!market) {
			return null
		}

		const [marketChart, fundingHistory] = await Promise.all([
			fetchRWAPerpsMarketChart(market.id)
				.then(normalizeMarketChart)
				.catch(() => null),
			fetchRWAPerpsFundingHistory(market.id)
				.then(normalizeFundingHistory)
				.catch(() => null)
		])

		const displayName = market.referenceAsset ?? market.contract.split(':')[1] ?? market.contract

		return {
			contract: {
				contract,
				displayName,
				venue: market.venue,
				baseAsset: market.referenceAsset,
				baseAssetGroup: market.referenceAssetGroup,
				assetClass: getPrimaryAssetClass(market.assetClass),
				rwaClassification: market.rwaClassification,
				accessModel: market.accessModel,
				parentPlatform: market.parentPlatform,
				issuer: market.issuer,
				website: market.website?.[0] ?? null,
				link: market.link ?? null,
				oracleProvider: market.oracleProvider,
				description: market.description,
				categories: market.category ?? []
			},
			market,
			marketChart,
			fundingHistory
		}
	} catch (error) {
		console.error(`[rwa-perps] getRWAPerpsContractData failed for ${contract}:`, error)
		return null
	}
}
