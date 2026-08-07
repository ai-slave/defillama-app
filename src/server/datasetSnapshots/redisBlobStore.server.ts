import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'
import { getCache, getObjectCache, setCache, setObjectCache } from '~/utils/cache-client'
import { recordRuntimeError } from '~/utils/telemetry'

/**
 * Keyed pointer + immutable blob store for runtime-built dataset snapshots
 * A deliberate sibling of DatasetSnapshotStore, not an
 * implementation of it: this store holds single gzipped JSON blobs under
 * dynamic keys with TTL lifecycle, while the file store holds multi-file
 * generations under a static domain registry. The two share invariants, not
 * an interface:
 *
 * - the blob is written before any pointer, and a pointer is advanced only
 *   after the write it names succeeded — a pointer can never name a blob that
 *   failed to save;
 * - published blobs are immutable; refreshes publish a new version;
 * - `:last-good` is never rolled back by a failed publish.
 *
 * Keys, per logical `key` (e.g. a chain slug):
 *   {prefix}:{key}:latest     -> { version }   freshness pointer, short TTL
 *   {prefix}:{key}:last-good  -> { version }   fallback pointer, long TTL
 *   {prefix}:{key}:{version}  -> gzip blob     immutable, outlives `:latest`
 */

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * Content-addressed version for runtime-built datasets: unchanged data hashes
 * to an unchanged version, and the token is opaque, fixed-width, and safe to
 * round-trip through a browser. Validate returned tokens with
 * `isContentHashVersion` before concatenating them into store keys.
 */
export function contentHashVersion(serialized: string): string {
	return createHash('sha256').update(serialized).digest('base64url').slice(0, 20)
}

const CONTENT_HASH_VERSION_PATTERN = /^[A-Za-z0-9_-]{20}$/

export function isContentHashVersion(value: string): boolean {
	return CONTENT_HASH_VERSION_PATTERN.test(value)
}

export type RedisBlobStore<T> = {
	/** Read one immutable version. Null means missing, unreadable, or identity mismatch. */
	readVersion: (key: string, version: string) => Promise<T | null>
	/** Read the version named by `:latest`. Null means the pointer expired — rebuild. */
	readCurrent: (key: string) => Promise<T | null>
	/**
	 * Read the version named by `:last-good`. For the rebuild-FAILURE branch
	 * only — never for ordinary freshness, where it would silently extend an
	 * expired `:latest`.
	 */
	readLastGood: (key: string) => Promise<T | null>
	/** Write blob, then `:latest`, then `:last-good`; false (and a recorded runtime error) on any failure. */
	publish: (payload: T) => Promise<boolean>
}

export function createRedisBlobStore<T>(config: {
	/** Redis key prefix including any cache-format version, e.g. 'protocol-rankings:v3'. */
	prefix: string
	/** TTL of each immutable blob. Must comfortably exceed pointerTtlSeconds — the overhang is the grace window for in-flight readers. */
	versionTtlSeconds: number
	/** TTL of the `:latest` pointer. Expiry is the refresh trigger. */
	pointerTtlSeconds: number
	/** TTL of the `:last-good` pointer. Should be >= versionTtlSeconds. */
	lastGoodTtlSeconds: number
	/** Extract the identity a payload claims; reads verify it against what was asked for. */
	getIdentity: (payload: T) => { key: string; version: string }
}): RedisBlobStore<T> {
	const latestKey = (key: string) => `${config.prefix}:${key}:latest`
	const lastGoodKey = (key: string) => `${config.prefix}:${key}:last-good`
	const versionKey = (key: string, version: string) => `${config.prefix}:${key}:${version}`

	const reportFailure = (step: string, key: string) => {
		recordRuntimeError(new Error(`redisBlobStore failed to write ${step} for ${config.prefix}:${key}`), 'unknown', {
			blob_store_prefix: config.prefix,
			blob_store_key: key,
			blob_store_step: step
		})
	}

	async function readVersion(key: string, version: string): Promise<T | null> {
		const cached = await getCache(versionKey(key, version))
		if (!cached) return null
		try {
			const parsed = JSON.parse((await gunzipAsync(cached.Body)).toString('utf8')) as T
			const identity = config.getIdentity(parsed)
			if (identity.key !== key || identity.version !== version) return null
			return parsed
		} catch {
			return null
		}
	}

	async function readPointer(pointerKey: string, key: string): Promise<T | null> {
		const pointer = await getObjectCache<{ version: string }>(pointerKey)
		if (!pointer?.version) return null
		return readVersion(key, pointer.version)
	}

	return {
		readVersion,
		readCurrent: (key) => readPointer(latestKey(key), key),
		readLastGood: (key) => readPointer(lastGoodKey(key), key),
		async publish(payload) {
			const { key, version } = config.getIdentity(payload)
			const compressed = await gzipAsync(Buffer.from(JSON.stringify(payload)))
			const stored = await setCache(
				{ Key: versionKey(key, version), Body: compressed, ContentType: 'application/json+gzip' },
				config.versionTtlSeconds
			)
			if (!stored) {
				reportFailure('blob', key)
				return false
			}
			const latestSet = await setObjectCache(latestKey(key), { version }, config.pointerTtlSeconds)
			if (!latestSet) {
				reportFailure('latest pointer', key)
				return false
			}
			const lastGoodSet = await setObjectCache(lastGoodKey(key), { version }, config.lastGoodTtlSeconds)
			if (!lastGoodSet) {
				reportFailure('last-good pointer', key)
				return false
			}
			return true
		}
	}
}
