import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'
import { cachedResult } from '~/server/api/resultCache'
import { slug } from '~/utils'
import { getCache, getObjectCache, setCache, setObjectCache } from '~/utils/cache-client'
import type {
	ICategoriesAndTags,
	IChainMetadata,
	IProtocolMetadata,
	ProtocolLlamaswapMetadata
} from '~/utils/metadata/types'
import { collectAvailableActivityMetrics, type ProtocolRankingsSnapshotData } from './pagination.server'
import { getProtocolsByChain } from './queries.server'

const SNAPSHOT_CACHE_PREFIX = 'protocol-rankings:v3'
const SNAPSHOT_TTL_SECONDS = 4 * 60 * 60
const LATEST_POINTER_TTL_SECONDS = 55 * 60
const SNAPSHOT_MEMORY_OPTIONS = {
	// Redis `latest` owns shared freshness. Keep this short and blocking on expiry so
	// process uptime cannot extend an expired pointer through another ISR cycle.
	ttlMs: 5 * 60 * 1000,
	maxEntries: 24,
	maxBytes: 128 * 1024 * 1024
}
const SNAPSHOT_VERSION_MEMORY_OPTIONS = {
	ttlMs: SNAPSHOT_TTL_SECONDS * 1000,
	maxEntries: 24,
	maxBytes: 128 * 1024 * 1024
}
const SNAPSHOT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20}$/
const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

export function isProtocolRankingSnapshotToken(value: string): boolean {
	return SNAPSHOT_TOKEN_PATTERN.test(value)
}

export type ProtocolRankingsCanonicalSnapshot = ProtocolRankingsSnapshotData & {
	chain: string
	createdAt: number
	// Compact summaries produced by the same source fetch let ChainOverview ISR avoid refetching adapters.
	// They stay server-side and are not included in paginated ranking responses.
	source: {
		chains: string[]
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

function latestPointerKey(chain: string): string {
	return `${SNAPSHOT_CACHE_PREFIX}:${chainCacheKey(chain)}:latest`
}

function versionedSnapshotKey(chain: string, snapshot: string): string {
	return `${SNAPSHOT_CACHE_PREFIX}:${chainCacheKey(chain)}:${snapshot}`
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
				const cached = await getCache(versionedSnapshotKey(chain, snapshot))
				if (!cached) throw new ProtocolRankingSnapshotCacheMiss()
				const parsed = JSON.parse(
					(await gunzipAsync(cached.Body)).toString('utf8')
				) as ProtocolRankingsCanonicalSnapshot
				if (parsed.snapshot !== snapshot || parsed.chain !== chain) throw new ProtocolRankingSnapshotCacheMiss()
				return parsed
			},
			(value) => Buffer.byteLength(JSON.stringify(value))
		)
	} catch {
		return null
	}
}

async function readLatestSnapshot(chain: string): Promise<ProtocolRankingsCanonicalSnapshot | null> {
	const pointer = await getObjectCache<{ snapshot: string }>(latestPointerKey(chain))
	if (!pointer?.snapshot) return null
	return readVersionedSnapshot(chain, pointer.snapshot)
}

async function storeSnapshot(snapshot: ProtocolRankingsCanonicalSnapshot): Promise<void> {
	const compressed = await gzipAsync(Buffer.from(JSON.stringify(snapshot)))
	const stored = await setCache(
		{
			Key: versionedSnapshotKey(snapshot.chain, snapshot.snapshot),
			Body: compressed,
			ContentType: 'application/json+gzip'
		},
		SNAPSHOT_TTL_SECONDS
	)
	if (stored) {
		await setObjectCache(latestPointerKey(snapshot.chain), { snapshot: snapshot.snapshot }, LATEST_POINTER_TTL_SECONDS)
	}
}

export function getProtocolRankingSourceOptions({
	chain,
	chainMetadata,
	categoriesAndTagsMetadata
}: {
	chain: string
	chainMetadata: Record<string, IChainMetadata>
	categoriesAndTagsMetadata?: ICategoriesAndTags
}): { shouldFetchDexs: boolean; shouldFetchPerps: boolean } {
	const metadata = chain === 'All' ? { id: 'all', name: 'All', dexs: true, perps: true } : chainMetadata[slug(chain)]
	if (!metadata) return { shouldFetchDexs: false, shouldFetchPerps: false }
	if (chain === 'All' || metadata.id === 'all') return { shouldFetchDexs: true, shouldFetchPerps: true }
	return {
		shouldFetchDexs:
			!!metadata.dexs && (categoriesAndTagsMetadata?.configs?.Dexs?.chains?.includes(metadata.id) ?? false),
		shouldFetchPerps:
			!!metadata.perps && (categoriesAndTagsMetadata?.configs?.Derivatives?.chains?.includes(metadata.id) ?? false)
	}
}

export async function getProtocolRankingsSnapshot({
	chain,
	chainMetadata,
	protocolMetadata,
	categoriesAndTagsMetadata,
	protocolLlamaswapDataset = null
}: {
	chain: string
	chainMetadata: Record<string, IChainMetadata>
	protocolMetadata: Record<string, IProtocolMetadata>
	categoriesAndTagsMetadata?: ICategoriesAndTags
	protocolLlamaswapDataset?: ProtocolLlamaswapMetadata | null
}): Promise<ProtocolRankingsCanonicalSnapshot> {
	return cachedResult(
		'protocol-rankings-snapshot',
		chainCacheKey(chain),
		SNAPSHOT_MEMORY_OPTIONS,
		async () => {
			const cached = await readLatestSnapshot(chain)
			if (cached) return cached

			const { shouldFetchDexs, shouldFetchPerps } = getProtocolRankingSourceOptions({
				chain,
				chainMetadata,
				categoriesAndTagsMetadata
			})
			const result = await getProtocolsByChain({
				chain,
				chainMetadata,
				protocolMetadata,
				protocolLlamaswapDataset,
				shouldFetchDexs,
				shouldFetchPerps,
				includeExtendedMetrics: true
			})
			if (!result) throw new Error(`Missing protocol rankings source for ${chain}`)
			const snapshotVersion = createHash('sha256')
				.update(JSON.stringify(result.protocols))
				.digest('base64url')
				.slice(0, 20)
			const { protocols } = result
			const snapshot: ProtocolRankingsCanonicalSnapshot = {
				chain,
				createdAt: Date.now(),
				snapshot: snapshotVersion,
				protocols,
				availableActivityMetrics: collectAvailableActivityMetrics(protocols),
				source: {
					chains: result.chains,
					feeProtocols:
						result.fees?.protocols.map((protocol) => ({
							slug: protocol.slug,
							total24h: protocol.total24h
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
								total24h: result.perps.total24h,
								total7d: result.perps.total7d,
								change_7dover7d: result.perps.change_7dover7d
							}
						: null
				}
			}
			await storeSnapshot(snapshot)
			return snapshot
		},
		(snapshot) => Buffer.byteLength(JSON.stringify(snapshot))
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
