import { expect, test } from 'vitest'
import { DATASETS_SERVER_URL, LIQUIDATIONS_SERVER_URL_V2 } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installSnapshotDirectory } from '~/utils/testing/snapshotDirectory'
const http = installFixtureFetch()
installSnapshotDirectory('liquidations-index-test')

test('reads protocol chain membership for the sitemap from one published generation', async () => {
	http.serve({
		[`${LIQUIDATIONS_SERVER_URL_V2}/protocols`]: { protocols: ['aave', 'compound'] },
		[`${LIQUIDATIONS_SERVER_URL_V2}/all`]: {
			timestamp: 1,
			data: { aave: { ethereum: [], arbitrum: [] }, compound: { base: [] } }
		},
		[`${DATASETS_SERVER_URL}/blockExplorers.json`]: {}
	})
	const { fileDatasetSnapshotStore } = await import('~/server/datasetSnapshots/fileStore.server')
	const { buildLiquidationsDomain } = await import('../server/dataset.builder.server')
	await fileDatasetSnapshotStore.publish('liquidations', buildLiquidationsDomain)
	const api = await import('../server/dataset.server')
	expect(await api.getLiquidationsSitemapProtocolChains()).toEqual([
		{ protocolId: 'aave', chainIds: ['ethereum', 'arbitrum'] },
		{ protocolId: 'compound', chainIds: ['base'] }
	])
	expect(http.requests).toHaveLength(3)
})
