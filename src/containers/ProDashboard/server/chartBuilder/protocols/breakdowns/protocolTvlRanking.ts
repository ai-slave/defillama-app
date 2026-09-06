import { llamaDb } from '~/server/db/llama'
import { toInternalSlug } from '~/utils/chainNormalizer'

export type ProtocolTvlRankingRow = {
	protocolSlug: string
	parentProtocolSlug: string | null
	category: string | null
	tvl: number | null
	excludeTvlFromParent: boolean
}

export type ProtocolTvlRankingItem = {
	protocolSlug: string
	parentProtocolSlug: string | null
	value: number
	isParent: boolean
}

type ProtocolTvlRankingSourceRow = {
	protocol_slug: string
	parent_protocol_slug: string | null
	category: string | null
	tvl: number | null
	exclude_tvl_from_parent: boolean
}

type RankingScope = 'global' | 'include' | 'exclude'

function resolveRankingScope(chains: Array<string>, chainFilterMode: 'include' | 'exclude'): RankingScope {
	const hasAll = chains.length === 0 || chains.some((chain) => chain.toLowerCase() === 'all')
	const hasSelectedChains = chains.some((chain) => chain.toLowerCase() !== 'all')
	if (chainFilterMode === 'exclude' && hasSelectedChains) return 'exclude'
	return hasAll ? 'global' : 'include'
}

function globalRankingQuery() {
	return `
		WITH child_relations AS (
			SELECT
				msp.sub_protocol AS protocol_slug,
				metadata.protocol AS parent_protocol_slug,
				metadata.category,
				msp.tvl_base::double precision AS tvl,
				metadata.exclude_tvl_from_parent
			FROM lens.metrics_sub_protocol_current msp
			JOIN dim.protocol metadata ON metadata.slug = msp.sub_protocol
			WHERE msp.sub_protocol IS NOT NULL AND metadata.slug != metadata.protocol
		),
		standalone_protocols AS (
			SELECT
				mp.protocol AS protocol_slug,
				NULL::text AS parent_protocol_slug,
				metadata.category,
				mp.tvl_base::double precision AS tvl,
				FALSE AS exclude_tvl_from_parent
			FROM lens.metrics_protocol_current mp
			JOIN dim.protocol metadata ON metadata.slug = mp.protocol
			WHERE NOT EXISTS (
				SELECT 1
				FROM child_relations child
				WHERE child.parent_protocol_slug = mp.protocol OR child.protocol_slug = mp.protocol
			)
		)
		SELECT * FROM child_relations
		UNION ALL
		SELECT * FROM standalone_protocols
	`
}

function filteredRankingQuery(scope: 'include' | 'exclude') {
	const chainPredicate = scope === 'include' ? 'lower(metrics.chain) = ANY($1)' : 'lower(metrics.chain) <> ALL($1)'
	return `
		WITH child_relations AS (
			SELECT
				msp.sub_protocol AS protocol_slug,
				metadata.protocol AS parent_protocol_slug,
				metadata.category,
				metadata.exclude_tvl_from_parent
			FROM lens.metrics_sub_protocol_current msp
			JOIN dim.protocol metadata ON metadata.slug = msp.sub_protocol
			WHERE msp.sub_protocol IS NOT NULL AND metadata.slug != metadata.protocol
		),
		child_scores AS (
			SELECT
				relation.protocol_slug,
				relation.parent_protocol_slug,
				relation.category,
				SUM(metrics.tvl_base)::double precision AS tvl,
				relation.exclude_tvl_from_parent
			FROM child_relations relation
			JOIN lens.metrics_sub_protocol_by_chain_current metrics
				ON metrics.sub_protocol = relation.protocol_slug
			WHERE ${chainPredicate}
			GROUP BY
				relation.protocol_slug,
				relation.parent_protocol_slug,
				relation.category,
				relation.exclude_tvl_from_parent
		),
		standalone_relations AS (
			SELECT
				mp.protocol AS protocol_slug,
				NULL::text AS parent_protocol_slug,
				metadata.category,
				FALSE AS exclude_tvl_from_parent
			FROM lens.metrics_protocol_current mp
			JOIN dim.protocol metadata ON metadata.slug = mp.protocol
			WHERE NOT EXISTS (
				SELECT 1
				FROM child_relations child
				WHERE child.parent_protocol_slug = mp.protocol OR child.protocol_slug = mp.protocol
			)
		),
		standalone_scores AS (
			SELECT
				relation.protocol_slug,
				relation.parent_protocol_slug,
				relation.category,
				SUM(metrics.tvl_base)::double precision AS tvl,
				relation.exclude_tvl_from_parent
			FROM standalone_relations relation
			JOIN lens.metrics_protocol_by_chain_current metrics ON metrics.protocol = relation.protocol_slug
			WHERE ${chainPredicate}
			GROUP BY
				relation.protocol_slug,
				relation.parent_protocol_slug,
				relation.category,
				relation.exclude_tvl_from_parent
		)
		SELECT * FROM child_scores
		UNION ALL
		SELECT * FROM standalone_scores
	`
}

export async function fetchProtocolTvlRankingRows({
	chains,
	chainFilterMode
}: {
	chains: Array<string>
	chainFilterMode: 'include' | 'exclude'
}): Promise<Array<ProtocolTvlRankingRow>> {
	const scope = resolveRankingScope(chains, chainFilterMode)
	const selectedChains: Array<string> = []
	for (const chain of chains) {
		if (chain.toLowerCase() !== 'all') selectedChains.push(toInternalSlug(chain))
	}
	const rows = await llamaDb.any<ProtocolTvlRankingSourceRow>(
		scope === 'global' ? globalRankingQuery() : filteredRankingQuery(scope),
		scope === 'global' ? [] : [selectedChains]
	)
	return rows.map((row) => ({
		protocolSlug: row.protocol_slug,
		parentProtocolSlug: row.parent_protocol_slug,
		category: row.category,
		tvl: row.tvl,
		excludeTvlFromParent: row.exclude_tvl_from_parent
	}))
}

export function buildProtocolTvlRanking({
	rows,
	topN,
	groupByParent,
	categories,
	categoryFilterMode
}: {
	rows: Array<ProtocolTvlRankingRow>
	topN: number
	groupByParent: boolean
	categories: Array<string>
	categoryFilterMode: 'include' | 'exclude'
}): { items: Array<ProtocolTvlRankingItem>; totalEntities: number; eligibleRows: Array<ProtocolTvlRankingRow> } {
	const categorySet = new Set(categories.map((category) => category.toLowerCase()))
	const eligibleRows = rows.filter((row) => {
		const category = row.category?.toLowerCase() ?? ''
		if (categorySet.size > 0) {
			if (categoryFilterMode === 'include' && !categorySet.has(category)) return false
			if (categoryFilterMode === 'exclude' && categorySet.has(category)) return false
		}
		return row.tvl != null && row.tvl > 0
	})

	if (!groupByParent) {
		const ranked = eligibleRows.toSorted((left, right) => (right.tvl ?? 0) - (left.tvl ?? 0))
		return {
			items: ranked.slice(0, topN).map((row) => ({
				protocolSlug: row.protocolSlug,
				parentProtocolSlug: null,
				value: row.tvl ?? 0,
				isParent: false
			})),
			totalEntities: ranked.length,
			eligibleRows
		}
	}

	const grouped = new Map<string, ProtocolTvlRankingItem>()
	for (const row of eligibleRows) {
		const belongsToParent = row.parentProtocolSlug !== null && !row.excludeTvlFromParent
		const key = belongsToParent ? row.parentProtocolSlug : `protocol:${row.protocolSlug}`
		const current = grouped.get(key)
		const value = row.tvl ?? 0
		if (current) current.value += value
		else {
			grouped.set(key, {
				protocolSlug: belongsToParent ? row.parentProtocolSlug : row.protocolSlug,
				parentProtocolSlug: belongsToParent ? row.parentProtocolSlug : null,
				value,
				isParent: belongsToParent
			})
		}
	}
	const ranked = Array.from(grouped.values())
		.filter((item) => item.value > 0)
		.sort((left, right) => right.value - left.value)
	return { items: ranked.slice(0, topN), totalEntities: ranked.length, eligibleRows }
}
