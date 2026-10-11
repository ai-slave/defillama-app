import { beforeEach, describe, expect, test } from 'vitest'
import { RWA_PERPS_SERVER_URL as base } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { getRWAPerpsContractData } from '../queries'
import { TEST_CONTRACT } from './contractFixture'

const http = installFixtureFetch()
const market = TEST_CONTRACT.market

/** Backend paths requested, in order, decoded and without the query. */
const requestedPaths = () =>
	http.requests.map(({ url }) => decodeURIComponent(url.pathname.slice(new URL(base).pathname.length)))

beforeEach(() => {
	http.serve({
		[`${base}/chart/`]: [
			{
				timestamp: 1_774_483_200,
				openInterest: 100,
				volume24h: 50,
				price: 500,
				priceChange24h: 2,
				fundingRate: 0.00001,
				premium: 0.0002,
				cumulativeFunding: 1
			}
		],
		[`${base}/funding/`]: [
			{
				timestamp: 1_774_454_400,
				id: 'xyz:meta',
				contract: 'xyz:META',
				venue: 'XYZ Exchange',
				funding_rate: '0.00000625',
				premium: '0.00010000',
				open_interest: '6203.048',
				funding_payment: '0.03876905',
				created_at: '2026-03-26T15:17:54.413Z'
			}
		]
	})
})

describe('getRWAPerpsContractData', () => {
	test('uses the raw contract identifier and returns a single matching market', async () => {
		http.serve({ [`${base}/contract/`]: [market] })

		const result = await getRWAPerpsContractData({ contract: 'xyz:META' })

		expect(requestedPaths()).toEqual(['/contract/xyz:META', '/chart/xyz:meta', '/funding/xyz:meta'])
		expect(result).toMatchObject({
			contract: {
				contract: 'xyz:META',
				displayName: 'Meta',
				venue: 'XYZ Exchange',
				baseAsset: 'Meta',
				baseAssetGroup: 'Equities',
				link: 'https://app.hyperliquid.xyz/join/DEFILLAMAS'
			},
			market: {
				id: 'xyz:meta',
				venue: 'XYZ Exchange',
				price: 500
			}
		})
		expect(result?.marketChart?.[0]).toMatchObject({
			timestamp: 1_774_483_200_000,
			price: 500,
			priceChange24h: 2,
			fundingRate: 0.00001,
			premium: 0.0002,
			cumulativeFunding: 1
		})
		expect(result?.fundingHistory?.[0]).toMatchObject({
			timestamp: 1_774_454_400_000,
			fundingRate: 0.00000625,
			premium: 0.0001,
			openInterest: 6203.048,
			fundingPayment: 0.03876905
		})
	})

	test('keeps the contract data when chart and funding fetches fail', async () => {
		http.serve({
			[`${base}/contract/`]: [market],
			[`${base}/chart/`]: fixtureStatus(404),
			[`${base}/funding/`]: fixtureStatus(404)
		})

		const result = await getRWAPerpsContractData({ contract: 'xyz:META' })

		expect(result?.contract.contract).toBe('xyz:META')
		expect(result?.marketChart).toBeNull()
		expect(result?.fundingHistory).toBeNull()
	})

	test('returns null when multiple rows make the contract ambiguous', async () => {
		http.serve({
			[`${base}/contract/`]: [
				{ ...market, id: 'xyz:meta-1' },
				{ ...market, id: 'xyz:meta-2' }
			]
		})

		await expect(getRWAPerpsContractData({ contract: 'xyz:META' })).resolves.toBeNull()
		expect(requestedPaths()).toEqual(['/contract/xyz:META'])
	})
})
