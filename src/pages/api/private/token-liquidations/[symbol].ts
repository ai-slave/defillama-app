import { withSubscriptionJsonRoute } from '~/server/api/withSubscriptionJsonRoute'

export const config = {
	api: {
		responseLimit: false
	}
}

export default withSubscriptionJsonRoute<{ symbol: string }>({
	route: '/api/private/token-liquidations/[symbol]',
	errorMessage: 'Failed to fetch token liquidations data',
	getRouteParams(req, res) {
		const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : ''
		if (!symbol) {
			res.status(400).json({ error: 'Missing symbol parameter' })
			return null
		}
		return { symbol }
	},
	async handler(_req, res, { symbol }) {
		const metadataModule = await import('~/utils/metadata')

		if (!metadataModule.default.liquidationsTokenSymbolsSet.has(symbol)) {
			return res.status(404).json({ error: 'Token liquidations not found' })
		}

		const metadataCache = {
			chainMetadata: metadataModule.default.chainMetadata,
			protocolMetadata: metadataModule.default.protocolMetadata
		}
		const { getTokenLiquidationsSectionData } = await import('~/containers/LiquidationsV2/server/dataset.server')
		const data = await getTokenLiquidationsSectionData(symbol, metadataCache)

		if (!data) {
			return res.status(404).json({ error: 'Token liquidations not found' })
		}

		return res.status(200).json(data)
	}
})
