/** Builds unpublished Markets artifacts; the snapshot store owns publication. */
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'
import { buildCexExchangeSlugIndex, buildTokenMarketsGeckoIdIndex, buildTokenMarketSummaries } from './dataset.index'
import {
	fetchExchangeDirectoryFromNetwork,
	fetchTokenExchangeListingsFromNetwork,
	fetchTokenMarketsListFromNetwork
} from './upstream'

const MARKETS_DOMAIN = 'markets'

export async function buildMarketsDomain(writer: DatasetSnapshotWriter): Promise<void> {
	const files = DATASET_SNAPSHOT_CONTRACT[MARKETS_DOMAIN].files

	const [tokensList, tokenExchangeListings, exchangeDirectory] = await Promise.all([
		fetchTokenMarketsListFromNetwork(),
		fetchTokenExchangeListingsFromNetwork(),
		fetchExchangeDirectoryFromNetwork()
	])

	await Promise.all([
		writer.writeJson(files.tokensList, tokensList),
		writer.writeJson(files.tokenSummaries, buildTokenMarketSummaries(tokenExchangeListings)),
		writer.writeJson(files.exchangeDirectory, exchangeDirectory),
		writer.writeJson(files.tokenGeckoIds, buildTokenMarketsGeckoIdIndex(tokenExchangeListings)),
		writer.writeJson(files.cexByDefillamaSlug, buildCexExchangeSlugIndex(exchangeDirectory))
	])
}
