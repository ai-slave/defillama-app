import type { NextApiRequest, NextApiResponse } from 'next'
import { normalizeProTokenSymbols } from '~/containers/ProDashboard/tableQueryKeys'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { toRawArrayParam } from '~/utils/routerQuery'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'
import { fetchProTokenUsageData } from './tableQueries'

const MAX_TOKEN_SYMBOLS = 4

type TokenUsageResponse = ProtocolTokenUsageData[] | { error: string }

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

export async function tokenUsageHandler(req: NextApiRequest, res: NextApiResponse<TokenUsageResponse>) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const parsed = parseTokenUsageQuery(req.query)
	if (!parsed) return res.status(400).json({ error: 'Invalid token usage query' })

	try {
		const data = await fetchProTokenUsageData(parsed.tokenSymbols, parsed.includeCex)
		res.setHeader('Cache-Control', 'public, max-age=300')
		return res.status(200).json(data)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		return res.status(500).json({ error: 'Failed to load token usage data' })
	}
}

export const tokenUsageApiHandler = withApiRouteTelemetry('/api/dynamic/pro-dashboard/token-usage', tokenUsageHandler)
