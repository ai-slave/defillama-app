import { getProtocolUnlocksStaticPropsData } from '~/containers/Unlocks/protocolUnlocksStaticProps'

// THORChain's emissions live under the DEX protocol slug on DefiLlama.
const DEX = 'thorchain-dex'

export interface ThorchainUnlocks {
	emissions: Awaited<ReturnType<typeof getProtocolUnlocksStaticPropsData>>['emissions']
	initialTokenMarketData: Awaited<ReturnType<typeof getProtocolUnlocksStaticPropsData>>['initialTokenMarketData']
}

// Fetched server-side (keyed pro API) so the dashboard gets data the in-browser code can't:
// the rate-limited all-emissions list behind Locked/Unlocked %. Only the processed JSON is
// sent to the client — the API key never leaves the server.
export async function fetchThorchainServerData(): Promise<ThorchainUnlocks> {
	const metadata = (await import('~/utils/metadata')).default
	const unlocks = await getProtocolUnlocksStaticPropsData(DEX, metadata.tokenlist, metadata.emissionsProtocolsList)
	// The emissions payload is keyed to the thorchain-dex slug; display it as plain
	// "THORChain" (the protocol asked for all "DEX" references to go) and drop the
	// methodology notes block (not wanted on the IR dashboard).
	const emissions = unlocks.emissions ? { ...unlocks.emissions, name: 'THORChain', notes: [] } : unlocks.emissions
	return {
		emissions,
		initialTokenMarketData: unlocks.initialTokenMarketData
	}
}
