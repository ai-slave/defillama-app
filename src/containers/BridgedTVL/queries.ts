import { slug } from '~/utils'
import { getDeprecatedChainsByName, isDeprecatedChain } from '~/utils/metadata/deprecatedChains'
import type { IChainMetadata } from '~/utils/metadata/types'
import { fetchChainAssetsDetail, fetchChainAssetsFlows1d, fetchChainsAssetTotals } from './api'
import type { ChainAsset, ChainsAssetsFlows1dResponse, ChainsAssetTotalsResponse } from './api.types'
import { reconcileChainAssetFlowKeys } from './flowKeys'

interface BridgedTVLChainsData {
	chains: Array<{ label: string; to: string }>
	assets: ChainsAssetTotalsResponse
	flows1d: ChainsAssetsFlows1dResponse | null
	deprecatedChains: Record<string, true>
}

interface BridgedTVLChainData {
	chains: Array<{ label: string; to: string }>
	chainData: ChainAsset | null
	deprecated?: boolean
}

type ChainAssetNavigationSource = Record<string, { total: { total: number } }>

function buildChainNavigation(
	assets: ChainAssetNavigationSource,
	chainMetadata: Record<string, IChainMetadata>
): { chains: Array<{ label: string; to: string }>; chainNames: Array<string> } {
	const assetEntries: Array<[string, number]> = []
	for (const name in assets) {
		const asset = assets[name]
		if (asset !== undefined) assetEntries.push([name, asset.total.total])
	}
	assetEntries.sort((left, right) => Math.trunc(right[1]) - Math.trunc(left[1]))

	const chains: Array<{ label: string; to: string }> = [{ label: 'All', to: '/bridged' }]
	const chainNames: Array<string> = []
	for (const [name] of assetEntries) {
		const chainSlug = slug(name)
		if (!chainMetadata[chainSlug]?.chainAssets) continue
		chainNames.push(name)
		chains.push({ label: name, to: `/bridged/${chainSlug}` })
	}

	return { chains, chainNames }
}

export async function getBridgedTVLChains({
	chainMetadata
}: {
	chainMetadata: Record<string, IChainMetadata>
}): Promise<BridgedTVLChainsData> {
	const [assets, rawFlows1d] = await Promise.all([
		fetchChainsAssetTotals(),
		fetchChainAssetsFlows1d().catch(() => null)
	])
	const flows1d = rawFlows1d ? reconcileChainAssetFlowKeys({ assets, flows: rawFlows1d, chainMetadata }) : null
	const { chains, chainNames } = buildChainNavigation(assets, chainMetadata)

	return {
		chains,
		assets,
		flows1d,
		deprecatedChains: getDeprecatedChainsByName(chainMetadata, chainNames)
	}
}

export async function getBridgedTVLByChain({
	chain,
	chainMetadata
}: {
	chain: string
	chainMetadata: Record<string, IChainMetadata>
}): Promise<BridgedTVLChainData> {
	const { chainData, totals } = await fetchChainAssetsDetail(chain)
	const { chains } = buildChainNavigation(totals, chainMetadata)

	return {
		chains,
		chainData,
		...(isDeprecatedChain(chainMetadata, chain) ? { deprecated: true } : {})
	}
}
