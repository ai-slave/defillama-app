import { CONFIG_API } from '~/constants'
import { fetchJson } from '~/utils/async'
import { getDisplayAliases } from '~/utils/chainNormalizer'
import type { IChainMetadata } from '~/utils/metadata/types'

let chainAssetIdsPromise: Promise<Map<string, string>> | null = null

function normalizeChainName(chain: string): string {
	return chain.trim().toLowerCase()
}

export function buildChainAssetIdIndex(chains: Record<string, IChainMetadata>): Map<string, string> {
	const idsByChain = new Map<string, string>()
	for (const metadataKey in chains) {
		const metadata = chains[metadataKey]
		if (metadata === undefined) continue
		if (!metadata.chainAssets) continue
		idsByChain.set(normalizeChainName(metadataKey), metadata.id)
		idsByChain.set(normalizeChainName(metadata.id), metadata.id)
		idsByChain.set(normalizeChainName(metadata.name), metadata.id)
		for (const alias of getDisplayAliases(metadata.name)) {
			idsByChain.set(normalizeChainName(alias), metadata.id)
		}
	}
	return idsByChain
}

async function fetchChainAssetIdIndex(): Promise<Map<string, string>> {
	const chains = await fetchJson<Record<string, IChainMetadata>>(`${CONFIG_API}/smol/appMetadata-chains.json`)
	return buildChainAssetIdIndex(chains)
}

export async function resolveChainAssetId(chain: string): Promise<string | null> {
	if (!chain) return null

	const request = chainAssetIdsPromise ?? fetchChainAssetIdIndex()
	chainAssetIdsPromise = request
	try {
		const idsByChain = await request
		return idsByChain.get(normalizeChainName(chain)) ?? null
	} catch (error) {
		if (chainAssetIdsPromise === request) chainAssetIdsPromise = null
		throw error
	}
}
