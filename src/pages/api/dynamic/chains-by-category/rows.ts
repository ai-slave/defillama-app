import type { NextApiRequest, NextApiResponse } from 'next'
import { getChainsByCategory } from '~/containers/ChainsByCategory/queries'
import type { IChainsByCategoryData } from '~/containers/ChainsByCategory/types'
import { cachedResult } from '~/server/api/resultCache'
import metadataCache from '~/utils/metadata'
import { withApiRouteTelemetry } from '~/utils/telemetry'

/**
 * Resolve full chain rows (with sampled charts) for an explicit list of chain
 * names — the watchlist's chains tab. Mirrors /api/dynamic/protocol-rankings/rows:
 * the saved set lives client-side, so the page ships only chain names in its
 * ISR props and asks for the rows the reader saved.
 */

const MAX_WATCHED_CHAINS = 200

async function loadAllChains(): Promise<IChainsByCategoryData['chains']> {
	const data = await cachedResult(
		'chains-by-category-rows',
		'all',
		{ ttlMs: 5 * 60 * 1000, maxEntries: 1, maxBytes: 64 * 1024 * 1024 },
		() =>
			getChainsByCategory({
				chainMetadata: metadataCache.chainMetadata,
				category: 'All',
				sampledChart: true
			}),
		(value) => Buffer.byteLength(JSON.stringify(value))
	)
	return data.chains
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader('Cache-Control', 'no-store')
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST')
		return res.status(405).json({ error: 'Method not allowed' })
	}
	const { names } = (req.body ?? {}) as { names?: unknown }
	if (!Array.isArray(names) || names.length > MAX_WATCHED_CHAINS || names.some((name) => typeof name !== 'string')) {
		return res.status(400).json({ error: 'Invalid rows request' })
	}
	if (names.length === 0) return res.status(200).json({ rows: [] })

	const wanted = new Set(names as Array<string>)
	const chains = await loadAllChains()
	return res.status(200).json({ rows: chains.filter((chain) => wanted.has(chain.name)) })
}

export default withApiRouteTelemetry('/api/dynamic/chains-by-category/rows', handler)
