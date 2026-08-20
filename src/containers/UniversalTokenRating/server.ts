import { fetchJson } from '~/utils/async'
import { geckoTokenIconUrl } from '~/utils/icons'
import type {
	UtrAssetResponse,
	UtrBatchResponse,
	UtrCategoryBreakdown,
	UtrLeaderboardApiRow,
	UtrLeaderboardResponse,
	UtrLeaderboardRow,
	UtrMomResponse,
	UtrProject,
	UtrScoringDocs,
	UtrUniverse,
	UtrExchangesResponse,
	UtrDisclosureScoreSummary
} from './types'

const FORGD_HOST = process.env.FORGD_API_URL ?? 'https://dev.quant.api.forgd.com'

function forgdUtrHeaders(): Record<string, string> | undefined {
	const key = process.env.API_KEY_FORGD?.trim()
	return key ? { Authorization: `Bearer ${key}` } : undefined
}

export async function fetchUtrProjects(): Promise<UtrProject[]> {
	try {
		return await fetchJson<UtrProject[]>(`${FORGD_HOST}/api/utr/projects`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
	} catch {
		return []
	}
}

export async function fetchUtrDisclosureScoreSummaries(): Promise<UtrDisclosureScoreSummary[]> {
	try {
		return await fetchJson<UtrDisclosureScoreSummary[]>(`${FORGD_HOST}/api/utr/projects/disclosure-scores`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
	} catch {
		return []
	}
}

export async function fetchUtrExchangeOptions(): Promise<string[]> {
	try {
		const response = await fetchJson<{
			exchanges: {
				tier1: { displayName: string }[]
				tier2: { displayName: string }[]
			}
		}>(`${FORGD_HOST}/api/utr/scoring-config`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
		return [...response.exchanges.tier1, ...response.exchanges.tier2].map((exchange) => exchange.displayName)
	} catch {
		return []
	}
}

export async function fetchUtrBatchMetrics(assets: string[]): Promise<UtrBatchResponse | null> {
	if (!assets.length) return null
	try {
		return await fetchJson<UtrBatchResponse>(
			`${FORGD_HOST}/api/utr?assets=${encodeURIComponent(assets.slice(0, 100).join(','))}`,
			{ timeout: 30_000, headers: forgdUtrHeaders() }
		)
	} catch {
		return null
	}
}

export async function fetchUtrAssetResponse(asset: string): Promise<UtrAssetResponse | null> {
	try {
		return await fetchJson<UtrAssetResponse>(`${FORGD_HOST}/api/utr/asset/${encodeURIComponent(asset)}`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
	} catch (error) {
		if (error instanceof Error && error.message.includes('[404]')) return null
		throw error
	}
}

export async function fetchUtrAssetExchanges(asset: string): Promise<UtrExchangesResponse | null> {
	try {
		return await fetchJson<UtrExchangesResponse>(`${FORGD_HOST}/api/utr/asset/${encodeURIComponent(asset)}/exchanges`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
	} catch {
		return null
	}
}

export async function fetchUtrScoringDocs(): Promise<UtrScoringDocs | null> {
	try {
		const response = await fetchJson<{
			config: {
				disclosure: { categories: UtrScoringDocs['disclosure'] }
				performance: { categories: UtrScoringDocs['performance'] }
			}
		}>(`${FORGD_HOST}/api/utr/scoring-config`, { timeout: 30_000, headers: forgdUtrHeaders() })
		const pick = (categories: UtrScoringDocs['disclosure']) =>
			categories.map((category) => ({
				key: category.key,
				label: category.label,
				criteria: category.criteria.map((criterion) => ({
					key: criterion.key,
					label: criterion.label,
					definition: criterion.definition ?? null,
					rubric: criterion.rubric ?? []
				}))
			}))
		return {
			disclosure: pick(response.config.disclosure.categories),
			performance: pick(response.config.performance.categories)
		}
	} catch {
		return null
	}
}

export async function fetchUtrLeaderboardMom(): Promise<UtrMomResponse | null> {
	try {
		return await fetchJson<UtrMomResponse>(`${FORGD_HOST}/api/utr/leaderboard/mom`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
	} catch {
		return null
	}
}

export async function fetchUtrLeaderboard(): Promise<UtrLeaderboardResponse | null> {
	try {
		return await fetchJson<UtrLeaderboardResponse>(`${FORGD_HOST}/api/utr/leaderboard`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
	} catch {
		return null
	}
}

function withEmptyCriteria(categories: UtrCategoryBreakdown[]): UtrCategoryBreakdown[] {
	return categories.map((category) => ({ ...category, criteria: category.criteria ?? [] }))
}

export function rowFromLeaderboardApiRow(row: UtrLeaderboardApiRow): UtrLeaderboardRow {
	return {
		asset: row.coingeckoId ?? row.arcticId,
		name: row.projectName,
		symbol: row.symbol.toUpperCase(),
		sector: row.sector,
		listingStatus: row.tgeStatus === 'post' ? 'listed' : 'pre-tge',
		disclosureLevel: row.gradedCount >= row.criteriaCount ? 'full' : row.gradedCount > 0 ? 'partial' : 'none',
		claimed: false,
		fdvUsd: row.fdvUsd,
		coingeckoId: row.coingeckoId,
		grade: row.grade,
		breakdown: {
			disclosure: withEmptyCriteria(row.disclosureCategories ?? []),
			performance: withEmptyCriteria(row.performanceCategories ?? [])
		},
		scores: {
			overall: row.overallScore,
			overallMomChangePct: row.momChangePct,
			disclosure: row.disclosureScore,
			performance: row.performanceScore,
			rank: row.rank,
			disclosureRubrics: [],
			performanceRubrics: []
		}
	}
}

export async function fetchIconDataUrl(coingeckoId: string): Promise<string | null> {
	try {
		const response = await fetch(geckoTokenIconUrl(coingeckoId))
		if (!response.ok) return null
		const buffer = Buffer.from(await response.arrayBuffer())
		const contentType = response.headers.get('content-type') ?? 'image/png'
		if (!contentType.startsWith('image/')) return null
		return `data:${contentType};base64,${buffer.toString('base64')}`
	} catch {
		return null
	}
}

async function withIconDataUrls(rows: UtrLeaderboardRow[]): Promise<UtrLeaderboardRow[]> {
	return Promise.all(
		rows.map(async (row) => (row.coingeckoId ? { ...row, iconDataUrl: await fetchIconDataUrl(row.coingeckoId) } : row))
	)
}

export async function fetchUtrUniverseWithLive(): Promise<UtrUniverse> {
	const leaderboard = await fetchUtrLeaderboard()
	const postRows = (leaderboard?.postTge.rows ?? []).map(rowFromLeaderboardApiRow)
	const preRows = (leaderboard?.preTge.rows ?? []).map(rowFromLeaderboardApiRow).map((row) => ({
		...row,
		scores: { ...row.scores, rank: row.scores.rank == null ? null : row.scores.rank + postRows.length }
	}))
	if (leaderboard && (postRows.length || preRows.length)) {
		const rows = await withIconDataUrls(
			[...postRows, ...preRows].sort((a, b) => (a.scores.rank ?? Infinity) - (b.scores.rank ?? Infinity))
		)
		return { rows, scoredCount: leaderboard.scoredCount, totalCount: leaderboard.totalCount }
	}
	return { rows: [], scoredCount: leaderboard?.scoredCount ?? 0, totalCount: leaderboard?.totalCount ?? 0 }
}
