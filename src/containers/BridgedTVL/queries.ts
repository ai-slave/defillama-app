import { slug } from '~/utils'
import { getDeprecatedChainsByName, isDeprecatedChain } from '~/utils/metadata/deprecatedChains'
import type { IChainMetadata } from '~/utils/metadata/types'
import { fetchChainAssetsFlows1d, fetchChainsAssets } from './api'
import type { ChainAsset, ChainAssetsFlowEntry, ChainsAssetsResponse } from './api.types'
import { reconcileChainAssetFlowKeys } from './flowKeys'

interface BridgedTVLData {
	chains: Array<{ label: string; to: string }>
	assets: ChainsAssetsResponse
	flows1d: Record<string, ChainAssetsFlowEntry> | null
	chainData: ChainAsset | null
	deprecated?: boolean
	deprecatedChains: Record<string, true>
}

export async function getBridgedTVLByChain({
	chain,
	chainMetadata
}: {
	chain?: string
	chainMetadata: Record<string, IChainMetadata>
}): Promise<BridgedTVLData> {
	const [assets, rawFlows1d] = await Promise.all([fetchChainsAssets(), fetchChainAssetsFlows1d().catch(() => null)])
	const flows1d = rawFlows1d ? reconcileChainAssetFlowKeys({ assets, flows: rawFlows1d, chainMetadata }) : null

	let chainData: ChainAsset | null = null
	if (chain) {
		const targetSlug = slug(chain)
		for (const key in assets) {
			if (slug(key) === targetSlug) {
				chainData = assets[key] ?? null
				break
			}
		}
	}

	const assetEntries: Array<[string, ChainAsset]> = []
	for (const key in assets) {
		const asset = assets[key]
		if (asset !== undefined) assetEntries.push([key, asset])
	}
	assetEntries.sort((a, b) => Math.trunc(b[1].total.total) - Math.trunc(a[1].total.total))
	const chainLinks: { label: string; to: string }[] = [{ label: 'All', to: '/bridged' }]
	const deprecatedChainNames: string[] = []
	for (const [assetKey] of assetEntries) {
		const slugChain = slug(assetKey)
		const currentChainMetadata = chainMetadata[slugChain]

		if (!currentChainMetadata?.chainAssets) continue

		deprecatedChainNames.push(assetKey)
		chainLinks.push({ label: assetKey, to: `/bridged/${slugChain}` })
	}

	return {
		chains: chainLinks,
		assets,
		flows1d,
		chainData,
		...(chain && isDeprecatedChain(chainMetadata, chain) ? { deprecated: true } : {}),
		deprecatedChains: getDeprecatedChainsByName(chainMetadata, deprecatedChainNames)
	}
}
