import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchDashboardConfig } from '~/containers/ProDashboard/queries.server'
import { getProTokenUsageQueryKey, normalizeProTokenSymbols } from '~/containers/ProDashboard/tableQueryKeys'
import { buildTokenUsageSourcePlan } from '~/containers/ProDashboard/tokenUsageSourcePlan'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'
import { toRawArrayParam } from '~/utils/routerQuery'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'
import { fetchProTokenUsageData } from './tableQueries'

const MAX_TOKEN_SYMBOLS = 4

export function parseTokenUsageQuery(query: NextApiRequest['query']): {
	tokenSymbols: string[]
	includeCex: boolean
} | null {
	const rawTokenSymbols = toRawArrayParam(query['symbols[]'])
	if (rawTokenSymbols.length === 0 || rawTokenSymbols.length > MAX_TOKEN_SYMBOLS) return null

	const tokenSymbols = normalizeProTokenSymbols(rawTokenSymbols)
	if (tokenSymbols.length === 0) return null

	const includeCex = query.includeCex
	if (Array.isArray(includeCex) || (includeCex !== undefined && includeCex !== 'true' && includeCex !== 'false')) {
		return null
	}

	return { tokenSymbols, includeCex: includeCex === 'true' }
}

export const tokenUsageApiHandler = withSubscriptionJsonRoute<{
	tokenSymbols: string[]
	includeCex: boolean
}>({
	route: '/api/dynamic/pro-dashboard/token-usage',
	errorMessage: 'Failed to load token usage data',
	getRouteParams: (req, res) => {
		const parsed = parseTokenUsageQuery(req.query)
		if (parsed) return parsed
		res.status(400).json({ error: 'Invalid token usage query' })
		return null
	},
	handler: async (_req: NextApiRequest, res: NextApiResponse<ProtocolTokenUsageData[]>, parsed) => {
		const data = await fetchProTokenUsageData(parsed.tokenSymbols, parsed.includeCex)
		return res.status(200).json(data)
	}
})

export async function publicDashboardTokenUsageHandler(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader('Cache-Control', 'private, no-store')
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const parsed = parseTokenUsageQuery(req.query)
	const dashboardId = Array.isArray(req.query.dashboardId) ? req.query.dashboardId[0] : req.query.dashboardId
	if (!parsed || !dashboardId || dashboardId.length > 200) {
		return res.status(400).json({ error: 'Invalid public dashboard token usage query' })
	}

	try {
		const dashboard = await fetchDashboardConfig(dashboardId, null)
		const requestedCacheKey = JSON.stringify(getProTokenUsageQueryKey(parsed.tokenSymbols, parsed.includeCex))
		const hasPublicCapability =
			dashboard?.visibility === 'public' &&
			buildTokenUsageSourcePlan(dashboard.data.items).some((source) => source.cacheKey === requestedCacheKey)
		if (!hasPublicCapability) return res.status(403).json({ error: 'Token usage query is not public' })

		const data = await fetchProTokenUsageData(parsed.tokenSymbols, parsed.includeCex)
		res.setHeader('Cache-Control', 'public, max-age=300')
		return res.status(200).json(data)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		return res.status(500).json({ error: 'Failed to load public dashboard token usage data' })
	}
}

export const publicDashboardTokenUsageApiHandler = withApiRouteTelemetry(
	'/api/public/pro-dashboard/dashboard-token-usage',
	publicDashboardTokenUsageHandler
)
