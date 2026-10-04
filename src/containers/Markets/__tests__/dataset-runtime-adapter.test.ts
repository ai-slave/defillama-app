import { expect, test } from 'vitest'
import { MARKETS_SERVER_URL } from '~/constants'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotBuilder } from '~/server/datasetSnapshots/store'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installSnapshotDirectory, publishAfterFirstAcquisition } from '~/utils/testing/snapshotDirectory'
import type { TokenMarketSummary } from '../api.types'
const http = installFixtureFetch()
installSnapshotDirectory('markets-index-test')

const MARKET_FILES = DATASET_SNAPSHOT_CONTRACT.markets.files
const bucket = { pair_count: 1, total_volume_24h: 100, total_oi_usd: 20 }
const summary: TokenMarketSummary = {
	total_volume_24h: 100,
	total_oi_usd: 20,
	totals: {
		cex: { spot: bucket, linear_perp: bucket, inverse_perp: bucket },
		dex: { spot: bucket, linear_perp: bucket, inverse_perp: bucket }
	}
}

/** A generation whose listed tokens each have a summary and a markets index entry. */
function marketsGeneration(summaries: Record<string, TokenMarketSummary>): DatasetSnapshotBuilder {
	return async (writer) => {
		const geckoIds: Record<string, true> = {}
		for (const geckoId in summaries) geckoIds[geckoId] = true
		await writer.writeJson(MARKET_FILES.tokensList, { tokens: [] })
		await writer.writeJson(MARKET_FILES.exchangeDirectory, { venues: [] })
		await writer.writeJson(MARKET_FILES.cexByDefillamaSlug, {})
		await writer.writeJson(MARKET_FILES.tokenSummaries, summaries)
		await writer.writeJson(MARKET_FILES.tokenGeckoIds, geckoIds)
	}
}

test('publishes token and exchange indexes where regional arms never take a DefiLlama slug', async () => {
	http.serve({
		[`${MARKETS_SERVER_URL}/tokens/list.json`]: { tokens: [] },
		[`${MARKETS_SERVER_URL}/tokens/exchange-listings.json`]: {
			last_updated: '2026-09-07',
			tokens: [{ coingecko_id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', venues: [] }]
		},
		[`${MARKETS_SERVER_URL}/exchanges/directory.json`]: {
			venues: [
				{
					slug: 'crypto-com-eu',
					type: 'cex',
					secondary: true,
					links: { defillama: { type: 'cex', slug: 'crypto-com' } }
				},
				{
					slug: 'crypto-com',
					display_name: 'Crypto.com',
					type: 'cex',
					links: { defillama: { type: 'cex', slug: 'crypto-com', url: 'https://defillama.com/cex/crypto-com' } }
				},
				{ slug: 'uniswap', type: 'dex', links: { defillama: { type: 'protocol', slug: 'Uniswap' } } }
			]
		}
	})
	const { fileDatasetSnapshotStore } = await import('~/server/datasetSnapshots/fileStore.server')
	const { buildMarketsDomain } = await import('../server/dataset.builder.server')
	await fileDatasetSnapshotStore.publish('markets', buildMarketsDomain)
	const api = await import('../server/dataset.server')
	expect(await api.getTokenMarkets('Bitcoin')).toEqual({ summary: null, hasMarkets: true })
	expect(await api.getTokenMarkets('missing')).toEqual({ summary: null, hasMarkets: false })
	expect(await api.resolveExchangeByDefillamaCexSlug('Crypto-com')).toEqual({
		exchange: 'crypto-com',
		defillama_slug: 'crypto-com'
	})
	expect(await api.resolveExchangeByDefillamaCexSlug('Uniswap')).toEqual({
		exchange: 'uniswap',
		defillama_slug: 'Uniswap'
	})
	expect(await api.resolveExchangeByDefillamaCexSlug('missing')).toBeNull()
})

test('reads a token summary and its markets link from one generation when a refresh lands between reads', async () => {
	const { fileDatasetSnapshotStore } = await import('~/server/datasetSnapshots/fileStore.server')
	await fileDatasetSnapshotStore.publish('markets', marketsGeneration({ bitcoin: summary }))
	await publishAfterFirstAcquisition('markets', marketsGeneration({}))
	const api = await import('../server/dataset.server')
	expect(await api.getTokenMarkets('bitcoin')).toEqual({ summary, hasMarkets: true })
	// The next response reads the refreshed generation.
	expect(await api.getTokenMarkets('bitcoin')).toEqual({ summary: null, hasMarkets: false })
})

test('indexes bulk summaries by identity and tolerates older listings', async () => {
	const { buildTokenMarketSummaries } = await import('../server/dataset.index')
	const index = buildTokenMarketSummaries({
		last_updated: '',
		tokens: [
			{ coingecko_id: 'Bitcoin', symbol: 'btc', name: 'Bitcoin', venues: [], summary },
			{ coingecko_id: 'other-bitcoin', symbol: 'btc', name: 'Other', venues: [] }
		]
	})
	expect(index).toEqual({ bitcoin: summary })
})
