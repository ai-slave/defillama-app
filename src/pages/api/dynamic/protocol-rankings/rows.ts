import type { NextApiRequest, NextApiResponse } from 'next'
import { loadProtocolRankingSnapshot } from '~/containers/ProtocolRankings/server/api'
import { withApiRouteTelemetry } from '~/utils/telemetry'

/**
 * Resolve full ranking rows for an explicit list of protocol names — the
 * watchlist's data source. The saved set lives client-side, so the page ships
 * no protocol rows in its ISR props and asks for exactly the ones the reader
 * saved. POST because a large watchlist does not fit in a URL.
 *
 * Matching mirrors the watchlist's own predicate: a parent row is returned
 * when its name or any child protocol's name is watched, children intact.
 */

const MAX_WATCHED_PROTOCOLS = 500

type RowsBody = { names?: unknown }

async function handler(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST')
		return res.status(405).json({ error: 'Method not allowed' })
	}
	const { names } = (req.body ?? {}) as RowsBody
	if (!Array.isArray(names) || names.length > MAX_WATCHED_PROTOCOLS || names.some((name) => typeof name !== 'string')) {
		return res.status(400).json({ error: 'Invalid rows request' })
	}

	const wanted = new Set(names as string[])
	const { snapshot } = await loadProtocolRankingSnapshot('All', null)
	const rows =
		wanted.size === 0
			? []
			: snapshot.protocols.filter(
					(protocol) => wanted.has(protocol.name) || protocol.childProtocols?.some((child) => wanted.has(child.name))
				)

	return res.status(200).json({ rows, snapshot: snapshot.snapshot })
}

export default withApiRouteTelemetry('/api/dynamic/protocol-rankings/rows', handler)
