import { prepareYieldsTable, sliceYieldsPage, sortYieldsRows } from '~/containers/Yields/yieldsTablePagination.server'
import type { YieldsPaginatedTableResponse } from '~/containers/Yields/yieldsTableQuery'
import { queryBoolean } from '~/server/api/params'
import type { ApiQuery } from '~/server/api/types'
import { getRiskCoveredPoolIds } from '../VaultRisk/coveredPools'
import { resolveApy, resolveVariant } from './apy'
import { getEnrichedMarkets, getEnrichedRoutes } from './enrich.server'
import {
	createTokensMatcher,
	matchesTriState,
	parseApyComponents,
	parseApyWindow,
	parseCommonFilters,
	parseNumber,
	parseTokenPairFilters,
	parseTriState
} from './query'
import { getRaiseValuationsUsd, getReferralUrls } from './server/raiseValuations'
import { readYieldsDepegs, readYieldsMeta, type YieldsSnapshot } from './snapshot'
import { TOKEN_PAGE_BORROW_QUERY } from './tokenPageQuery'
import type {
	ApyComponent,
	ApyWindow,
	EnrichedMarketRow,
	EnrichedRouteRow,
	MarketTableRow,
	RouteTableRow,
	Token,
	DepegRow
} from './types'

// Utilization of the borrow capacity: total borrowed over (borrowed + still available).
// Derived here — the API serves the two facts, not the ratio.
export function deriveBorrowCapacityFilled(
	totalBorrowUsd: number | null | undefined,
	availableBorrowUsd: number | null | undefined
): number | null {
	if (totalBorrowUsd == null || availableBorrowUsd == null) return null
	const capacity = totalBorrowUsd + availableBorrowUsd
	return capacity <= 0 ? null : totalBorrowUsd / capacity
}

// Non-empty reward-token symbols for a leg (drops nullish/blank symbols).
function tokenSymbols(tokens: Token[] | null | undefined): string[] {
	return (tokens ?? []).map((token) => token.symbol ?? '').filter(Boolean)
}

type MarketSortKey = 'available_borrow' | 'total_borrow' | 'supply_apy' | 'borrow_apy' | 'ltv'
type RouteSortKey = 'net_apy' | 'available_borrow' | 'total_borrow' | 'supply_apy' | 'borrow_apy' | 'ltv'

// Map an enriched borrow-market row to the flat markets-table row.
function toMarketTableRow(row: EnrichedMarketRow, window: ApyWindow, components: ApyComponent[]): MarketTableRow {
	const label = row.display.label ?? row.collateral_token?.symbol ?? ''
	// Resolve both legs once so totals + per-leg components come from the same view.
	const supply = resolveApy(row.supply_apy, row.intrinsic.supply, window, components)
	const borrow = resolveApy(row.borrow_cost_apy, row.intrinsic.borrow, window, components)
	return {
		id: row.id,
		configID: row.id,
		pool: label,
		poolMeta: row.display.detail,
		url: row.url ?? null,
		project: row.protocol,
		projectslug: row.protocolSlug ?? row.protocol,
		// Token-less protocols get the "Potential Airdrop" marker (Fraxlend excluded at render).
		airdrop: !row.protocolHasToken,
		raiseValuationUsd: null,
		chain: row.chain,
		chains: [row.chain],
		supplyApy: supply.total,
		supplyApyBase: supply.base,
		supplyApyReward: supply.reward,
		supplyApyIntrinsic: supply.intrinsic,
		supplyIntrinsicSourceSymbol: row.intrinsic.supply?.source_pool?.symbol ?? null,
		borrowApy: borrow.total,
		borrowApyBase: borrow.base,
		borrowApyReward: borrow.reward,
		borrowApyIntrinsic: borrow.intrinsic,
		borrowIntrinsicSourceSymbol: row.intrinsic.borrow?.source_pool?.symbol ?? null,
		// Markets carry one pool-level reward set; mirror it to both legs (each leg only surfaces the
		// symbols when it actually has reward APY, so the borrow leg stays clean when reward is supply-only).
		supplyRewardTokensSymbols: tokenSymbols(row.reward_tokens),
		borrowRewardTokensSymbols: tokenSymbols(row.reward_tokens),
		collateralSymbol: row.collateral_token?.symbol ?? null,
		borrowSymbol: row.borrow_token?.symbol ?? null,
		totalSupplyUsd: row.total_supply_usd,
		availableBorrowUsd: row.available_borrow_usd,
		totalBorrowUsd: row.total_borrow_usd,
		borrowCapacityFilled: deriveBorrowCapacityFilled(row.total_borrow_usd, row.available_borrow_usd),
		ltv: row.loan_to_value
	}
}

// Map an enriched route (collateral → borrow leg pair) to the flat routes-table row.
function toRouteTableRow(row: EnrichedRouteRow, window: ApyWindow, components: ApyComponent[]): RouteTableRow {
	const collateralSymbol = row.collateral.token?.symbol ?? null
	const borrowSymbol = row.borrow.token?.symbol ?? null
	// Resolve both legs once so totals + per-leg components come from the same view.
	const supply = resolveApy(row.collateral.apy, row.collateral.intrinsic, window, components)
	const borrow = resolveApy(row.borrow.cost_apy, row.borrow.intrinsic, window, components)
	return {
		id: `${row.collateral.id}:${row.borrow.id}`,
		collateralId: row.collateral.id,
		borrowId: row.borrow.id,
		// Chart link target — the borrow leg's pool page.
		configID: row.borrow.id,
		pool: `${collateralSymbol ?? '—'} / ${borrowSymbol ?? '—'}`,
		poolMeta: row.display.detail,
		url: row.borrow.url ?? row.collateral.url ?? null,
		project: row.protocol,
		projectslug: row.protocolSlug ?? row.protocol,
		// Token-less protocols get the "Potential Airdrop" marker (Fraxlend excluded at render).
		airdrop: !row.protocolHasToken,
		raiseValuationUsd: null,
		chain: row.chain,
		chains: [row.chain],
		collateralSymbol,
		borrowSymbol,
		supplyApy: supply.total,
		supplyApyBase: supply.base,
		supplyApyReward: supply.reward,
		supplyApyIntrinsic: supply.intrinsic,
		supplyIntrinsicSourceSymbol: row.collateral.intrinsic?.source_pool?.symbol ?? null,
		borrowApy: borrow.total,
		borrowApyBase: borrow.base,
		borrowApyReward: borrow.reward,
		borrowApyIntrinsic: borrow.intrinsic,
		borrowIntrinsicSourceSymbol: row.borrow.intrinsic?.source_pool?.symbol ?? null,
		supplyRewardTokensSymbols: tokenSymbols(row.collateral.reward_tokens),
		borrowRewardTokensSymbols: tokenSymbols(row.borrow.reward_tokens),
		netApy: resolveVariant(row.net_apy[window], components),
		availableBorrowUsd: row.borrow.available_borrow_usd,
		totalBorrowUsd: row.borrow.total_borrow_usd,
		borrowCapacityFilled: deriveBorrowCapacityFilled(row.borrow.total_borrow_usd, row.borrow.available_borrow_usd),
		ltv: row.collateral.loan_to_value
	}
}

function decorateRouteTableRow(
	row: EnrichedRouteRow,
	window: ApyWindow,
	components: ApyComponent[],
	depegByPool: Map<string, DepegRow>,
	raiseValuationsUsd: Map<string, number>,
	referralUrls: Map<string, string>,
	riskCovered: Set<string>
): RouteTableRow {
	const routeRow = toRouteTableRow(row, window, components)
	// Outbound link: the protocol's referral URL wins over the leg's own URL (site-wide
	// ref-link policy, same preference as the protocol pages' website link).
	const referralUrl = row.protocolSlug ? referralUrls.get(row.protocolSlug) : undefined
	if (referralUrl) routeRow.url = referralUrl
	const collateralDepeg = depegByPool.get(row.collateral.id)
	const borrowDepeg = depegByPool.get(row.borrow.id)
	const worst =
		collateralDepeg && borrowDepeg
			? Math.abs(collateralDepeg.deviation_pct) >= Math.abs(borrowDepeg.deviation_pct)
				? collateralDepeg
				: borrowDepeg
			: (collateralDepeg ?? borrowDepeg)
	if (worst) {
		routeRow.pegDeviation = worst.deviation_pct
		routeRow.pegTokenSymbol = worst.token_symbol
	}
	if (routeRow.airdrop && row.protocolSlug)
		routeRow.raiseValuationUsd = raiseValuationsUsd.get(row.protocolSlug) ?? null
	if (riskCovered.has(row.collateral.id)) routeRow.hasRiskData = true
	return routeRow
}

const ROUTE_SORT_ACCESSORS = {
	net_apy: (row: RouteTableRow) => row.netApy,
	supply_apy: (row: RouteTableRow) => row.supplyApy,
	borrow_apy: (row: RouteTableRow) => row.borrowApy,
	available_borrow: (row: RouteTableRow) => row.availableBorrowUsd,
	total_borrow: (row: RouteTableRow) => row.totalBorrowUsd,
	ltv: (row: RouteTableRow) => row.ltv
}

const DEFAULT_ROUTE_SORT = { sortBy: 'available_borrow', sortDesc: true } as const

export async function getBorrowMarketsPage(
	snapshot: YieldsSnapshot,
	query: ApiQuery
): Promise<YieldsPaginatedTableResponse<MarketTableRow>> {
	const prepared = await prepareYieldsTable({
		surface: 'borrow-markets',
		snapshot,
		query,
		prepare: () => buildPreparedBorrowMarkets(snapshot, query),
		measureBytes: (rows) => rows.length * 1024 + 256
	})
	return sliceYieldsPage(prepared, query)
}

async function buildPreparedBorrowMarkets(snapshot: YieldsSnapshot, query: ApiQuery): Promise<MarketTableRow[]> {
	const window = parseApyWindow(query)
	const components = parseApyComponents(query)
	const common = parseCommonFilters(query)
	const [rows, meta, depegs, raiseValuationsUsd, referralUrls, riskCovered] = await Promise.all([
		getEnrichedMarkets(snapshot),
		readYieldsMeta(snapshot),
		readYieldsDepegs(snapshot),
		getRaiseValuationsUsd(snapshot),
		getReferralUrls(snapshot),
		getRiskCoveredPoolIds()
	])
	const memePoolIds = common.includeMemeTokens ? null : new Set(meta.meme_pool_ids)
	const depegByPool = new Map(depegs.map((depeg) => [depeg.pool_id, depeg]))
	const pair = parseTokenPairFilters(query)
	const matchesCollateral = createTokensMatcher(pair.collateralTokens)
	const matchesBorrow = createTokensMatcher(pair.borrowTokens)
	const hasAudit = queryBoolean(query, 'hasAudit')
	const protocolHasToken = parseTriState(query, 'protocolHasToken')
	const minAvailable = parseNumber(query, 'minAvailable')
	const maxAvailable = parseNumber(query, 'maxAvailable')

	const pageRows: MarketTableRow[] = []
	for (const row of rows) {
		if (common.chains && !common.chains.has(row.chain)) continue
		if (common.projects && !common.projects.has(row.protocol)) continue
		if (common.categories && !(row.category != null && common.categories.has(row.category))) continue
		if (memePoolIds?.has(row.id)) continue
		if (hasAudit && !row.hasAudit) continue
		if (!matchesTriState(protocolHasToken, row.protocolHasToken)) continue
		if (minAvailable != null && !(row.available_borrow_usd != null && row.available_borrow_usd >= minAvailable))
			continue
		if (maxAvailable != null && !(row.available_borrow_usd != null && row.available_borrow_usd <= maxAvailable))
			continue
		if (!matchesCollateral([row.tokenKeys?.reference_asset])) continue
		if (!matchesBorrow([row.tokenKeys?.borrow_token])) continue

		const marketRow = toMarketTableRow(row, window, components)
		// Outbound link: the protocol's referral URL wins over the market's own URL (site-wide
		// ref-link policy, same preference as the protocol pages' website link).
		const referralUrl = row.protocolSlug ? referralUrls.get(row.protocolSlug) : undefined
		if (referralUrl) marketRow.url = referralUrl
		const depeg = depegByPool.get(row.id)
		if (depeg) {
			marketRow.pegDeviation = depeg.deviation_pct
			marketRow.pegTokenSymbol = depeg.token_symbol
		}
		// Airdrop hint decoration: latest fundraise valuation, only on airdrop rows.
		if (marketRow.airdrop && row.protocolSlug) {
			marketRow.raiseValuationUsd = raiseValuationsUsd.get(row.protocolSlug) ?? null
		}
		if (riskCovered.has(row.id)) marketRow.hasRiskData = true
		pageRows.push(marketRow)
	}

	return sortYieldsRows<MarketTableRow, MarketSortKey>({
		rows: pageRows,
		query,
		sortAccessors: {
			available_borrow: (row) => row.availableBorrowUsd,
			total_borrow: (row) => row.totalBorrowUsd,
			supply_apy: (row) => row.supplyApy,
			borrow_apy: (row) => row.borrowApy,
			ltv: (row) => row.ltv
		},
		defaultSort: { sortBy: 'available_borrow', sortDesc: true }
	})
}

export async function getBorrowRoutesPage(
	snapshot: YieldsSnapshot,
	query: ApiQuery
): Promise<YieldsPaginatedTableResponse<RouteTableRow>> {
	const prepared = await prepareYieldsTable({
		surface: 'borrow-routes',
		snapshot,
		query,
		prepare: () => buildPreparedBorrowRoutes(snapshot, query),
		measureBytes: (rows) => rows.length * 1024 + 256
	})
	return sliceYieldsPage(prepared, query)
}

async function buildPreparedBorrowRoutes(snapshot: YieldsSnapshot, query: ApiQuery): Promise<RouteTableRow[]> {
	const window = parseApyWindow(query)
	const components = parseApyComponents(query)
	const common = parseCommonFilters(query)
	const [rows, meta, depegs, raiseValuationsUsd, referralUrls, riskCovered] = await Promise.all([
		getEnrichedRoutes(snapshot),
		readYieldsMeta(snapshot),
		readYieldsDepegs(snapshot),
		getRaiseValuationsUsd(snapshot),
		getReferralUrls(snapshot),
		getRiskCoveredPoolIds()
	])
	const memePoolIds = common.includeMemeTokens ? null : new Set(meta.meme_pool_ids)
	const depegByPool = new Map(depegs.map((depeg) => [depeg.pool_id, depeg]))
	const pair = parseTokenPairFilters(query)
	const matchesCollateral = createTokensMatcher(pair.collateralTokens)
	const matchesBorrow = createTokensMatcher(pair.borrowTokens)
	const hasAudit = queryBoolean(query, 'hasAudit')
	const protocolHasToken = parseTriState(query, 'protocolHasToken')
	const minAvailable = parseNumber(query, 'minAvailable')
	const maxAvailable = parseNumber(query, 'maxAvailable')

	const pageRows: RouteTableRow[] = []
	for (const row of rows) {
		if (common.chains && !common.chains.has(row.chain)) continue
		if (common.projects && !common.projects.has(row.protocol)) continue
		if (common.categories && !(row.category != null && common.categories.has(row.category))) continue
		if (memePoolIds && (memePoolIds.has(row.collateral.id) || memePoolIds.has(row.borrow.id))) continue
		if (hasAudit && !row.hasAudit) continue
		if (!matchesTriState(protocolHasToken, row.protocolHasToken)) continue
		const available = row.borrow.available_borrow_usd
		if (minAvailable != null && !(available != null && available >= minAvailable)) continue
		if (maxAvailable != null && !(available != null && available <= maxAvailable)) continue
		if (!matchesCollateral([row.collateralTokenKeys])) continue
		if (!matchesBorrow([row.borrowTokenKeys])) continue

		pageRows.push(
			decorateRouteTableRow(row, window, components, depegByPool, raiseValuationsUsd, referralUrls, riskCovered)
		)
	}

	return sortYieldsRows<RouteTableRow, RouteSortKey>({
		rows: pageRows,
		query,
		sortAccessors: ROUTE_SORT_ACCESSORS,
		defaultSort: DEFAULT_ROUTE_SORT
	})
}

export async function getBorrowRoutesForTokenKeys(snapshot: YieldsSnapshot, tokenKeys: string[]) {
	const [rows, depegs, raiseValuationsUsd, referralUrls, riskCovered] = await Promise.all([
		getEnrichedRoutes(snapshot),
		readYieldsDepegs(snapshot),
		getRaiseValuationsUsd(snapshot),
		getReferralUrls(snapshot),
		getRiskCoveredPoolIds()
	])
	const depegByPool = new Map(depegs.map((depeg) => [depeg.pool_id, depeg]))
	const window = parseApyWindow(TOKEN_PAGE_BORROW_QUERY)
	const components = parseApyComponents(TOKEN_PAGE_BORROW_QUERY)
	const memePoolIds = parseCommonFilters(TOKEN_PAGE_BORROW_QUERY).includeMemeTokens
		? null
		: new Set((await readYieldsMeta(snapshot)).meme_pool_ids)
	const matchesToken = createTokensMatcher(tokenKeys)
	const useAsCollateral: RouteTableRow[] = []
	const borrowThis: RouteTableRow[] = []

	for (const row of rows) {
		if (memePoolIds && (memePoolIds.has(row.collateral.id) || memePoolIds.has(row.borrow.id))) continue
		const collateralMatch = matchesToken([row.collateralTokenKeys])
		const borrowMatch = matchesToken([row.borrowTokenKeys])
		if (!collateralMatch && !borrowMatch) continue

		const route = decorateRouteTableRow(
			row,
			window,
			components,
			depegByPool,
			raiseValuationsUsd,
			referralUrls,
			riskCovered
		)
		if (collateralMatch) useAsCollateral.push(route)
		if (borrowMatch) borrowThis.push(route)
	}

	const query = TOKEN_PAGE_BORROW_QUERY
	return {
		useAsCollateral: sortYieldsRows<RouteTableRow, RouteSortKey>({
			rows: useAsCollateral,
			query,
			sortAccessors: ROUTE_SORT_ACCESSORS,
			defaultSort: DEFAULT_ROUTE_SORT
		}),
		borrowThis: sortYieldsRows<RouteTableRow, RouteSortKey>({
			rows: borrowThis,
			query,
			sortAccessors: ROUTE_SORT_ACCESSORS,
			defaultSort: DEFAULT_ROUTE_SORT
		})
	}
}
