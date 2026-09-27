import { getProtocolUnlocksStaticPropsData } from '~/containers/Unlocks/protocolUnlocksStaticProps'

// UNI emissions live under the parent protocol slug on DefiLlama.
const PROTOCOL = 'uniswap'

export interface UniswapUnlocks {
	emissions: Awaited<ReturnType<typeof getProtocolUnlocksStaticPropsData>>['emissions']
	initialTokenMarketData: Awaited<ReturnType<typeof getProtocolUnlocksStaticPropsData>>['initialTokenMarketData']
	generatedAtSec: number
}

// Fetched server-side (keyed pro API) so the dashboard gets data the in-browser code can't:
// the rate-limited all-emissions list behind Locked/Unlocked %. Only the processed JSON is
// sent to the client; the API key never leaves the server.
export async function fetchUniswapServerData(): Promise<UniswapUnlocks> {
	const metadata = (await import('~/utils/metadata')).default
	const unlocks = await getProtocolUnlocksStaticPropsData(PROTOCOL, metadata.tokenlist, metadata.emissionsProtocolsList)
	return {
		emissions: unlocks.emissions,
		initialTokenMarketData: unlocks.initialTokenMarketData,
		generatedAtSec: unlocks.generatedAtSec
	}
}
