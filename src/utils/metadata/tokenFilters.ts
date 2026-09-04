export const TOKEN_FILTER_METADATA_SCHEMA_VERSION = 1 as const

export interface TokenFilterMetadataArtifact {
	schemaVersion: typeof TOKEN_FILTER_METADATA_SCHEMA_VERSION
	generatedAt: number
	sources: {
		coingeckoCatalogGeneratedAt: number
		rankingsUpdatedAt: string | null
	}
	tokens: Record<string, { chains: string[]; nativeChains?: string[]; categories: string[] }>
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
	const artifact = value as TokenFilterMetadataArtifact
	return artifact?.schemaVersion === TOKEN_FILTER_METADATA_SCHEMA_VERSION ? artifact : EMPTY_TOKEN_FILTER_METADATA
}
