/** Builds one unpublished Yields v2 generation; the snapshot store owns atomic publication and fallback. */
import assert from 'node:assert/strict'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'
import { getErrorMessage } from '~/utils/error'
import {
	fetchBorrowMarketsFromNetwork,
	fetchBorrowRoutesFromNetwork,
	fetchDepegsFromNetwork,
	fetchEarnFromNetwork,
	fetchExploitsFromNetwork,
	fetchLoopsFromNetwork,
	fetchTokenKeysFromNetwork,
	fetchTrendsFromNetwork,
	fetchYieldsMetaFromNetwork
} from '../data/server/fetchers'
import { YIELDS_SNAPSHOT_FILES } from '../data/snapshot.contract'

const YIELDS_SNAPSHOT_FETCH_TIMEOUT_MS = 180_000

export async function buildYieldsSnapshotCandidate(writer: DatasetSnapshotWriter): Promise<void> {
	const fetchOptions = { extraRetry: true, timeout: YIELDS_SNAPSHOT_FETCH_TIMEOUT_MS }
	const [earn, trends, borrowMarkets, borrowRoutes, loops, tokenKeys, meta, depegs, exploits] =
		await Promise.allSettled([
			fetchEarnFromNetwork(fetchOptions),
			fetchTrendsFromNetwork(fetchOptions),
			fetchBorrowMarketsFromNetwork(fetchOptions),
			fetchBorrowRoutesFromNetwork(fetchOptions),
			fetchLoopsFromNetwork(fetchOptions),
			fetchTokenKeysFromNetwork(fetchOptions),
			fetchYieldsMetaFromNetwork(fetchOptions),
			fetchDepegsFromNetwork(fetchOptions),
			fetchExploitsFromNetwork(fetchOptions)
		])

	const failures: string[] = []
	for (const [name, result] of [
		['earn', earn],
		['trends', trends],
		['borrow markets', borrowMarkets],
		['borrow routes', borrowRoutes],
		['loops', loops],
		['tokens', tokenKeys],
		['meta', meta],
		['depegs', depegs],
		['exploits', exploits]
	] as const) {
		if (result.status === 'rejected') failures.push(`${name}: ${getErrorMessage(result.reason)}`)
	}
	if (failures.length > 0) throw new Error(`Yields snapshot requests failed:\n${failures.join('\n')}`)

	assert(earn.status === 'fulfilled')
	assert(trends.status === 'fulfilled')
	assert(borrowMarkets.status === 'fulfilled')
	assert(borrowRoutes.status === 'fulfilled')
	assert(loops.status === 'fulfilled')
	assert(tokenKeys.status === 'fulfilled')
	assert(meta.status === 'fulfilled')
	assert(depegs.status === 'fulfilled')
	assert(exploits.status === 'fulfilled')

	// A successful HTTP response can still contain an empty dataset. Publishing it
	// would replace the last good generation and turn the default tables into valid,
	// cacheable empty responses.
	assert(earn.value.length > 0, 'Yields snapshot earn dataset is empty')
	assert(trends.value.length > 0, 'Yields snapshot trends dataset is empty')
	assert(borrowMarkets.value.length > 0, 'Yields snapshot borrow markets dataset is empty')
	assert(borrowRoutes.value.length > 0, 'Yields snapshot borrow routes dataset is empty')
	assert(loops.value.length > 0, 'Yields snapshot loops dataset is empty')
	assert(tokenKeys.value.length > 0, 'Yields snapshot tokens dataset is empty')
	assert(meta.value.chains.length > 0, 'Yields snapshot metadata has no chains')
	assert(meta.value.protocols.length > 0, 'Yields snapshot metadata has no protocols')
	assert(meta.value.categories.length > 0, 'Yields snapshot metadata has no categories')
	assert(
		meta.value.tokens.families.length + meta.value.tokens.assets.length > 0,
		'Yields snapshot metadata has no token options'
	)

	const memePoolIds = new Set(meta.value.meme_pool_ids)
	assert(
		earn.value.some((row) => !memePoolIds.has(row.id)),
		'Yields snapshot earn dataset has no default-visible rows'
	)
	assert(
		borrowMarkets.value.some((row) => !memePoolIds.has(row.id)),
		'Yields snapshot borrow markets dataset has no default-visible rows'
	)
	assert(
		loops.value.some((row) => !memePoolIds.has(row.id)),
		'Yields snapshot loops dataset has no default-visible rows'
	)

	await Promise.all([
		writer.writeJson(YIELDS_SNAPSHOT_FILES.earn, earn.value),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.trends, trends.value),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.borrowMarkets, borrowMarkets.value),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.borrowRoutes, borrowRoutes.value),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.loops, loops.value),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.tokenKeys, tokenKeys.value),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.meta, meta.value),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.depegs, depegs.value),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.exploits, exploits.value)
	])
}
