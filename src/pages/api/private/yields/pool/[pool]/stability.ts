import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchPoolDetail, isNotFoundError } from '~/containers/Yields/poolDetail/fetch'
import { getPoolStability } from '~/containers/Yields/poolDetail/stability'
import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'

async function handler(req: NextApiRequest, res: NextApiResponse) {
	const pool = typeof req.query.pool === 'string' ? req.query.pool : ''
	if (!pool) return res.status(400).json({ error: 'Missing pool parameter' })

	try {
		return res.status(200).json({ stability: getPoolStability(await fetchPoolDetail(pool)) })
	} catch (error) {
		if (isNotFoundError(error)) return res.status(404).json({ error: 'Pool not found' })
		throw error
	}
}

export default withSubscriptionJsonRoute({
	route: '/api/private/yields/pool/[pool]/stability',
	errorMessage: 'Failed to fetch pool stability',
	handler
})
