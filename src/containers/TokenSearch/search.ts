import { searchApi } from '~/api'
import { geckoTokenIconUrl } from '~/utils/icons'
import { TOKEN_SEARCH_LIMIT, type TokenSearchResult } from './types'

interface TokenSearchHit {
	id: string
	name: string
	symbol?: string
	logo?: string | null
	mcapRank?: number | null
}

// Meili `id` is not filterable in the pages index, so these only pick search terms for legacy CoinGecko ids.
const TOKEN_ID_SEARCH_ALIASES: Record<string, string> = {
	binancecoin: 'bnb'
}

export function getGeckoIdFromSearchId(id: string): string {
	const coinKey = id.replaceAll('_', ':')
	const withoutPrefix = coinKey.startsWith('coingecko:') ? coinKey.slice('coingecko:'.length) : coinKey
	return withoutPrefix.endsWith(':token') ? withoutPrefix.slice(0, -':token'.length) : withoutPrefix
}

function getFallbackTokenName(geckoId: string): string {
	return geckoId
		.split('-')
		.map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
		.join(' ')
}

export function getTokenSearchFallback(id: string): TokenSearchResult {
	const searchId = id.replaceAll('_', ':')
	const geckoId = getGeckoIdFromSearchId(id)
	return {
		id: geckoId,
		searchId,
		coinKey: `coingecko:${geckoId}`,
		name: getFallbackTokenName(geckoId),
		symbol: geckoId.toUpperCase(),
		logo: geckoTokenIconUrl(geckoId),
		rank: Number.MAX_SAFE_INTEGER
	}
}

function toTokenSearchResult(hit: TokenSearchHit, fallbackRank: number): TokenSearchResult {
	const searchId = hit.id.replaceAll('_', ':')
	const geckoId = getGeckoIdFromSearchId(hit.id)
	const symbol = (hit.symbol ?? hit.name ?? geckoId).toUpperCase()
	return {
		id: geckoId,
		searchId,
		coinKey: `coingecko:${geckoId}`,
		name: hit.name || symbol,
		symbol,
		logo: hit.logo ?? geckoTokenIconUrl(geckoId),
		rank: hit.mcapRank ?? fallbackRank
	}
}

export async function searchTokens(query: string, limit = TOKEN_SEARCH_LIMIT): Promise<TokenSearchResult[]> {
	const hits = await searchApi<TokenSearchHit>({
		indexUid: 'pages',
		limit,
		offset: 0,
		q: query,
		filter: [['type = "Token"']],
		sort: ['mcapRank:asc']
	})

	const tokens: TokenSearchResult[] = []
	for (let index = 0; index < hits.length; index++) {
		tokens.push(toTokenSearchResult(hits[index], index + 1))
	}
	return tokens
}

async function hydrateTokenSearchOptionsByIdQuery(ids: string[]): Promise<TokenSearchResult[]> {
	const results = await Promise.all(
		ids.map((id) => {
			const geckoId = getGeckoIdFromSearchId(id)
			return searchTokens(TOKEN_ID_SEARCH_ALIASES[geckoId] ?? geckoId, 10)
		})
	)
	const tokens: TokenSearchResult[] = []
	for (const [index, id] of ids.entries()) {
		const geckoId = getGeckoIdFromSearchId(id)
		const token = results[index]?.find((result) => result.id === geckoId)
		if (token) tokens.push(token)
	}
	return tokens
}

export async function hydrateTokenSearchOptionsByIds(ids: readonly string[]): Promise<TokenSearchResult[]> {
	const normalizedIds = Array.from(new Set(ids.map(getGeckoIdFromSearchId).filter(Boolean)))
	if (normalizedIds.length === 0) return []

	const tokens = await hydrateTokenSearchOptionsByIdQuery(normalizedIds)
	const tokensById = new Map(tokens.map((token) => [token.id, token]))
	return normalizedIds.flatMap((id) => {
		const token = tokensById.get(id)
		return token ? [token] : []
	})
}

export function mergeTokenSearchResults(...tokenLists: Array<readonly TokenSearchResult[]>): TokenSearchResult[] {
	const tokensById = new Map<string, TokenSearchResult>()
	for (const tokens of tokenLists) {
		for (const token of tokens) {
			if (!tokensById.has(token.id)) tokensById.set(token.id, token)
		}
	}
	return Array.from(tokensById.values())
}

export async function getInitialTokenSearchOptions(ids: readonly string[] = []): Promise<TokenSearchResult[]> {
	const [topTokens, selectedTokens] = await Promise.all([searchTokens(''), hydrateTokenSearchOptionsByIds(ids)])
	return mergeTokenSearchResults(topTokens, selectedTokens)
}
