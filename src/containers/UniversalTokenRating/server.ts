import { forgdFetch } from '~/containers/MarketMakers/server/client'
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
	UtrScoringCategoryConfig,
	UtrScoringConfig,
	UtrUniverse,
	UtrExchangesResponse,
	UtrDisclosureScoreSummary,
	UtrDisclosures,
	UtrClaimExchangeOption,
	UtrClaimMarketMakerOption
} from './types'

const FORGD_HOST = 'https://quant.forgd.com'

function forgdUtrHeaders(): Record<string, string> | undefined {
	const key = process.env.API_KEY_FORGD?.trim()
	return key ? { Authorization: `Bearer ${key}` } : undefined
}

export async function fetchUtrProjects(): Promise<Array<UtrProject>> {
	try {
		return await fetchJson<Array<UtrProject>>(`${FORGD_HOST}/api/utr/projects`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
	} catch {
		return []
	}
}

export async function fetchUtrDisclosureScoreSummaries(): Promise<Array<UtrDisclosureScoreSummary>> {
	try {
		return await fetchJson<Array<UtrDisclosureScoreSummary>>(`${FORGD_HOST}/api/utr/projects/disclosure-scores`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
	} catch {
		return []
	}
}

export async function fetchUtrBatchMetrics(assets: Array<string>): Promise<UtrBatchResponse | null> {
	if (assets.length === 0) return null
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback
}

function nullableString(value: unknown): string | null {
	return typeof value === 'string' ? value : null
}

function finiteNumber(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeCategories(value: unknown): Array<UtrScoringCategoryConfig> {
	if (!isRecord(value) || !Array.isArray(value.categories)) return []
	return value.categories.flatMap((rawCategory) => {
		if (!isRecord(rawCategory)) return []
		const key = stringValue(rawCategory.key)
		const label = stringValue(rawCategory.label)
		if (!key || !label) return []
		const rawCriteria = Array.isArray(rawCategory.criteria) ? rawCategory.criteria : []
		return [
			{
				key,
				label,
				criteria: rawCriteria.flatMap((rawCriterion) => {
					if (!isRecord(rawCriterion)) return []
					const criterionKey = stringValue(rawCriterion.key)
					const criterionLabel = stringValue(rawCriterion.label)
					if (!criterionKey || !criterionLabel) return []
					const applicability =
						rawCriterion.applicability === 'preTge' || rawCriterion.applicability === 'postTge'
							? rawCriterion.applicability
							: 'both'
					return [
						{
							key: criterionKey,
							label: criterionLabel,
							weight: finiteNumber(rawCriterion.weight),
							applicability,
							evaluationType: nullableString(rawCriterion.evaluationType),
							ignoreBlacklistedExchanges:
								typeof rawCriterion.ignoreBlacklistedExchanges === 'boolean'
									? rawCriterion.ignoreBlacklistedExchanges
									: null,
							expression: nullableString(rawCriterion.expression),
							bands: Array.isArray(rawCriterion.bands) ? rawCriterion.bands : [],
							definition: nullableString(rawCriterion.definition),
							rubric: Array.isArray(rawCriterion.rubric)
								? rawCriterion.rubric.filter((entry): entry is string => typeof entry === 'string')
								: []
						}
					]
				})
			}
		]
	})
}

function normalizeGradingAxis(value: unknown) {
	const axis = isRecord(value) ? value : {}
	return {
		description: stringValue(axis.description),
		scale: (Array.isArray(axis.scale) ? axis.scale : []).flatMap((rawEntry) => {
			if (!isRecord(rawEntry)) return []
			const grade = stringValue(rawEntry.grade)
			const min = rawEntry.min === null ? null : finiteNumber(rawEntry.min, Number.NaN)
			if (!grade || (min !== null && Number.isNaN(min))) return []
			return [{ min, grade, interpretation: stringValue(rawEntry.interpretation) }]
		})
	}
}

function normalizeExchanges(value: unknown) {
	const exchanges = isRecord(value) ? value : {}
	const normalizeTier = (tier: unknown) =>
		(Array.isArray(tier) ? tier : []).flatMap((rawExchange) => {
			if (!isRecord(rawExchange)) return []
			const displayName = stringValue(rawExchange.displayName)
			if (!displayName) return []
			return [
				{
					id: stringValue(rawExchange.id, displayName),
					displayName,
					logoUrl: nullableString(rawExchange.logoUrl)
				}
			]
		})
	return { tier1: normalizeTier(exchanges.tier1), tier2: normalizeTier(exchanges.tier2) }
}

export function normalizeUtrScoringConfig(value: unknown): UtrScoringConfig | null {
	if (!isRecord(value) || !isRecord(value.config)) return null
	const grading = isRecord(value.config.grading) ? value.config.grading : {}
	return {
		version: finiteNumber(value.version),
		grading: {
			overall: normalizeGradingAxis(grading.overall),
			disclosure: normalizeGradingAxis(grading.disclosure),
			performance: normalizeGradingAxis(grading.performance)
		},
		disclosure: { categories: normalizeCategories(value.config.disclosure) },
		performance: { categories: normalizeCategories(value.config.performance) },
		exchanges: normalizeExchanges(value.exchanges)
	}
}

export async function fetchUtrScoringConfig(): Promise<UtrScoringConfig | null> {
	try {
		const response = await fetchJson<unknown>(`${FORGD_HOST}/api/utr/scoring-config`, {
			timeout: 30_000,
			headers: forgdUtrHeaders()
		})
		return normalizeUtrScoringConfig(response)
	} catch {
		return null
	}
}

const DISCLOSURE_PLACEHOLDER = /^(n\/?a|-+|none|unknown( details)?|not (disclosed|published)|to be confirmed|tb[cd])$/i
const NUMERIC_TEXT = /^-?\d+(\.\d+)?\s*%?$/

function disclosedText(value: unknown): string | null {
	const text = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
	return text && !DISCLOSURE_PLACEHOLDER.test(text) ? text : null
}

function disclosedNumber(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null
	const text = disclosedText(value)
	return text && NUMERIC_TEXT.test(text) ? Number.parseFloat(text) : null
}

function disclosedAllocation(value: unknown): number | string | null {
	return disclosedNumber(value) ?? disclosedText(value)
}

function disclosedBoolean(value: unknown): boolean | null {
	return typeof value === 'boolean' ? value : null
}

function disclosureRows<T>(value: unknown, mapRow: (row: Record<string, unknown>) => T | null): Array<T> {
	if (!Array.isArray(value)) return []
	return value.flatMap((row) => {
		if (!isRecord(row)) return []
		const mapped = mapRow(row)
		return mapped ? [mapped] : []
	})
}

export function normalizeUtrDisclosures(value: unknown): UtrDisclosures | null {
	if (!isRecord(value)) return null
	const raw = isRecord(value.disclosures) ? value.disclosures : {}
	return {
		updatedAt: nullableString(value.updatedAt),
		insiderIdentities: disclosureRows(raw.insiderIdentities, (row) => {
			const name = disclosedText(row.name)
			return name
				? {
						name,
						role: disclosedText(row.role) ?? '',
						profileUrl: disclosedText(row.profileUrl),
						description: disclosedText(row.description)
					}
				: null
		}),
		organizationalStructure: disclosureRows(raw.organizationalStructure, (row) => {
			const companyName = disclosedText(row.companyName)
			return companyName
				? {
						companyName,
						jurisdiction: disclosedText(row.jurisdiction) ?? '',
						description: disclosedText(row.description) ?? ''
					}
				: null
		}),
		insiderWallets: disclosureRows(raw.insiderWallets, (row) => {
			const walletAddress = disclosedText(row.walletAddress)
			return walletAddress
				? {
						walletAddress,
						allocationPct: disclosedAllocation(row.allocationPct),
						ownerType: disclosedText(row.ownerType) ?? ''
					}
				: null
		}),
		tokenomicsGroups: disclosureRows(raw.tokenomicsGroups, (row) => {
			const groupName = disclosedText(row.groupName)
			const allocationPct = disclosedNumber(row.allocationPct)
			return groupName && allocationPct != null
				? {
						groupName,
						allocationPct,
						groupCategory: disclosedText(row.groupCategory) ?? '',
						tgeUnlockPct: disclosedNumber(row.tgeUnlockPct) ?? 0,
						lockUpDurationMonths: disclosedNumber(row.lockUpDurationMonths) ?? 0,
						cliffUnlockPct: disclosedNumber(row.cliffUnlockPct) ?? 0,
						unlockDurationMonths: disclosedNumber(row.unlockDurationMonths) ?? 0,
						unlockFrequency: disclosedText(row.unlockFrequency) ?? ''
					}
				: null
		}),
		externalAllocations: disclosureRows(raw.externalAllocations, (row) => {
			const counterpartyName = disclosedText(row.counterpartyName)
			return counterpartyName
				? {
						counterpartyName,
						allocationPct: disclosedAllocation(row.allocationPct),
						categorization: disclosedText(row.categorization) ?? ''
					}
				: null
		}),
		multisigWallets: disclosureRows(raw.multisigWallets, (row) => {
			const walletAddress = disclosedText(row.walletAddress)
			return walletAddress
				? {
						walletAddress,
						thresholdRequired: disclosedNumber(row.thresholdRequired),
						thresholdTotal: disclosedNumber(row.thresholdTotal)
					}
				: null
		}),
		licenses: disclosureRows(raw.licenses, (row) => {
			const name = disclosedText(row.name)
			return name ? { name, link: disclosedText(row.link), description: disclosedText(row.description) ?? '' } : null
		}),
		marketMakerEngagements: disclosureRows(raw.marketMakerEngagements, (row) => {
			const marketMakerName = disclosedText(row.marketMakerName)
			return marketMakerName
				? {
						marketMakerName,
						logoUrl: disclosedText(row.marketMakerLogoUrl),
						allocationPct: disclosedAllocation(row.allocationPct),
						engagementType: disclosedText(row.engagementType) ?? ''
					}
				: null
		}),
		verifyMmEngagements: disclosedBoolean(raw.verifyMmEngagements),
		exchangeEngagements: disclosureRows(raw.exchangeEngagements, (row) => {
			const exchangeName = disclosedText(row.exchangeName)
			return exchangeName
				? {
						exchangeName,
						logoUrl: disclosedText(row.exchangeLogoUrl),
						commercialCommitment: disclosedBoolean(row.commercialCommitment),
						details: disclosedText(row.details)
					}
				: null
		}),
		auditors: disclosureRows(raw.auditors, (row) => {
			const name = disclosedText(row.name)
			return name ? { name, type: disclosedText(row.type) ?? '', link: disclosedText(row.link) } : null
		}),
		roleDescriptionsCommentary: disclosedText(raw.roleDescriptionsCommentary),
		treasuryReportingCommentary: disclosedText(raw.treasuryReportingCommentary),
		cashFlowCommentary: disclosedText(raw.cashFlowCommentary),
		vestingActualCommentary: disclosedText(raw.vestingActualCommentary)
	}
}

export async function fetchUtrDisclosures(arcticId: string): Promise<UtrDisclosures | null> {
	try {
		return normalizeUtrDisclosures(
			await fetchJson<unknown>(`${FORGD_HOST}/api/v1/public/utr/disclosures/${encodeURIComponent(arcticId)}`, {
				timeout: 30_000,
				headers: forgdUtrHeaders()
			})
		)
	} catch {
		return null
	}
}

export function exchangeOptionsFromScoringConfig(config: UtrScoringConfig | null): Array<UtrClaimExchangeOption> {
	return config
		? [...config.exchanges.tier1, ...config.exchanges.tier2].map(({ id, displayName }) => ({ id, displayName }))
		: []
}

export async function fetchUtrClaimMarketMakerOptions(): Promise<Array<UtrClaimMarketMakerOption>> {
	try {
		const payload = await forgdFetch<Array<unknown>>('/market-maker/leaderboard/performance')
		if (!Array.isArray(payload)) return []
		const options = new Map<string, UtrClaimMarketMakerOption>()
		for (const row of payload) {
			if (!row || typeof row !== 'object') continue
			const value = row as Record<string, unknown>
			const marketMakerId = typeof value.marketMakerId === 'string' ? value.marketMakerId.trim() : ''
			const marketMakerName = typeof value.marketMakerName === 'string' ? value.marketMakerName.trim() : ''
			if (marketMakerId && marketMakerName) options.set(marketMakerId, { marketMakerId, marketMakerName })
		}
		return [...options.values()].sort((a, b) => a.marketMakerName.localeCompare(b.marketMakerName))
	} catch {
		return []
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
		return await fetchUtrLeaderboardStrict()
	} catch {
		return null
	}
}

export function fetchUtrLeaderboardStrict(): Promise<UtrLeaderboardResponse> {
	return fetchJson<UtrLeaderboardResponse>(`${FORGD_HOST}/api/utr/leaderboard`, {
		timeout: 30_000,
		headers: forgdUtrHeaders()
	})
}

function withEmptyCriteria(categories: Array<UtrCategoryBreakdown>): Array<UtrCategoryBreakdown> {
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
		disclosureGrade: row.disclosureGrade ?? null,
		performanceGrade: row.performanceGrade ?? null,
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

async function withIconDataUrls(rows: Array<UtrLeaderboardRow>): Promise<Array<UtrLeaderboardRow>> {
	return Promise.all(
		rows.map(async (row) => (row.coingeckoId ? { ...row, iconDataUrl: await fetchIconDataUrl(row.coingeckoId) } : row))
	)
}

export function leaderboardRowsFromResponse(leaderboard: UtrLeaderboardResponse): Array<UtrLeaderboardRow> {
	const postRows = leaderboard.postTge.rows.map(rowFromLeaderboardApiRow)
	const preRows = leaderboard.preTge.rows.map(rowFromLeaderboardApiRow).map((row) => ({
		...row,
		scores: { ...row.scores, rank: row.scores.rank == null ? null : row.scores.rank + postRows.length }
	}))
	return [...postRows, ...preRows].sort((a, b) => (a.scores.rank ?? Infinity) - (b.scores.rank ?? Infinity))
}

export async function fetchUtrUniverseWithLive(): Promise<UtrUniverse> {
	const leaderboard = await fetchUtrLeaderboard()
	const leaderboardRows = leaderboard ? leaderboardRowsFromResponse(leaderboard) : []
	if (leaderboard && leaderboardRows.length > 0) {
		const rows = await withIconDataUrls(leaderboardRows)
		return { rows, scoredCount: leaderboard.scoredCount, totalCount: leaderboard.totalCount }
	}
	return { rows: [], scoredCount: leaderboard?.scoredCount ?? 0, totalCount: leaderboard?.totalCount ?? 0 }
}
