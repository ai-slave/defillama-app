/** Acquires one immutable Yields v2 generation at a server entry point. */
import { acquireDatasetSnapshot, type DatasetSnapshotRefreshMode } from '~/server/datasetSnapshots/refresh.server'
import type { YieldsSnapshot } from '../data/snapshot'

export {
	readBorrowMarkets,
	readBorrowRoutes,
	readEarn,
	readLoops,
	readTokenKeys,
	readTrends,
	readYieldsDepegs,
	readYieldsMeta
} from '../data/snapshot'

/** Acquire freshness once at a server entry point, then pass this handle through every transform. */
export async function acquireYieldsSnapshot(refreshMode: DatasetSnapshotRefreshMode): Promise<YieldsSnapshot> {
	return (await acquireDatasetSnapshot('yields', refreshMode)).handle
}

/** Optional consumers lose only their Yields enrichment when no usable snapshot can be acquired. */
export async function acquireOptionalYieldsSnapshot(): Promise<YieldsSnapshot | null> {
	try {
		return await acquireYieldsSnapshot('blocking')
	} catch (error) {
		console.error('Failed to acquire optional Yields snapshot', error)
		return null
	}
}
