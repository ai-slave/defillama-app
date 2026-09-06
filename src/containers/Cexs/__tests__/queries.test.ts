import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchCexs } from '../api'
import { getCexsPageData } from '../queries'
import { binanceCexMetadataCache } from './metadataFixture'

vi.mock('../api', () => ({ fetchCexs: vi.fn() }))
vi.mock('~/server/routeRegistry/common', () => ({ getMetadataCache: vi.fn(() => binanceCexMetadataCache) }))

describe('CEX page data', () => {
	beforeEach(() => vi.resetAllMocks())

	test('normalizes the CEX protocol identity and producer exclusion population once', async () => {
		vi.mocked(fetchCexs).mockResolvedValue({
			cexs: [
				{
					name: 'Binance',
					slug: 'Binance-CEX',
					coin: 'BNB',
					coinSymbol: 'BNB',
					ownTokens: ['BNB', 'BUSD']
				},
				{ name: 'OKX', slug: 'okx', coinSymbol: 'OKB' }
			],
			cg_volume_cexs: []
		})

		const { cexs } = await getCexsPageData()

		expect(cexs[0]).toMatchObject({
			name: 'Binance',
			cexProtocolSlug: 'binance-cex',
			tokensToExclude: ['BNB', 'BUSD']
		})
		expect(cexs[0]).not.toHaveProperty('slug')
		expect(cexs[0]).not.toHaveProperty('exchangeProfileSlug')
		expect(cexs[1]).toMatchObject({ name: 'OKX', cexProtocolSlug: 'okx', tokensToExclude: ['OKB'] })
	})

	test('keeps display coin separate when the producer has no exclusion symbol', async () => {
		vi.mocked(fetchCexs).mockResolvedValue({
			cexs: [{ name: 'Bitrue', coin: 'BTR' }],
			cg_volume_cexs: []
		})

		const { cexs } = await getCexsPageData()

		expect(cexs[0]).toMatchObject({ name: 'Bitrue', coin: 'BTR', tokensToExclude: [] })
	})

	test('keeps an unknown producer slug as an unlinked CEX row', async () => {
		vi.mocked(fetchCexs).mockResolvedValue({
			cexs: [{ name: 'New CEX', slug: 'new-cex', coinSymbol: 'NEW' }],
			cg_volume_cexs: []
		})

		const { cexs } = await getCexsPageData()

		expect(cexs[0]).toMatchObject({ name: 'New CEX', tokensToExclude: ['NEW'] })
		expect(cexs[0]).not.toHaveProperty('cexProtocolSlug')
	})
})
