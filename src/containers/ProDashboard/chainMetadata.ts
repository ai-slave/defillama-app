import { getDisplayAliases } from '~/utils/chainNormalizer'
import type { IChainMetadata } from '~/utils/metadata/types'

export function buildProDashboardChainMetadataByName(
	chains: Record<string, IChainMetadata> | null | undefined
): Map<string, IChainMetadata> {
	const chainsByName = new Map<string, IChainMetadata>()
	if (!chains) return chainsByName

	for (const key in chains) {
		const chain = chains[key]
		if (chain === undefined) continue
		chainsByName.set(key, chain)
		chainsByName.set(key.toLowerCase(), chain)
		chainsByName.set(chain.name, chain)
		chainsByName.set(chain.name.toLowerCase(), chain)
		for (const alias of getDisplayAliases(chain.name)) {
			chainsByName.set(alias, chain)
			chainsByName.set(alias.toLowerCase(), chain)
		}
	}
	return chainsByName
}

export function getProDashboardChainMetadata(
	chainsByName: ReadonlyMap<string, IChainMetadata>,
	chain: string
): IChainMetadata | undefined {
	return chainsByName.get(chain) ?? chainsByName.get(chain.toLowerCase())
}
