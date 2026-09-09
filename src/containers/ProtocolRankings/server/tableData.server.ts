import { cachedResult } from '~/server/api/resultCache'
import {
	contentHashVersion,
	createRedisBlobStore,
	isContentHashVersion
} from '~/server/datasetSnapshots/redisBlobStore.server'
import { slug } from '~/utils'
import type { ICategoriesAndTags, IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import { recordRuntimeError } from '~/utils/telemetry'
import { getProtocolsByChain } from '../queries.server'
import { assertPublishableSnapshot } from '../snapshot.validation'
import { PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS, type ProtocolRankingActivityMetricKey } from '../sortAccessors'
import type { IProtocol } from '../types'

/**
 * Snapshot lifecycle for protocol rankings (delivery tier: cursor — see
 * src/server/tablePages/README.md). One canonical snapshot per chain is
 * content-hashed, published to the Redis blob store, and pinned by clients;
 * ChainOverview ISR reads the same snapshot's `source` block so it never
 * refetches adapters.
 *
 * Freshness: the in-process layer below is short and blocking on expiry so
 * process uptime cannot extend an expired `:latest` pointer through another
 * ISR cycle — Redis owns shared freshness. The pointer's 55 minutes sit just
 * under the ~hourly ISR cadence; the 4-hour blob overhang is the grace
 * window for in-flight cursors. Do not shorten it below pointer + scroll
 * session length.
 */

const SNAPSHOT_TTL_SECONDS = 4 * 60 * 60
const LATEST_POINTER_TTL_SECONDS = 55 * 60
const LAST_GOOD_POINTER_TTL_SECONDS = 24 * 60 * 60
const SNAPSHOT_MEMORY_OPTIONS = {
	ttlMs: 5 * 60 * 1000,
	maxEntries: 24,
	maxBytes: 128 * 1024 * 1024
}
const SNAPSHOT_VERSION_MEMORY_OPTIONS = {
	ttlMs: SNAPSHOT_TTL_SECONDS * 1000,
	maxEntries: 24,
	maxBytes: 128 * 1024 * 1024
}

export type ProtocolRankingsSnapshotData = {
	snapshot: string
	protocols: Array<IProtocol>
	availableActivityMetrics: Array<ProtocolRankingActivityMetricKey>
}

export function collectAvailableActivityMetrics(protocols: Array<IProtocol>): Array<ProtocolRankingActivityMetricKey> {
	return PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS.filter((key) =>
		protocols.some((protocol) => protocol[key] !== undefined)
	)
}

export type ProtocolRankingsCanonicalSnapshot = ProtocolRankingsSnapshotData & {
	chain: string
	createdAt: number
	// Compact summaries produced by the same source fetch let ChainOverview ISR avoid refetching adapters.
	// They stay server-side and are not included in paginated ranking responses.
	source: {
		chains: Array<string>
		feeProtocols: Array<{ slug: string; total24h?: number | null }> | null
		dexs: {
			total24h: number | null
			total7d: number | null
			change_7dover7d: number | null
			recentChart: Array<[number, number]>
		} | null
		perps: {
			total24h?: number | null
			total7d?: number | null
			change_7dover7d?: number | null
		} | null
	}
}

function chainCacheKey(chain: string): string {
	return slug(chain === 'All' ? 'all' : chain)
}

const snapshotStore = createRedisBlobStore<ProtocolRankingsCanonicalSnapshot>({
	prefix: 'protocol-rankings:v3',
	versionTtlSeconds: SNAPSHOT_TTL_SECONDS,
	pointerTtlSeconds: LATEST_POINTER_TTL_SECONDS,
	lastGoodTtlSeconds: LAST_GOOD_POINTER_TTL_SECONDS,
	getIdentity: (payload) => ({ key: chainCacheKey(payload.chain), version: payload.snapshot }),
	getPublishedAt: (payload) => payload.createdAt
})

export function isProtocolRankingSnapshotToken(value: string): boolean {
	return isContentHashVersion(value)
}

function measureSnapshotBytes(snapshot: ProtocolRankingsCanonicalSnapshot): number {
	return Buffer.byteLength(JSON.stringify(snapshot))
}

class ProtocolRankingSnapshotCacheMiss extends Error {}

async function readVersionedSnapshot(
	chain: string,
	snapshot: string
): Promise<ProtocolRankingsCanonicalSnapshot | null> {
	try {
		return await cachedResult(
			'protocol-rankings-snapshot-version',
			`${chainCacheKey(chain)}:${snapshot}`,
			SNAPSHOT_VERSION_MEMORY_OPTIONS,
			async () => {
				const stored = await snapshotStore.readVersion(chainCacheKey(chain), snapshot)
				if (!stored || stored.chain !== chain) throw new ProtocolRankingSnapshotCacheMiss()
				return stored
			},
			measureSnapshotBytes
		)
	} catch {
		return null
	}
}

export function getProtocolRankingSourceOptions({
	chain,
	chainMetadata,
	categoriesAndTagsMetadata
}: {
	chain: string
	chainMetadata: Record<string, IChainMetadata>
	categoriesAndTagsMetadata: ICategoriesAndTags
}): { shouldFetchDexs: boolean; shouldFetchPerps: boolean } {
	const metadata = chain === 'All' ? { id: 'all', name: 'All', dexs: true, perps: true } : chainMetadata[slug(chain)]
	if (!metadata) return { shouldFetchDexs: false, shouldFetchPerps: false }
	if (chain === 'All' || metadata.id === 'all') return { shouldFetchDexs: true, shouldFetchPerps: true }
	return {
		shouldFetchDexs:
			!!metadata.dexs && (categoriesAndTagsMetadata.configs.Dexs?.chains?.includes(metadata.id) ?? false),
		shouldFetchPerps:
			!!metadata.perps && (categoriesAndTagsMetadata.configs.Derivatives?.chains?.includes(metadata.id) ?? false)
	}
}

export async function getProtocolRankingsSnapshot({
	chain,
	chainMetadata,
	protocolMetadata,
	categoriesAndTagsMetadata
}: {
	chain: string
	chainMetadata: Record<string, IChainMetadata>
	protocolMetadata: Record<string, IProtocolMetadata>
	categoriesAndTagsMetadata: ICategoriesAndTags
}): Promise<ProtocolRankingsCanonicalSnapshot> {
	return cachedResult(
		'protocol-rankings-snapshot',
		chainCacheKey(chain),
		SNAPSHOT_MEMORY_OPTIONS,
		async () => {
			const cached = await snapshotStore.readCurrent(chainCacheKey(chain))
			if (cached && cached.chain === chain) return cached

			const { shouldFetchDexs, shouldFetchPerps } = getProtocolRankingSourceOptions({
				chain,
				chainMetadata,
				categoriesAndTagsMetadata
			})
			const result = await getProtocolsByChain({
				chain,
				chainMetadata,
				protocolMetadata,
				shouldFetchDexs,
				shouldFetchPerps,
				includeExtendedMetrics: true
			})
			if (!result) throw new Error(`Missing protocol rankings source for ${chain}`)
			const { protocols } = result
			const snapshot: ProtocolRankingsCanonicalSnapshot = {
				chain,
				createdAt: Date.now(),
				snapshot: contentHashVersion(JSON.stringify(protocols)),
				protocols,
				availableActivityMetrics: collectAvailableActivityMetrics(protocols),
				source: {
					chains: result.chains,
					feeProtocols:
						result.fees?.protocols.map((protocol) => ({
							slug: protocol.slug,
							...(protocol.total24h === undefined ? {} : { total24h: protocol.total24h })
						})) ?? null,
					dexs: result.dexs
						? {
								total24h: result.dexs.total24h ?? null,
								total7d: result.dexs.total7d ?? null,
								change_7dover7d: result.dexs.change_7dover7d ?? null,
								recentChart: result.dexs.totalDataChart.slice(-14)
							}
						: null,
					perps: result.perps
						? {
								...(result.perps.total24h === undefined ? {} : { total24h: result.perps.total24h }),
								...(result.perps.total7d === undefined ? {} : { total7d: result.perps.total7d }),
								...(result.perps.change_7dover7d === undefined ? {} : { change_7dover7d: result.perps.change_7dover7d })
							}
						: null
				}
			}
			const lastGood = await snapshotStore.readLastGood(chainCacheKey(chain))
			// Group metadata can describe TVL on other chains; check the included children instead.
			const allowNoTvl =
				protocols.length > 0 &&
				protocols.every((protocol) =>
					protocol.childProtocols
						? protocol.childProtocols.every((child) => protocolMetadata[child.id]?.tvl === false)
						: protocolMetadata[protocol.id]?.tvl === false
				)
			try {
				assertPublishableSnapshot(snapshot, {
					expectDexs: shouldFetchDexs,
					expectPerps: shouldFetchPerps,
					previousProtocolCount: lastGood?.protocols.length ?? null,
					allowNoTvl
				})
			} catch (error) {
				// Never publish a degraded snapshot — it would be pinned for hours.
				// Serve the freshest healthy version instead: a concurrent process
				// may have published since our pointer read missed, and :last-good
				// outlives :latest exactly for this branch.
				recordRuntimeError(error, 'unknown', { protocol_rankings_chain: chain })
				const fallback = (await snapshotStore.readCurrent(chainCacheKey(chain))) ?? lastGood
				if (fallback && fallback.chain === chain) return fallback
				throw error
			}
			// A failed publish (Redis unreachable) is deliberately not fatal: the
			// build is validated, telemetry recorded the failure inside the store,
			// and falling back to Redis reads would fail for the same reason. Each
			// process serves its own rebuild until Redis recovers (hardening P3).
			await snapshotStore.publish(snapshot)
			return snapshot
		},
		measureSnapshotBytes
	)
}

export async function getRequestedProtocolRankingsSnapshot({
	chain,
	requestedSnapshot,
	createLatest
}: {
	chain: string
	requestedSnapshot?: string | null
	createLatest: () => Promise<ProtocolRankingsCanonicalSnapshot>
}): Promise<{ snapshot: ProtocolRankingsCanonicalSnapshot; mismatch: boolean }> {
	if (requestedSnapshot) {
		const exact = await readVersionedSnapshot(chain, requestedSnapshot)
		if (exact) return { snapshot: exact, mismatch: false }
	}
	const latest = await createLatest()
	return { snapshot: latest, mismatch: !!requestedSnapshot && requestedSnapshot !== latest.snapshot }
}
