import type { ChainListItem } from '~/containers/Chains/api.types'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { sluggifyProtocol } from '~/utils/cache-client'
import { toDisplayName } from '~/utils/chainNormalizer'
import type { Chain, Protocol } from './types'

export interface ProDashboardProtocolCatalog {
	protocols: Protocol[]
	chains: Chain[]
}

export interface ProDashboardProtocolRelations {
	protocolsBySlug: ReadonlyMap<string, Protocol>
	childrenByParentId: ReadonlyMap<string, Protocol[]>
}

export function buildProDashboardParentMapping(protocols: readonly Protocol[]): Map<string, string[]> {
	const parentSlugsById = new Map<string, string>()
	for (const protocol of protocols) {
		if (!protocol.parentProtocol) parentSlugsById.set(protocol.id, protocol.slug)
	}

	const childrenByParentSlug = new Map<string, string[]>()
	for (const protocol of protocols) {
		if (!protocol.parentProtocol) continue
		const parentSlug = parentSlugsById.get(protocol.parentProtocol)
		if (!parentSlug) continue
		const children = childrenByParentSlug.get(parentSlug)
		if (children) children.push(protocol.slug)
		else childrenByParentSlug.set(parentSlug, [protocol.slug])
	}
	return childrenByParentSlug
}

export function buildProtocolSymbolMap(protocols: readonly Protocol[]): Map<string, string> {
	const symbols = new Map<string, string>()
	for (const protocol of protocols) {
		if (protocol.symbol) symbols.set(protocol.slug, protocol.symbol)
	}
	return symbols
}

export function buildProDashboardProtocolRelations(
	catalog: ProDashboardProtocolCatalog | null
): ProDashboardProtocolRelations {
	const protocolsBySlug = new Map<string, Protocol>()
	const childrenByParentId = new Map<string, Protocol[]>()
	for (const protocol of catalog?.protocols ?? []) {
		protocolsBySlug.set(protocol.slug, protocol)
		if (!protocol.parentProtocol) continue
		const children = childrenByParentId.get(protocol.parentProtocol)
		if (children) children.push(protocol)
		else childrenByParentId.set(protocol.parentProtocol, [protocol])
	}
	return { protocolsBySlug, childrenByParentId }
}

/** Build the catalog shared by the initial stream and the client fallback query. */
export function buildProDashboardProtocolCatalog(
	protocolsData: ProtocolsResponse,
	chainsData: ChainListItem[]
): ProDashboardProtocolCatalog {
	const parentGeckoIds = new Map<string, string | null>()
	for (const parent of protocolsData.parentProtocols) {
		parentGeckoIds.set(parent.id, parent.gecko_id ?? null)
	}

	const protocols = new Array<Protocol>(protocolsData.protocols.length + protocolsData.parentProtocols.length)
	let protocolIndex = 0
	const parentTotals = new Map<string, number>()
	const parentsWithMisrepresentedTokens = new Set<string>()
	for (const protocol of protocolsData.protocols) {
		protocols[protocolIndex++] = {
			...protocol,
			id: protocol.id ?? protocol.defillamaId,
			slug: sluggifyProtocol(protocol.name),
			tvl: protocol.tvl ?? 0,
			geckoId: protocol.geckoId ?? parentGeckoIds.get(protocol.parentProtocol ?? '') ?? null,
			parentProtocol: protocol.parentProtocol ?? null
		}
		if (protocol.parentProtocol) {
			parentTotals.set(protocol.parentProtocol, (parentTotals.get(protocol.parentProtocol) ?? 0) + (protocol.tvl ?? 0))
			if (protocol.misrepresentedTokens) parentsWithMisrepresentedTokens.add(protocol.parentProtocol)
		}
	}

	for (const parent of protocolsData.parentProtocols) {
		const slug = sluggifyProtocol(parent.name)
		protocols[protocolIndex++] = {
			id: parent.id,
			name: parent.name,
			symbol: parent.symbol,
			logo: parent.logo,
			slug: slug || `id-${parent.id}`,
			tvl: parentTotals.get(parent.id) ?? 0,
			geckoId: parent.gecko_id ?? null,
			...(parentsWithMisrepresentedTokens.has(parent.id) ? { misrepresentedTokens: true } : {}),
			parentProtocol: null
		}
	}

	const protocolsBySlug = new Map<string, Protocol>()
	for (const protocol of protocols) {
		if (!protocolsBySlug.has(protocol.slug)) protocolsBySlug.set(protocol.slug, protocol)
	}

	const chains = new Array<Chain>(chainsData.length)
	for (let index = 0; index < chainsData.length; index++) {
		const chain = chainsData[index]
		chains[index] = { ...chain, name: toDisplayName(chain.name) }
	}
	chains.sort((a, b) => b.tvl - a.tvl)

	return { protocols: Array.from(protocolsBySlug.values()), chains }
}
