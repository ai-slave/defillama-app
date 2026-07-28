import { slug } from '~/utils'
import type { IChainMetadata } from './types'

type ChainMetadataRecord = Record<string, IChainMetadata>

export function isDeprecatedChain(chainMetadata: ChainMetadataRecord, chain: string): boolean {
	return chainMetadata[slug(chain)]?.deprecated === true
}

export function getDeprecatedChainNames(chainMetadata: ChainMetadataRecord): Record<string, true> {
	const deprecatedChains: Record<string, true> = {}

	for (const metadata of Object.values(chainMetadata)) {
		if (metadata.deprecated) deprecatedChains[metadata.name] = true
	}

	return deprecatedChains
}

export function getDeprecatedChainsByName(
	chainMetadata: ChainMetadataRecord,
	chains: Iterable<string>
): Record<string, true> {
	const deprecatedChains: Record<string, true> = {}

	for (const chain of chains) {
		if (isDeprecatedChain(chainMetadata, chain)) deprecatedChains[chain] = true
	}

	return deprecatedChains
}
