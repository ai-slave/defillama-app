import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { slug } from '~/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { removedCategoriesFromChainTvlSet } from './constants'
import type { IProtocol } from './types'

const excludedCategoriesSet = new Set(['Canonical Bridge', 'Staking Pool', 'Foundation'])

export const toFilterProtocol = ({
	protocolMetadata,
	protocolData,
	chainDisplayName
}: {
	protocolMetadata: Pick<IProtocolMetadata, 'displayName' | 'chains'>
	protocolData: ProtocolLite
	chainDisplayName: string | null
}): boolean => {
	if (!protocolMetadata.displayName || !protocolMetadata.chains) return false
	if (excludedCategoriesSet.has(protocolData.category)) return false
	if (chainDisplayName === 'All') return true
	if (chainDisplayName === null) return false

	return protocolMetadata.chains.includes(chainDisplayName) || protocolData.chains.includes(chainDisplayName)
}

export const toStrikeTvl = (
	protocol: ProtocolLite,
	extraTvlSections: { liquidstaking?: boolean; doublecounted?: boolean }
) => {
	if (removedCategoriesFromChainTvlSet.has(protocol.category)) return true

	if (extraTvlSections.liquidstaking || extraTvlSections.doublecounted) return true

	return false
}

export const protocolMatchesForkFilter = ({
	protocol,
	normalizedFork
}: {
	protocol: ProtocolLite
	normalizedFork: string | null
}): boolean => {
	if (!normalizedFork) return true

	const forkedFrom = protocol.forkedFrom
	if (!forkedFrom) return false
	for (const forkName of forkedFrom) {
		if (slug(forkName) === normalizedFork) return true
	}
	return false
}

/** Parents a search reached only through their children open, keyed like the table's root row ids. */
export function getSearchExpandedRows(
	rows: ReadonlyArray<Pick<IProtocol, 'id' | 'name' | 'slug' | 'childProtocols'>>,
	search: string
): Record<string, boolean> | null {
	const normalizedQuery = search.trim().toLowerCase()
	if (!normalizedQuery) return null
	const expanded: Record<string, boolean> = {}
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index]
		if (row?.childProtocols?.length && !row.name.toLowerCase().includes(normalizedQuery)) {
			expanded[row.id ?? `root:${row.slug || index}`] = true
		}
	}
	return expanded
}
