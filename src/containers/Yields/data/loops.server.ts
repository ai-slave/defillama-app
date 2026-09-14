import { prepareYieldsTable, sliceYieldsPage, sortYieldsRows } from '~/containers/Yields/yieldsTablePagination.server'
import type { YieldsPaginatedTableResponse } from '~/containers/Yields/yieldsTableQuery'
import { queryBoolean, queryIntClamped } from '~/server/api/params'
import type { ApiQuery } from '~/server/api/types'
import { getRiskCoveredPoolIds } from '../VaultRisk/coveredPools'
import { computeLoopApy, resolveApy } from './apy'
import { deriveBorrowCapacityFilled } from './borrow.server'
import { getEnrichedLoops } from './enrich.server'
import {
	createTokensMatcher,
	matchesTriState,
	parseApyComponents,
	parseApyWindow,
	parseCommonFilters,
	parseNumber,
	parseTriState
} from './query'
import { getRaiseValuationsUsd, getReferralUrls } from './server/raiseValuations'
import { readYieldsDepegs, readYieldsMeta, type YieldsSnapshot } from './snapshot'
import type { ApyComponent, ApyWindow, EnrichedLoopRow, LoopTableRow, Token } from './types'

type LoopSortKey = 'loop_apy' | 'available_borrow' | 'supply_apy' | 'borrow_apy' | 'ltv' | 'loop_ltv'

// Non-empty reward-token symbols for a leg (drops nullish/blank symbols).
function tokenSymbols(tokens: Array<Token> | null | undefined): Array<string> {
	return (tokens ?? []).map((token) => token.symbol ?? '').filter(Boolean)
}

// Map an enriched loop row to the flat looping-table row. Supply and borrow APYs resolve
// against the selected APY window/components; intrinsic yield belongs to the supplied leg
// only (the borrow leg has none). `loopApy` is the geometric leverage recompute for the
// requested loop count.
function toLoopTableRow(
	row: EnrichedLoopRow,
	window: ApyWindow,
	components: Array<ApyComponent>,
	loopCount: number
): LoopTableRow {
	// Resolve both legs once so the totals and the per-leg components stay from the exact same
	// view (window + toggled components). The supply leg carries intrinsic when toggled; the
	// borrow leg never does (pass null), consistent with computeLoopApy.
	const supply = resolveApy(row.supply_apy, row.intrinsic, window, components)
	const borrow = resolveApy(row.borrow_cost_apy, null, window, components)
	return {
		id: row.id,
		configID: row.id,
		pool: row.token?.symbol ?? '',
		poolMeta: row.display.detail,
		url: row.url ?? null,
		project: row.protocol,
		projectslug: row.protocolSlug ?? row.protocol,
		// Token-less protocols get the "Potential Airdrop" marker (Fraxlend excluded at render).
		airdrop: row.potentialAirdrop,
		raiseValuationUsd: null,
		chain: row.chain,
		chains: [row.chain],
		leverage: row.leverage.supply_multiplier,
		supplyApy: supply.total,
		supplyApyBase: supply.base,
		supplyApyReward: supply.reward,
		supplyApyIntrinsic: supply.intrinsic,
		supplyIntrinsicSourceSymbol: row.intrinsic?.source_pool?.symbol ?? null,
		borrowApy: borrow.total,
		borrowApyBase: borrow.base,
		borrowApyReward: borrow.reward,
		supplyRewardTokensSymbols: tokenSymbols(row.reward_tokens.supply),
		borrowRewardTokensSymbols: tokenSymbols(row.reward_tokens.borrow),
		loopApy: computeLoopApy(row, loopCount, window, components),
		availableBorrowUsd: row.available_borrow_usd,
		totalBorrowUsd: row.total_borrow_usd,
		borrowCapacityFilled: deriveBorrowCapacityFilled(row.total_borrow_usd, row.available_borrow_usd),
		ltv: row.loan_to_value,
		loopCount
	}
}

export async function getLoopsPage(
	snapshot: YieldsSnapshot,
	query: ApiQuery
): Promise<YieldsPaginatedTableResponse<LoopTableRow>> {
	const prepared = await prepareYieldsTable({
		surface: 'loops',
		snapshot,
		query,
		prepare: () => buildPreparedLoops(snapshot, query),
		measureBytes: (rows) => rows.length * 1024 + 256
	})
	return sliceYieldsPage(prepared, query)
}

async function buildPreparedLoops(snapshot: YieldsSnapshot, query: ApiQuery): Promise<Array<LoopTableRow>> {
	const window = parseApyWindow(query)
	const components = parseApyComponents(query)
	const common = parseCommonFilters(query)
	const [rows, meta, depegs, raiseValuationsUsd, referralUrls, riskCovered] = await Promise.all([
		getEnrichedLoops(snapshot),
		readYieldsMeta(snapshot),
		readYieldsDepegs(snapshot),
		getRaiseValuationsUsd(snapshot),
		getReferralUrls(snapshot),
		getRiskCoveredPoolIds()
	])
	const memePoolIds = common.includeMemeTokens ? null : new Set(meta.meme_pool_ids)
	const depegByPool = new Map(depegs.map((depeg) => [depeg.pool_id, depeg]))
	const loopCount = queryIntClamped(query, 'loopCount', 5, 1, 10)
	const hasAudit = queryBoolean(query, 'hasAudit')
	const potentialAirdrop = parseTriState(query, 'potentialAirdrop')
	const minAvailable = parseNumber(query, 'minAvailable')
	const maxAvailable = parseNumber(query, 'maxAvailable')
	const matchesToken = createTokensMatcher(common.tokens)

	const pageRows: Array<LoopTableRow> = []
	for (const row of rows) {
		if (common.chains && !common.chains.has(row.chain)) continue
		if (common.projects && !common.projects.has(row.protocol)) continue
		if (memePoolIds?.has(row.id)) continue
		if (hasAudit && !row.hasAudit) continue
		if (!matchesTriState(potentialAirdrop, row.potentialAirdrop)) continue
		if (minAvailable != null && !(row.available_borrow_usd != null && row.available_borrow_usd >= minAvailable))
			continue
		if (maxAvailable != null && !(row.available_borrow_usd != null && row.available_borrow_usd <= maxAvailable))
			continue
		if (!matchesToken([row.tokenKeys?.reference_asset])) continue

		const loopRow = toLoopTableRow(row, window, components, loopCount)
		const referralUrl = row.protocolSlug ? referralUrls.get(row.protocolSlug) : undefined
		if (referralUrl) loopRow.url = referralUrl
		const depeg = depegByPool.get(row.id)
		if (depeg) {
			loopRow.pegDeviation = depeg.deviation_pct
			loopRow.pegTokenSymbol = depeg.token_symbol
		}
		// Airdrop hint decoration: latest fundraise valuation, only on airdrop rows.
		if (loopRow.airdrop && row.protocolSlug) {
			loopRow.raiseValuationUsd = raiseValuationsUsd.get(row.protocolSlug) ?? null
		}
		if (riskCovered.has(row.id)) loopRow.hasRiskData = true
		pageRows.push(loopRow)
	}

	return sortYieldsRows<LoopTableRow, LoopSortKey>({
		rows: pageRows,
		query,
		sortAccessors: {
			loop_apy: (row) => row.loopApy,
			available_borrow: (row) => row.availableBorrowUsd,
			supply_apy: (row) => row.supplyApy,
			borrow_apy: (row) => row.borrowApy,
			ltv: (row) => row.ltv,
			loop_ltv: (row) => row.ltv
		},
		defaultSort: { sortBy: 'loop_apy', sortDesc: true }
	})
}
