import { createProtocolMetadataLookup } from '~/containers/LiquidationsV2/protocolMetadata'
import { resolveChainId, resolveProtocolId } from '~/containers/LiquidationsV2/queries'
import { getMetadataCache, type StaticParamPath } from '~/server/routeRegistry/common'
import { slug } from '~/utils'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { getLiquidationsProtocolsList } from './dataset.server'
import { getLiquidationsSitemapProtocolChainsFromSnapshot } from './routeData'

export async function getLiquidationsProtocolStaticPaths(): Promise<Array<StaticParamPath<'protocol'>>> {
	const protocolsResponse = await getLiquidationsProtocolsList()
	return protocolsResponse.protocols.map((protocol) => ({ params: { protocol } }))
}

export async function resolveLiquidationsProtocolRoute(protocol: string): Promise<{
	protocolId: string
	protocolIds: Array<string>
	metadataCache: MetadataCache
} | null> {
	const [metadataCache, protocolsResponse] = await Promise.all([getMetadataCache(), getLiquidationsProtocolsList()])
	const lookup = createProtocolMetadataLookup(metadataCache.protocolMetadata)
	const protocolId = resolveProtocolId(protocol, protocolsResponse.protocols, lookup)
	return protocolId ? { protocolId, protocolIds: protocolsResponse.protocols, metadataCache } : null
}

export async function resolveLiquidationsChainParams(
	protocol: string,
	chain: string
): Promise<{
	protocolId: string
	chainId: string
	protocolIds: Array<string>
	metadataCache: MetadataCache
} | null> {
	const [metadataCache, protocolChains] = await Promise.all([
		getMetadataCache(),
		getLiquidationsSitemapProtocolChainsFromSnapshot()
	])
	const protocolIds = new Array<string>(protocolChains.length)
	for (let index = 0; index < protocolChains.length; index += 1) {
		protocolIds[index] = protocolChains[index]!.protocolId
	}
	const protocolId = resolveProtocolId(
		protocol,
		protocolIds,
		createProtocolMetadataLookup(metadataCache.protocolMetadata)
	)
	if (!protocolId) return null

	let chainIds: Array<string> | undefined
	for (const protocolChain of protocolChains) {
		if (protocolChain.protocolId !== protocolId) continue
		chainIds = protocolChain.chainIds
		break
	}
	if (!chainIds) return null
	const chainId = resolveChainId(chain, chainIds, metadataCache.chainMetadata)
	if (!chainId) return null

	return { protocolId, chainId, protocolIds, metadataCache }
}

export async function getLiquidationsSitemapRoutes(metadataCache: MetadataCache): Promise<Array<string>> {
	const routes: Array<string> = []
	const protocolChainIds = await getLiquidationsSitemapProtocolChainsFromSnapshot()

	for (const { protocolId, chainIds } of protocolChainIds) {
		routes.push(`liquidations/${protocolId}`)
		for (const chainId of chainIds) {
			const chainMetadata = metadataCache.chainMetadata[slug(chainId)]
			const chainSlug = slug(chainMetadata?.name ?? chainId)
			if (chainSlug) routes.push(`liquidations/${protocolId}/${chainSlug}`)
		}
	}

	return routes
}
