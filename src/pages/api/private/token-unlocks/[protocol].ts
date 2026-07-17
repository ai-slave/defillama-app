import type { NextApiRequest, NextApiResponse } from 'next'
import { getProtocolEmissons, isEmptyProtocolEmissionResult } from '~/containers/Unlocks/queries'
import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'
import { slug } from '~/utils'

async function handler(req: NextApiRequest, res: NextApiResponse) {
	const protocol = typeof req.query.protocol === 'string' ? req.query.protocol : ''
	if (!protocol) {
		return res.status(400).json({ error: 'Missing protocol parameter' })
	}

	const [metadataModule, { resolveProtocolParamFromMetadata }] = await Promise.all([
		import('~/utils/metadata'),
		import('~/containers/ProtocolOverview/server/routes')
	])
	const { emissionsProtocolBySlug } = metadataModule.default
	// Protocol routes first (handles aliases → canonical slug), then equities
	// unlocks, which are keyed in the emissions list directly by lowercased ticker.
	let emissionsSlug: string | null = null
	const protocolRoute = resolveProtocolParamFromMetadata(protocol, metadataModule.default)
	const normalizedSlug = slug(protocol)
	if (protocolRoute && emissionsProtocolBySlug[protocolRoute.canonicalSlug]) {
		emissionsSlug = protocolRoute.canonicalSlug
	} else if (emissionsProtocolBySlug[normalizedSlug]) {
		emissionsSlug = normalizedSlug
	}
	if (!emissionsSlug) {
		return res.status(404).json({ error: 'Protocol emissions not found' })
	}

	metadataModule.refreshMetadataInBackgroundIfStale('token_unlocks_api')
	const data = await getProtocolEmissons(emissionsSlug, {
		skipAvailabilityCheck: true,
		tokenlist: metadataModule.default.tokenlist
	})
	if (isEmptyProtocolEmissionResult(data)) {
		return res.status(404).json({ error: 'Protocol emissions not found' })
	}
	return res.status(200).json(data)
}

export default withSubscriptionJsonRoute({
	route: '/api/private/token-unlocks/[protocol]',
	errorMessage: 'Internal server error',
	handler
})
