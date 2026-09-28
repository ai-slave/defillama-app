import { TOKEN_RIGHTS_SECTION_ID } from '~/containers/Token/types'
import { parseUtrGrade, type UtrGradeLabel } from '~/containers/UniversalTokenRating/gradeBands'
import { slug } from '~/utils'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import { getCanonicalTokenRoute, type TokenDirectory } from '~/utils/tokenDirectory'
import type { IRawTokenRightsEntry } from './api.types'
import type { TokenRightsPreview } from './types'
import { getTokenRightsPreview, parseTokenRightsEntry } from './utils'

/** Overall score is out of 100, axis scores out of 10; null when not graded. */
export type TokenRightsUtrSummary = {
	grade: UtrGradeLabel
	disclosureGrade: UtrGradeLabel | null
	performanceGrade: UtrGradeLabel | null
	href: string
	projectName: string | null
	symbol: string | null
	score: number | null
	disclosureScore: number | null
	performanceScore: number | null
	/** Month-over-month change in the overall score, in percent. */
	momChangePct: number | null
	/** Rank within its list (listed or pre-TGE tokens). */
	rank: number | null
	preTge: boolean
	gradedCount: number | null
	criteriaCount: number | null
	asOf: string | null
}

/** `href` is the entity's token page section, null when it has no token page. */
export type TokenRightsLink = { preview: TokenRightsPreview; href: string | null }

/**
 * What a ranking row shows about its entity's token: only what the data has, never a guess about
 * whether a token exists. Rights and UTR load and fail independently; a failed source reads as absent.
 */
export type EntityToken = {
	rights: TokenRightsLink | null
	utr: TokenRightsUtrSummary | null
}

export type TokenRightsBadgeSources = {
	/** Token-rights previews keyed by normalizeTokenRightsId(DefiLlama ID); empty when token rights failed to load. */
	rightsById: ReadonlyMap<string, TokenRightsPreview>
	/** Token pages keyed like rightsById, holding only pages whose token rights section shows that entry. */
	rightsRouteById: ReadonlyMap<string, string>
	/** Universal Token Rating grades keyed by lowercase CoinGecko id; empty when UTR is unavailable. */
	utrByGeckoId: ReadonlyMap<string, TokenRightsUtrSummary>
	protocolMetadata: Record<string, IProtocolMetadata>
	chainMetadata: Record<string, IChainMetadata>
}

const CHAIN_ID_PREFIX = 'chain#'

/** Token-rights ids mix `plume_mainnet` and `plume-mainnet` spellings, and adapters prefix chains. */
export function normalizeTokenRightsId(id: string): string {
	const trimmed = id.trim().toLowerCase()
	return (trimmed.startsWith(CHAIN_ID_PREFIX) ? trimmed.slice(CHAIN_ID_PREFIX.length) : trimmed).replace(/_/g, '-')
}

function findGeckoId(sources: TokenRightsBadgeSources, id: string, name: string): string | null {
	if (id.startsWith(CHAIN_ID_PREFIX)) {
		// Adapter chain ids drift from metadata keys (chain#bitcoin-cash vs bitcoincash), so fall back to the name.
		// Some metadata keys keep underscores (boba_avax), so try the raw key before the normalized one.
		const rawKey = id.slice(CHAIN_ID_PREFIX.length).trim().toLowerCase()
		const chain =
			sources.chainMetadata[rawKey] ??
			sources.chainMetadata[normalizeTokenRightsId(id)] ??
			sources.chainMetadata[slug(name)]
		return chain?.gecko_id?.toLowerCase() || null
	}
	return sources.protocolMetadata[id]?.gecko_id?.toLowerCase() || null
}

/** Resolves a row's token data from its ids, most specific first; null when there are neither rights nor a grade. */
export function resolveEntityToken(
	sources: TokenRightsBadgeSources,
	ids: ReadonlyArray<string>,
	name: string
): EntityToken | null {
	let geckoId: string | null = null
	let rightsId: string | null = null

	for (const id of ids) {
		geckoId ??= findGeckoId(sources, id, name)
		const key = normalizeTokenRightsId(id)
		if (!rightsId && sources.rightsById.has(key)) rightsId = key
	}

	const utr = (geckoId && sources.utrByGeckoId.get(geckoId)) || null
	if (!rightsId) return utr ? { rights: null, utr } : null

	// The link comes from the same id as the rights, so it never opens a page that shows other rights or none.
	const tokenRoute = sources.rightsRouteById.get(rightsId)
	return {
		rights: {
			preview: sources.rightsById.get(rightsId)!,
			href: tokenRoute ? `${tokenRoute}#${TOKEN_RIGHTS_SECTION_ID}` : null
		},
		utr
	}
}

/** The UTR card's standing line: rank and grading coverage, each only when known. */
export function getUtrFacts(utr: TokenRightsUtrSummary): Array<string> {
	const facts: Array<string> = []
	if (utr.rank != null) facts.push(`#${utr.rank} among ${utr.preTge ? 'pre-TGE' : 'listed'} tokens`)
	if (utr.gradedCount != null && utr.criteriaCount) {
		facts.push(`${utr.gradedCount} of ${utr.criteriaCount} criteria graded`)
	}
	return facts
}

/** Graded UTR rows keyed by lowercase CoinGecko id; unrated and ungraded rows are dropped. */
export function buildUtrSummaryIndex(
	rows: ReadonlyArray<{
		coingeckoId: string | null
		notRated: boolean
		grade: string | null
		disclosureGrade?: string | null
		performanceGrade?: string | null
		projectName?: string
		symbol?: string
		overallScore?: number | null
		disclosureScore?: number | null
		performanceScore?: number | null
		momChangePct?: number | null
		rank?: number | null
		tgeStatus?: string
		gradedCount?: number
		criteriaCount?: number
		asOf?: string | null
	}>
): Map<string, TokenRightsUtrSummary> {
	const index = new Map<string, TokenRightsUtrSummary>()
	for (const row of rows) {
		const grade = parseUtrGrade(row.grade)
		if (!row.coingeckoId || row.notRated || !grade) continue
		const geckoId = row.coingeckoId.toLowerCase()
		if (!index.has(geckoId)) {
			index.set(geckoId, {
				grade,
				disclosureGrade: parseUtrGrade(row.disclosureGrade),
				performanceGrade: parseUtrGrade(row.performanceGrade),
				href: `/universal-token-rating/token/${encodeURIComponent(row.coingeckoId)}`,
				projectName: row.projectName || null,
				symbol: row.symbol ? row.symbol.toUpperCase() : null,
				score: row.overallScore ?? null,
				disclosureScore: row.disclosureScore ?? null,
				performanceScore: row.performanceScore ?? null,
				momChangePct: row.momChangePct ?? null,
				rank: row.rank ?? null,
				preTge: row.tgeStatus !== undefined && row.tgeStatus !== 'post',
				gradedCount: row.gradedCount ?? null,
				criteriaCount: row.criteriaCount ?? null,
				asOf: row.asOf ?? null
			})
		}
	}
	return index
}

/** Ids that normalize alike keep the most recently updated entry. */
export function buildRightsById(entries: Array<IRawTokenRightsEntry>): Map<string, TokenRightsPreview> {
	const newest = new Map<string, { updatedAt: number; entry: IRawTokenRightsEntry }>()
	for (const entry of entries) {
		const id = entry['DefiLlama ID']
		if (!id) continue
		const key = normalizeTokenRightsId(id)
		const updatedAt = Date.parse(entry['Last Updated'] ?? '') || 0
		const current = newest.get(key)
		if (!current || updatedAt > current.updatedAt) newest.set(key, { updatedAt, entry })
	}
	const rightsById = new Map<string, TokenRightsPreview>()
	for (const [key, { entry }] of newest) {
		rightsById.set(key, getTokenRightsPreview(parseTokenRightsEntry(entry)))
	}
	return rightsById
}

/**
 * Token pages keyed like buildRightsById, found the way /token/[token] loads its rights: a flagged page reads the
 * entry filed under its chain id, else its protocol id. A parent/child link alone does not share rights between pages.
 */
export function buildRightsRouteById(
	entries: Array<IRawTokenRightsEntry>,
	tokenDirectory: TokenDirectory
): Map<string, string> {
	const rightsIds = new Set<string>()
	for (const entry of entries) {
		const id = entry['DefiLlama ID']
		if (id) rightsIds.add(id)
	}
	const routes = new Map<string, string>()
	for (const key in tokenDirectory) {
		const record = tokenDirectory[key]
		if (!record?.tokenRights) continue
		const rightsId = [record.chainId, record.protocolId].find((id) => id && rightsIds.has(id))
		if (!rightsId) continue
		const rightsKey = normalizeTokenRightsId(rightsId)
		if (!routes.has(rightsKey)) routes.set(rightsKey, getCanonicalTokenRoute(record))
	}
	return routes
}
