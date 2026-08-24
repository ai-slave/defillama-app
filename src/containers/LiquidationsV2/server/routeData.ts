import { getLiquidationsSitemapProtocolChains, type LiquidationsSitemapProtocolChains } from './dataset.server'

export type { LiquidationsSitemapProtocolChains } from './dataset.server'

export async function getLiquidationsSitemapProtocolChainsFromSnapshot(): Promise<LiquidationsSitemapProtocolChains> {
	return getLiquidationsSitemapProtocolChains()
}
