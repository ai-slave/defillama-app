import { fetchCoinGeckoTokensListFromDataset } from '~/api/coingecko'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { queryIntClamped, queryList, queryString } from '~/server/api/params'
import { cachedResult } from '~/server/api/resultCache'
import type { ApiQuery } from '~/server/api/types'
import { geckoTokenIconUrl } from '~/utils/icons'
import {
	CORRELATION_TOKEN_PICKER_LIMIT,
	type CorrelationTokenOption,
	type CorrelationTokenPickerResponse
} from './types'

const MAX_CORRELATION_TOKEN_PICKER_LIMIT = 100
const CORRELATION_TOKEN_SOURCE_TTL_MS = 5 * 60 * 1000

interface CorrelationTokenOptionsQuery {
	q?: string
	offset?: number
	limit?: number
	ids?: string[]
}

function toCorrelationTokenOption(token: IResponseCGTokenRankingsDatasetItem, index: number): CorrelationTokenOption {
	return {
		id: token.id,
		name: token.name,
		symbol: token.symbol.toUpperCase(),
		rank: token.market_cap_rank_with_rehypothecated ?? token.market_cap_rank ?? index + 1,
		logo: geckoTokenIconUrl(token.id)
	}
}

async function fetchCorrelationTokenSource(): Promise<CorrelationTokenOption[]> {
	const tokens = await fetchCoinGeckoTokensListFromDataset()
	const options: CorrelationTokenOption[] = []

	for (let index = 0; index < tokens.length; index++) {
		options.push(toCorrelationTokenOption(tokens[index], index))
	}

	return options
}

async function getCorrelationTokenSource(): Promise<CorrelationTokenOption[]> {
	return cachedResult(
		'correlation-token-options',
		'v1',
		{
			ttlMs: CORRELATION_TOKEN_SOURCE_TTL_MS,
			ttlJitter: 0.2,
			staleWhileRevalidateMs: 30 * 60 * 1000
		},
		fetchCorrelationTokenSource
	)
}

function matchesTokenQuery(token: CorrelationTokenOption, q: string): boolean {
	return (
		token.id.toLowerCase().includes(q) || token.name.toLowerCase().includes(q) || token.symbol.toLowerCase().includes(q)
	)
}

function getRequestedIdSet(ids: string[]): Set<string> {
	const requestedIds = new Set<string>()
	for (const id of ids) {
		const normalizedId = id.trim().toLowerCase()
		if (normalizedId) requestedIds.add(normalizedId)
	}
	return requestedIds
}

export async function getCorrelationTokenOptions({
	q = '',
	offset = 0,
	limit = CORRELATION_TOKEN_PICKER_LIMIT,
	ids = []
}: CorrelationTokenOptionsQuery = {}): Promise<CorrelationTokenPickerResponse> {
	const source = await getCorrelationTokenSource()

	if (ids.length > 0) {
		const requestedIds = getRequestedIdSet(ids)
		const tokens: CorrelationTokenOption[] = []
		for (const token of source) {
			if (requestedIds.has(token.id.toLowerCase())) tokens.push(token)
		}

		return {
			tokens,
			offset: 0,
			limit: tokens.length,
			total: tokens.length,
			nextOffset: null
		}
	}

	const normalizedQuery = q.trim().toLowerCase()
	const filteredTokens: CorrelationTokenOption[] = []

	if (normalizedQuery) {
		for (const token of source) {
			if (matchesTokenQuery(token, normalizedQuery)) filteredTokens.push(token)
		}
	} else {
		filteredTokens.push(...source)
	}

	const safeOffset = Math.max(0, offset)
	const safeLimit = Math.min(Math.max(1, limit), MAX_CORRELATION_TOKEN_PICKER_LIMIT)
	const end = Math.min(filteredTokens.length, safeOffset + safeLimit)
	const tokens: CorrelationTokenOption[] = []

	for (let index = safeOffset; index < end; index++) {
		tokens.push(filteredTokens[index])
	}

	return {
		tokens,
		offset: safeOffset,
		limit: safeLimit,
		total: filteredTokens.length,
		nextOffset: end < filteredTokens.length ? end : null
	}
}

export function getCorrelationTokenOptionsFromQuery(query: ApiQuery): Promise<CorrelationTokenPickerResponse> {
	return getCorrelationTokenOptions({
		q: queryString(query, 'q') ?? '',
		offset: queryIntClamped(query, 'offset', 0, 0, 50_000),
		limit: queryIntClamped(query, 'limit', CORRELATION_TOKEN_PICKER_LIMIT, 1, MAX_CORRELATION_TOKEN_PICKER_LIMIT),
		ids: queryList(query, 'ids')
	})
}
