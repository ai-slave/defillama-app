import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	marketsServerUrl: 'https://markets.example.com'
}))

vi.mock('~/constants', () => ({
	get MARKETS_SERVER_URL() {
		return mocks.marketsServerUrl
	}
}))

vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))

beforeEach(() => {
	mocks.fetchJson.mockReset()
	mocks.fetchJson.mockResolvedValue(null)
})

describe('master Exchanges upstream', () => {
	it('uses only current master cache-file paths', async () => {
		const upstream = await import('../server/master.upstream')
		const cases = [
			[upstream.fetchMasterDirectoryFromNetwork, 'https://markets.example.com/exchanges/directory.json'],
			[
				() => upstream.fetchMasterExchangeSeriesFromNetwork('1y'),
				'https://markets.example.com/exchanges/series/1y.json'
			],
			[
				() => upstream.fetchMasterExchangeHistoryFromNetwork('binance', '30d'),
				'https://markets.example.com/exchanges/binance/series/30d.json'
			],
			[
				() => upstream.fetchMasterExchangeIndexFromNetwork('binance'),
				'https://markets.example.com/exchanges/binance/index.json'
			],
			[
				() => upstream.fetchMasterExchangeMetadataFromNetwork('binance'),
				'https://markets.example.com/exchanges/binance/metadata.json'
			],
			[upstream.fetchMasterExchangeRegionCatalogFromNetwork, 'https://markets.example.com/exchanges/regions.json'],
			[
				() => upstream.fetchMasterExchangeRegionManifestFromNetwork('binance'),
				'https://markets.example.com/exchanges/binance/metadata/regions.json'
			],
			[
				() => upstream.fetchMasterExchangeRegionalMetadataFromNetwork('binance', 'eea'),
				'https://markets.example.com/exchanges/binance/metadata/eea.json'
			],
			[upstream.fetchMasterMicaFromNetwork, 'https://markets.example.com/exchanges/mica.json'],
			[
				() => upstream.fetchMasterChartFromNetwork('volume', 'all'),
				'https://markets.example.com/charts/volume/all.json'
			]
		] as const

		for (const [fetcher, expectedUrl] of cases) {
			mocks.fetchJson.mockClear()
			await fetcher()
			expect(mocks.fetchJson).toHaveBeenCalledOnce()
			expect(mocks.fetchJson).toHaveBeenCalledWith(expectedUrl)
		}
	})
})
