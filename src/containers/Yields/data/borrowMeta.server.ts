import { BORROW_ATTRIBUTE_IDS, type AttributeId } from '../Filters/attributeOptions'
import { getEnrichedMarkets } from './enrich.server'
import { readYieldsMeta, type YieldsSnapshot } from './snapshot'
import type { MetaTokenOption, YieldsMeta, TokenOption } from './types'

export interface BorrowPageMeta {
	chainList: Array<string>
	projectList: Array<string>
	categoryList: Array<string>
	evmChains: Array<string>
	collateralTokens: Array<TokenOption>
	borrowTokens: Array<TokenOption>
	// Attribute option ids ordered by occurrence (count-DESC) over the enriched markets.
	attributeIds: Array<AttributeId>
	// Protocol NAMES for the 'Majors' curated view (present in the borrow markets),
	// resolved from the preset's protocol slugs via /v2/meta.
}

// Families before assets; within each group, occurrence-desc (markets matched), name tiebreak.
function buildTokenOptions(meta: YieldsMeta, counts: Map<string, number>): Array<TokenOption> {
	const options: Array<TokenOption> = []
	const seen = new Set<string>()
	for (const group of [meta.tokens.families, meta.tokens.assets] as Array<Array<MetaTokenOption>>) {
		const present = group.filter((option) => counts.has(option.value) && !seen.has(option.value))
		present.sort((a, b) => (counts.get(b.value) ?? 0) - (counts.get(a.value) ?? 0) || a.symbol.localeCompare(b.symbol))
		for (const option of present) {
			seen.add(option.value)
			options.push([option.symbol, option.value])
		}
	}
	return options
}

const byCountDesc = (counts: Map<string, number>) =>
	[...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b))

// Filter vocabulary for the /yields/borrow page, derived entirely from the enriched
// borrow markets + /v2/meta. `chainList` / `projectList` / `categoryList` are ordered by
// occurrence count (most common first, name-tiebroken); `collateralTokens` /
// `borrowTokens` are the option keys present in the markets' reference-asset /
// borrow-token keys (families before assets); `attributeIds` is the attribute option
// order (most common first).
export async function getBorrowPageMeta(snapshot: YieldsSnapshot): Promise<BorrowPageMeta> {
	const [rows, meta] = await Promise.all([getEnrichedMarkets(snapshot), readYieldsMeta(snapshot)])
	const memePoolIds = new Set(meta.meme_pool_ids)

	const chainIsEvm = new Map<string, boolean>()
	for (const chain of meta.chains) chainIsEvm.set(chain.name, chain.is_evm)

	const chainCounts = new Map<string, number>()
	const projectCounts = new Map<string, number>()
	const categoryCounts = new Map<string, number>()
	const collateralCounts = new Map<string, number>()
	const borrowCounts = new Map<string, number>()

	// Per-attribute occurrence counts (borrow surfaces the 3-option subset; `halal` is
	// earn-only, kept here only to satisfy the shared AttributeId record type).
	const attributeCounts: Record<AttributeId, number> = {
		stablecoins: 0,
		single_exposure: 0,
		multi_exposure: 0,
		no_il: 0,
		no_protocol_token: 0,
		audited: 0,
		include_meme_tokens: 0,
		halal: 0
	}

	for (const row of rows) {
		// Option ordering reflects the DEFAULT view (meme markets excluded); meme rows only
		// feed the include_meme_tokens attribute count below.
		if (!memePoolIds.has(row.id)) {
			if (row.chain) chainCounts.set(row.chain, (chainCounts.get(row.chain) ?? 0) + 1)
			if (row.protocol) projectCounts.set(row.protocol, (projectCounts.get(row.protocol) ?? 0) + 1)
			if (row.category) categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1)
			for (const key of row.tokenKeys?.reference_asset ?? [])
				collateralCounts.set(key, (collateralCounts.get(key) ?? 0) + 1)
			for (const key of row.tokenKeys?.borrow_token ?? []) borrowCounts.set(key, (borrowCounts.get(key) ?? 0) + 1)
		}

		if (!row.protocolHasToken) attributeCounts.no_protocol_token += 1
		if (row.hasAudit) attributeCounts.audited += 1
		if (memePoolIds.has(row.id)) attributeCounts.include_meme_tokens += 1
	}

	// Stable sort keeps the base BORROW_ATTRIBUTE_IDS order for equal counts.
	const attributeIds = [...BORROW_ATTRIBUTE_IDS].sort((a, b) => attributeCounts[b] - attributeCounts[a])

	const chainList = byCountDesc(chainCounts)

	return {
		chainList,
		projectList: byCountDesc(projectCounts),
		categoryList: byCountDesc(categoryCounts),
		evmChains: chainList.filter((chain) => chainIsEvm.get(chain)),
		collateralTokens: buildTokenOptions(meta, collateralCounts),
		borrowTokens: buildTokenOptions(meta, borrowCounts),
		attributeIds
	}
}
