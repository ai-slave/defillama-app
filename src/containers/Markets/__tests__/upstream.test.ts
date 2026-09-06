import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	marketsServerUrl: 'https://markets.example.com'
}))

vi.mock('~/constants', () => ({
	get MARKETS_SERVER_URL() {
		return mocks.marketsServerUrl
	}
}))

vi.mock('~/utils/async', () => ({
	fetchJson: mocks.fetchJson
}))

beforeEach(() => {
	mocks.fetchJson.mockReset()
	mocks.fetchJson.mockResolvedValue(null)
})

describe('shared markets upstream data', () => {
	test('requests the token markets list', async () => {
		const upstream = await import('../server/upstream')

		await upstream.fetchTokenMarketsListFromNetwork()

		expect(mocks.fetchJson).toHaveBeenCalledWith('https://markets.example.com/tokens/list.json')
	})

	test('requests canonical token exchange listings', async () => {
		const upstream = await import('../server/upstream')

		await upstream.fetchTokenExchangeListingsFromNetwork()

		expect(mocks.fetchJson).toHaveBeenCalledWith('https://markets.example.com/tokens/exchange-listings.json')
	})

	test('requests the exchange directory used by CEX and exchange routes', async () => {
		const upstream = await import('../server/upstream')

		await upstream.fetchExchangeDirectoryFromNetwork()

		expect(mocks.fetchJson).toHaveBeenCalledWith('https://markets.example.com/exchanges/directory.json')
	})
})
