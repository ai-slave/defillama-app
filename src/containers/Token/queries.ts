import type { ITokenRightsData } from '~/containers/TokenRights/types'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import type { TokenDirectoryRecord } from '~/utils/tokenDirectory'
import { getTokenRiskBorrowCapacity } from './api'
import type { TokenRiskBorrowCapacityResponse } from './api.types'
import { DEFAULT_TABLE_PAGE_SIZE } from './tableUtils'
import type { TokenOverviewData } from './tokenOverview'
import type { TokenRiskResponse } from './tokenRisk.types'
import {
	buildExposuresSection,
	filterTokenRiskCandidatesWithData,
	indexBorrowCapacityByAssetKey,
	inferTokenRiskCandidatesFromBorrowCapacity,
	mergeIndexedBorrowCapacity,
	TOKEN_RISK_LIMITATIONS_COMMON,
	TOKEN_RISK_LIMITATION_MIN_BAD_DEBT_NULLS
} from './tokenRisk.utils'
import type {
	TokenBorrowRoutesData,
	TokenBorrowRoutesHydration,
	TokenIncomeStatementData,
	TokenIssuer,
	TokenPageSection,
	TokenYieldsHydration
} from './types'

export function getCoinGeckoId(tokenNk: string | undefined): string | null {
	if (!tokenNk?.startsWith('coingecko:')) return null
	return tokenNk.slice('coingecko:'.length) || null
}

export function downgradeTokenPageDataError<T>(
	error: unknown,
	message: string,
	fallback: T,
	isIntegrityError: (error: unknown) => boolean
): T {
	if (isIntegrityError(error)) {
		throw error
	}
	console.error(message, error)
	return fallback
}

function getBorrowRouteChainList(rows: Array<RouteTableRow>): Array<string> {
	const chains = new Set<string>()
	for (const row of rows) {
		const chain = row.chains[0]
		if (typeof chain === 'string' && chain.length > 0) chains.add(chain)
	}
	return Array.from(chains).toSorted()
}

export function buildInitialYieldsSnapshot(
	yieldsRows: Array<IYieldTableRow>,
	tokenKeys: Array<string>
): TokenYieldsHydration {
	const chainList = new Set<string>()
	for (const row of yieldsRows) {
		const chain = row.chains[0]
		if (chain) chainList.add(chain)
	}

	return {
		rows: yieldsRows.slice(0, DEFAULT_TABLE_PAGE_SIZE),
		rowCount: yieldsRows.length,
		chainList: Array.from(chainList).toSorted(),
		pageSize: DEFAULT_TABLE_PAGE_SIZE,
		tokenKeys
	}
}

export function buildInitialBorrowRoutesSnapshot(
	routes: TokenBorrowRoutesData | null,
	tokenKeys: Array<string>
): TokenBorrowRoutesHydration | null {
	if (!routes) return null

	return {
		data: {
			useAsCollateral: routes.useAsCollateral.slice(0, DEFAULT_TABLE_PAGE_SIZE),
			borrowThis: routes.borrowThis.slice(0, DEFAULT_TABLE_PAGE_SIZE)
		},
		counts: {
			useAsCollateral: routes.useAsCollateral.length,
			borrowThis: routes.borrowThis.length
		},
		chainLists: {
			useAsCollateral: getBorrowRouteChainList(routes.useAsCollateral),
			borrowThis: getBorrowRouteChainList(routes.borrowThis)
		},
		pageSize: DEFAULT_TABLE_PAGE_SIZE,
		tokenKeys
	}
}

export function getTokenPageSections({
	record,
	geckoId,
	tokenRightsData,
	incomeStatement,
	tokenRiskData,
	hasLiquidations,
	hasMarkets,
	resolvedUnlocksSlug,
	yieldsSnapshot,
	borrowRoutesSnapshot,
	issuer,
	chain,
	overview
}: {
	record: TokenDirectoryRecord
	geckoId: string | null
	tokenRightsData: ITokenRightsData | null
	incomeStatement: TokenIncomeStatementData | null
	tokenRiskData: TokenRiskResponse | null
	hasLiquidations: boolean
	hasMarkets: boolean
	resolvedUnlocksSlug: string | null
	yieldsSnapshot: ReturnType<typeof buildInitialYieldsSnapshot>
	borrowRoutesSnapshot: ReturnType<typeof buildInitialBorrowRoutesSnapshot>
	issuer: TokenIssuer | null
	chain: TokenIssuer | null
	overview: TokenOverviewData
}): Array<TokenPageSection> {
	const sections: Array<TokenPageSection> = [
		{
			id: 'token-overview',
			label: 'Overview',
			overview,
			geckoId,
			logo: record.logo ?? null,
			issuer,
			chain
		}
	]

	if (incomeStatement) {
		sections.push({
			id: 'token-income-statement',
			label: 'Income Statement',
			tokenSymbol: record.symbol,
			incomeStatement
		})
	}
	if (tokenRiskData) {
		sections.push({
			id: 'token-risks',
			label: 'Risks',
			tokenSymbol: record.symbol,
			riskData: tokenRiskData
		})
	}
	if (geckoId && hasMarkets) {
		sections.push({
			id: 'token-markets',
			label: 'Markets',
			geckoId,
			tokenSymbol: record.symbol
		})
	}
	if (tokenRightsData) {
		sections.push({
			id: 'token-rights-and-value-accrual',
			label: 'Token Rights',
			name: record.name,
			symbol: record.symbol,
			tokenRightsData
		})
	}

	sections.push({
		id: 'token-usage',
		label: 'Token Usage',
		tokenSymbol: record.symbol
	})

	if (hasLiquidations) {
		sections.push({
			id: 'token-liquidations',
			label: 'Liquidations',
			tokenSymbol: record.symbol
		})
	}
	if (resolvedUnlocksSlug) {
		sections.push({
			id: 'token-unlocks',
			label: 'Unlocks',
			resolvedUnlocksSlug
		})
	}
	if (record.hasEarn && yieldsSnapshot.rowCount > 0) {
		sections.push({
			id: 'token-yields',
			label: 'Yields',
			tokenSymbol: record.symbol,
			hydration: yieldsSnapshot
		})
	}
	if (
		record.hasBorrow &&
		borrowRoutesSnapshot &&
		(borrowRoutesSnapshot.counts.useAsCollateral > 0 || borrowRoutesSnapshot.counts.borrowThis > 0)
	) {
		sections.push({
			id: 'token-borrow',
			label: 'Borrow',
			tokenSymbol: record.symbol,
			hydration: borrowRoutesSnapshot
		})
	}

	return sections
}

const BORROW_CAPACITY_CACHE_TTL_MS = 5 * 60 * 1000

type IndexedBorrowCapacityCache = {
	data: TokenRiskBorrowCapacityResponse
	indexedTokens: ReturnType<typeof indexBorrowCapacityByAssetKey>
	fetchedAt?: number
}

type TokenRiskDisplayLookups = {
	protocolDisplayNames: Map<string, string>
	chainDisplayNames: Map<string, string>
}

type TokenRiskQueryInput = {
	tokenSymbol: string
	displayLookups: TokenRiskDisplayLookups
	borrowCapacitySnapshot?: IndexedBorrowCapacityCache
}

let borrowCapacityCache: IndexedBorrowCapacityCache | null = null
let borrowCapacityInFlight: Promise<IndexedBorrowCapacityCache> | null = null

export function resetTokenRiskBorrowRoutesCache() {
	borrowCapacityCache = null
	borrowCapacityInFlight = null
}

async function getIndexedBorrowCapacityCache(): Promise<IndexedBorrowCapacityCache> {
	const now = Date.now()
	if (
		borrowCapacityCache &&
		borrowCapacityCache.fetchedAt &&
		now - borrowCapacityCache.fetchedAt < BORROW_CAPACITY_CACHE_TTL_MS
	) {
		return borrowCapacityCache
	}

	if (borrowCapacityInFlight) {
		return borrowCapacityInFlight
	}

	borrowCapacityInFlight = (async () => {
		const data = await getTokenRiskBorrowCapacity()
		return {
			data,
			indexedTokens: indexBorrowCapacityByAssetKey(data.tokens),
			fetchedAt: Date.now()
		}
	})()
		.then((cacheValue) => {
			borrowCapacityCache = cacheValue
			return cacheValue
		})
		.finally(() => {
			borrowCapacityInFlight = null
		})

	return borrowCapacityInFlight
}

export async function getTokenRiskData({
	tokenSymbol,
	displayLookups,
	borrowCapacitySnapshot
}: TokenRiskQueryInput): Promise<TokenRiskResponse | null> {
	const resolvedBorrowCapacitySnapshot = borrowCapacitySnapshot ?? (await getIndexedBorrowCapacityCache())
	const candidates = inferTokenRiskCandidatesFromBorrowCapacity({
		tokenSymbol,
		tokens: resolvedBorrowCapacitySnapshot.data.tokens,
		chainDisplayNames: displayLookups.chainDisplayNames
	})
	if (candidates.length === 0) return null

	const scopeCandidates = filterTokenRiskCandidatesWithData(candidates, resolvedBorrowCapacitySnapshot.indexedTokens)
	if (scopeCandidates.length === 0) return null

	const activeTokens = mergeIndexedBorrowCapacity(
		resolvedBorrowCapacitySnapshot.indexedTokens,
		scopeCandidates.map((candidate) => candidate.key)
	)

	const exposures = buildExposuresSection(
		activeTokens,
		resolvedBorrowCapacitySnapshot.data.methodologies,
		displayLookups
	)
	if (exposures.rows.length === 0) return null

	return {
		candidates,
		scopeCandidates,
		selectedCandidateKey: null,
		exposures,
		limitations: [
			...TOKEN_RISK_LIMITATIONS_COMMON,
			...(exposures.summary.minBadDebtUnknownCount > 0 ? [TOKEN_RISK_LIMITATION_MIN_BAD_DEBT_NULLS] : [])
		]
	}
}
