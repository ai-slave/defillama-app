import { RWA_SERVER_URL } from '~/constants'
import type { RWAFlowOverviewSplitBy } from '~/containers/RWA/api.types'
import { queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest } from '~/server/api/respond'
import type { ApiQuery } from '~/server/api/types'

const RWA_FLOW_CACHE_CONTROL = 'public, s-maxage=1800, stale-while-revalidate=1800'
const RWA_FLOW_RESULT_TTL_MS = 30 * 60 * 1000
const FLOW_SCOPES = ['asset', 'assetGroup', 'category', 'platform', 'chain'] as const
const OVERVIEW_SPLITS: ReadonlySet<RWAFlowOverviewSplitBy> = new Set(['assetGroup', 'category', 'platform', 'chain'])
const ASSET_BREAKDOWN_SCOPES = ['assetGroup', 'category', 'platform', 'chain'] as const

function optionalUnixTimestamp(query: ApiQuery, name: 'start' | 'end'): string | null | undefined {
	const value = queryString(query, name)
	if (value === undefined) return undefined
	return /^\d+$/.test(value) ? value : null
}

export function buildRWAFlowProxyUrl(query: ApiQuery): string | null {
	const path = query.path
	if (!Array.isArray(path)) return null

	if (path.length === 1 && path[0] === 'overview') {
		const splitBy = queryString(query, 'splitBy')
		if (splitBy !== undefined && !OVERVIEW_SPLITS.has(splitBy as RWAFlowOverviewSplitBy)) return null
		const includeStablecoin = queryString(query, 'includeStablecoin')
		const includeGovernance = queryString(query, 'includeGovernance')
		if (
			(includeStablecoin !== undefined && includeStablecoin !== 'true' && includeStablecoin !== 'false') ||
			(includeGovernance !== undefined && includeGovernance !== 'true' && includeGovernance !== 'false')
		) {
			return null
		}
		const searchParams = new URLSearchParams()
		if (splitBy) searchParams.set('splitBy', splitBy)
		if (includeStablecoin !== undefined) searchParams.set('includeStablecoin', includeStablecoin)
		if (includeGovernance !== undefined) searchParams.set('includeGovernance', includeGovernance)
		const qs = searchParams.toString()
		return `${RWA_SERVER_URL}/flows/overview${qs ? `?${qs}` : ''}`
	}

	if (path.length === 1 && path[0] === 'summary') return `${RWA_SERVER_URL}/flows/summary`
	if (path.length === 1 && path[0] === 'asset-breakdown') return `${RWA_SERVER_URL}/flows/asset-breakdown`
	if (
		path.length === 3 &&
		path[0] === 'asset-breakdown' &&
		ASSET_BREAKDOWN_SCOPES.includes(path[1] as (typeof ASSET_BREAKDOWN_SCOPES)[number]) &&
		path[2]
	) {
		return `${RWA_SERVER_URL}/flows/asset-breakdown/${path[1]}/${encodeURIComponent(path[2])}`
	}

	if (path.length !== 2 || !FLOW_SCOPES.includes(path[0] as (typeof FLOW_SCOPES)[number]) || !path[1]) return null

	const [scope, value] = path
	if (scope !== 'asset') return `${RWA_SERVER_URL}/flows/${scope}/${encodeURIComponent(value)}`

	const start = optionalUnixTimestamp(query, 'start')
	const end = optionalUnixTimestamp(query, 'end')
	const withMcap = queryString(query, 'withMcap')
	if (start === null || end === null || (withMcap !== undefined && withMcap !== 'true' && withMcap !== 'false')) {
		return null
	}

	const searchParams = new URLSearchParams()
	if (start !== undefined) searchParams.set('start', start)
	if (end !== undefined) searchParams.set('end', end)
	if (withMcap === 'true') searchParams.set('withMcap', 'true')
	const qs = searchParams.toString()
	return `${RWA_SERVER_URL}/flows/${encodeURIComponent(value)}${qs ? `?${qs}` : ''}`
}

export const rwaFlowsProxy = proxyJsonRoute({
	route: '/api/public/rwa/flows/[...path]',
	cacheControl: RWA_FLOW_CACHE_CONTROL,
	resultTtlMs: RWA_FLOW_RESULT_TTL_MS,
	upstreamUrl: (req) => buildRWAFlowProxyUrl(req.query) ?? badRequest('Invalid RWA flow request'),
	upstreamErrorMessage: 'Failed to fetch upstream RWA flow data'
})
