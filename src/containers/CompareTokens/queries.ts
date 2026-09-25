import { fetchCoinGeckoTokensListFromDataset } from '~/api/coingecko'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import { ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import type { CompareTokenProtocol, CompareTokensPageData } from './types'

export async function getCompareTokensPageData(): Promise<CompareTokensPageData> {
	const emptyProtocolsResponse: ProtocolsResponse = {
		protocols: [],
		chains: [],
		parentProtocols: [],
		protocolCategories: []
	}
	const [coinsData, tvlProtocols, feesData, revenueData]: [
		Array<IResponseCGTokenRankingsDatasetItem>,
		ProtocolsResponse,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null
	] = await Promise.all([
		fetchCoinGeckoTokensListFromDataset().catch((error) => {
			console.log(`Couldn't fetch CoinGecko tokens at path: compare-tokens`, 'Error:', error)
			return []
		}),
		fetchProtocols().catch((error) => {
			console.log(`Couldn't fetch TVL protocols list at path: compare-tokens`, 'Error:', error)
			return emptyProtocolsResponse
		}),
		fetchAdapterChainMetrics({
			adapterType: ADAPTER_TYPES.FEES,
			chain: 'All'
		}).catch((error) => {
			console.log(`Couldn't fetch fees protocols list at path: compare-tokens`, 'Error:', error)
			return null
		}),
		fetchAdapterChainMetrics({
			adapterType: ADAPTER_TYPES.FEES,
			chain: 'All',
			dataType: 'dailyRevenue'
		}).catch((error) => {
			console.log(`Couldn't fetch revenue protocols list at path: compare-tokens`, 'Error:', error)
			return null
		})
	])

	return {
		coinsData: coinsData.map((coin) => ({ ...coin, label: coin.symbol.toUpperCase(), value: coin.id })),
		protocols: buildCompareTokenProtocols(tvlProtocols, feesData, revenueData)
	}
}

/** A null fees/revenue response means the source failed, so rows show it unavailable instead of zero. */
export function buildCompareTokenProtocols(
	tvlProtocols: ProtocolsResponse,
	feesData: IAdapterChainMetrics | null,
	revenueData: IAdapterChainMetrics | null
): Array<CompareTokenProtocol> {
	type ParentProtocolAccumulator = CompareTokenProtocol & { hasChild: boolean; hasMeasuredTvl: boolean }
	const parentProtocols: Record<string, ParentProtocolAccumulator> = {}

	for (const protocol of tvlProtocols.parentProtocols) {
		parentProtocols[protocol.id] = {
			name: protocol.name,
			geckoId: protocol.gecko_id,
			tvl: 0,
			fees: feesData === null ? null : 0,
			revenue: revenueData === null ? null : 0,
			hasChild: false,
			hasMeasuredTvl: false
		}
	}

	const feesByProtocolId = new Map<string, number>()
	for (const protocol of feesData?.protocols ?? []) {
		feesByProtocolId.set(protocol.defillamaId, protocol.total24h ?? 0)
	}
	const revenueByProtocolId = new Map<string, number>()
	for (const protocol of revenueData?.protocols ?? []) {
		revenueByProtocolId.set(protocol.defillamaId, protocol.total24h ?? 0)
	}
	const llamaProtocols: Array<CompareTokenProtocol> = []
	for (const protocol of tvlProtocols.protocols) {
		const fees = feesData === null ? null : (feesByProtocolId.get(protocol.defillamaId) ?? 0)
		const revenue = revenueData === null ? null : (revenueByProtocolId.get(protocol.defillamaId) ?? 0)

		const parentProtocol = protocol.parentProtocol ? parentProtocols[protocol.parentProtocol] : undefined
		if (parentProtocol) {
			parentProtocol.hasChild = true
			if (protocol.tvl !== null) {
				parentProtocol.hasMeasuredTvl = true
				const excludedTvl = protocol.chainTvls.excludeParent?.tvl
				parentProtocol.tvl =
					parentProtocol.tvl === null || excludedTvl === null
						? null
						: parentProtocol.tvl + protocol.tvl - (excludedTvl ?? 0)
			}
			if (parentProtocol.fees !== null && fees !== null) parentProtocol.fees += fees
			if (parentProtocol.revenue !== null && revenue !== null) parentProtocol.revenue += revenue
		}

		llamaProtocols.push({
			name: protocol.name,
			tvl: protocol.tvl,
			geckoId: protocol.geckoId,
			fees,
			revenue
		})
	}

	const parentRows: Array<CompareTokenProtocol> = []
	for (const parentId in parentProtocols) {
		const parentProtocol = parentProtocols[parentId]
		if (!parentProtocol?.hasChild) continue
		parentRows.push({
			name: parentProtocol.name,
			geckoId: parentProtocol.geckoId,
			tvl: parentProtocol.hasMeasuredTvl ? parentProtocol.tvl : null,
			fees: parentProtocol.fees,
			revenue: parentProtocol.revenue
		})
	}

	return llamaProtocols.concat(parentRows)
}
