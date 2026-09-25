import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { slug } from '~/utils'
import type { IProtocolMetricsV2 } from './api.types'

export function resolveProtocolCategory({
	protocolData,
	liteProtocols
}: {
	protocolData: Pick<IProtocolMetricsV2, 'category' | 'id' | 'isParentProtocol'>
	liteProtocols: ReadonlyArray<Pick<ProtocolLite, 'parentProtocol' | 'category' | 'tvl'>>
}): string | null {
	if (protocolData.category) {
		return protocolData.category
	}

	if (!protocolData.isParentProtocol) {
		return null
	}

	let topChildCategory: string | null = null
	let topChildTvl = Number.NEGATIVE_INFINITY

	for (const protocol of liteProtocols) {
		if (protocol.parentProtocol !== protocolData.id || !protocol.category) {
			continue
		}

		const protocolTvl = protocol.tvl ?? 0
		if (protocolTvl > topChildTvl) {
			topChildTvl = protocolTvl
			topChildCategory = protocol.category
		}
	}

	return topChildCategory
}

// Parent protocols spread across categories: the protocol's own category leads, children add the rest.
export function getProtocolInfoCategories(
	category: string | null | undefined,
	childProtocols: ReadonlyArray<{ category?: string | null }>
): Array<{ label: string; href: string }> {
	const categories: Array<{ label: string; href: string }> = []
	const seen = new Set<string>()
	for (const label of [category, ...childProtocols.map((child) => child.category)]) {
		if (!label || seen.has(label)) continue
		seen.add(label)
		categories.push({ label, href: getCategoryRoute(slug(label)) })
	}
	return categories
}
