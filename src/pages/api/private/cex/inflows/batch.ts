import type { NextApiRequest, NextApiResponse } from 'next'
import { SERVER_URL } from '~/constants'
import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'
import { fetchWithPoolingOnServer } from '~/utils/http-client'

type CexInflowsBatchRequest = {
	cexs?: unknown
	start?: unknown
	end?: unknown
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
		return res.status(400).json({ error: 'Request body must be an object' })
	}
	const body = req.body as CexInflowsBatchRequest
	const startNum = Number(body.start)
	const endNum = Number(body.end)
	if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) {
		return res.status(400).json({ error: 'start and end must be valid numbers' })
	}
	if (!(startNum < endNum - 3600)) {
		return res.status(400).json({ error: 'end must be more than one hour after start' })
	}

	if (!Array.isArray(body.cexs) || body.cexs.length === 0) {
		return res.status(400).json({ error: 'cexs must be a non-empty array' })
	}
	if (body.cexs.length > 100) {
		return res.status(413).json({ error: 'cexs must contain at most 100 entries' })
	}

	const cexRequests: Array<{ cexProtocolSlug: string; tokensToExclude: string[] }> = []
	for (const cex of body.cexs) {
		if (!cex || typeof cex !== 'object') {
			return res.status(400).json({ error: 'cexs must include protocol slugs and token exclusions' })
		}
		const { cexProtocolSlug, tokensToExclude } = cex as {
			cexProtocolSlug?: unknown
			tokensToExclude?: unknown
		}
		if (typeof cexProtocolSlug !== 'string' || !cexProtocolSlug) {
			return res.status(400).json({ error: 'cexs must include protocol slugs and token exclusions' })
		}
		if (!Array.isArray(tokensToExclude) || tokensToExclude.some((token) => typeof token !== 'string')) {
			return res.status(400).json({ error: 'tokensToExclude must be string arrays' })
		}
		cexRequests.push({ cexProtocolSlug, tokensToExclude })
	}

	const [{ default: metadataCache }, { resolveCexParamFromMetadata }] = await Promise.all([
		import('~/utils/metadata'),
		import('~/containers/Cexs/server/routes')
	])
	const protocols: Array<{ protocol: string; tokensToExclude: string[] }> = []
	const seenProtocolIds = new Set<string>()
	for (const cex of cexRequests) {
		const cexRoute = resolveCexParamFromMetadata(cex.cexProtocolSlug, metadataCache)
		if (!cexRoute) {
			return res.status(404).json({ error: 'CEX not found' })
		}
		if (seenProtocolIds.has(cexRoute.id)) {
			return res.status(400).json({ error: `Duplicate CEX: ${cex.cexProtocolSlug}` })
		}
		seenProtocolIds.add(cexRoute.id)

		protocols.push({
			protocol: cexRoute.canonicalSlug,
			tokensToExclude: cex.tokensToExclude
		})
	}

	const upstream = await fetchWithPoolingOnServer(`${SERVER_URL}/inflows/batch`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			protocols,
			startTimestamp: startNum,
			endTimestamp: endNum
		})
	})

	if (!upstream.ok) {
		return res.status(upstream.status).json({ error: `Upstream API returned ${upstream.status}` })
	}

	const data = await upstream.json()
	return res.status(200).json(data)
}

export default withSubscriptionJsonRoute({
	route: '/api/private/cex/inflows/batch',
	method: 'POST',
	errorMessage: 'Internal server error',
	handler
})
