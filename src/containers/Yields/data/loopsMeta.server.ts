import { BORROW_ATTRIBUTE_IDS, type AttributeId } from '../Filters/attributeOptions'
import { getEnrichedLoops } from './enrich.server'
import { readYieldsMeta, type YieldsSnapshot } from './snapshot'
import type { TokenOption } from './types'

export interface LoopsPageMeta {
	chainList: Array<string>
	projectList: Array<string>
	evmChains: Array<string>
	tokens: Array<TokenOption>
	// Attribute option ids ordered by occurrence (count-DESC) over the enriched loops.
	attributeIds: Array<AttributeId>
}

// Filter vocabulary for the /yields/loop page, derived entirely from the enriched
// loops dataset + /v2/meta. `chainList` / `projectList` are ordered by occurrence count
// (most common first, name-tiebroken); `tokens` are the family/asset option keys
// that appear in the loops' reference-asset keys (families before assets); `attributeIds`
// is the attribute option order (most common first).
export async function getLoopsPageMeta(snapshot: YieldsSnapshot): Promise<LoopsPageMeta> {
	const [rows, meta] = await Promise.all([getEnrichedLoops(snapshot), readYieldsMeta(snapshot)])
	const memePoolIds = new Set(meta.meme_pool_ids)

	const chainIsEvm = new Map<string, boolean>()
	for (const chain of meta.chains) chainIsEvm.set(chain.name, chain.is_evm)

	const chainCounts = new Map<string, number>()
	const projectCounts = new Map<string, number>()
	const tokenCounts = new Map<string, number>()

	// Per-attribute occurrence counts (loops surface the 3-option subset; `halal` is
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
		// Option ordering reflects the DEFAULT view (meme loops excluded); meme rows only
		// feed the include_meme_tokens attribute count below.
		if (!memePoolIds.has(row.id)) {
			if (row.chain) chainCounts.set(row.chain, (chainCounts.get(row.chain) ?? 0) + 1)
			if (row.protocol) projectCounts.set(row.protocol, (projectCounts.get(row.protocol) ?? 0) + 1)
			for (const key of row.tokenKeys?.reference_asset ?? []) tokenCounts.set(key, (tokenCounts.get(key) ?? 0) + 1)
		}

		if (!row.protocolHasToken) attributeCounts.no_protocol_token += 1
		if (row.hasAudit) attributeCounts.audited += 1
		if (memePoolIds.has(row.id)) attributeCounts.include_meme_tokens += 1
	}

	// Families before assets; within each group, occurrence-desc (loops matched), name tiebreak.
	const tokens: Array<TokenOption> = []
	const seenTokenValues = new Set<string>()
	for (const group of [meta.tokens.families, meta.tokens.assets]) {
		const present = group.filter((option) => tokenCounts.has(option.value) && !seenTokenValues.has(option.value))
		present.sort(
			(a, b) => (tokenCounts.get(b.value) ?? 0) - (tokenCounts.get(a.value) ?? 0) || a.symbol.localeCompare(b.symbol)
		)
		for (const option of present) {
			seenTokenValues.add(option.value)
			tokens.push([option.symbol, option.value])
		}
	}

	// Stable sort keeps the base BORROW_ATTRIBUTE_IDS order for equal counts.
	const attributeIds = [...BORROW_ATTRIBUTE_IDS].sort((a, b) => attributeCounts[b] - attributeCounts[a])

	const byCountDesc = (counts: Map<string, number>) =>
		[...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b))
	const chainList = byCountDesc(chainCounts)

	return {
		chainList,
		projectList: byCountDesc(projectCounts),
		evmChains: chainList.filter((chain) => chainIsEvm.get(chain)),
		tokens,
		attributeIds
	}
}
