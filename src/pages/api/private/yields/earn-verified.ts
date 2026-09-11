import type { NextApiRequest, NextApiResponse } from 'next'
import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'

/**
 * The earn table as a subscriber sees it. Returns the WHOLE page rather than a patch of measured
 * values: the measurement is the headline, so it changes the sort order, the APY filters and the
 * median, and a client-side merge would leave the rows ordered on something else.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
	const [{ getEarnPage }, { acquireYieldsSnapshot }] = await Promise.all([
		import('~/containers/Yields/data/earn.server'),
		import('~/containers/Yields/server/dataset.server')
	])
	const page = await getEarnPage(await acquireYieldsSnapshot('background'), req.query, { verifiedAccess: true })
	return res.status(200).json(page)
}

export default withSubscriptionJsonRoute({
	route: '/api/private/yields/earn-verified',
	errorMessage: 'Failed to fetch yields earn data',
	handler
})
