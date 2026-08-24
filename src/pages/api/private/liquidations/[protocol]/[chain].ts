import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'

export const config = {
	api: {
		responseLimit: false
	}
}

export default withSubscriptionJsonRoute<{ protocol: string; chain: string }>({
	route: '/api/private/liquidations/[protocol]/[chain]',
	errorMessage: 'Failed to fetch liquidations chain data',
	getRouteParams(req, res) {
		const protocol = typeof req.query.protocol === 'string' ? req.query.protocol : ''
		const chain = typeof req.query.chain === 'string' ? req.query.chain : ''

		if (!protocol || !chain) {
			res.status(400).json({ error: 'Missing protocol or chain parameter' })
			return null
		}

		return { protocol, chain }
	},
	async handler(_req, res, { protocol, chain }) {
		const [{ getLiquidationsChainPageData }, { default: metadataCache }] = await Promise.all([
			import('~/containers/LiquidationsV2/server/dataset.server'),
			import('~/utils/metadata')
		])
		const data = await getLiquidationsChainPageData(protocol, chain, {
			chainMetadata: metadataCache.chainMetadata,
			protocolMetadata: metadataCache.protocolMetadata
		})

		if (!data) {
			return res.status(404).json({ error: 'Liquidations chain not found' })
		}

		return res.status(200).json(data)
	}
})
