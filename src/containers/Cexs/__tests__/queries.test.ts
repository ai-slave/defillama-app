import { beforeEach, describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import type { RawCexsResponse } from '../api.types'
import { getCexsPageData } from '../queries'
import { binanceCexMetadataCache } from './metadataFixture'

const http = installFixtureFetch()
const metadata = installMetadataSeeder()
function serveCexs(body: RawCexsResponse) {
	http.serve({ '/cexs': body })
}

describe('CEX page data', () => {
	beforeEach(() => metadata.seed(binanceCexMetadataCache))

	test('normalizes the CEX protocol identity and producer exclusion population once', async () => {
		serveCexs({
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
		serveCexs({
			cexs: [{ name: 'Bitrue', coin: 'BTR' }],
			cg_volume_cexs: []
		})

		const { cexs } = await getCexsPageData()

		expect(cexs[0]).toMatchObject({ name: 'Bitrue', coin: 'BTR', tokensToExclude: [] })
	})

	test('keeps an unknown producer slug as an unlinked CEX row', async () => {
		serveCexs({
			cexs: [{ name: 'New CEX', slug: 'new-cex', coinSymbol: 'NEW' }],
			cg_volume_cexs: []
		})

		const { cexs } = await getCexsPageData()

		expect(cexs[0]).toMatchObject({ name: 'New CEX', tokensToExclude: ['NEW'] })
		expect(cexs[0]).not.toHaveProperty('cexProtocolSlug')
	})
})
