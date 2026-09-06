import {
	readBorrowMarkets,
	readBorrowRoutes,
	readEarn,
	readLoops,
	readTokenKeys,
	readTrends,
	readYieldsMeta,
	type YieldsSnapshot
} from './snapshot'
import type {
	BorrowMarketRow,
	EarnRow,
	EarnWithTokenKeysRow,
	EnrichedEarnRow,
	EnrichedLoopRow,
	EnrichedMarketRow,
	EnrichedRouteRow,
	EntityEarnRow,
	EntityEnrichment,
	EntityMarketRow,
	LoopRow,
	MetaChain,
	MetaProtocol,
	RouteRow,
	TokenKeys,
	Trend,
	YieldsMeta
} from './types'

// Rows carry only plain protocol/chain NAME strings; slugs and entity facts
// live in /v2/meta. These maps join them on.
export interface MetaMaps {
	protocolByName: Map<string, MetaProtocol>
	chainByName: Map<string, MetaChain>
	tokenSymbolByValue: Map<string, string>
}

function buildMetaMaps(meta: YieldsMeta): MetaMaps {
	const protocolByName = new Map<string, MetaProtocol>()
	for (const protocol of meta.protocols) protocolByName.set(protocol.name, protocol)

	const chainByName = new Map<string, MetaChain>()
	for (const chain of meta.chains) chainByName.set(chain.name, chain)

	const tokenSymbolByValue = new Map<string, string>()
	for (const token of meta.tokens.families) tokenSymbolByValue.set(token.value, token.symbol)
	for (const token of meta.tokens.assets) tokenSymbolByValue.set(token.value, token.symbol)

	return { protocolByName, chainByName, tokenSymbolByValue }
}

let metaMapsCache: { meta: YieldsMeta; maps: MetaMaps } | null = null

// Memoized by the parsed artifact reference; a new snapshot handle produces a new reference.
function getMetaMaps(meta: YieldsMeta): MetaMaps {
	if (metaMapsCache?.meta === meta) return metaMapsCache.maps
	const maps = buildMetaMaps(meta)
	metaMapsCache = { meta, maps }
	return maps
}

function entityEnrichment(protocol: string, chain: string, maps: MetaMaps): EntityEnrichment {
	const protocolMeta = maps.protocolByName.get(protocol)
	const chainMeta = maps.chainByName.get(chain)
	return {
		protocolSlug: protocolMeta?.slug ?? null,
		chainSlug: chainMeta?.slug ?? null,
		isEvm: chainMeta?.is_evm ?? null,
		category: protocolMeta?.category ?? null,
		hasAudit: protocolMeta?.has_audit ?? false,
		protocolHasToken: protocolMeta?.has_token ?? false
	}
}

function indexById<T extends { id: string }>(items: Array<T>): Map<string, T> {
	const byId = new Map<string, T>()
	for (const item of items) byId.set(item.id, item)
	return byId
}

let entityEarnCache: {
	earn: Array<EarnRow>
	meta: YieldsMeta
	rows: Array<EntityEarnRow>
} | null = null

export async function getEntityEarn(snapshot: YieldsSnapshot): Promise<Array<EntityEarnRow>> {
	const [earn, meta] = await Promise.all([readEarn(snapshot), readYieldsMeta(snapshot)])
	if (entityEarnCache?.earn === earn && entityEarnCache.meta === meta) return entityEarnCache.rows

	const maps = getMetaMaps(meta)
	const rows = earn.map((row) => ({ ...row, ...entityEnrichment(row.protocol, row.chain, maps) }))
	entityEarnCache = { earn, meta, rows }
	return rows
}

let earnWithTokenKeysCache: {
	earn: Array<EarnRow>
	tokenKeys: Array<TokenKeys>
	meta: YieldsMeta
	rows: Array<EarnWithTokenKeysRow>
} | null = null

export async function getEarnWithTokenKeys(snapshot: YieldsSnapshot): Promise<Array<EarnWithTokenKeysRow>> {
	const [earn, tokenKeys, meta] = await Promise.all([
		readEarn(snapshot),
		readTokenKeys(snapshot),
		readYieldsMeta(snapshot)
	])
	if (
		earnWithTokenKeysCache?.earn === earn &&
		earnWithTokenKeysCache.tokenKeys === tokenKeys &&
		earnWithTokenKeysCache.meta === meta
	)
		return earnWithTokenKeysCache.rows

	const maps = getMetaMaps(meta)
	const tokenKeysById = indexById(tokenKeys)
	const rows = earn.map((row) => ({
		...row,
		...entityEnrichment(row.protocol, row.chain, maps),
		tokenKeys: tokenKeysById.get(row.id) ?? null
	}))
	earnWithTokenKeysCache = { earn, tokenKeys, meta, rows }
	return rows
}

let enrichedEarnCache: {
	earn: Array<EarnRow>
	trends: Array<Trend>
	tokenKeys: Array<TokenKeys>
	meta: YieldsMeta
	rows: Array<EnrichedEarnRow>
} | null = null

export async function getEnrichedEarn(snapshot: YieldsSnapshot): Promise<Array<EnrichedEarnRow>> {
	const [earn, trends, tokenKeys, meta] = await Promise.all([
		readEarn(snapshot),
		readTrends(snapshot),
		readTokenKeys(snapshot),
		readYieldsMeta(snapshot)
	])
	if (
		enrichedEarnCache?.earn === earn &&
		enrichedEarnCache.trends === trends &&
		enrichedEarnCache.tokenKeys === tokenKeys &&
		enrichedEarnCache.meta === meta
	)
		return enrichedEarnCache.rows

	const maps = getMetaMaps(meta)
	const trendsById = indexById<Trend>(trends)
	const tokenKeysById = indexById<TokenKeys>(tokenKeys)
	const rows: Array<EnrichedEarnRow> = earn.map((row) => ({
		...row,
		...entityEnrichment(row.protocol, row.chain, maps),
		trend: trendsById.get(row.id) ?? null,
		tokenKeys: tokenKeysById.get(row.id) ?? null
	}))

	enrichedEarnCache = { earn, trends, tokenKeys, meta, rows }
	return rows
}

let entityMarketsCache: {
	markets: Array<BorrowMarketRow>
	meta: YieldsMeta
	rows: Array<EntityMarketRow>
} | null = null

export async function getEntityMarkets(snapshot: YieldsSnapshot): Promise<Array<EntityMarketRow>> {
	const [markets, meta] = await Promise.all([readBorrowMarkets(snapshot), readYieldsMeta(snapshot)])
	if (entityMarketsCache?.markets === markets && entityMarketsCache.meta === meta) return entityMarketsCache.rows

	const maps = getMetaMaps(meta)
	const rows = markets.map((row) => ({ ...row, ...entityEnrichment(row.protocol, row.chain, maps) }))
	entityMarketsCache = { markets, meta, rows }
	return rows
}

let enrichedMarketsCache: {
	markets: Array<BorrowMarketRow>
	tokenKeys: Array<TokenKeys>
	meta: YieldsMeta
	rows: Array<EnrichedMarketRow>
} | null = null

export async function getEnrichedMarkets(snapshot: YieldsSnapshot): Promise<Array<EnrichedMarketRow>> {
	const [markets, tokenKeys, meta] = await Promise.all([
		readBorrowMarkets(snapshot),
		readTokenKeys(snapshot),
		readYieldsMeta(snapshot)
	])
	if (
		enrichedMarketsCache?.markets === markets &&
		enrichedMarketsCache.tokenKeys === tokenKeys &&
		enrichedMarketsCache.meta === meta
	) {
		return enrichedMarketsCache.rows
	}

	const maps = getMetaMaps(meta)
	const tokenKeysById = indexById<TokenKeys>(tokenKeys)

	const rows: Array<EnrichedMarketRow> = markets.map((row) => ({
		...row,
		...entityEnrichment(row.protocol, row.chain, maps),
		tokenKeys: tokenKeysById.get(row.id) ?? null
	}))

	enrichedMarketsCache = { markets, tokenKeys, meta, rows }
	return rows
}

let enrichedRoutesCache: {
	routes: Array<RouteRow>
	tokenKeys: Array<TokenKeys>
	meta: YieldsMeta
	rows: Array<EnrichedRouteRow>
} | null = null

export async function getEnrichedRoutes(snapshot: YieldsSnapshot): Promise<Array<EnrichedRouteRow>> {
	const [routes, tokenKeys, meta] = await Promise.all([
		readBorrowRoutes(snapshot),
		readTokenKeys(snapshot),
		readYieldsMeta(snapshot)
	])
	if (
		enrichedRoutesCache &&
		enrichedRoutesCache.routes === routes &&
		enrichedRoutesCache.tokenKeys === tokenKeys &&
		enrichedRoutesCache.meta === meta
	) {
		return enrichedRoutesCache.rows
	}

	const maps = getMetaMaps(meta)
	const tokenKeysById = indexById<TokenKeys>(tokenKeys)

	const rows: Array<EnrichedRouteRow> = routes.map((row: RouteRow) => ({
		...row,
		...entityEnrichment(row.protocol, row.chain, maps),
		collateralTokenKeys: tokenKeysById.get(row.collateral.id)?.reference_asset ?? null,
		borrowTokenKeys: tokenKeysById.get(row.borrow.id)?.borrow_token ?? null
	}))

	enrichedRoutesCache = { routes, tokenKeys, meta, rows }
	return rows
}

let enrichedLoopsCache: {
	loops: Array<LoopRow>
	tokenKeys: Array<TokenKeys>
	meta: YieldsMeta
	rows: Array<EnrichedLoopRow>
} | null = null

export async function getEnrichedLoops(snapshot: YieldsSnapshot): Promise<Array<EnrichedLoopRow>> {
	const [loops, tokenKeys, meta] = await Promise.all([
		readLoops(snapshot),
		readTokenKeys(snapshot),
		readYieldsMeta(snapshot)
	])
	if (
		enrichedLoopsCache &&
		enrichedLoopsCache.loops === loops &&
		enrichedLoopsCache.tokenKeys === tokenKeys &&
		enrichedLoopsCache.meta === meta
	) {
		return enrichedLoopsCache.rows
	}

	const maps = getMetaMaps(meta)
	const tokenKeysById = indexById<TokenKeys>(tokenKeys)

	const rows: Array<EnrichedLoopRow> = loops.map((row: LoopRow) => ({
		...row,
		...entityEnrichment(row.protocol, row.chain, maps),
		tokenKeys: tokenKeysById.get(row.id) ?? null
	}))

	enrichedLoopsCache = { loops, tokenKeys, meta, rows }
	return rows
}
