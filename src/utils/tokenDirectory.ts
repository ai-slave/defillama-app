import { safeDecodeURIComponent } from './route'

export type TokenDirectoryRecord = {
	name: string
	symbol: string
	token_nk?: string
	protocolId?: string
	chainId?: string
	incomeStatement?: true
	route?: string
	tokenRights?: boolean
	is_yields?: boolean
	mcap_rank?: number
	logo?: string | null
	website?: string
	twitter?: string
	telegram?: string
	discord?: string
}

export type TokenDirectory = Record<string, TokenDirectoryRecord>
export type TokenDirectoryRecordByRouteSegment = Record<string, TokenDirectoryRecord>

const TOKEN_ROUTE_PREFIX = '/token/'

export function getCanonicalTokenRoute(record: TokenDirectoryRecord): string {
	return record.route ?? `${TOKEN_ROUTE_PREFIX}${encodeURIComponent(record.symbol)}`
}

export function getCanonicalTokenRouteSegment(record: TokenDirectoryRecord): string | null {
	const route = getCanonicalTokenRoute(record)
	return route.startsWith(TOKEN_ROUTE_PREFIX) ? route.slice(TOKEN_ROUTE_PREFIX.length) : null
}

export function createTokenDirectoryRecordByRouteSegment(tokens: TokenDirectory): TokenDirectoryRecordByRouteSegment {
	const records: TokenDirectoryRecordByRouteSegment = {}

	for (const tokenId in tokens) {
		const token = tokens[tokenId]
		if (token === undefined) continue
		const routeSegment = getCanonicalTokenRouteSegment(token)
		if (!routeSegment) continue
		const decodedSegment = safeDecodeURIComponent(routeSegment)
		if (records[decodedSegment] === undefined) records[decodedSegment] = token
	}

	return records
}

export function findTokenDirectoryRecordByGeckoId(
	tokens: TokenDirectory,
	geckoId: string | null | undefined
): TokenDirectoryRecord | null {
	if (!geckoId) return null

	const tokenNk = `coingecko:${geckoId.toLowerCase()}`

	for (const tokenId in tokens) {
		const token = tokens[tokenId]
		if (token === undefined) continue
		if (token.token_nk?.toLowerCase() === tokenNk) {
			return token
		}
	}

	return null
}

export function findTokenPageRoute(
	tokenDirectory: TokenDirectory | null | undefined,
	{ defillamaId, geckoId }: { defillamaId?: string | null; geckoId?: string | null }
): string | null {
	if (!tokenDirectory) return null

	const record =
		(defillamaId ? findTokenDirectoryRecordByDefillamaId(tokenDirectory, defillamaId) : null) ??
		findTokenDirectoryRecordByGeckoId(tokenDirectory, geckoId)

	return record ? getCanonicalTokenRoute(record) : null
}

export function findTokenDirectoryRecordByDefillamaId(
	tokens: TokenDirectory,
	defillamaId: string
): TokenDirectoryRecord | null {
	for (const tokenId in tokens) {
		const token = tokens[tokenId]
		if (token === undefined) continue
		if (token.protocolId === defillamaId || token.chainId === defillamaId) {
			return token
		}
	}

	return null
}
