import { cachedResult } from '~/server/api/resultCache'
import { contentHashVersion, createRedisBlobStore } from '~/server/datasetSnapshots/redisBlobStore.server'
import { prepareTableRows } from '~/server/tablePages/preparedRows.server'
import { getProtocolListRows, paginateProtocolListRows } from '../pagination.server'
import { getAirdropsProtocols, getRecentProtocols } from '../queries'
import {
	PROTOCOL_LIST_LIMITS,
	protocolListSignature,
	type ProtocolListKind,
	type ProtocolListQuery,
	type ProtocolListInitialProps
} from '../tableQuery'
import type { IRecentProtocolsPageData } from '../types'

type Snapshot = IRecentProtocolsPageData & { kind: ProtocolListKind; version: string; createdAt: number }
const store = createRedisBlobStore<Snapshot>({
	prefix: 'protocol-lists:v1',
	versionTtlSeconds: 4 * 60 * 60,
	pointerTtlSeconds: 55 * 60,
	lastGoodTtlSeconds: 24 * 60 * 60,
	getIdentity: (data) => ({ key: data.kind, version: data.version }),
	getPublishedAt: (data) => data.createdAt
})
const memory = { ttlMs: 5 * 60 * 1000, maxEntries: 8, maxBytes: 64 * 1024 * 1024 }
export async function getProtocolListSnapshot(kind: ProtocolListKind): Promise<Snapshot> {
	return cachedResult(
		'protocol-lists-snapshot',
		kind,
		memory,
		async () => {
			const current = await store.readCurrent(kind)
			if (current) return cacheProtocolListVersion(kind, current.version, async () => current)
			const data = await (kind === 'airdrops' ? getAirdropsProtocols() : getRecentProtocols())
			const snapshot = { ...data, kind, version: contentHashVersion(JSON.stringify(data)), createdAt: Date.now() }
			// Like rankings, a healthy build remains usable when Redis is unavailable (including next dev).
			// Retain its exact version locally; other workers may only reuse a rebuild with the same hash.
			await store.publish(snapshot)
			return cacheProtocolListVersion(kind, snapshot.version, async () => snapshot)
		},
		(data) => Buffer.byteLength(JSON.stringify(data))
	)
}
class ProtocolListSnapshotMissing extends Error {}
function cacheProtocolListVersion(kind: ProtocolListKind, version: string, build: () => Promise<Snapshot>) {
	return cachedResult(
		'protocol-lists-snapshot-version',
		`${kind}:${version}`,
		{ ...memory, ttlMs: 4 * 60 * 60 * 1000 },
		build,
		(data) => Buffer.byteLength(JSON.stringify(data))
	)
}
export async function readProtocolListSnapshot(kind: ProtocolListKind, version: string): Promise<Snapshot | null> {
	try {
		return await cacheProtocolListVersion(kind, version, async () => {
			const snapshot = await store.readVersion(kind, version)
			if (!snapshot) throw new ProtocolListSnapshotMissing()
			return snapshot
		})
	} catch (error) {
		if (error instanceof ProtocolListSnapshotMissing) return null
		throw error
	}
}

export function prepareProtocolListRows(snapshot: Snapshot, query: ProtocolListQuery) {
	return prepareTableRows({
		namespace: 'table-pages:protocol-lists:prepared-rows',
		domain: snapshot.kind,
		version: snapshot.version,
		signature: protocolListSignature(query),
		memory,
		prepare: () => getProtocolListRows(snapshot, query),
		measureBytes: (rows) => rows.length * 1024
	})
}
export async function getProtocolListInitialProps(kind: ProtocolListKind): Promise<ProtocolListInitialProps> {
	const snapshot = await getProtocolListSnapshot(kind)
	const rows = await prepareProtocolListRows(snapshot, {})
	const { rows: protocols, ...protocolList } = paginateProtocolListRows(
		rows,
		snapshot.version,
		{},
		null,
		PROTOCOL_LIST_LIMITS.initial
	)
	return {
		protocols,
		protocolList,
		kind,
		chainList: snapshot.chainList,
		categories: snapshot.categories
	}
}
