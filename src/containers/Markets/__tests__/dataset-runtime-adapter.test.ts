import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readJson: vi.fn() }))

vi.mock('~/server/datasetSnapshots/reader.server', () => ({
	datasetSnapshotReader: { readJson: mocks.readJson }
}))

beforeEach(() => {
	vi.clearAllMocks()
})

describe('markets dataset snapshot', () => {
	it('resolves an exchange from the markets snapshot', async () => {
		mocks.readJson.mockResolvedValue({
			cex: {
				spot: [{ exchange: 'binance', defillama_slug: 'Binance-CEX', market_count: 1, total_volume_24h: 100 }],
				linear_perp: [],
				inverse_perp: []
			},
			dex: {
				spot: [],
				linear_perp: [],
				inverse_perp: []
			},
			totals: {}
		})

		const { resolveMarketsExchangeByParam } = await import('~/containers/Markets/server/dataset.server')

		await expect(resolveMarketsExchangeByParam('Binance')).resolves.toBe('binance')
		expect(mocks.readJson).toHaveBeenCalledWith('markets', 'exchanges-list.json')
	})
})
