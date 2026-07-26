import { paginateAndSortRows } from '~/containers/Yields/yieldsTablePagination.server'
import type { YieldsPaginatedTableResponse } from '~/containers/Yields/yieldsTableQuery'
import { queryBoolean } from '~/server/api/params'
import type { ApiQuery } from '~/server/api/types'
import { slug } from '~/utils'
import { getCanonicalTokenRoute, type TokenDirectory } from '~/utils/tokenDirectory'
import { getRiskCoveredPoolIds } from '../VaultRisk/coveredPools'
import { collapseTrend, resolveApy, resolveVariant, stabilityRatingFromScore } from './apy'
import { getEnrichedEarn } from './enrich.server'
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
	type TokenFilterInput
} from './query'
import { getRaiseValuationsUsd, getReferralUrls } from './server/raiseValuations'
import { readYieldsDepegs, readYieldsExploits, readYieldsMeta, type YieldsSnapshot } from './snapshot'
import type { DepegRow, EarnPageRow, EnrichedEarnRow, Token } from './types'

function collectRewardSymbols(tokens: Token[]): string[] {
	const symbols: string[] = []
	for (const token of tokens) {
		if (token.symbol) symbols.push(token.symbol)
	}
	return symbols
}

function collectPoolTokenSymbols(row: EnrichedEarnRow): string[] {
	const symbols = new Set<string>()
	for (const token of row.underlying_tokens) if (token.symbol) symbols.add(token.symbol)
	if (row.pool_token?.symbol) symbols.add(row.pool_token.symbol)
	if (row.reference_asset_symbol) symbols.add(row.reference_asset_symbol)
	return [...symbols]
}

const NO_KEYS: string[] = []

function medianApyOf(rows: EarnPageRow[]): number | null {
	const values: number[] = []
	for (const row of rows) if (row.apy != null) values.push(row.apy)
	if (values.length === 0) return null
	values.sort((a, b) => a - b)
	const mid = Math.floor(values.length / 2)
	return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]
}

// Build the per-row option-key sets for the token filter.
function tokenFilterInput(row: EnrichedEarnRow): TokenFilterInput {
	return {
		referenceKeys: row.tokenKeys?.reference_asset ?? NO_KEYS,
		poolKeys: row.tokenKeys?.pool_token ?? NO_KEYS,
		referenceExactKeys: row.tokenKeys?.reference_asset_exact ?? NO_KEYS
	}
}

export async function getEarnPage(
	snapshot: YieldsSnapshot,
	query: ApiQuery
): Promise<YieldsPaginatedTableResponse<EarnPageRow>> {
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
	const protocolHasToken = parseTriState(query, 'protocolHasToken')

	const minTvl = legacyMinTvl(query, parseNumber(query, 'minTvl'))
	const maxTvl = parseNumber(query, 'maxTvl')
	const minApy = parseNumber(query, 'minApy')
	const maxApy = parseNumber(query, 'maxApy')

	const pageRows: EarnPageRow[] = []
	for (const row of rows) {
		if (common.ids && !common.ids.has(row.id)) continue
		if (common.chains && !common.chains.has(row.chain)) continue
		if (common.projects && !common.projects.has(row.protocol)) continue
		if (common.categories && !(row.category != null && common.categories.has(row.category))) continue
		if (memePoolIds?.has(row.id)) continue
		if (stablecoin && !row.attributes.stablecoin_only) continue
		if (halalSlugs && !(row.protocolSlug != null && halalSlugs.has(row.protocolSlug))) continue
		if (!matchesTriState(singleAssetExposure, row.attributes.single_asset_exposure)) continue
		if (noIlRisk && row.attributes.impermanent_loss_risk) continue
		if (hasAudit && !row.hasAudit) continue
		if (!matchesTriState(protocolHasToken, row.protocolHasToken)) continue
		if (minTvl != null && !(row.tvl_usd != null && row.tvl_usd >= minTvl)) continue
		if (maxTvl != null && !(row.tvl_usd != null && row.tvl_usd <= maxTvl)) continue
		if (!matchesToken(tokenFilterInput(row))) continue

		const resolvedApy = resolveApy(row.apy, row.intrinsic, window, components)
		if (minApy != null && !(resolvedApy.total != null && resolvedApy.total >= minApy)) continue
		if (maxApy != null && !(resolvedApy.total != null && resolvedApy.total <= maxApy)) continue

		const pageRow = toEarnPageRow(
			row,
			resolvedApy,
			window,
			components,
			depegByPool.get(row.id),
			raiseValuationsUsd,
			tokenDirectory
		)
		const referralUrl = row.protocolSlug ? referralUrls.get(row.protocolSlug) : undefined
		if (referralUrl) pageRow.url = referralUrl
		if (riskCovered.has(row.id)) pageRow.hasRiskData = true
		if (exploitedPoolIds.has(row.id)) pageRow.exploited = true
		pageRows.push(pageRow)
	}

	const medianApy = medianApyOf(pageRows)

	// The client (shared pools table) emits the column id as `sortBy`, and the row
	// is shaped as `IYieldTableRow`, so sorting resolves against the alias field of
	// the same name via a `row[sortBy]` accessor (covers the optional 1d Volume / Top 10 % /
	// Avg Position columns, whose fields are stamped onto every row).
	return {
		...paginateAndSortRows<EarnPageRow, string>({
			rows: pageRows,
			query: { ...query, sortBy: legacySortBy(typeof query.sortBy === 'string' ? query.sortBy : undefined) },
			fallbackSortAccessor: (row, sortBy) => row[sortBy as keyof EarnPageRow],
			defaultSort: { sortBy: 'tvl', sortDesc: true }
		}),
		medianApy
	}
}

// Map an enriched earn row to the shared pools-table row shape (plus reference/APY extras).
function toEarnPageRow(
	row: EnrichedEarnRow,
	resolvedApy: EarnPageRow['resolvedApy'],
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
	const stabilityScore = resolveVariant<number>(row.stability_30d, stabilityComponents)
	// 30d average of the scored composition — same resolver as the APY cell so the
	// stability tooltip matches the APY column.
	const stabilityAvg30d = resolveApy(row.apy, row.intrinsic, 'avg_30d', stabilityComponents).total
	// Token-less protocols get the "Potential Airdrop" marker (Fraxlend excluded at render).
	const airdrop = !row.protocolHasToken
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
		// Extra consumed by the APY toggle and the pool page.
		resolvedApy,
		// Depeg flag (sparse): drives the always-on APY warning icon and the optional Peg column.
		// Relative deviation (−0.05 = −5%); formatted only in cells.
		...(depeg ? { pegDeviation: depeg.deviation_pct, pegTokenSymbol: depeg.token_symbol } : {})
	}
}
