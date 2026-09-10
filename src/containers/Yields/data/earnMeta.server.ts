import { EARN_ATTRIBUTE_IDS, type AttributeId } from '../Filters/attributeOptions'
import { getEarnWithTokenKeys } from './enrich.server'
import { readYieldsMeta, type YieldsSnapshot } from './snapshot'
import type { TokenOption } from './types'

export interface EarnPageMeta {
	chainList: Array<string>
	projectList: Array<string>
	categoryList: Array<string>
	evmChains: Array<string>
	tokens: Array<TokenOption>
	// Canonical attribute option order used by the Earn filters.
	attributeIds: Array<AttributeId>
}

const byCountDesc = (counts: Map<string, number>) =>
	[...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b))

// Filter vocabulary for the /yields page, derived entirely from the earn dataset +
// meta. Chains/projects/categories are ordered by pool count (most rows behind the
// option first — counts are not shipped); `tokens` are the family/asset option keys
// that actually appear in the earn rows' reference assets.
export async function getEarnPageMeta(snapshot: YieldsSnapshot): Promise<EarnPageMeta> {
	const [rows, meta] = await Promise.all([getEarnWithTokenKeys(snapshot), readYieldsMeta(snapshot)])
	const memePoolIds = new Set(meta.meme_pool_ids)
	const chainIsEvm = new Map<string, boolean>()
	for (const chain of meta.chains) chainIsEvm.set(chain.name, chain.is_evm)

	const chainCounts = new Map<string, number>()
	const projectCounts = new Map<string, number>()
	const categoryCounts = new Map<string, number>()
	const tokenCounts = new Map<string, number>()

	for (const row of rows) {
		// Option ordering reflects the DEFAULT view (meme pools excluded); meme rows only
		// feed the include_meme_tokens attribute count below.
		if (!memePoolIds.has(row.id)) {
			if (row.chain) chainCounts.set(row.chain, (chainCounts.get(row.chain) ?? 0) + 1)
			if (row.protocol) projectCounts.set(row.protocol, (projectCounts.get(row.protocol) ?? 0) + 1)
			if (row.category) categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1)
			for (const key of row.tokenKeys?.reference_asset ?? []) tokenCounts.set(key, (tokenCounts.get(key) ?? 0) + 1)
		}
	}

	// Families before assets; within each group, occurrence-desc (rows matched), name tiebreak.
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

	const attributeIds = [...EARN_ATTRIBUTE_IDS]

	const chainList = byCountDesc(chainCounts)

	return {
		chainList,
		projectList: byCountDesc(projectCounts),
		categoryList: byCountDesc(categoryCounts),
		evmChains: chainList.filter((chain) => chainIsEvm.get(chain)),
		tokens,
		attributeIds
	}
}
