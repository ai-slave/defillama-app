import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'

export interface ProDashboardAppMetadata {
	protocols: Record<string, IProtocolMetadata>
	chains: Record<string, IChainMetadata>
	pfPs: { pf: string[]; ps: string[] }
}

/** Fields actually consumed when a chart source is fetched. */
export interface ProDashboardChartRequest {
	type: string
	protocol?: string
	chain?: string
	geckoId?: string | null
	dataType?: string
	/** Resolved from the shared lite catalog; used only by protocol liquidity charts. */
	protocolSymbol?: string | null
}
