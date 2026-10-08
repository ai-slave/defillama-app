import { prepareYieldsTable, sliceYieldsPage, sortYieldsRows } from '~/containers/Yields/yieldsTablePagination.server'
import type { YieldsPaginatedTableResponse } from '~/containers/Yields/yieldsTableQuery'
import { queryBoolean } from '~/server/api/params'
import type { ApiQuery } from '~/server/api/types'
import { slug } from '~/utils'
import { getCanonicalTokenRoute, type TokenDirectory } from '~/utils/tokenDirectory'
import { isVerifiedCurrent } from '../domain/verifiedFreshness'
import { getRiskCoveredPoolIds } from '../VaultRisk/coveredPools'
import {
	applyMeasuredBase,
	applyMeasuredIntrinsic,
	resolveVerifiedApy,
	collapseTrend,
	type MeasuredApy,
	resolveApy,
	resolveVariant,
	stabilityRatingFromScore
} from './apy'
import { getEnrichedEarn } from './enrich.server'
import { exitSortScore } from './exit'
import { legacyMinTvl, legacySortBy, normalizeLegacyTokens } from './legacyQuery'
import {
	createTokenFilterMatcher,
	matchesTriState,
	parseApyComponents,
	parseApyWindow,
	parseCommonFilters,
	parseNumber,
	parseTokenMatch,
	parseTokenOn,
	parseTriState,
	type TokenFilterInput,
	UNCATEGORIZED
} from './query'
import { getRaiseValuationsUsd, getReferralUrls, withReferral } from './server/raiseValuations'
import { readYieldsDepegs, readYieldsExploits, readYieldsMeta, type YieldsSnapshot } from './snapshot'
import type { DepegRow, EarnPageRow, EnrichedEarnRow, Token } from './types'
import { lockEarnRows } from './verifiedGate'

function collectRewardSymbols(tokens: Array<Token>): Array<string> {
	const symbols: Array<string> = []
	for (const token of tokens) {
		if (token.symbol) symbols.push(token.symbol)
	}
	return symbols
}

function collectPoolTokenSymbols(row: EnrichedEarnRow): Array<string> {
	const symbols = new Set<string>()
	for (const token of row.underlying_tokens) if (token.symbol) symbols.add(token.symbol)
	if (row.pool_token?.symbol) symbols.add(row.pool_token.symbol)
	if (row.reference_asset_symbol) symbols.add(row.reference_asset_symbol)
	return [...symbols]
}

const NO_KEYS: Array<string> = []

function medianApyOf(rows: Array<EarnPageRow>): number | null {
	const values: Array<number> = []
	for (const row of rows) if (row.apy != null) values.push(row.apy)
	if (values.length === 0) return null
	values.sort((a, b) => a - b)
	const mid = Math.floor(values.length / 2)
	return values.length % 2 === 0 ? (values[mid - 1]! + values[mid]!) / 2 : values[mid]!
}

// Build the per-row option-key sets for the token filter.
function tokenFilterInput(row: EnrichedEarnRow): TokenFilterInput {
	return {
		referenceKeys: row.tokenKeys?.reference_asset ?? NO_KEYS,
		poolKeys: row.tokenKeys?.pool_token ?? NO_KEYS,
		referenceExactKeys: row.tokenKeys?.reference_asset_exact ?? NO_KEYS
	}
}

type PreparedEarn = { rows: Array<EarnPageRow>; medianApy: number | null }

export interface EarnPageAccess {
	/**
	 * False skips `applyMeasuredBase` outright, so the headline, sort key, APY filters, median and
	 * CSV are all the reported numbers — a locked reader cannot rank by a withheld figure.
	 */
	verifiedAccess: boolean
}

/**
 * Defaults to LOCKED: callers like the token and RWA pages embed these rows in shared cacheable
 * HTML, so a permissive default would leak the paid dataset through whichever surface was forgotten.
 */
export async function getEarnPage(
	snapshot: YieldsSnapshot,
	query: ApiQuery,
	access: EarnPageAccess = { verifiedAccess: false }
): Promise<YieldsPaginatedTableResponse<EarnPageRow>> {
	// Filter + map + median + sort run once per (generation, filters+sort) and
	// every page of that combination is a slice. Everything except page/pageSize
	// can change rows or their order, so it all signs.
	const prepared = await prepareYieldsTable({
		surface: 'earn',
		snapshot,
		// The tiers produce different rows and a different order, so they must not share an entry.
		query: { ...query, __verifiedAccess: access.verifiedAccess ? '1' : '0' },
		prepare: () => buildPreparedEarn(snapshot, query, access),
		// Estimated: serializing ~14k rows just to size them costs more than a
		// mis-sized entry. Earn rows carry sparklines, hence the heavy per-row figure.
		measureBytes: (value) => value.rows.length * 2048 + 256,
		maxBytes: 192 * 1024 * 1024
	})

	return {
		...sliceYieldsPage(prepared.rows, query),
		medianApy: prepared.medianApy
	}
}

async function buildPreparedEarn(
	snapshot: YieldsSnapshot,
	query: ApiQuery,
	access: EarnPageAccess
): Promise<PreparedEarn> {
	// One clock per prepared table: freshness is judged once for every row, and the memo's lifetime
	// bounds how far behind that judgement can fall.
	const now = Date.now()
	const window = parseApyWindow(query)
	const components = parseApyComponents(query)
	const common = parseCommonFilters(query)

	// Token search: Match (exact/contains/set) × On (reference/pool/both). Absent/invalid
	// params fall back to the default exact-on-reference behavior.
	const tokenMatch = parseTokenMatch(query)
	const tokenOn = parseTokenOn(query)

	const stablecoin = queryBoolean(query, 'stablecoin')
	const halal = queryBoolean(query, 'halal')
	const [rows, meta, depegs, exploits, raiseValuationsUsd, referralUrls, riskCovered, metadataCache] =
		await Promise.all([
			getEnrichedEarn(snapshot),
			readYieldsMeta(snapshot),
			readYieldsDepegs(snapshot),
			readYieldsExploits(snapshot),
			getRaiseValuationsUsd(snapshot),
			getReferralUrls(snapshot),
			getRiskCoveredPoolIds(),
			import('~/utils/metadata').then((m) => m.default)
		])
	const tokenDirectory = metadataCache.tokenDirectory
	common.tokens = normalizeLegacyTokens(common.tokens, meta)
	const matchesToken = createTokenFilterMatcher(common.tokens, tokenMatch, tokenOn)
	// Worst-deviation-per-pool depeg flags, joined onto matching rows by pool id (sparse).
	const depegByPool = new Map<string, DepegRow>(depegs.map((depeg) => [depeg.pool_id, depeg]))
	// Curated exploit flags (server-side editorial list), joined by pool id (sparse).
	const exploitedPoolIds = new Set(exploits)
	const halalSlugs = halal ? new Set(meta.halal) : null
	const memePoolIds = common.includeMemeTokens ? null : new Set(meta.meme_pool_ids)
	const singleAssetExposure = parseTriState(query, 'singleAssetExposure')
	const noIlRisk = queryBoolean(query, 'noIlRisk')
	const hasAudit = queryBoolean(query, 'hasAudit')
	const potentialAirdrop = parseTriState(query, 'potentialAirdrop')
	// Narrows to pools we measure on-chain. Coverage is sparse (~124 of 15k), so this is the
	// only practical way to find them without scanning the whole table.
	const verifiedOnly = queryBoolean(query, 'verified')
	// Intrinsic legs point at another pool's yield. Where that source pool is measured, its reading
	// stands in for the reported leg, the same way the base does for the pool's own figure.
	const verifiedById = new Map(rows.flatMap((row) => (row.verified ? [[row.id, row.verified] as const] : [])))

	const minTvl = legacyMinTvl(query, parseNumber(query, 'minTvl'))
	const maxTvl = parseNumber(query, 'maxTvl')
	const minApy = parseNumber(query, 'minApy')
	const maxApy = parseNumber(query, 'maxApy')

	const pageRows: Array<EarnPageRow> = []
	for (const row of rows) {
		if (common.ids && !common.ids.has(row.id)) continue
		if (common.matchesChain && !common.matchesChain(row.chain)) continue
		if (common.matchesProtocol && !common.matchesProtocol(row.protocol)) continue
		if (common.matchesCategory && !common.matchesCategory(row.category || UNCATEGORIZED)) continue
		if (memePoolIds?.has(row.id)) continue
		if (stablecoin && !row.attributes.stablecoin_only) continue
		if (halalSlugs && !(row.protocolSlug != null && halalSlugs.has(row.protocolSlug))) continue
		if (!matchesTriState(singleAssetExposure, row.attributes.single_asset_exposure)) continue
		if (noIlRisk && row.attributes.impermanent_loss_risk !== false) continue
		if (hasAudit && !row.hasAudit) continue
		if (verifiedOnly && !row.verified) continue
		if (!matchesTriState(potentialAirdrop, row.potentialAirdrop)) continue
		if (minTvl != null && !(row.tvl_usd != null && row.tvl_usd >= minTvl)) continue
		if (maxTvl != null && !(row.tvl_usd != null && row.tvl_usd <= maxTvl)) continue
		if (!matchesToken(tokenFilterInput(row))) continue

		// Folded in FIRST, so the filters, median, sort key and cell all read the same number.
		const reportedApy = resolveApy(row.apy, row.intrinsic, window, components)
		const resolvedApy = access.verifiedAccess
			? applyMeasuredIntrinsic(
					applyMeasuredBase(reportedApy, row.apy[window], row.verified, window, row.reward_tokens.length > 0, now),
					row.intrinsic ? verifiedById.get(row.intrinsic.source_pool.id) : null,
					window,
					now
				)
			: {
					...reportedApy,
					measured: null,
					reported: null,
					intrinsicMeasured: null,
					intrinsicReported: null,
					reportedTotal: reportedApy.total
				}
		// A reading too old to land in the headline still reaches the card, labelled with its age,
		// so a subscriber sees WHY the seal went quiet rather than a pool that looks unmeasured.
		const verifiedLastApy =
			access.verifiedAccess && resolvedApy.measured == null && !isVerifiedCurrent(row.verified?.apy_as_of, now)
				? resolveVerifiedApy(row.verified, window)
				: null
		// A fresh base reading can be real yet unsafe to substitute into an unsplit total that may
		// already include rewards. Keep it out of the headline/sort, but carry it explicitly to the
		// subscriber's evidence card instead of calling the window unmeasured.
		const verifiedUnsubstitutedApy =
			access.verifiedAccess && resolvedApy.measured == null && isVerifiedCurrent(row.verified?.apy_as_of, now)
				? resolveVerifiedApy(row.verified, window)
				: null
		if (minApy != null && !(resolvedApy.total != null && resolvedApy.total >= minApy)) continue
		if (maxApy != null && !(resolvedApy.total != null && resolvedApy.total <= maxApy)) continue

		const pageRow = toEarnPageRow(
			row,
			resolvedApy,
			verifiedLastApy,
			verifiedUnsubstitutedApy,
			window,
			components,
			depegByPool.get(row.id),
			raiseValuationsUsd,
			tokenDirectory
		)
		const referralUrl = row.protocolSlug ? referralUrls.get(row.protocolSlug) : undefined
		if (referralUrl) pageRow.url = withReferral(pageRow.url, referralUrl)
		if (riskCovered.has(row.id)) pageRow.hasRiskData = true
		if (exploitedPoolIds.has(row.id)) pageRow.exploited = true
		pageRows.push(pageRow)
	}

	// The client (shared pools table) emits the column id as `sortBy`, and the row
	// is shaped as `IYieldTableRow`, so sorting resolves against the alias field of
	// the same name via a `row[sortBy]` accessor (covers the optional 1d Volume / Top 10 % /
	// Avg Position columns, whose fields are stamped onto every row).
	return {
		// Redacted before memoizing, so the locked tier's cache never holds a measured figure.
		rows: sortYieldsRows<EarnPageRow, string>({
			rows: access.verifiedAccess ? pageRows : lockEarnRows(pageRows),
			query: { ...query, sortBy: legacySortBy(typeof query.sortBy === 'string' ? query.sortBy : undefined) },
			fallbackSortAccessor: (row, sortBy) => row[sortBy as keyof EarnPageRow],
			defaultSort: { sortBy: 'tvl', sortDesc: true }
		}),
		medianApy: medianApyOf(pageRows)
	}
}

// Map an enriched earn row to the shared pools-table row shape (plus reference/APY extras).
function toEarnPageRow(
	row: EnrichedEarnRow,
	resolvedApy: MeasuredApy,
	verifiedLastApy: number | null,
	verifiedUnsubstitutedApy: number | null,
	window: ReturnType<typeof parseApyWindow>,
	components: ReturnType<typeof parseApyComponents>,
	depeg: DepegRow | undefined,
	raiseValuationsUsd: Map<string, number>,
	tokenDirectory: TokenDirectory
): EarnPageRow {
	const rewardSymbols = collectRewardSymbols(row.reward_tokens)
	// Unsplit pool (trend serves `total`): stability only exists reward-inclusive,
	// so it, like the sparkline, ignores the reward toggle.
	const stabilityComponents =
		row.trend?.total && !components.includes('reward') ? [...components, 'reward' as const] : components
	const stabilityScore = resolveVariant(row.stability_30d, stabilityComponents)
	// 30d average of the scored composition — same resolver as the APY cell so the
	// stability tooltip matches the APY column.
	const stabilityAvg30d = resolveApy(row.apy, row.intrinsic, 'avg_30d', stabilityComponents).total
	// Token-less protocols get the "Potential Airdrop" marker (Fraxlend excluded at render).
	const airdrop = row.potentialAirdrop
	// Same lookup /token/[token] resolves with — untracked symbols get no link.
	const referenceTokenRecord = row.reference_asset_symbol ? tokenDirectory[slug(row.reference_asset_symbol)] : undefined
	return {
		// Aliases consumed by the shared pools-table columns / cells / CSV export.
		id: row.id,
		configID: row.id,
		pool: row.display.label ?? '',
		poolMeta: row.display.detail,
		projectslug: row.protocolSlug ?? row.protocol,
		project: row.protocol,
		airdrop,
		// Latest fundraise valuation (whole USD) — decorates the airdrop hint only, so
		// stamped solely on airdrop rows (matches main's semantics).
		raiseValuationUsd: airdrop && row.protocolSlug ? (raiseValuationsUsd.get(row.protocolSlug) ?? null) : null,
		chains: [row.chain],
		url: row.url ?? '',
		category: row.category,
		// Reference column (reference-asset symbol, e.g. "ETH").
		referenceAsset: row.reference_asset_symbol ?? null,
		referenceTokenRoute: referenceTokenRecord ? getCanonicalTokenRoute(referenceTokenRecord) : null,
		tvl: row.tvl_usd,
		apy: resolvedApy.total,
		apyBase: resolvedApy.base,
		apyReward: resolvedApy.reward,
		apyMean30d: row.apy.avg_30d.total,
		// Raw window reward for the optional APY Reward column — independent of the
		// +Reward toggle (the resolved `apyReward` above follows it, for the APY cell).
		apyRewardRaw: row.apy[window].reward,
		rewardTokens: row.reward_tokens.map(({ address, symbol }) => ({ address, symbol })),
		volumeUsd1d: row.volume_1d_usd ?? null,
		pricePerShare: row.price_per_share ?? null,
		rewardTokensSymbols: rewardSymbols,
		intrinsicSourceSymbol: row.intrinsic?.source_pool?.symbol ?? null,
		stablecoin: row.attributes.stablecoin_only,
		tokenSymbols: collectPoolTokenSymbols(row),
		singleAssetExposure: row.attributes.single_asset_exposure,
		ilRisk: row.attributes.impermanent_loss_risk,
		// Holders aliases (pools-table column accessor field names).
		holderCount: row.holders?.count ?? null,
		avgPositionUsd: row.holders?.avg_position_usd ?? null,
		top10Pct: row.holders?.top_10_share_pct ?? null,
		// 30d APY stability: numeric `stabilityScore` alias drives server sorting
		// (row[sortBy]); `stabilityRating` labels the cell.
		stabilityScore,
		stabilityRating: stabilityRatingFromScore(stabilityScore),
		stabilityAvg30d,
		// Collapsed 30d APY trend series for the inline sparkline column.
		sparkline: collapseTrend(row.trend, components),
		// Stripped to the four composition parts; the measurement rides the row fields above.
		resolvedApy: {
			base: resolvedApy.base,
			reward: resolvedApy.reward,
			intrinsic: resolvedApy.intrinsic,
			total: resolvedApy.total
		},
		availableSupplyUsd: row.available_supply_usd ?? null,
		// The measured base folded into `apy`/`apyBase` above, and the figure it replaced.
		verifiedApy: resolvedApy.measured,
		reportedApyBase: resolvedApy.reported,
		// The source pool's measured base standing as the intrinsic leg, and the figure it replaced.
		verifiedIntrinsicApy: resolvedApy.intrinsicMeasured,
		reportedIntrinsicApy: resolvedApy.intrinsicReported,
		verifiedUnsubstitutedApy,
		verifiedLastApy,
		// `?? null` is load-bearing: snapshots generated before the API served `verified` have
		// no such key, and getStaticProps cannot serialize `undefined`.
		verified: row.verified ?? null,
		exitStatus: exitSortScore(row.verified),
		// Depeg flag (sparse): drives the always-on APY warning icon and the optional Peg column.
		// Relative deviation (−0.05 = −5%); formatted only in cells.
		...(depeg ? { pegDeviation: depeg.deviation_pct, pegTokenSymbol: depeg.token_symbol } : {})
	}
}
