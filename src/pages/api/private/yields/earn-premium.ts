import type { NextApiRequest, NextApiResponse } from 'next'
import { getEarnPage } from '~/containers/Yields/data/earn.server'
import { acquireYieldsSnapshot } from '~/containers/Yields/server/dataset.server'
import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'

async function handler(req: NextApiRequest, res: NextApiResponse) {
	const page = await getEarnPage(await acquireYieldsSnapshot('background'), req.query)
	return res.status(200).json(page)
}

export const config = {
	api: {
		responseLimit: false
	}
}

export default withSubscriptionJsonRoute({
	route: '/api/private/yields/earn-premium',
	errorMessage: 'Failed to fetch yields earn data',
	handler
})
