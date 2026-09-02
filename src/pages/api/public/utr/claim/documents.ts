import type { NextApiRequest, NextApiResponse } from 'next'
import {
	getUtrClaimUpstreamConfig,
	mapUtrClaimUpstreamResponse
} from '~/containers/UniversalTokenRating/server/claimProxy'
import { recordRouteRuntimeError } from '~/utils/telemetry'

export const config = {
	api: {
		bodyParser: false,
		responseLimit: false
	}
}

const MAX_UPLOAD_BYTES = 105 * 1024 * 1024

function sendJson(res: NextApiResponse, status: number, body: unknown) {
	res.setHeader('Cache-Control', 'no-store')
	return res.status(status).json(body)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST')
		return sendJson(res, 405, { error: 'Method not allowed' })
	}
	const contentType = req.headers['content-type']
	if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('multipart/form-data;')) {
		return sendJson(res, 400, { error: 'Expected multipart/form-data with file parts' })
	}
	const contentLength = req.headers['content-length']
	if (typeof contentLength !== 'string') return sendJson(res, 411, { error: 'Content-Length is required' })
	const contentBytes = Number(contentLength)
	if (!Number.isSafeInteger(contentBytes) || contentBytes <= 0) {
		return sendJson(res, 400, { error: 'Invalid Content-Length' })
	}
	if (contentBytes > MAX_UPLOAD_BYTES) return sendJson(res, 413, { error: 'Upload is too large' })

	const upstreamConfig = getUtrClaimUpstreamConfig()
	if (!upstreamConfig) return sendJson(res, 502, { error: 'Claim service is not configured' })

	try {
		const upstream = await fetch(`${upstreamConfig.baseUrl}/utr/claim/documents`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${upstreamConfig.apiKey}`,
				'Content-Type': contentType,
				'Content-Length': contentLength
			},
			body: req as unknown as BodyInit,
			duplex: 'half',
			signal: AbortSignal.timeout(120_000)
		} as RequestInit & { duplex: 'half' })
		const result = await mapUtrClaimUpstreamResponse(upstream)
		return sendJson(res, result.status, result.body)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		return sendJson(res, 502, { error: 'Failed to upload supporting documents' })
	}
}
