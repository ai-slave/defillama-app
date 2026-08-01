import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { slug } from '~/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { removedCategoriesFromChainTvlSet } from './constants'

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
