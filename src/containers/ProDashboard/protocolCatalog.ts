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

	const protocols: Protocol[] = []
	const parentTotals = new Map<string, number | null>()
	for (const protocol of protocolsData.protocols) {
		const parentGeckoId = protocol.parentProtocol ? (parentGeckoIds.get(protocol.parentProtocol) ?? null) : null
		protocols.push({
			...protocol,
			id: protocol.defillamaId,
			slug: sluggifyProtocol(protocol.name),
			tvl: protocol.tvl,
			geckoId: protocol.geckoId ?? parentGeckoId,
			parentProtocol: protocol.parentProtocol ?? null
		})
		if (protocol.parentProtocol) {
			if (protocol.tvl === null) continue
			const currentTotal = parentTotals.get(protocol.parentProtocol)
			const excludedTvl = protocol.chainTvls.excludeParent?.tvl
			parentTotals.set(
				protocol.parentProtocol,
				currentTotal === null || excludedTvl === null ? null : (currentTotal ?? 0) + protocol.tvl - (excludedTvl ?? 0)
			)
		}
	}

	for (const parent of protocolsData.parentProtocols) {
		const parentTvl = parentTotals.get(parent.id)
		protocols.push({
			id: parent.id,
			name: parent.name,
			...(parent.symbol != null ? { symbol: parent.symbol } : {}),
			logo: parent.logo,
			slug: sluggifyProtocol(parent.name),
			tvl: parentTvl ?? null,
			geckoId: parent.gecko_id ?? null,
			parentProtocol: null
		})
	}

	const protocolsBySlug = new Map<string, Protocol>()
	for (const protocol of protocols) {
		if (!protocolsBySlug.has(protocol.slug)) protocolsBySlug.set(protocol.slug, protocol)
	}

	const chains: Chain[] = []
	for (const chain of chainsData) chains.push({ ...chain, name: toDisplayName(chain.name) })
	chains.sort((a, b) => b.tvl - a.tvl)

	return { protocols: Array.from(protocolsBySlug.values()), chains }
}
