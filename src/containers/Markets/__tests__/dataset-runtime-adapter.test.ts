import { expect, test } from 'vitest'
import { MARKETS_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installSnapshotDirectory } from '~/utils/test/snapshotDirectory'
const http = installFixtureFetch()
installSnapshotDirectory('markets-index-test')

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
	expect(await api.hasTokenMarkets('Bitcoin')).toBe(true)
	expect(await api.hasTokenMarkets('missing')).toBe(false)
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

test('indexes bulk summaries by identity and tolerates older listings', async () => {
	const { buildTokenMarketSummaries } = await import('../server/dataset.index')
	const bucket = { pair_count: 1, total_volume_24h: 100, total_oi_usd: 20 }
	const summary = {
		total_volume_24h: 100,
		total_oi_usd: 20,
		totals: {
			cex: { spot: bucket, linear_perp: bucket, inverse_perp: bucket },
			dex: { spot: bucket, linear_perp: bucket, inverse_perp: bucket }
		}
	}
	const index = buildTokenMarketSummaries({
		last_updated: '',
		tokens: [
			{ coingecko_id: 'Bitcoin', symbol: 'btc', name: 'Bitcoin', venues: [], summary },
			{ coingecko_id: 'other-bitcoin', symbol: 'btc', name: 'Other', venues: [] }
		]
	})
	expect(index).toEqual({ bitcoin: summary })
})
