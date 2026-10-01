import type { NextApiRequest, NextApiResponse } from 'next'
import { getPoolHistoryRange, slicePoolHistory } from '~/containers/Yields/poolDetail/queryState'
import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'

/**
 * The measured half of `/yields/pool/[pool]`, for a subscriber. The page itself is publicly cached
 * so its props are always redacted; this rebuilds them with the same builders and the browser swaps
 * them in. Reads through the page's own server-side memo, so a subscriber's page costs one fetch.
 */
export async function handler(req: NextApiRequest, res: NextApiResponse) {
	const id = typeof req.query.id === 'string' ? req.query.id : ''
	if (!id) return res.status(400).json({ error: 'Missing pool id' })

	const [{ isNotFoundError }, { fetchPoolDetailCached, fetchPoolHistoryCached }, { buildPoolVerifiedProps }] =
		await Promise.all([
			import('~/containers/Yields/poolDetail/fetch'),
			import('~/containers/Yields/poolDetail/fetch.server'),
			import('~/containers/Yields/poolDetail/verifiedProps')
		])

	// Exit reliability aggregates the full history. Ranges nest, so max can also serve the visible
	// range locally instead of issuing two upstream requests.
	const range = getPoolHistoryRange(req.query.range)
	let pool
	try {
		pool = await fetchPoolDetailCached(id, true)
	} catch (error) {
		if (isNotFoundError(error)) return res.status(404).json({ error: 'Pool not found' })
		throw error
	}
	if (!pool.verified) return res.status(200).json({ verified: null })

	const available = pool.available_history ?? { supply: true, borrow: false }
	const sourceId = pool.intrinsic?.source_pool.id
	const [maxHistory, sourceVerified, sourceHistory] = await Promise.all([
		available.supply ? fetchPoolHistoryCached(id, 'max', true) : null,
		// A missing or unmeasured source pool leaves the intrinsic leg reported, as in the table.
		sourceId
			? fetchPoolDetailCached(sourceId, true).then(
					(source) => source.verified ?? null,
					() => null
				)
			: null,
		// Always max: the asset band rebases to whatever day the reader picks, so a narrower fetch
		// would lose its basis the moment they moved the deposit.
		sourceId ? fetchPoolHistoryCached(sourceId, 'max', true).catch(() => null) : null
	])
	const history = maxHistory ? slicePoolHistory(maxHistory, range) : null

	return res
		.status(200)
		.json(
			buildPoolVerifiedProps({ pool, history, fullHistory: maxHistory, sourceVerified, sourceHistory, now: Date.now() })
		)
}

export default withSubscriptionJsonRoute({
	route: '/api/private/yields/pool/[id]',
	errorMessage: 'Failed to fetch verified pool data',
	handler
})
