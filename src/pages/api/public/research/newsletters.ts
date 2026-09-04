import type { NextApiRequest, NextApiResponse } from 'next'
import type { ResearchNewsletterListResponse } from '~/containers/Articles/newsletterFeed'
import {
	getResearchNewsletterArchiveItems,
	searchResearchNewsletterItems
} from '~/containers/Articles/newsletterFeed.server'
import { jitterCacheControlHeader } from '~/utils/maxAgeForNext'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const MAX_QUERY_LENGTH = 200

type ResponseData = ResearchNewsletterListResponse | { error: string }

function getQueryParam(value: string | string[] | undefined): string {
	if (Array.isArray(value)) return value[0] ?? ''
	return value ?? ''
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const query = getQueryParam(req.query.query).trim().slice(0, MAX_QUERY_LENGTH)
	const requestedLimit = Number.parseInt(getQueryParam(req.query.limit), 10)
	const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT

	try {
		const items = await getResearchNewsletterArchiveItems()
		res.setHeader(
			'Cache-Control',
			jitterCacheControlHeader('public, s-maxage=300, stale-while-revalidate=3600', req.url ?? query)
		)
		return res.status(200).json(searchResearchNewsletterItems(items, query, limit))
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		return res.status(502).json({ error: 'Newsletter search is temporarily unavailable' })
	}
}

export default withApiRouteTelemetry('/api/public/research/newsletters', handler)
