import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RWA_PERPS_SERVER_URL } from '~/constants'
import { getRWAPerpsContractData } from '../queries'

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson
}))

// Backend fixtures keyed by decoded path below the RWA perps server; a key ending in `*` matches a prefix.
type Fixture = unknown | ((url: URL, rest: string) => unknown)
const routes = new Map<string, Fixture>()
const basePath = new URL(RWA_PERPS_SERVER_URL).pathname

function serve(fixtures: Record<string, Fixture>) {
	for (const path in fixtures) routes.set(path, fixtures[path])
}

function backendPath(href: string) {
	const url = new URL(href)
	url.searchParams.delete('cachebust')
	return { url, path: decodeURIComponent(url.pathname.slice(basePath.length)) }
}

/** Backend requests in order, as decoded paths with their query and without the cache-busting parameter. */
function requested(): Array<string> {
	return fetchJson.mock.calls.map(([href]: [string]) => {
		const { url, path } = backendPath(href)
		return url.search ? `${path}${url.search}` : path
	})
}

const baseMarket = {
	timestamp: 1_775_011_512,
	contract: 'xyz:META',
	venue: 'xyz',
	venueType: 'DEX' as const,
	openInterest: 100,
	openInterestChange24h: 25,
	volume24h: 50,
	volume24hChange24h: 50,
	price: 500,
	priceChange24h: 5,
	fundingRate: 0.00001,
	premium: 0.0002,
	cumulativeFunding: 10,
	referenceAsset: 'Meta',
	referenceAssetGroup: 'Equities',
	assetClass: ['Stock Perp'],
	parentPlatform: 'trade[XYZ]',
	pair: null,
	marginAsset: 'USDC',
	settlementAsset: 'USDC',
	category: ['RWA Perps'],
	issuer: 'XYZ',
	website: ['https://trade.xyz/'],
	link: 'https://app.hyperliquid.xyz/join/DEFILLAMAS',
	oracleProvider: 'Pyth equity feed',
	description: 'Perpetual market',
	accessModel: 'Permissionless',
	rwaClassification: 'Programmable Finance',
	makerFeeRate: 0.0002,
	takerFeeRate: 0.0005,
	deployerFeeShare: 0.5,
	oraclePx: 501,
	midPx: 500.5,
	prevDayPx: 480,
	maxLeverage: 10,
	szDecimals: 2,
	fundingIntervalHours: 1,
	volume7d: 300,
	volume30d: 1000,
	volumeAllTime: 5000,
	estimatedProtocolFees24h: 1,
	estimatedProtocolFees7d: 3,
	estimatedProtocolFees30d: 10,
	estimatedProtocolFeesAllTime: 50,
	suspicious: false
}

afterEach(() => {
	vi.clearAllMocks()
	vi.useRealTimers()
})

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
	routes.clear()
	fetchJson.mockReset()
	fetchJson.mockImplementation(async (href: string) => {
		const { url, path } = backendPath(href)
		let fixture = routes.get(path)
		let rest = ''
		if (fixture === undefined) {
			for (const [key, value] of routes) {
				if (key.endsWith('*') && path.startsWith(key.slice(0, -1))) {
					fixture = value
					rest = path.slice(key.length - 1)
				}
			}
		}
		if (fixture === undefined) throw new Error(`Unfixtured RWA perps request: ${href}`)
		return typeof fixture === 'function' ? fixture(url, rest) : fixture
	})
	serve({
		'/chart/*': [
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
		]
	})
	serve({
		'/funding/*': [
			{
				timestamp: 1_774_454_400,
				id: 'xyz:meta',
				contract: 'xyz:META',
				venue: 'xyz',
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
		serve({ '/contract/*': [{ ...baseMarket, id: 'xyz:meta', venue: 'xyz' }] })

		const result = await getRWAPerpsContractData({ contract: 'xyz:META' })

		expect(requested()).toEqual(['/contract/xyz:META', '/chart/xyz:meta', '/funding/xyz:meta'])
		expect(result).toMatchObject({
			contract: {
				contract: 'xyz:META',
				displayName: 'Meta',
				venue: 'xyz',
				baseAsset: 'Meta',
				baseAssetGroup: 'Equities',
				link: 'https://app.hyperliquid.xyz/join/DEFILLAMAS'
			},
			market: {
				id: 'xyz:meta',
				venue: 'xyz',
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
		serve({
			'/contract/*': [{ ...baseMarket, id: 'xyz:meta', venue: 'xyz' }],
			'/chart/*': () => {
				throw new Error('chart failed')
			},
			'/funding/*': () => {
				throw new Error('funding failed')
			}
		})

		const result = await getRWAPerpsContractData({ contract: 'xyz:META' })

		expect(result?.contract.contract).toBe('xyz:META')
		expect(result?.marketChart).toBeNull()
		expect(result?.fundingHistory).toBeNull()
	})

	test('returns null when multiple rows make the contract ambiguous', async () => {
		serve({
			'/contract/*': [
				{ ...baseMarket, id: 'xyz:meta-1', contract: 'xyz:META' },
				{ ...baseMarket, id: 'xyz:meta-2', contract: 'xyz:META' }
			]
		})

		await expect(getRWAPerpsContractData({ contract: 'xyz:META' })).resolves.toBeNull()
		expect(requested()).toEqual(['/contract/xyz:META'])
	})
})
