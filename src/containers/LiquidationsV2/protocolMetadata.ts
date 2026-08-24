import type { IProtocolMetadata } from '~/utils/metadata/types'

type LiquidationsProtocolMetadata = IProtocolMetadata & { name?: string }

export function createProtocolMetadataLookup(
	protocolMetadata: Record<string, IProtocolMetadata>
): Map<string, LiquidationsProtocolMetadata> {
	const lookup = new Map<string, LiquidationsProtocolMetadata>()

	for (const metadataId in protocolMetadata) {
		const metadata: LiquidationsProtocolMetadata | undefined = protocolMetadata[metadataId]
		if (metadata?.name) {
			lookup.set(metadata.name, metadata)
		}
	}

	return lookup
}
