import type { NextApiRequest, NextApiResponse } from 'next'
import { protocolListsApi } from '~/containers/ProtocolLists/server/api'
import { toNextHandler } from '~/server/api/nextAdapter'
import { withApiRouteTelemetry } from '~/utils/telemetry'

const jsonHandler = toNextHandler(protocolListsApi)
export const config = { api: { responseLimit: false } }
async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.query.csv !== 'true' || req.method !== 'GET') return jsonHandler(req, res)
	res.setHeader('Cache-Control', 'no-store')
	const result = await protocolListsApi.handle({
		method: 'GET',
		url: req.url ?? '',
		query: req.query,
		headers: req.headers
	})
	for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, value)
	return res.status(result.status).send('body' in result ? result.body : result.serializedJson)
}
export default withApiRouteTelemetry('/api/public/protocol-lists', handler)
