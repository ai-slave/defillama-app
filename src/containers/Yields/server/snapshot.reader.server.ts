/** Typed Yields reads and pure transforms pinned to one immutable snapshot handle. */
import { fetchCoinGeckoTokensListFromDataset } from '~/api/coingecko'
import { buildTokenBorrowRoutesData } from '~/containers/Token/tokenBorrowRoutes.transform'
import type { TokenBorrowRoutesResponse } from '~/containers/Token/tokenBorrowRoutes.types'
import { filterTokenYieldRows } from '~/containers/Token/tokenYields.transform'
import { buildBorrowAdvancedPageMetadata, buildBorrowAdvancedPageRows } from '~/containers/Yields/borrowAdvanced.server'
import { buildBorrowPageMetadata, buildBorrowPageRows } from '~/containers/Yields/borrowSimple.server'
import { getYieldTokenVariantSet } from '~/containers/Yields/domain/tokenFilter'
import { buildYieldHalalPageMetadata, buildYieldHalalPageResponse } from '~/containers/Yields/halalTable.server'
import {
	buildYieldLongShortPageMetadata,
	buildYieldLongShortPageResponse
} from '~/containers/Yields/longShortTable.server'
import { buildYieldLoopPageMetadata, buildYieldLoopPageResponse } from '~/containers/Yields/loopTable.server'
import { buildYieldPoolsPageResponse } from '~/containers/Yields/pools.server'
import { getPerpData, type LendBorrowData, type YieldConfigResponse } from '~/containers/Yields/queries.server'
import {
	buildYieldStrategyPageMetadata,
	buildYieldStrategyPageResponse
} from '~/containers/Yields/strategyTable.server'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import type { YieldPageData } from '~/containers/Yields/types'
import { isMissingDatasetSnapshotArtifact } from '~/server/datasetSnapshots/errors'
import { acquireDatasetSnapshot, type DatasetSnapshotRefreshMode } from '~/server/datasetSnapshots/refresh.server'
import type { DatasetSnapshotHandle } from '~/server/datasetSnapshots/store'
import {
	filterProtocolYieldRows,
	getYieldRowSnapshotId,
	indexYieldRows,
	resolveYieldRowsById
} from './dataset.transform'
import type { YieldPoolPageDataResult } from './dataset.types'
import { YIELDS_SNAPSHOT_FILES } from './snapshot.contract'
import { getYieldsTokenIndexArtifactPath } from './snapshot.indexPath.server'

type YieldProtocolConfig = NonNullable<NonNullable<YieldConfigResponse>['protocols']>[string]

export type YieldsSnapshot = {
	readonly handle: DatasetSnapshotHandle
}

/** Acquire freshness once, then keep every read on the same Yields generation. */
export async function acquireYieldsSnapshot(refreshMode: DatasetSnapshotRefreshMode): Promise<YieldsSnapshot> {
	const { handle } = await acquireDatasetSnapshot('yields', refreshMode)
	return { handle }
}

export function readYieldRows(snapshot: YieldsSnapshot): Promise<IYieldTableRow[]> {
	return snapshot.handle.readJson(YIELDS_SNAPSHOT_FILES.rows)
}

export function readYieldPageData(snapshot: YieldsSnapshot): Promise<YieldPageData> {
	return snapshot.handle.readJson(YIELDS_SNAPSHOT_FILES.pageData)
}

export function readYieldConfig(snapshot: YieldsSnapshot): Promise<YieldConfigResponse> {
	return snapshot.handle.readJson(YIELDS_SNAPSHOT_FILES.config)
}

export function readLendBorrowData(snapshot: YieldsSnapshot): Promise<LendBorrowData> {
	return snapshot.handle.readJson(YIELDS_SNAPSHOT_FILES.lendBorrow)
}

let indexedYieldRows: { rows: IYieldTableRow[]; byId: Map<string, IYieldTableRow> } | null = null

async function getIndexedYieldRows(snapshot: YieldsSnapshot): Promise<Map<string, IYieldTableRow>> {
	const rows = await readYieldRows(snapshot)
	if (indexedYieldRows?.rows === rows) return indexedYieldRows.byId
	const byId = indexYieldRows(rows)
	indexedYieldRows = { rows, byId }
	return byId
}

async function readIndexedTokenYieldRows(snapshot: YieldsSnapshot, token: string): Promise<IYieldTableRow[] | null> {
	const variants = getYieldTokenVariantSet(token)
	if (variants.size === 0) return null

	const rowById = await getIndexedYieldRows(snapshot)
	const rowsById = new Map<string, IYieldTableRow>()
	let foundIndex = false
	for (const variant of variants) {
		try {
			const rowIds = await snapshot.handle.readJson<string[]>(getYieldsTokenIndexArtifactPath(variant))
			foundIndex = true
			for (const row of resolveYieldRowsById(rowIds, rowById)) {
				rowsById.set(getYieldRowSnapshotId(row), row)
			}
		} catch (error) {
			if (!isMissingDatasetSnapshotArtifact(error)) throw error
		}
	}
	return foundIndex ? Array.from(rowsById.values()) : null
}

export async function getTokenYieldsRows(
	snapshot: YieldsSnapshot,
	token: string,
	chains?: string | string[]
): Promise<IYieldTableRow[]> {
	const indexedRows = token.trim() ? await readIndexedTokenYieldRows(snapshot, token) : null
	return indexedRows
		? filterTokenYieldRows(indexedRows, '', chains)
		: filterTokenYieldRows(await readYieldRows(snapshot), token, chains)
}

export async function getTokenBorrowRoutes(
	snapshot: YieldsSnapshot,
	token: string
): Promise<TokenBorrowRoutesResponse> {
	const lendBorrowData = await readLendBorrowData(snapshot)
	return buildTokenBorrowRoutesData(token, lendBorrowData.props.pools)
}

export function getYieldConfig(snapshot: YieldsSnapshot): Promise<YieldConfigResponse> {
	return readYieldConfig(snapshot)
}

export async function getBorrowAdvancedPageMetadata(snapshot: YieldsSnapshot) {
	const [lendBorrowData, cgList] = await Promise.all([
		readLendBorrowData(snapshot),
		fetchCoinGeckoTokensListFromDataset()
	])
	return buildBorrowAdvancedPageMetadata(lendBorrowData, cgList)
}

export async function getBorrowAdvancedPageRows(
	snapshot: YieldsSnapshot,
	query: Record<string, string | string[] | undefined>
) {
	return buildBorrowAdvancedPageRows(await readLendBorrowData(snapshot), query)
}

export async function getBorrowPageMetadata(snapshot: YieldsSnapshot) {
	const [lendBorrowData, cgList] = await Promise.all([
		readLendBorrowData(snapshot),
		fetchCoinGeckoTokensListFromDataset()
	])
	return buildBorrowPageMetadata(lendBorrowData, cgList)
}

export async function getBorrowPageRows(
	snapshot: YieldsSnapshot,
	query: Record<string, string | string[] | undefined>
) {
	return buildBorrowPageRows(await readLendBorrowData(snapshot), query)
}

export async function getYieldPoolsPage(
	snapshot: YieldsSnapshot,
	query: Record<string, string | string[] | undefined>
) {
	const [yieldPageData, lendBorrowData] = await Promise.all([readYieldPageData(snapshot), readLendBorrowData(snapshot)])
	return buildYieldPoolsPageResponse({
		data: yieldPageData.props,
		lendBorrowPools: lendBorrowData.props.pools,
		query
	})
}

export async function getYieldLoopPageMetadata(snapshot: YieldsSnapshot) {
	const [lendBorrowData, cgList] = await Promise.all([
		readLendBorrowData(snapshot),
		fetchCoinGeckoTokensListFromDataset()
	])
	return buildYieldLoopPageMetadata(lendBorrowData, cgList)
}

export async function getYieldLoopPage(snapshot: YieldsSnapshot, query: Record<string, string | string[] | undefined>) {
	return buildYieldLoopPageResponse(await readLendBorrowData(snapshot), query)
}

export async function getYieldStrategyPageMetadata(snapshot: YieldsSnapshot) {
	const [lendBorrowData, cgList] = await Promise.all([
		readLendBorrowData(snapshot),
		fetchCoinGeckoTokensListFromDataset()
	])
	return buildYieldStrategyPageMetadata(lendBorrowData, cgList)
}

export async function getYieldStrategyPage(
	snapshot: YieldsSnapshot,
	query: Record<string, string | string[] | undefined>
) {
	return buildYieldStrategyPageResponse(await readLendBorrowData(snapshot), query)
}

export async function getYieldLongShortPageMetadata(snapshot: YieldsSnapshot) {
	const [yieldPageData, cgList] = await Promise.all([
		readYieldPageData(snapshot),
		fetchCoinGeckoTokensListFromDataset()
	])
	return buildYieldLongShortPageMetadata(yieldPageData, cgList)
}

export async function getYieldLongShortPage(
	snapshot: YieldsSnapshot,
	query: Record<string, string | string[] | undefined>
) {
	const [yieldPageData, perps] = await Promise.all([readYieldPageData(snapshot), getPerpData()])
	return buildYieldLongShortPageResponse({ data: yieldPageData, perps, query })
}

export async function getYieldHalalPageMetadata(snapshot: YieldsSnapshot) {
	return buildYieldHalalPageMetadata(await readYieldPageData(snapshot))
}

export async function getYieldHalalPage(
	snapshot: YieldsSnapshot,
	query: Record<string, string | string[] | undefined>
) {
	return buildYieldHalalPageResponse(await readYieldPageData(snapshot), query)
}

export async function getProtocolYieldRows(
	snapshot: YieldsSnapshot,
	protocolSlugs: string[]
): Promise<IYieldTableRow[]> {
	return filterProtocolYieldRows(await readYieldRows(snapshot), protocolSlugs)
}

export async function getYieldPoolPageData(snapshot: YieldsSnapshot, poolId: string): Promise<YieldPoolPageDataResult> {
	const row = (await getIndexedYieldRows(snapshot)).get(poolId)
	if (!row) return { source: 'snapshot', data: null }

	const config = await readYieldConfig(snapshot)
	const protocolConfig: YieldProtocolConfig | null = row.projectslug
		? (config?.protocols?.[row.projectslug] ?? null)
		: null
	return {
		source: 'snapshot',
		data: { pool: row, config: protocolConfig, poolId }
	}
}
