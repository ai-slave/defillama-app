import { describe, expect, test } from 'vitest'
import { MARKETS_SERVER_URL } from '~/constants'
import { getStaticProps } from '~/pages/exchange/[slug]'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { matchesDefillamaCex, nativeTokenChange24h } from '../profileEnrichment'

const http = installFixtureFetch()

describe('exchange profile enrichment', () => {
	test('matches hack and raise names only through the canonical DefiLlama CEX slug', () => {
		expect(matchesDefillamaCex('Binance', 'binance-cex')).toBe(true)
		expect(matchesDefillamaCex('Crypto.com', 'crypto-com')).toBe(true)
		expect(matchesDefillamaCex('Coinbase Pro', 'coinbase')).toBe(false)
	})

	test('derives the native token 24h change from canonical price history', () => {
		expect(
			nativeTokenChange24h(110, 'coingecko:venue', {
				coins: { 'coingecko:venue': { prices: [{ timestamp: 1, price: 100 }] } }
			})
		).toBeCloseTo(10)
		expect(nativeTokenChange24h(110, null, { coins: {} })).toBeNull()
	})
})

describe('exchange profile route', () => {
	test('returns notFound for a noncanonical slug without fetching', async () => {
		expect(await getStaticProps({ params: { slug: 'coinbase.eu' } })).toEqual({ notFound: true })
		expect(http.requests).toHaveLength(0)
	})

	test('returns notFound for a venue the markets server does not publish', async () => {
		http.serve({
			[`${MARKETS_SERVER_URL}/exchanges/unknown/metadata.json`]: fixtureStatus(404, { error: 'Not Found' })
		})

		expect(await getStaticProps({ params: { slug: 'unknown' } })).toEqual({ notFound: true })
	})
})
