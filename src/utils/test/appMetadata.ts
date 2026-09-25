import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'

/**
 * Fetch fixtures for the three reads behind the Pro dashboard `AppMetadataProvider`: protocol
 * flags keyed by protocol id (the provider indexes them by `name`), chain flags keyed by chain id,
 * and the protocols with P/F and P/S ratios. Serve them with `installFixtureFetch().serve()`.
 */
export function appMetadataFixtures({
	protocols = {},
	chains = {},
	pf = [],
	ps = []
}: {
	protocols?: Record<string, IProtocolMetadata>
	chains?: Record<string, IChainMetadata>
	pf?: Array<string>
	ps?: Array<string>
} = {}) {
	return {
		'https://api.llama.fi/config/smol/appMetadata-protocols.json': protocols,
		'https://api.llama.fi/config/smol/appMetadata-chains.json': chains,
		'/api/public/pro-dashboard/pf-ps-protocols': { pf, ps }
	}
}
