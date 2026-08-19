import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchJson } from '~/utils/async'

const BASE = process.env.IR_SERVER_URL
// One fetchFn per dashboard tab on the ir-server, plus metadata and the isolated
// liquidity-segments series.
const ALLOWED = new Set([
	'metadata',
	'overview',
	'liquidity',
	'liquiditySegments',
	'economics',
	'security',
	'integrations',
	'assets'
])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	const tab = String(req.query.tab || '')
	if (!ALLOWED.has(tab)) return res.status(404).json({ error: 'Unknown tab' })

	try {
		const data = await fetchJson(`${BASE}/api/uniswap/${tab}`, { timeout: 60_000 })
		res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
		return res.status(200).json(data)
	} catch (error) {
		console.error(`Uniswap proxy error (${tab}):`, error)
		return res.status(502).json({ error: 'Failed to fetch upstream data' })
	}
}
