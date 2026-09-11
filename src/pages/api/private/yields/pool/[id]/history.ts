import type { NextApiRequest, NextApiResponse } from 'next'
import { getPoolHistoryRange } from '~/containers/Yields/poolDetail/queryState'
import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'

/**
 * A pool's measured history, unredacted, for a subscriber. Without it a paying reader would watch
 * the measured chart series vanish the moment they widened the range, since the proxy is redacted
 * for everyone. Shaped as `{ data }` to match the proxy so the fetchers differ only in their URL.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
	const id = typeof req.query.id === 'string' ? req.query.id : ''
	if (!id) return res.status(400).json({ error: 'Missing pool id' })

	const [{ isNotFoundError }, { fetchPoolHistoryCached }] = await Promise.all([
		import('~/containers/Yields/poolDetail/fetch'),
		import('~/containers/Yields/poolDetail/fetch.server')
	])
	try {
		return res.status(200).json({ data: await fetchPoolHistoryCached(id, getPoolHistoryRange(req.query.range), true) })
	} catch (error) {
		if (isNotFoundError(error)) return res.status(404).json({ error: 'Pool history not found' })
		throw error
	}
}

export default withSubscriptionJsonRoute({
	route: '/api/private/yields/pool/[id]/history',
	errorMessage: 'Failed to fetch verified pool history',
	handler
})
