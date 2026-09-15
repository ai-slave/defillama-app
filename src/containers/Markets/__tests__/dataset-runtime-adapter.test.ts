import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readJson: vi.fn() }))

vi.mock('~/server/datasetSnapshots/reader.server', () => ({
	datasetSnapshotReader: { readJson: mocks.readJson }
}))

beforeEach(() => {
	vi.clearAllMocks()
})

describe('markets dataset snapshot', () => {
	test('checks market availability by canonical CoinGecko ID', async () => {
		mocks.readJson.mockResolvedValue({ bitcoin: true })
		const { hasTokenMarkets } = await import('~/containers/Markets/server/dataset.server')

		await expect(hasTokenMarkets('Bitcoin')).resolves.toBe(true)
		expect(mocks.readJson).toHaveBeenCalledWith('markets', 'token-gecko-ids.json')
	})

	test('resolves retired CEX Markets slugs to canonical exchange profiles', async () => {
		mocks.readJson.mockResolvedValue({
			'crypto-com': { exchange: 'crypto-com', defillama_slug: 'Crypto.com' }
		})

		const { resolveExchangeByDefillamaCexSlug } = await import('~/containers/Markets/server/dataset.server')

		await expect(resolveExchangeByDefillamaCexSlug('Crypto-com')).resolves.toEqual({
			exchange: 'crypto-com',
			defillama_slug: 'Crypto.com'
		})
		expect(mocks.readJson).toHaveBeenCalledWith('markets', 'cex-by-defillama-slug.json')
	})
})

test('indexes bulk summaries by identity and tolerates older listings', async () => {
	const { buildTokenMarketSummaries } = await import('../server/dataset.index')
	const bucket = { pair_count: 1, total_volume_24h: 100, total_oi_usd: 20 }
	const summary = {
		total_volume_24h: 100,
		total_oi_usd: 20,
		totals: {
			cex: { spot: bucket, linear_perp: bucket, inverse_perp: bucket },
			dex: { spot: bucket, linear_perp: bucket, inverse_perp: bucket }
		}
	}
	const index = buildTokenMarketSummaries({
		last_updated: '',
		tokens: [
			{ coingecko_id: 'Bitcoin', symbol: 'btc', name: 'Bitcoin', venues: [], summary },
			{ coingecko_id: 'other-bitcoin', symbol: 'btc', name: 'Other', venues: [] }
		]
	})
	expect(index).toEqual({ bitcoin: summary })
})
