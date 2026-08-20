import type { ChainListItem } from '~/containers/Chains/api.types'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { sluggifyProtocol } from '~/utils/cache-client'
import { toDisplayName } from '~/utils/chainNormalizer'
import type { Chain, Protocol } from './types'

export interface ProProtocolCatalogSourceRow {
	slug: string
	name: string
	parentSlug: string
	category: string | null
	tvl: number | null
	symbol: string | null
	geckoId: string | null
	hasMisrepresentedTokens: boolean
	excludeTvlFromParent: boolean
}

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
	sourceRows: ProProtocolCatalogSourceRow[],
	protocolsData: ProtocolsResponse,
	chainsData: ChainListItem[]
): ProDashboardProtocolCatalog {
	const metadataBySlug = new Map<string, ProtocolsResponse['protocols'][number]>()
	for (const protocol of protocolsData.protocols) {
		metadataBySlug.set(sluggifyProtocol(protocol.name), protocol)
	}
	const parentMetadataBySlug = new Map<string, ProtocolsResponse['parentProtocols'][number]>()
	for (const parent of protocolsData.parentProtocols) parentMetadataBySlug.set(sluggifyProtocol(parent.name), parent)

	const protocolsBySlug = new Map<string, Protocol>()
	const parentTotals = new Map<string, number>()
	const parentChains = new Map<string, Set<string>>()
	const parentCategories = new Map<string, string>()
	const parentSymbols = new Map<string, Set<string>>()
	const parentGeckoIds = new Map<string, Set<string>>()
	const parentsWithMisrepresentedTokens = new Set<string>()
	for (const source of sourceRows) {
		const metadata = metadataBySlug.get(source.slug)
		const name = metadata?.name ?? source.name
		const isChild = source.parentSlug !== source.slug
		const category = metadata?.category ?? source.category
		const protocol: Protocol = {
			id: source.slug,
			name,
			slug: source.slug,
			...(source.symbol ? { symbol: source.symbol } : {}),
			...(metadata?.logo ? { logo: metadata.logo } : {}),
			...(category ? { category } : {}),
			chains: metadata?.chains ?? [],
			...(metadata?.listedAt === undefined ? {} : { listedAt: metadata.listedAt }),
			...(metadata?.deprecated === undefined ? {} : { deprecated: metadata.deprecated }),
			tvl: source.tvl ?? 0,
			geckoId: source.geckoId,
			...(source.hasMisrepresentedTokens ? { misrepresentedTokens: true } : {}),
			parentProtocol: isChild ? source.parentSlug : null
		}
		if (!protocolsBySlug.has(source.slug)) protocolsBySlug.set(source.slug, protocol)
		if (isChild) {
			if (!parentTotals.has(source.parentSlug)) parentTotals.set(source.parentSlug, 0)
			if (!source.excludeTvlFromParent) {
				parentTotals.set(source.parentSlug, (parentTotals.get(source.parentSlug) ?? 0) + (source.tvl ?? 0))
			}
			const chains = parentChains.get(source.parentSlug) ?? new Set<string>()
			for (const chain of metadata?.chains ?? []) chains.add(chain)
			parentChains.set(source.parentSlug, chains)
			if (category && !parentCategories.has(source.parentSlug)) parentCategories.set(source.parentSlug, category)
			if (source.symbol) {
				const symbols = parentSymbols.get(source.parentSlug) ?? new Set<string>()
				symbols.add(source.symbol)
				parentSymbols.set(source.parentSlug, symbols)
			}
			if (source.geckoId) {
				const geckoIds = parentGeckoIds.get(source.parentSlug) ?? new Set<string>()
				geckoIds.add(source.geckoId)
				parentGeckoIds.set(source.parentSlug, geckoIds)
			}
			if (source.hasMisrepresentedTokens) parentsWithMisrepresentedTokens.add(source.parentSlug)
		}
	}

	for (const [parentSlug, total] of parentTotals) {
		const metadata = parentMetadataBySlug.get(parentSlug)
		const symbols = parentSymbols.get(parentSlug)
		const geckoIds = parentGeckoIds.get(parentSlug)
		const name = metadata?.name ?? parentSlug
		const symbol = symbols?.size === 1 ? symbols.values().next().value : undefined
		const category = parentCategories.get(parentSlug)
		protocolsBySlug.set(parentSlug, {
			id: parentSlug,
			name,
			...(symbol !== undefined ? { symbol } : {}),
			...(metadata?.logo ? { logo: metadata.logo } : {}),
			slug: parentSlug,
			...(category !== undefined ? { category } : {}),
			chains: Array.from(parentChains.get(parentSlug) ?? []),
			tvl: total,
			geckoId: geckoIds?.size === 1 ? (geckoIds.values().next().value ?? null) : null,
			...(parentsWithMisrepresentedTokens.has(parentSlug) ? { misrepresentedTokens: true } : {}),
			parentProtocol: null
		})
	}

	const chains: Chain[] = chainsData.map((chain) => ({
		name: toDisplayName(chain.name),
		tvl: chain.tvl ?? 0,
		gecko_id: chain.gecko_id ?? null,
		tokenSymbol: chain.tokenSymbol ?? null,
		chainId: chain.chainId ?? null,
		cmcId: chain.cmcId ?? null
	}))
	chains.sort((a, b) => b.tvl - a.tvl)

	return { protocols: Array.from(protocolsBySlug.values()), chains }
}
