import type { NextApiRequest, NextApiResponse } from 'next'
import { FEATURES_SERVER } from '~/constants'
import { scheduleResearchCacheUpdate, type ScheduledResearchCacheUpdate } from '~/server/researchCacheInvalidation'
import { withApiRouteTelemetry } from '~/utils/telemetry'

type ResponseData = ScheduledResearchCacheUpdate | { error: string }

function articleUrl(path: string) {
	return `${FEATURES_SERVER.replace(/\/$/, '')}${path}`
}

function authorizationHeader(req: NextApiRequest): Record<string, string> {
	const header = req.headers.authorization
	if (Array.isArray(header)) {
		const first = header.find(Boolean)
		return first ? { Authorization: first } : {}
	}
	return header ? { Authorization: header } : {}
}

function parseJsonObject(body: string): ResponseData | null {
	try {
		const payload = JSON.parse(body)
		return payload && typeof payload === 'object' ? (payload as ResponseData) : null
	} catch {
		return null
	}
}

async function sendBackendResponse(response: Response, res: NextApiResponse<ResponseData>) {
	const body = await response.text()
	if (body) {
		const payload = parseJsonObject(body)
		if (payload) return res.status(response.status).json(payload)
	}

	return res.status(response.status).json({ error: body || response.statusText || 'Article request failed' })
}

export async function researchLandingRevalidateHandler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	res.setHeader('Cache-Control', 'private, no-store, max-age=0')

	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const headers = authorizationHeader(req)
	if (!headers.Authorization) {
		return res.status(401).json({ error: 'Unauthorized' })
	}

	const authCheck = await fetch(articleUrl('/articles/mine?limit=1'), { headers })
	if (!authCheck.ok) {
		return sendBackendResponse(authCheck, res)
	}

	const cache = scheduleResearchCacheUpdate({ purgePaths: ['/research'], revalidatePaths: ['/research'] }, (path) =>
		res.revalidate(path)
	)

	return res.status(200).json(cache)
}

export default withApiRouteTelemetry('/api/private/research/revalidate-landing', researchLandingRevalidateHandler)
