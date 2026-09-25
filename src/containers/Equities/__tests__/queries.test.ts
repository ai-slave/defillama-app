import { describe, expect, test } from 'vitest'
import { EQUITIES_SERVER_URL } from '~/constants'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import type { EquitiesPriceHistory, IEquitiesOnchainResponse } from '../api.types'
import { getEquitiesTickerPageData } from '../queries'
import { installEquitiesPageNetwork } from './pageFixture'

const http = installEquitiesPageNetwork()

const pageMetadata = {
	protocolDisplayNames: new Map<string, string>(),
	rwaPlatforms: [],
	emissionsProtocolBySlug: {}
}

function market(
	pair: string,
	volume24h: number | null,
	rwaPlatformSlug: string
): IEquitiesOnchainResponse['perps'][number] {
	return {
		pair,
		volume24h,
		rwaPlatformSlug,
		price: null,
		openInterest: null,
		annualizedFundingRate: null,
		tradeUrl: 'https://example.com',
		contractSlug: pair,
		exchangeType: 'CEX',
		updatedAt: '2026-08-27T00:00:00Z'
	}
}

describe('getEquitiesTickerPageData', () => {
	test('fetches only the default 24H price history for page generation', async () => {
		const priceHistory: EquitiesPriceHistory = [
			['2026-08-27T13:35:00Z', 223],
			['2026-08-27T13:30:00Z', 222]
		]
		http.serve({ [`${EQUITIES_SERVER_URL}/price-history`]: priceHistory })

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(
			http.requests
				.filter(({ url }) => url.pathname.endsWith('/price-history'))
				.map(({ url }) => ({
					ticker: url.searchParams.get('ticker'),
					country: url.searchParams.get('country'),
					timeframe: url.searchParams.get('timeframe')
				}))
		).toEqual([{ ticker: 'NVDA', country: 'US', timeframe: '1D' }])
		expect(result?.priceHistory).toEqual(priceHistory)
	})

	test('derives an unlocks slug from a lowercased ticker present in emissions metadata', async () => {
		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map(),
			rwaPlatforms: [],
			emissionsProtocolBySlug: { nvda: 'nvda' }
		})

		expect(result?.unlocksSlug).toBe('nvda')
	})

	test('omits the unlocks slug when the ticker is absent from emissions metadata', async () => {
		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map(),
			rwaPlatforms: [],
			emissionsProtocolBySlug: {}
		})

		expect(result?.unlocksSlug).toBeNull()
	})

	test('keeps successful empty optional sources available', async () => {
		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map(),
			rwaPlatforms: [],
			emissionsProtocolBySlug: {}
		})

		expect(result?.priceHistory).toEqual([])
		expect(result?.filings).toEqual([])
		expect(result?.onchain).toEqual({ perps: [], tokens: [] })
	})

	test('preserves populated optional data and maps on-chain display names', async () => {
		http.serve({
			[`${EQUITIES_SERVER_URL}/filings`]: [
				{
					filingDate: '2026-08-20',
					reportDate: null,
					form: '10-Q',
					primaryDocumentUrl: 'https://www.sec.gov/filing',
					documentDescription: 'Quarterly report'
				}
			]
		})
		http.serve({
			[`${EQUITIES_SERVER_URL}/onchain`]: {
				perps: [
					{
						pair: 'NVDA/USD',
						price: null,
						volume24h: 0,
						openInterest: null,
						annualizedFundingRate: 0,
						tradeUrl: 'https://example.com/cex',
						contractSlug: 'nvda',
						exchangeProtocolSlug: 'binance',
						rwaPlatformSlug: 'ondo-finance',
						exchangeType: 'CEX',
						updatedAt: '2026-08-24T00:00:00.000Z'
					},
					{
						pair: 'NVDA/USDC',
						price: 180,
						volume24h: null,
						openInterest: 0,
						annualizedFundingRate: null,
						tradeUrl: 'https://example.com/dex',
						contractSlug: 'nvda',
						exchangeProtocolSlug: 'binance',
						rwaPlatformSlug: 'ondo-finance',
						exchangeType: 'DEX',
						updatedAt: '2026-08-24T00:00:00.000Z'
					}
				],
				tokens: [
					{
						issuer: 'Ondo',
						issuerRwaPlatformSlug: 'ondo-finance',
						price: null,
						assetSlug: 'nvda',
						activeMarketcap: 0
					}
				]
			}
		})

		const result = await getEquitiesTickerPageData('NVDA', 'US', {
			protocolDisplayNames: new Map([['binance', 'Binance']]),
			rwaPlatforms: ['Ondo Finance'],
			emissionsProtocolBySlug: {}
		})

		expect(result?.filings?.[0]?.reportDate).toBeNull()
		expect(result?.filingForms).toEqual(['10-Q'])
		expect(result?.onchain?.perps.map(({ exchangeType }) => exchangeType)).toEqual(['CEX', 'DEX'])
		expect(result?.onchain?.perps[0]).toMatchObject({
			price: null,
			volume24h: 0,
			openInterest: null,
			annualizedFundingRate: 0,
			exchangeName: 'Binance',
			platformName: 'Ondo Finance'
		})
		expect(result?.onchain?.tokens[0]).toMatchObject({
			price: null,
			activeMarketcap: 0,
			issuerRwaPlatformName: 'Ondo Finance'
		})
	})

	test('promotes only the highest-volume Bybit pair', async () => {
		const onchain: IEquitiesOnchainResponse = {
			perps: [
				market('Bybit small', 10, 'bybit'),
				market('Binance', 300, 'binance'),
				market('Bybit large', 200, 'bybit'),
				market('Ostium', null, 'ostium'),
				market('Zero', 0, 'other')
			],
			tokens: []
		}
		http.serve({ [`${EQUITIES_SERVER_URL}/onchain`]: onchain })

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result?.onchain?.perps.map(({ pair }) => pair)).toEqual([
			'Bybit large',
			'Binance',
			'Bybit small',
			'Zero',
			'Ostium'
		])
	})

	test('orders markets by descending volume with missing values last when Bybit is absent', async () => {
		http.serve({
			[`${EQUITIES_SERVER_URL}/onchain`]: {
				perps: [market('Ostium', null, 'ostium'), market('Zero', 0, 'other'), market('Binance', 300, 'binance')],
				tokens: []
			}
		})

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result?.onchain?.perps.map(({ pair }) => pair)).toEqual(['Binance', 'Zero', 'Ostium'])
	})

	test.each([null, 0])('keeps Bybit first by default even when its volume is %s', async (volume) => {
		http.serve({
			[`${EQUITIES_SERVER_URL}/onchain`]: {
				perps: [
					market('Ostium', null, 'ostium'),
					market('Binance', 300, 'binance'),
					market('Bybit', volume, 'bybit'),
					market('Bybit missing', null, 'bybit')
				],
				tokens: []
			}
		})

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result?.onchain?.perps.map(({ pair }) => pair)).toEqual(['Bybit', 'Binance', 'Ostium', 'Bybit missing'])
	})

	test('keeps filings and on-chain data available when price history fails', async () => {
		http.serve({ [`${EQUITIES_SERVER_URL}/price-history`]: fixtureStatus(404, { error: 'unavailable' }) })

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result).not.toBeNull()
		expect(result?.priceHistory).toBeNull()
		expect(result?.filings).toEqual([])
		expect(result?.filingForms).toEqual([])
		expect(result?.onchain).toEqual({ perps: [], tokens: [] })
	})

	test('keeps price and on-chain data available when filings fail', async () => {
		http.serve({ [`${EQUITIES_SERVER_URL}/filings`]: fixtureStatus(404, { error: 'unavailable' }) })

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result).not.toBeNull()
		expect(result?.priceHistory).toEqual([])
		expect(result?.filings).toBeNull()
		expect(result?.filingForms).toEqual([])
		expect(result?.onchain).toEqual({ perps: [], tokens: [] })
	})

	test('keeps price and filings data available when on-chain data fails', async () => {
		http.serve({ [`${EQUITIES_SERVER_URL}/onchain`]: fixtureStatus(404, { error: 'unavailable' }) })

		const result = await getEquitiesTickerPageData('NVDA', 'US', pageMetadata)

		expect(result).not.toBeNull()
		expect(result?.priceHistory).toEqual([])
		expect(result?.filings).toEqual([])
		expect(result?.onchain).toBeNull()
	})

	test('keeps required statement failure page-atomic', async () => {
		http.serve({ [`${EQUITIES_SERVER_URL}/statements`]: fixtureStatus(404, { error: 'unavailable' }) })

		await expect(getEquitiesTickerPageData('NVDA', 'US', pageMetadata)).resolves.toBeNull()
	})

	test('keeps required dimensions failure page-atomic', async () => {
		http.serve({ [`${EQUITIES_SERVER_URL}/dimensions`]: fixtureStatus(404, { error: 'unavailable' }) })

		await expect(getEquitiesTickerPageData('NVDA', 'US', pageMetadata)).resolves.toBeNull()
	})

	test.each([
		['summary', () => http.serve({ [`${EQUITIES_SERVER_URL}/summary`]: fixtureStatus(404, { error: 'unavailable' }) })],
		[
			'metadata',
			() => http.serve({ [`${EQUITIES_SERVER_URL}/metadata`]: fixtureStatus(404, { error: 'unavailable' }) })
		]
	])('keeps required %s request failure page-atomic', async (_source, rejectRequest) => {
		rejectRequest()

		await expect(getEquitiesTickerPageData('NVDA', 'US', pageMetadata)).rejects.toThrow('unavailable')
	})
})
