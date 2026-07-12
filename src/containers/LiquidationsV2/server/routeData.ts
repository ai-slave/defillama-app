import { getLiquidationsProtocolChainIds, getLiquidationsProtocolsList } from './dataset.server'

export type LiquidationsSitemapProtocolChains = Array<{
	protocolId: string
	chainIds: string[]
}>

export async function getLiquidationsSitemapProtocolChainsFromSnapshot(): Promise<LiquidationsSitemapProtocolChains> {
	const { protocols } = await getLiquidationsProtocolsList()
	return Promise.all(
		protocols.map(async (protocolId) => ({
			protocolId,
			chainIds: await getLiquidationsProtocolChainIds(protocolId)
		}))
	)
}
