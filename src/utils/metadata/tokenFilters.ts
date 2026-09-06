export const TOKEN_FILTER_METADATA_SCHEMA_VERSION = 2 as const

export interface TokenFilterMetadataArtifact {
	schemaVersion: typeof TOKEN_FILTER_METADATA_SCHEMA_VERSION
	generatedAt: number
	sources: {
		coingeckoCatalogGeneratedAt: number
		rankingsUpdatedAt: string | null
	}
	tokens: Record<string, { chains: Array<string>; primaryChain: string | null; categories: Array<string> }>
	categories: Array<{ id: string; label: string; description?: string }>
}

export const EMPTY_TOKEN_FILTER_METADATA: TokenFilterMetadataArtifact = {
	schemaVersion: TOKEN_FILTER_METADATA_SCHEMA_VERSION,
	generatedAt: 0,
	sources: { coingeckoCatalogGeneratedAt: 0, rankingsUpdatedAt: null },
	tokens: {},
	categories: []
}

export function parseTokenFilterMetadata(value: unknown): TokenFilterMetadataArtifact {
	const artifact = value as
		| TokenFilterMetadataArtifact
		| (Omit<TokenFilterMetadataArtifact, 'schemaVersion' | 'tokens'> & {
				schemaVersion: 1
				tokens: Record<string, { chains: Array<string>; nativeChains?: Array<string>; categories: Array<string> }>
		  })
	if (artifact?.schemaVersion === TOKEN_FILTER_METADATA_SCHEMA_VERSION) return artifact
	if (artifact?.schemaVersion !== 1) return EMPTY_TOKEN_FILTER_METADATA
	const tokens: TokenFilterMetadataArtifact['tokens'] = {}
	for (const id in artifact.tokens) {
		const { nativeChains, ...token } = artifact.tokens[id]
		tokens[id] = { ...token, primaryChain: nativeChains?.[0] ?? null }
	}
	return { ...artifact, schemaVersion: TOKEN_FILTER_METADATA_SCHEMA_VERSION, tokens }
}
