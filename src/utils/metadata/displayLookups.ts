import { slug } from '~/utils'

const PROTOCOL_FALLBACKs = {
	'morpho-v1': 'Morpho V1',
	'sky-staking-engine': 'Sky Staking Engine'
}

export function buildProtocolDisplayNameLookupRecord(
	protocolMetadata: Record<string, { name?: string; displayName?: string }>
): Record<string, string> {
	const lookup: Record<string, string> = {}

	for (const metadata of Object.values(protocolMetadata)) {
		if (!metadata.name) continue
		lookup[metadata.name] = metadata.displayName ?? metadata.name
	}

	for (const [protocol, fallback] of Object.entries(PROTOCOL_FALLBACKs)) {
		if (lookup[protocol] == null) {
			lookup[protocol] = fallback
		}
	}

	return lookup
}

export function buildChainDisplayNameLookupRecord(
	chainMetadata: Record<string, { id?: string; name?: string }>
): Record<string, string> {
	const lookup: Record<string, string> = {}

	for (const [key, metadata] of Object.entries(chainMetadata)) {
		if (!metadata.name) continue
		lookup[key] = metadata.name
		lookup[slug(metadata.name)] = metadata.name
		if (metadata.id) {
			lookup[metadata.id] = metadata.name
		}
	}

	return lookup
}

export function createStringLookupMap(lookup: Record<string, string>): Map<string, string> {
	const map = new Map<string, string>()

	for (const [key, value] of Object.entries(lookup)) {
		map.set(key, value)
	}

	return map
}
