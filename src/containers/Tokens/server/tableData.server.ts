import { fetchCoinGeckoTokensListFromDataset } from '~/api/coingecko'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import { fetchTokenMarketsList } from '~/containers/Markets/server/dataset.server'
import type { TokenOverviewCurrentMetrics } from '~/containers/Token/tokenOverview'
import { cachedResult } from '~/server/api/resultCache'
import { contentHashVersion, createRedisBlobStore } from '~/server/datasetSnapshots/redisBlobStore.server'
import { isCurrentTokensWindow, tokensCacheWindow } from '../cache.server'
import { buildTokenIndexById, buildTokenOverviewCurrentMetricsById, EMPTY_MARKETS_LIST } from '../readModel'

/**
 * The shared token market snapshot: one content-hashed, pointer-fresh dataset
 * per five-minute window that every runtime reads instead of independently
 * sampling the mutable upstream.
 */

interface SharedTokensMarketSnapshot {
	version: string
	generatedAt: number
	tokens: IResponseCGTokenRankingsDatasetItem[]
	markets: TokenMarketsListResponse | null
	currentMetricsById: Record<string, TokenOverviewCurrentMetrics>
}

interface TokensMarketSnapshot extends SharedTokensMarketSnapshot {
	tokenIndexById: Map<string, number>
}

const tokensMarketStore = createRedisBlobStore<SharedTokensMarketSnapshot>({
	prefix: 'tokens-market:v4',
	versionTtlSeconds: 30 * 60,
	pointerTtlSeconds: 5 * 60,
	lastGoodTtlSeconds: 60 * 60,
	getIdentity: (payload) => ({ key: 'all', version: payload.version }),
	getPublishedAt: (payload) => payload.generatedAt
})

async function buildSharedTokensMarketSnapshot(): Promise<SharedTokensMarketSnapshot> {
	const [tokens, markets, metadataModule] = await Promise.all([
		fetchCoinGeckoTokensListFromDataset(),
		fetchTokenMarketsList().catch(() => null),
		import('~/utils/metadata')
	])
	metadataModule.refreshMetadataInBackgroundIfStale('tokens')
	const currentMetricsById = buildTokenOverviewCurrentMetricsById({
		tokens,
		markets: markets ?? EMPTY_MARKETS_LIST,
		metadata: metadataModule.default
	})
	return {
		// Content-addressed: an unchanged upstream republishes the same blob and
		// only refreshes the freshness pointer.
		version: contentHashVersion(JSON.stringify({ tokens, markets, currentMetricsById })),
		generatedAt: Date.now(),
		tokens,
		markets,
		currentMetricsById
	}
}

export async function getTokensMarketSnapshot(): Promise<TokensMarketSnapshot> {
	// Keyed by the wall-clock window so every runtime flips to a fresh build at
	// the same boundary the CDN expires on - a snapshot from the previous
	// window is never served (or edge-cached) into the current one.
	return cachedResult(
		'tokens-market-snapshot',
		`window:${tokensCacheWindow(Date.now())}`,
		{ ttlMs: 60 * 1000, maxEntries: 2 },
		async () => {
			const current = await tokensMarketStore.readCurrent('all')
			if (current && isCurrentTokensWindow(current.generatedAt)) {
				return { ...current, tokenIndexById: buildTokenIndexById(current.tokens) }
			}

			let built: SharedTokensMarketSnapshot
			try {
				built = await buildSharedTokensMarketSnapshot()
			} catch (error) {
				// Upstream outage at the window flip: serve the last published
				// snapshot instead of failing the request.
				const lastGood = (await tokensMarketStore.readCurrent('all')) ?? (await tokensMarketStore.readLastGood('all'))
				if (lastGood) return { ...lastGood, tokenIndexById: buildTokenIndexById(lastGood.tokens) }
				throw error
			}
			// Adopt a concurrent runtime's build for this window instead of
			// publishing a second sample - the store's monotonic pointer plus
			// this re-read approximates the old first-writer-wins contract.
			const winner = await tokensMarketStore.readCurrent('all')
			if (winner && isCurrentTokensWindow(winner.generatedAt)) {
				return { ...winner, tokenIndexById: buildTokenIndexById(winner.tokens) }
			}
			await tokensMarketStore.publish(built)
			return { ...built, tokenIndexById: buildTokenIndexById(built.tokens) }
		}
	)
}

export type { SharedTokensMarketSnapshot, TokensMarketSnapshot }
