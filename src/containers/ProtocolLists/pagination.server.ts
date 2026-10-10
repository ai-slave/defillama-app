import { inRange, rangeQuickPicks, USD_QUICK_PICK_LADDER } from '~/components/Filters/quickPicks'
import { compareTableSortValues, cursorTablePage } from '~/server/tablePages/cursorPage.server'
import { hashTableQuerySignature } from '~/server/tablePages/preparedRows.server'
import { parseNumberQueryParam } from '~/utils/routerQuery'
import { isProtocolListTvlKey } from './api.types'
import {
	protocolListSelection,
	protocolListSignature,
	PROTOCOL_LIST_LIMITS,
	type ProtocolListQuery,
	type RecentProtocolTableRow
} from './tableQuery'
import type { IRecentProtocol, IRecentProtocolsPageData } from './types'
import { applyExtraTvl, scopeRecentProtocolToChains } from './utils'

function filterRows(data: IRecentProtocolsPageData, query: ProtocolListQuery) {
	const { protocols, categories, forkedList } = data
	const { selectedChains, selectedCategories } = protocolListSelection(query, data.chainList, categories)
	const toHideForkedProtocols = query.hideForks === 'true'
	const rawKeys = query.tvlKeys ?? []
	const tvlKeys = (typeof rawKeys === 'string' ? [rawKeys] : rawKeys).filter(isProtocolListTvlKey)
	const categoriesToFilterSet = new Set(selectedCategories.map((selectedCategory) => selectedCategory.toLowerCase()))

	const chainsToSelectSet = new Set(selectedChains.map((t) => t.toLowerCase()))

	const filteredProtocols: Array<IRecentProtocol> = []

	for (const protocol of protocols) {
		// filter out forked protocols
		if (toHideForkedProtocols && forkedList?.[protocol.name]) continue

		// filter out protocols by category
		if (categories.length > 0) {
			if (categoriesToFilterSet.size === 0) continue
			if (categoriesToFilterSet.size > 0) {
				const protocolCategory = protocol.category?.toLowerCase() ?? ''
				if (!categoriesToFilterSet.has(protocolCategory)) continue
			}
		}

		// filter if a protocol has at least one selected chain
		let includesChain = false
		for (const c of protocol.chains) {
			if (chainsToSelectSet.has(c.toLowerCase())) {
				includesChain = true
				break
			}
		}
		if (!includesChain) continue

		filteredProtocols.push(scopeRecentProtocolToChains({ protocol, selectedChains: chainsToSelectSet }))
	}

	// Apply extraTvl toggles (staking/pool2/borrowed)
	return applyExtraTvl(filteredProtocols, Object.fromEntries(tvlKeys.map((key) => [key, true])))
}
export function protocolListSortValue(row: RecentProtocolTableRow, query: ProtocolListQuery) {
	switch (query.sort) {
		case 'category':
			return row.category.toLowerCase()
		case 'tvl':
			return row.tvl
		case 'change_1d':
			return row.change_1d
		case 'change_7d':
			return row.change_7d
		case 'change_1m':
			return row.change_1m
		case 'totalRaised':
			return row.raiseSummary?.totalUsd ?? null
		case 'undisclosedRounds':
			return row.raiseSummary?.undisclosedCount ?? null
		default:
			return row.listedAt
	}
}
export function getProtocolListRows(data: IRecentProtocolsPageData, query: ProtocolListQuery) {
	const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
	const minTvl = parseNumberQueryParam(query.minTvl)
	const maxTvl = parseNumberQueryParam(query.maxTvl)
	const tvlValues: Array<number | null> = []
	const rows: Array<RecentProtocolTableRow> = []
	for (const row of filterRows(data, query)) {
		if (!row.name.toLowerCase().includes(search)) continue
		// The chips count the rows every other filter keeps, so applying one leaves its own chips in place.
		tvlValues.push(row.tvl)
		if (inRange(row.tvl, minTvl, maxTvl)) rows.push(row)
	}
	rows.sort(
		(a, b) =>
			compareTableSortValues(
				protocolListSortValue(a, query),
				protocolListSortValue(b, query),
				query.order === 'asc' ? 'asc' : 'desc'
			) || (a.defillamaId < b.defillamaId ? -1 : a.defillamaId > b.defillamaId ? 1 : 0)
	)
	return {
		// Chain snapshots and additive sections are needed only by the server transform.
		rows: rows.map((row) => ({ ...row, chainTvls: {}, extraTvl: {} })),
		tvlQuickPicks: rangeQuickPicks(USD_QUICK_PICK_LADDER, tvlValues)
	}
}
export function paginateProtocolListRows(
	rows: Array<RecentProtocolTableRow>,
	version: string,
	query: ProtocolListQuery,
	cursor: string | null,
	limit: number
) {
	return cursorTablePage({
		rows,
		version,
		queryHash: hashTableQuerySignature(protocolListSignature(query)),
		cursor,
		limit,
		maxLimit: PROTOCOL_LIST_LIMITS.max,
		order: query.order === 'asc' ? 'asc' : 'desc',
		rowId: (row) => row.defillamaId,
		sortValue: (row) => protocolListSortValue(row, query)
	})
}
