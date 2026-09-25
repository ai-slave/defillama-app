import { describe, expect, test } from 'vitest'
import { MARKETS_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()

describe('master Exchanges upstream', () => {
	test('uses only current master cache-file paths', async () => {
		const upstream = await import('../server/master.upstream')
		const cases = [
			[upstream.fetchMasterDirectoryFromNetwork, `${MARKETS_SERVER_URL}/exchanges/directory.json`],
			[() => upstream.fetchMasterExchangeSeriesFromNetwork('1y'), `${MARKETS_SERVER_URL}/exchanges/series/1y.json`],
			[
				() => upstream.fetchMasterExchangeHistoryFromNetwork('binance', '30d'),
				`${MARKETS_SERVER_URL}/exchanges/binance/series/30d.json`
			],
			[
				() => upstream.fetchMasterExchangeIndexFromNetwork('binance'),
				`${MARKETS_SERVER_URL}/exchanges/binance/index.json`
			],
			[
				() => upstream.fetchMasterExchangeMetadataFromNetwork('binance'),
				`${MARKETS_SERVER_URL}/exchanges/binance/metadata.json`
			],
			[upstream.fetchMasterExchangeRegionCatalogFromNetwork, `${MARKETS_SERVER_URL}/exchanges/regions.json`],
			[
				() => upstream.fetchMasterExchangeRegionManifestFromNetwork('binance'),
				`${MARKETS_SERVER_URL}/exchanges/binance/metadata/regions.json`
			],
			[
				() => upstream.fetchMasterExchangeRegionalMetadataFromNetwork('binance', 'eea'),
				`${MARKETS_SERVER_URL}/exchanges/binance/metadata/eea.json`
			],
			[upstream.fetchMasterMicaFromNetwork, `${MARKETS_SERVER_URL}/exchanges/mica.json`],
			[() => upstream.fetchMasterChartFromNetwork('volume', 'all'), `${MARKETS_SERVER_URL}/charts/volume/all.json`]
		] as const

		for (const [fetcher, expectedUrl] of cases) {
			http.serve({ [expectedUrl]: null })
			await fetcher()

			expect(http.urls().at(-1)).toBe(expectedUrl)
		}
	})
})
