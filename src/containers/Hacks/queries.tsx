import { resolveCexParamFromMetadata } from '~/containers/Cexs/server/routes'
import { resolveChainParamFromMetadata } from '~/containers/ChainOverview/server/routes'
import { resolveProtocolParamFromMetadata } from '~/containers/ProtocolOverview/server/routes'
import { slug } from '~/utils'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { fetchHacks } from './api'
import { buildHacksPageSummary } from './data'
import type { Hack } from './model'
import type { IHacksPageData, IHackRow, IProtocolTotalValueLostInHacksByProtocol } from './types'

export async function getHacksPageData(): Promise<IHacksPageData> {
	return buildHacksPageData(await fetchHacks())
}

export function buildHacksPageData(hacks: Array<Hack>): IHacksPageData {
	const data: Array<IHackRow> = []

	for (const hack of hacks) {
		data.push({
			chains: hack.chain ?? [],
			classification: hack.classification ?? '',
			date: hack.date,
			target: hack.targetType,
			amountUsd: hack.amountUsd,
			name: hack.name,
			technique: hack.technique ?? '',
			bridge: hack.bridgeHack,
			language: hack.language ?? ''
		})
	}

	data.sort((left, right) => {
		if (left.date === null) return right.date === null ? 0 : 1
		if (right.date === null) return -1
		return right.date - left.date
	})

	return { data, ...buildHacksPageSummary(data) }
}

type ProtocolHackRow = IProtocolTotalValueLostInHacksByProtocol['protocols'][number]
type ProtocolHackIdentity = Pick<ProtocolHackRow, 'name' | 'slug' | 'route'>

function resolveHackIdentity(hack: Hack, defillamaId: string, metadataCache: MetadataCache): ProtocolHackIdentity {
	const metadata = metadataCache.protocolMetadata[defillamaId]
	const name = metadata?.displayName ?? metadata?.name ?? hack.name

	if (defillamaId.startsWith('chain#')) {
		const chainRoute = resolveChainParamFromMetadata(defillamaId.slice('chain#'.length), metadataCache)
		if (chainRoute) {
			return {
				name: chainRoute.canonicalName,
				slug: chainRoute.canonicalSlug,
				route: `/chain/${chainRoute.canonicalSlug}`
			}
		}
		return { name, slug: slug(name), route: null }
	}

	if (metadata?.cex) {
		const cexRoute = resolveCexParamFromMetadata(metadata.name ?? hack.name, metadataCache)
		if (cexRoute) {
			return {
				name: cexRoute.metadata.displayName ?? cexRoute.metadata.name ?? hack.name,
				slug: cexRoute.canonicalSlug,
				route: `/cex/${cexRoute.canonicalSlug}`
			}
		}
		return { name, slug: slug(name), route: null }
	}

	if (metadata?.name || metadata?.displayName) {
		const protocolRoute = resolveProtocolParamFromMetadata(defillamaId, metadataCache)
		if (protocolRoute) {
			return {
				name: protocolRoute.metadata.displayName ?? protocolRoute.metadata.name ?? hack.name,
				slug: protocolRoute.canonicalSlug,
				route: `/protocol/${protocolRoute.canonicalSlug}`
			}
		}
		return { name, slug: slug(name), route: null }
	}

	const protocolRoute = resolveProtocolParamFromMetadata(hack.name, metadataCache)
	if (protocolRoute && protocolRoute.id !== defillamaId) {
		return {
			name: protocolRoute.metadata.displayName ?? protocolRoute.metadata.name ?? hack.name,
			slug: protocolRoute.canonicalSlug,
			route: `/protocol/${protocolRoute.canonicalSlug}`
		}
	}

	const cexRoute = resolveCexParamFromMetadata(hack.name, metadataCache)
	if (cexRoute && cexRoute.id !== defillamaId) {
		return {
			name: cexRoute.metadata.displayName ?? cexRoute.metadata.name ?? hack.name,
			slug: cexRoute.canonicalSlug,
			route: `/cex/${cexRoute.canonicalSlug}`
		}
	}

	return { name, slug: slug(name), route: null }
}

export async function getTotalValueLostInHacksByProtocol({
	metadataCache
}: {
	metadataCache: MetadataCache
}): Promise<IProtocolTotalValueLostInHacksByProtocol> {
	return buildTotalValueLostInHacksByProtocol(await fetchHacks(), metadataCache)
}

export function buildTotalValueLostInHacksByProtocol(
	hacks: Array<Hack>,
	metadataCache: MetadataCache
): IProtocolTotalValueLostInHacksByProtocol {
	const totalLostByProtocol = new Map<string, ProtocolHackRow>()

	for (const hack of hacks) {
		if (hack.defillamaId === null || !metadataCache.protocolMetadata[hack.defillamaId]) continue

		const existing = totalLostByProtocol.get(hack.defillamaId)
		if (existing) {
			existing.totalHackedUsd += hack.amountUsd ?? 0
			existing.returnedFundsUsd += hack.returnedFundsUsd ?? 0
			continue
		}

		totalLostByProtocol.set(hack.defillamaId, {
			...resolveHackIdentity(hack, hack.defillamaId, metadataCache),
			totalHackedUsd: hack.amountUsd ?? 0,
			returnedFundsUsd: hack.returnedFundsUsd ?? 0
		})
	}

	const protocols = Array.from(totalLostByProtocol.values())
	protocols.sort((left, right) => right.totalHackedUsd - left.totalHackedUsd)
	return { protocols }
}
