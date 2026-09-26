import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RWA_PERPS_SERVER_URL, RWA_SERVER_URL } from '~/constants'
import { filterRwaOverviewDisplayRows, readRwaQueryFilters } from '../filterState'
import { buildRwaDefiTvlProtocolChainBreakdown, getRWAAssetsOverview } from '../queries'
import { getRankedRwaFilterValues } from '../rankedFilterValues'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return { ...actual, fetchJson: mocks.fetchJson }
})

// Upstream routes, answered by URL. An Error fixture is a failed upstream request.
const LISTING = `${RWA_SERVER_URL}/current?lite=true`
const CHAIN_SPLIT = `${RWA_SERVER_URL}/chart/chain-breakdown?key=activeMcap`
const PERPS_CURRENT = `${RWA_PERPS_SERVER_URL}/current?cachebust=091626&includeCex=true`
const assetBreakdown = (scope: string) =>
	`${RWA_SERVER_URL}/chart/${scope}/asset-breakdown?includeStablecoin=true&includeGovernance=true`
const chainHistory = (chain: string, metric: string) => `${assetBreakdown(`chain/${chain}`)}&key=${metric}`
const venueSplit = (includeCex: boolean) =>
	`${RWA_PERPS_SERVER_URL}/chart/overview-breakdown?breakdown=venue&key=openInterest${includeCex ? '&includeCex=true' : ''}`

let routes: Record<string, unknown> = {}
let unfixtured: Array<string> = []
const serve = (next: Record<string, unknown>) => Object.assign(routes, next)
const serveListing = (rows: Array<unknown>) => serve({ [LISTING]: rows })
// A scope whose per-asset history fails to load; the page still renders from the listing.
const NO_HISTORY = new Error('[500] upstream')
const serveBreakdown = (scope: string, body: unknown) => serve({ [assetBreakdown(scope)]: body })
const requestedUrls = () => mocks.fetchJson.mock.calls.map(([url]) => url)

describe('rwa queries', () => {
	beforeEach(() => {
		unfixtured = []
		// The front page cards read these three splits; an empty split leaves its card empty.
		routes = { [PERPS_CURRENT]: [], [CHAIN_SPLIT]: [], [venueSplit(true)]: [], [venueSplit(false)]: [] }
		mocks.fetchJson.mockReset()
		mocks.fetchJson.mockImplementation(async (url: string) => {
			if (!(url in routes)) {
				unfixtured.push(url)
				throw new Error(`Unfixtured request: ${url}`)
			}
			const body = routes[url]
			if (body instanceof Error) throw body
			return structuredClone(body)
		})
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
		// The overview swallows most upstream failures, so an unfixtured route must fail here.
		if (unfixtured.length > 0) throw new Error(`Requests without a fixture:\n${unfixtured.join('\n')}`)
	})

	test('excludes assets tagged as RWA Perps from the standard rwa overview', async () => {
		serveBreakdown('chain/all', NO_HISTORY)
		serveListing([
			{
				id: 'treasury-1',
				ticker: 'T1',
				assetName: 'Treasury One',
				category: ['Treasuries'],
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: { Ethereum: { Aave: 20 } }
			},
			{
				id: 'perps-1',
				ticker: 'P1',
				assetName: 'Perps One',
				category: ['RWA Perps'],
				onChainMcap: { Ethereum: 250 },
				activeMcap: { Ethereum: 200 },
				defiActiveTvl: { Ethereum: { Morpho: 25 } }
			},
			{
				id: 'mixed-1',
				ticker: 'M1',
				assetName: 'Mixed One',
				category: ['Private Credit', 'RWA Perps'],
				onChainMcap: { Ethereum: 300 },
				activeMcap: { Ethereum: 280 },
				defiActiveTvl: { Ethereum: { Spark: 30 } }
			}
		])

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries', 'Private Credit', 'RWA Perps'],
				platforms: [],
				assetGroups: []
			} as never
		})

		expect(result?.assets.map((asset) => asset.assetName)).toEqual(['Treasury One'])
		expect(result?.categoriesOptions.map((option) => option.key)).toEqual(['Treasuries'])
		expect(result).not.toHaveProperty('categories')
		expect(result).not.toHaveProperty('categoryValues')
		expect(result?.categoryLinks).toEqual([])
	})

	test('serializes one canonical active-mcap history for the initial regular-page chart', async () => {
		serveListing([
			{
				id: 'alpha',
				canonicalMarketId: 'alpha',
				ticker: 'ALPHA',
				assetName: 'Alpha',
				assetGroup: 'Treasuries',
				category: ['Treasuries'],
				onChainMcap: { Ethereum: 12 },
				activeMcap: { Ethereum: 10 },
				defiActiveTvl: {}
			}
		])
		serveBreakdown('chain/all', {
			activeMcap: [{ timestamp: 1, alpha: 10 }],
			onChainMcap: [],
			defiActiveTvl: []
		})
		serve({ [chainHistory('ethereum', 'activeMcap')]: [{ timestamp: 1, alpha: 10 }] })

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: [],
				assetGroups: ['Treasuries']
			} as never
		})

		expect(result?.initialChartDatasets).toEqual([
			{
				metric: 'activeMcap',
				groupBy: 'platform',
				dataset: {
					dimensions: ['timestamp', 'Total Active AUM', 'Unknown'],
					source: [[1000, 10, 10]]
				}
			},
			{
				metric: 'activeMcap',
				groupBy: 'chain',
				dataset: {
					dimensions: ['timestamp', 'Total Active AUM', 'Ethereum'],
					source: [[1000, 10, 10]]
				}
			}
		])
	})

	test('folds the front page chain lines at build time and leaves a failed chain in Others', async () => {
		serveListing([
			{
				id: 'alpha',
				canonicalMarketId: 'alpha',
				ticker: 'ALPHA',
				assetName: 'Alpha',
				assetGroup: 'Treasuries',
				category: ['Treasuries'],
				onChainMcap: { Ethereum: 12, Solana: 6 },
				activeMcap: { Ethereum: 10, Solana: 5 },
				defiActiveTvl: {}
			}
		])
		serveBreakdown('chain/all', {
			activeMcap: [{ timestamp: 1, alpha: 15 }],
			onChainMcap: [],
			defiActiveTvl: []
		})
		serve({
			[chainHistory('ethereum', 'activeMcap')]: [{ timestamp: 1, alpha: 10 }],
			[chainHistory('solana', 'activeMcap')]: new Error('[500] upstream')
		})

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum', 'Solana'],
				categories: ['Treasuries'],
				platforms: [],
				assetGroups: ['Treasuries']
			} as never
		})

		expect(result?.initialChartDatasets.find((initial) => initial.groupBy === 'chain')).toEqual({
			metric: 'activeMcap',
			groupBy: 'chain',
			dataset: {
				dimensions: ['timestamp', 'Total Active AUM', 'Ethereum', 'Others'],
				source: [[1000, 15, 10, 5]]
			}
		})
	})

	test('ships the front page cards from the chain split and the perps venue split, and none on a scoped page', async () => {
		serveBreakdown('chain/all', NO_HISTORY)
		serveBreakdown('chain/ethereum', NO_HISTORY)
		serveListing([
			{
				id: 'alpha',
				canonicalMarketId: 'alpha',
				ticker: 'ALPHA',
				assetName: 'Alpha',
				assetGroup: 'Treasuries',
				category: ['Treasuries'],
				chain: ['Ethereum'],
				onChainMcap: { Ethereum: 12 },
				activeMcap: { Ethereum: 10 },
				defiActiveTvl: { Ethereum: { Aave: 4 } }
			}
		])
		serve({
			[CHAIN_SPLIT]: [
				{ timestamp: 0, Ethereum: 8 },
				{ timestamp: 31 * 24 * 60 * 60, Ethereum: 10 }
			],
			[venueSplit(true)]: [
				{ timestamp: 1, Hyperliquid: 5, Binance: 20 },
				{ timestamp: 2, Hyperliquid: 6, Binance: 24 }
			],
			[venueSplit(false)]: [
				{ timestamp: 1, Hyperliquid: 5 },
				{ timestamp: 2, Hyperliquid: 6 }
			]
		})

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: [],
				assetGroups: ['Treasuries']
			} as never
		})
		expect(result?.cards?.chainChange.bars).toEqual([{ name: 'Ethereum', changeUsd: 2, changePct: 25 }])
		expect(result?.cards?.defiByProtocol.withBridges.bars).toEqual([{ name: 'Aave', value: 4 }])
		expect(result?.cards?.perpsOpenInterest.withCex.value).toBe(30)
		expect(result?.cards?.perpsOpenInterest.dexOnly.value).toBe(6)
		expect(result?.cards?.perpsOpenInterest.withCex.series).toEqual([
			[1000, 25],
			[2000, 30]
		])

		const scoped = await getRWAAssetsOverview({
			chain: 'ethereum',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: [],
				assetGroups: ['Treasuries']
			} as never
		})
		expect(scoped).not.toBeNull()
		expect(scoped?.cards).toBeNull()
	})

	test('keeps suspicious assets visible while excluding them from initial totals and charts', async () => {
		serveListing([
			{
				id: 'alpha',
				canonicalMarketId: 'alpha',
				ticker: 'ALPHA',
				assetName: 'Alpha',
				assetGroup: 'Treasuries',
				category: ['Treasuries'],
				onChainMcap: { Ethereum: 12 },
				activeMcap: { Ethereum: 10 },
				defiActiveTvl: {}
			},
			{
				id: 'beta',
				canonicalMarketId: 'beta',
				ticker: 'BETA',
				assetName: 'Beta',
				assetGroup: 'Treasuries',
				category: ['Treasuries'],
				onChainMcap: { Ethereum: 24 },
				activeMcap: { Ethereum: 20 },
				defiActiveTvl: {},
				suspicious: true,
				suspiciousReason: 'Unverified valuation source'
			}
		])
		serveBreakdown('chain/all', {
			activeMcap: [{ timestamp: 1, alpha: 10, beta: 20 }],
			onChainMcap: [],
			defiActiveTvl: []
		})
		serve({ [chainHistory('ethereum', 'activeMcap')]: [{ timestamp: 1, alpha: 10, beta: 20 }] })

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: [],
				assetGroups: ['Treasuries']
			} as never
		})

		expect(result?.assets).toHaveLength(2)
		expect(result?.assets.find((asset) => asset.assetName === 'Beta')).toMatchObject({
			assetName: 'Beta',
			suspicious: true,
			suspiciousReason: 'Unverified valuation source'
		})
		expect(result?.totals).toMatchObject({ onChainMcap: 12, activeMcap: 10 })
		expect(result?.initialChartDatasets.map((initial) => initial.dataset)).toEqual([
			{ dimensions: ['timestamp', 'Total Active AUM', 'Unknown'], source: [[1000, 10, 10]] },
			{ dimensions: ['timestamp', 'Total Active AUM', 'Ethereum'], source: [[1000, 10, 10]] }
		])
	})

	test('groups an asset group page initial chart by platform, its default, with no chain fold', async () => {
		serveListing([
			{
				id: 'alpha',
				canonicalMarketId: 'alpha',
				ticker: 'ALPHA',
				assetName: 'Alpha',
				assetGroup: 'Public Equities',
				parentPlatform: 'Ondo',
				category: ['Public Equities'],
				onChainMcap: { Ethereum: 12 },
				activeMcap: { Ethereum: 10 },
				defiActiveTvl: {}
			},
			{
				id: 'beta',
				canonicalMarketId: 'beta',
				ticker: 'BETA',
				assetName: 'Beta',
				assetGroup: 'Public Equities',
				parentPlatform: 'Backed',
				category: ['Public Equities'],
				onChainMcap: { Ethereum: 24 },
				activeMcap: { Ethereum: 20 },
				defiActiveTvl: {}
			}
		])
		serveBreakdown('assetGroup/public-equities', {
			activeMcap: [{ timestamp: 1, alpha: 10, beta: 20 }],
			onChainMcap: [],
			defiActiveTvl: []
		})

		const result = await getRWAAssetsOverview({
			assetGroup: 'public-equities',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Public Equities'],
				platforms: ['Ondo', 'Backed'],
				assetGroups: ['Public Equities']
			} as never
		})

		expect(result?.initialChartDatasets).toEqual([
			{
				metric: 'activeMcap',
				groupBy: 'platform',
				dataset: {
					dimensions: ['timestamp', 'Total Active AUM', 'Backed', 'Ondo'],
					source: [[1000, 30, 20, 10]]
				}
			}
		])
	})

	test('folds a platform page initial chart by asset name, its default, with no Platform series', async () => {
		serveListing([
			{
				id: 'alpha',
				canonicalMarketId: 'alpha',
				ticker: 'ALPHA',
				assetName: 'Alpha',
				assetGroup: 'Public Equities',
				parentPlatform: 'Ondo',
				category: ['Public Equities'],
				onChainMcap: { Ethereum: 12 },
				activeMcap: { Ethereum: 10 },
				defiActiveTvl: {}
			},
			{
				id: 'beta',
				canonicalMarketId: 'beta',
				ticker: 'BETA',
				assetName: 'Beta',
				assetGroup: 'Public Equities',
				parentPlatform: 'Ondo',
				category: ['Public Equities'],
				onChainMcap: { Ethereum: 24 },
				activeMcap: { Ethereum: 20 },
				defiActiveTvl: {}
			}
		])
		serveBreakdown('platform/ondo', {
			activeMcap: [{ timestamp: 1, alpha: 10, beta: 20 }],
			onChainMcap: [],
			defiActiveTvl: []
		})

		const result = await getRWAAssetsOverview({
			platform: 'ondo',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Public Equities'],
				platforms: ['Ondo'],
				assetGroups: ['Public Equities']
			} as never
		})

		expect(result?.initialChartDatasets).toEqual([
			{
				metric: 'activeMcap',
				groupBy: 'none',
				dataset: {
					dimensions: ['timestamp', 'Total Active AUM', 'Beta', 'Alpha'],
					source: [[1000, 30, 20, 10]]
				}
			}
		])
	})

	test('ships a platform page initial chart folded to the drawn ten with Others', async () => {
		const assets = Array.from({ length: 12 }, (_, index) => ({
			id: `asset-${index}`,
			canonicalMarketId: `asset-${index}`,
			ticker: `A${index}`,
			assetName: `Asset ${index}`,
			assetGroup: 'Treasuries',
			parentPlatform: 'Ondo',
			category: ['Treasuries'],
			onChainMcap: { Ethereum: (index + 1) * 2 },
			activeMcap: { Ethereum: index + 1 },
			defiActiveTvl: {}
		}))
		serveListing(assets)
		serveBreakdown('platform/ondo', {
			activeMcap: [Object.fromEntries([['timestamp', 1], ...assets.map((asset, index) => [asset.id, index + 1])])],
			onChainMcap: [],
			defiActiveTvl: []
		})

		const result = await getRWAAssetsOverview({
			platform: 'ondo',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: ['Ondo'],
				assetGroups: ['Treasuries']
			} as never
		})

		expect(result?.initialChartDatasets).toEqual([
			{
				metric: 'activeMcap',
				groupBy: 'none',
				dataset: {
					dimensions: [
						'timestamp',
						'Total Active AUM',
						'Asset 11',
						'Asset 10',
						'Asset 9',
						'Asset 8',
						'Asset 7',
						'Asset 6',
						'Asset 5',
						'Asset 4',
						'Asset 3',
						'Asset 2',
						'Others'
					],
					source: [[1000, 78, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 3]]
				}
			}
		])
	})

	test('keeps selected-chain table metric breakdowns filtered and sorted', async () => {
		serveBreakdown('chain/ethereum', NO_HISTORY)
		serveListing([
			{
				id: 'multi-chain-1',
				ticker: 'MC1',
				assetName: 'Multi Chain One',
				category: ['Treasuries'],
				chain: ['Ethereum', 'Solana'],
				onChainMcap: { Solana: 50, Ethereum: 100 },
				activeMcap: { Solana: 40, Ethereum: 90 },
				defiActiveTvl: {
					Solana: { Aave: 100, Spark: 7 },
					Ethereum: { Morpho: 5, Aave: 20 }
				},
				bridgeTvl: { Solana: 100, Ethereum: 5 },
				bridgeTvlBreakdown: { Solana: { Aave: 100 }, Ethereum: { Morpho: 5 } }
			}
		])

		const result = await getRWAAssetsOverview({
			chain: 'ethereum',
			rwaList: {
				chains: ['Ethereum', 'Solana'],
				categories: ['Treasuries'],
				platforms: [],
				assetGroups: []
			} as never
		})

		expect(result?.assets).toHaveLength(1)
		const asset = result?.assets[0]
		expect(asset?.kind).toBe('spot')
		if (!asset || asset.kind !== 'spot') throw new Error('Expected a spot RWA asset')
		expect(asset.onChainMcap).toEqual({
			total: 100,
			breakdown: [['Ethereum', 100]]
		})
		expect(asset.activeMcap).toEqual({
			total: 90,
			breakdown: [['Ethereum', 90]]
		})
		expect(asset.defiActiveTvl).toEqual({
			total: 25,
			breakdown: [
				['Aave', 20],
				['Morpho', 5]
			]
		})
		expect(asset.defiActiveTvlByChain).toEqual({
			total: 25,
			breakdown: [['Ethereum', 25]]
		})
		expect(asset.bridgeTvl).toBe(5)
		expect(asset.bridgeTvlByChain).toEqual({
			total: 5,
			breakdown: [['Ethereum', 5]]
		})
		expect(asset.bridgeTvlByProtocol).toEqual({
			total: 5,
			breakdown: [['Morpho', 5]]
		})
	})

	test('merges perps contracts into the overview rows', async () => {
		serveBreakdown('chain/all', NO_HISTORY)
		serveBreakdown('chain/ethereum', NO_HISTORY)
		serveListing([
			{
				id: 'treasury-1',
				canonicalMarketId: 'ondo/usdy',
				chain: ['Ethereum'],
				ticker: 'USDY',
				assetName: 'Ondo USDY',
				category: ['Treasuries'],
				assetGroup: 'Treasuries',
				parentPlatform: 'Ondo',
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: { Ethereum: { Aave: 20 } }
			}
		])
		const dexMarket = {
			id: 'perps-1',
			timestamp: 1,
			contract: 'xyz:usdy',
			venue: 'xyz',
			venueType: 'DEX',
			openInterest: 10,
			openInterestChange24h: null,
			volume24h: 20,
			volume24hChange24h: null,
			price: 1.01,
			priceChange24h: 0,
			fundingRate: 0,
			premium: 0,
			cumulativeFunding: 0,
			referenceAsset: 'Ondo USDY',
			referenceAssetGroup: 'Treasuries',
			assetClass: ['Bonds'],
			parentPlatform: 'Ondo',
			pair: null,
			marginAsset: null,
			settlementAsset: null,
			category: ['RWA Perps', 'Treasuries'],
			issuer: 'Ondo',
			website: null,
			link: null,
			oracleProvider: null,
			description: null,
			accessModel: 'Permissioned',
			rwaClassification: 'RWA',
			makerFeeRate: 0,
			takerFeeRate: 0,
			deployerFeeShare: 0,
			oraclePx: 0,
			midPx: 0,
			prevDayPx: 0,
			maxLeverage: 0,
			szDecimals: 0,
			fundingIntervalHours: 1,
			volume7d: 0,
			volume30d: 0,
			volumeAllTime: 0,
			estimatedProtocolFees24h: 0,
			estimatedProtocolFees7d: 0,
			estimatedProtocolFees30d: 0,
			estimatedProtocolFeesAllTime: 0,
			suspicious: false
		}
		serve({
			[PERPS_CURRENT]: [
				dexMarket,
				{
					...dexMarket,
					id: 'binance:usdy',
					contract: 'binance:USDY',
					venue: 'Binance',
					venueType: 'CEX',
					parentPlatform: 'Binance',
					issuer: null,
					openInterest: 200
				}
			]
		})
		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries', 'RWA Perps'],
				platforms: ['Ondo'],
				assetGroups: ['Treasuries']
			} as never
		})

		expect(result?.assets.map((asset) => asset.kind)).toEqual(['spot', 'perps', 'perps'])
		expect(result?.assets[0]).toMatchObject({
			kind: 'spot',
			detailHref: '/rwa/asset/ondo%2Fusdy'
		})
		expect(result?.assets[1]).toMatchObject({
			kind: 'perps',
			priceChange24h: 0,
			detailHref: '/rwa/perps/contract/xyz%3Ausdy',
			assetName: 'Ondo USDY',
			category: ['Treasuries'],
			openInterest: 10,
			volume24h: 20,
			volume30d: 0,
			onChainMcap: null,
			activeMcap: null,
			defiActiveTvl: null
		})
		// The Perps view chart reads its splits in the browser; no contract history ships with the page.
		expect(result).not.toHaveProperty('initialOpenInterestChartDataset')
		expect(result?.totals.onChainMcap).toBe(100)
		expect(result?.totals.activeMcap).toBe(90)
		expect(result?.totals.defiActiveTvl).toBe(20)
		expect(result?.typeOptions.map((option) => option.key)).not.toContain('Perp')
		expect(result?.platforms).toContain('Ondo')
		expect(result?.assetGroups).toContain('Treasuries')
		expect(result?.assets[1]).toMatchObject({
			venueType: 'DEX',
			attestations: null
		})
		expect(result?.assets[2]).toMatchObject({
			venueType: 'CEX',
			attestations: null
		})
		expect(result?.platforms).toContain('Binance')
		expect(result?.issuers).toContain('Unknown')

		const chainResult = await getRWAAssetsOverview({
			chain: 'ethereum',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: ['Ondo'],
				assetGroups: ['Treasuries']
			} as never
		})
		expect(chainResult?.assets.map((asset) => asset.kind)).toEqual(['spot'])
	})

	test('falls back to the spot overview when the perps markets request fails', async () => {
		serveBreakdown('chain/all', NO_HISTORY)
		serveListing([
			{
				id: 'treasury-1',
				canonicalMarketId: 'ondo/usdy',
				ticker: 'USDY',
				assetName: 'Ondo USDY',
				category: ['Treasuries'],
				assetGroup: 'Treasuries',
				parentPlatform: 'Ondo',
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: { Ethereum: { Aave: 20 } }
			}
		])
		serve({ [PERPS_CURRENT]: new Error('temporary outage') })

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: ['Ondo'],
				assetGroups: ['Treasuries']
			} as never
		})

		expect(result?.assets.map((asset) => asset.kind)).toEqual(['spot'])
		expect(result?.platforms).toEqual(['Ondo'])
	})

	test('requests initial category chart data with stablecoins enabled for stablecoin categories', async () => {
		serveListing([])

		const stablecoinCategories = [
			{ label: 'RWA Stablecoins', slug: 'rwa-stablecoins' },
			{ label: 'Non-RWA Stablecoins', slug: 'non-rwa-stablecoins' },
			{ label: 'Fiat Stablecoins', slug: 'fiat-stablecoins' }
		]

		for (const category of stablecoinCategories) {
			serveBreakdown(`category/${category.slug}`, null)
			await getRWAAssetsOverview({
				category: category.slug,
				rwaList: {
					chains: ['Ethereum'],
					categories: stablecoinCategories.map(({ label }) => label),
					platforms: [],
					assetGroups: []
				} as never
			})
		}

		expect(requestedUrls()).toEqual(
			expect.arrayContaining(stablecoinCategories.map(({ slug }) => assetBreakdown(`category/${slug}`)))
		)
	})

	test('requests initial other-rwas category chart data with stablecoins and governance enabled', async () => {
		serveListing([])
		serveBreakdown('category/other-rwas', null)

		await getRWAAssetsOverview({
			category: 'other-rwas',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Other RWAs'],
				platforms: [],
				assetGroups: []
			} as never
		})

		expect(requestedUrls()).toContain(assetBreakdown('category/other-rwas'))
	})

	test('infers stablecoin inclusion for a platform whose only spot asset is a stablecoin', async () => {
		serveBreakdown('platform/curve', NO_HISTORY)
		serveListing([
			{
				id: 'curve-usd',
				ticker: 'crvUSD',
				assetName: 'crvUSD',
				parentPlatform: 'Curve',
				category: ['Non-RWA Stablecoins'],
				stablecoin: true,
				governance: false,
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: {}
			}
		])

		const result = await getRWAAssetsOverview({
			platform: 'curve',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Non-RWA Stablecoins'],
				platforms: ['Curve'],
				assetGroups: []
			} as never
		})

		// The wrapper default is asserted in constants.test.ts; this checks the stablecoin inference only.
		expect(result?.defaultInclusion).toMatchObject({
			includeStablecoins: true,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true
		})
		expect(requestedUrls()).toContain(assetBreakdown('platform/curve'))
	})

	test('keeps stablecoins off when a platform has as many base assets as stablecoins', async () => {
		serveBreakdown('platform/mixed', NO_HISTORY)
		serveListing([
			{
				id: 'base',
				ticker: 'BASE',
				assetName: 'Base Asset',
				parentPlatform: 'Mixed',
				stablecoin: false,
				governance: false,
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: {}
			},
			{
				id: 'stable',
				ticker: 'USD',
				assetName: 'Stable Asset',
				parentPlatform: 'Mixed',
				stablecoin: true,
				governance: false,
				onChainMcap: { Ethereum: 50 },
				activeMcap: { Ethereum: 45 },
				defiActiveTvl: {}
			}
		])

		const result = await getRWAAssetsOverview({
			platform: 'mixed',
			rwaList: {
				chains: ['Ethereum'],
				categories: [],
				platforms: ['Mixed'],
				assetGroups: []
			} as never
		})

		expect(result?.defaultInclusion.includeStablecoins).toBe(false)
	})

	test('attaches seven day prior values and first seen from the prefetched series', async () => {
		serve({ [chainHistory('ethereum', 'activeMcap')]: NO_HISTORY })
		const day = 86_400
		const latest = 1_800_000_000
		serveListing([
			{
				id: 'alpha',
				canonicalMarketId: 'alpha',
				ticker: 'ALPHA',
				assetName: 'Alpha',
				category: ['Treasuries'],
				stablecoin: false,
				governance: false,
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: { Ethereum: { Aave: 10 } },
				bridgeTvl: { Ethereum: 2 }
			},
			{
				id: 'beta',
				canonicalMarketId: 'beta',
				ticker: 'BETA',
				assetName: 'Beta',
				category: ['Treasuries'],
				stablecoin: false,
				governance: false,
				onChainMcap: { Ethereum: 50 },
				activeMcap: { Ethereum: 50 },
				defiActiveTvl: {}
			}
		])
		serveBreakdown('chain/all', {
			activeMcap: [
				{ timestamp: latest - 7 * day, alpha: 80 },
				{ timestamp: latest - 2 * day, alpha: 85, beta: 40 },
				{ timestamp: latest, alpha: 90, beta: 50 }
			],
			onChainMcap: [
				{ timestamp: latest - 7 * day, alpha: 95 },
				{ timestamp: latest - 2 * day, alpha: 99, beta: 45 },
				{ timestamp: latest, alpha: 100, beta: 50 }
			],
			defiActiveTvl: [
				{ timestamp: latest - 7 * day, alpha: 8 },
				{ timestamp: latest, alpha: 10 }
			],
			bridgeTvl: [
				{ timestamp: latest - 7 * day, alpha: 1 },
				{ timestamp: latest, alpha: 2 }
			]
		})

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: [],
				assetGroups: []
			} as never
		})

		const rows = new Map(result?.assets.map((asset) => [asset.id, asset]))
		const alpha = rows.get('alpha')
		const beta = rows.get('beta')
		if (alpha?.kind !== 'spot' || beta?.kind !== 'spot') throw new Error('expected spot rows')
		expect(alpha.priors?.['7d']).toEqual({
			activeMcap: 80,
			onChainMcap: 95,
			defiActiveTvl: 8,
			bridgeTvl: 1
		})
		expect(alpha.priors?.['1d']).toEqual({
			activeMcap: 85,
			onChainMcap: 99,
			defiActiveTvl: null,
			bridgeTvl: null
		})
		expect(alpha.firstSeen).toBe((latest - 7 * day) * 1e3)
		expect(beta.priors?.['7d']).toEqual({
			activeMcap: 0,
			onChainMcap: 0,
			defiActiveTvl: 0,
			bridgeTvl: 0
		})
		expect(beta.firstSeen).toBe((latest - 2 * day) * 1e3)
		expect(result?.seriesLatestTimestamp).toBe(latest * 1e3)
		expect(result?.platformLogos).toEqual({})
	})

	test('keeps each asset category order and offers every category an asset carries', async () => {
		serveBreakdown('category/other-rwas', NO_HISTORY)
		serveListing([
			{
				id: 'stablecoin-1',
				ticker: 'RUSD',
				assetName: 'RWA USD',
				category: ['RWA Stablecoins', 'Other RWAs'],
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: { Ethereum: { Aave: 20 } }
			},
			{
				id: 'other-1',
				ticker: 'ART',
				assetName: 'Art Token',
				category: ['Other RWAs'],
				onChainMcap: { Ethereum: 50 },
				activeMcap: { Ethereum: 45 },
				defiActiveTvl: { Ethereum: { Aave: 10 } }
			}
		])

		const result = await getRWAAssetsOverview({
			category: 'other-rwas',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['RWA Stablecoins', 'Other RWAs'],
				platforms: [],
				assetGroups: []
			} as never
		})

		expect(result?.assets[0]?.category).toEqual(['RWA Stablecoins', 'Other RWAs'])
		expect(result?.categoriesOptions).toEqual([
			{
				key: 'Other RWAs',
				name: 'Other RWAs',
				help: expect.stringContaining('alternative or niche real-world assets')
			},
			{
				key: 'RWA Stablecoins',
				name: 'RWA Stablecoins',
				help: expect.stringContaining('Fiat-pegged stablecoins')
			}
		])
	})

	test('offers Unknown for a field an asset lacks, so the default view shows that asset', async () => {
		serveBreakdown('chain/ethereum', NO_HISTORY)
		const asset = {
			category: ['Treasuries'],
			assetGroup: 'Treasuries',
			chain: ['Ethereum'],
			activeMcap: { Ethereum: 5 },
			defiActiveTvl: { Ethereum: { Aave: 1 } }
		}
		serveListing([
			{
				...asset,
				id: 'typed',
				canonicalMarketId: 'typed',
				ticker: 'TYP',
				assetName: 'Typed',
				type: 'Asset',
				parentPlatform: 'Ondo',
				rwaClassification: 'RWA',
				onChainMcap: { Ethereum: 20 }
			},
			{
				...asset,
				id: 'bare',
				canonicalMarketId: 'bare',
				ticker: 'BAR',
				assetName: 'Bare',
				onChainMcap: { Ethereum: 10 }
			}
		])

		const overview = await getRWAAssetsOverview({
			chain: 'ethereum',
			rwaList: { chains: ['Ethereum'], categories: ['Treasuries'], platforms: [], assetGroups: ['Treasuries'] } as never
		})
		if (!overview) throw new Error('Expected an overview')

		expect(overview.typeOptions.map((option) => option.key)).toEqual(['Asset', 'Unknown'])
		expect(overview.platforms).toEqual(['Ondo', 'Unknown'])
		expect(overview.rwaClassificationOptions.map((option) => option.key)).toEqual(['RWA', 'Unknown'])

		const filters = readRwaQueryFilters(
			{},
			{
				...getRankedRwaFilterValues(overview),
				assetNames: overview.assetNames,
				platforms: overview.platforms,
				assetGroups: overview.assetGroups,
				issuers: overview.issuers
			},
			'chain'
		)
		const { filteredAssets } = filterRwaOverviewDisplayRows(overview.assets, {
			...filters,
			isPlatformMode: false,
			includeStablecoins: true,
			includeGovernance: true,
			includeRwaPerps: false,
			includeCex: false,
			includeBridgeTvl: true,
			includeWrappers: true
		})
		expect(filteredAssets.map((row) => row.id)).toEqual(['typed', 'bare'])
	})

	test('resolves perps-only platform slugs on platform overview routes', async () => {
		serveBreakdown('platform/trade-xyz', NO_HISTORY)
		serveListing([])
		serve({
			[PERPS_CURRENT]: [
				{
					id: 'perps-1',
					timestamp: 1,
					contract: 'xyz:gold',
					venue: 'xyz',
					venueType: 'DEX',
					openInterest: 10,
					openInterestChange24h: null,
					volume24h: 20,
					volume24hChange24h: null,
					price: 1.01,
					priceChange24h: 0,
					fundingRate: 0,
					premium: 0,
					cumulativeFunding: 0,
					referenceAsset: 'Gold',
					referenceAssetGroup: 'Commodities',
					assetClass: ['Commodities'],
					parentPlatform: 'Trade[XYZ]',
					pair: null,
					marginAsset: null,
					settlementAsset: null,
					category: ['Commodities'],
					issuer: 'XYZ',
					website: null,
					link: null,
					oracleProvider: null,
					description: null,
					accessModel: 'Permissionless',
					rwaClassification: 'RWA',
					makerFeeRate: 0,
					takerFeeRate: 0,
					deployerFeeShare: 0,
					oraclePx: 0,
					midPx: 0,
					prevDayPx: 0,
					maxLeverage: 0,
					szDecimals: 0,
					fundingIntervalHours: 1,
					volume7d: 0,
					volume30d: 0,
					volumeAllTime: 0,
					estimatedProtocolFees24h: 0,
					estimatedProtocolFees7d: 0,
					estimatedProtocolFees30d: 0,
					estimatedProtocolFeesAllTime: 0,
					suspicious: false
				}
			]
		})

		const result = await getRWAAssetsOverview({
			platform: 'trade-xyz',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Commodities'],
				platforms: [],
				assetGroups: ['Commodities']
			} as never
		})

		expect(result?.selectedPlatform).toBe('Trade[XYZ]')
		expect(result?.assets.map((asset) => asset.kind)).toEqual(['perps'])
	})

	test('drops the active mcap chart metric for a platform whose whole supply is excluded', async () => {
		// Crypto.com shape: onChainMcap is tracked but activeMcapData is off, so the API omits activeMcap.
		serveListing([
			{
				id: 'cdc-nvda',
				ticker: 'NVDA',
				assetName: 'NVIDIA Corporation (Crypto.com Tokenized Stock)',
				parentPlatform: 'Crypto.com',
				category: ['Stocks & Equities'],
				stablecoin: false,
				governance: false,
				activeMcapData: false,
				onChainMcap: { Cronos: 249_813 },
				defiActiveTvl: {}
			}
		])
		serveBreakdown('platform/crypto-com', {
			activeMcap: [],
			onChainMcap: [{ timestamp: 1_787_702_400, 'cdc-nvda': 249_813 }],
			defiActiveTvl: []
		})

		const result = await getRWAAssetsOverview({
			platform: 'crypto-com',
			rwaList: {
				chains: ['Cronos'],
				categories: ['Stocks & Equities'],
				platforms: ['Crypto.com'],
				assetGroups: ['Public Equities']
			} as never
		})

		expect(result?.chartMetricAvailability.hasActiveMcapData).toBe(false)
		expect(result?.initialChartDatasets[0]?.metric).toBe('onChainMcap')
	})

	test('preloads the onchain fallback for an untracked regular-page scope', async () => {
		serve({ [chainHistory('cronos', 'onChainMcap')]: NO_HISTORY })
		serveListing([
			{
				id: 'cdc-nvda',
				canonicalMarketId: 'cdc-nvda',
				ticker: 'NVDA',
				assetName: 'NVIDIA Corporation',
				assetGroup: 'Public Equities',
				category: ['Stocks & Equities'],
				stablecoin: false,
				governance: false,
				activeMcapData: false,
				onChainMcap: { Cronos: 249_813 },
				defiActiveTvl: {}
			}
		])
		serveBreakdown('chain/all', {
			activeMcap: [],
			onChainMcap: [{ timestamp: 1, 'cdc-nvda': 249_813 }],
			defiActiveTvl: []
		})

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Cronos'],
				categories: ['Stocks & Equities'],
				platforms: ['Crypto.com'],
				assetGroups: ['Public Equities']
			} as never
		})

		expect(result?.chartMetricAvailability.hasActiveMcapData).toBe(false)
		expect(result?.initialChartDatasets[0]?.metric).toBe('onChainMcap')
		expect(result?.initialChartDatasets[0]?.dataset.source).toHaveLength(1)
	})

	test('keeps active mcap when configured even if the current breakdown is empty', async () => {
		serveListing([
			{
				id: 'rh-nvda',
				ticker: 'NVDA',
				assetName: 'NVIDIA Corporation',
				parentPlatform: 'Robinhood',
				category: ['Stocks & Equities'],
				stablecoin: false,
				governance: false,
				activeMcapData: true,
				onChainMcap: { Arbitrum: 7_379_058 },
				defiActiveTvl: {}
			}
		])
		serveBreakdown('platform/robinhood', {
			activeMcap: [{ timestamp: 1_787_702_400, 'rh-nvda': 7_379_058 }],
			onChainMcap: [],
			defiActiveTvl: []
		})

		const result = await getRWAAssetsOverview({
			platform: 'robinhood',
			rwaList: {
				chains: ['Arbitrum'],
				categories: ['Stocks & Equities'],
				platforms: ['Robinhood'],
				assetGroups: ['Public Equities']
			} as never
		})

		expect(result?.chartMetricAvailability.hasActiveMcapData).toBe(true)
		expect(result?.initialChartDatasets[0]?.metric).toBe('activeMcap')
	})

	test('resolves active metadata-only platforms without inventing assets', async () => {
		serveBreakdown('platform/metadata-only', NO_HISTORY)
		serveListing([])

		const result = await getRWAAssetsOverview({
			platform: 'metadata-only',
			rwaList: {
				canonicalMarketIds: [],
				chains: [],
				categories: [],
				platforms: ['Metadata Only'],
				platformRoutes: [{ name: 'Metadata Only', slug: 'metadata-only' }],
				assetGroups: [],
				idMap: {}
			}
		})

		expect(result?.selectedPlatform).toBe('Metadata Only')
		expect(result?.assets).toEqual([])
		// No spot assets is not evidence that activeMcap is untracked, so the metric switch is left alone.
		expect(result?.chartMetricAvailability.hasActiveMcapData).toBe(true)
	})

	test('ships only the logos of platforms present in the rows', async () => {
		serveBreakdown('chain/all', NO_HISTORY)
		serveListing([
			{
				id: 'usdy',
				canonicalMarketId: 'ondo/usdy',
				ticker: 'USDY',
				assetName: 'Ondo USDY',
				parentPlatform: 'Ondo',
				category: ['Treasuries'],
				stablecoin: false,
				governance: false,
				onChainMcap: { Ethereum: 100 },
				activeMcap: { Ethereum: 90 },
				defiActiveTvl: {}
			}
		])
		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries'],
				platforms: ['Ondo'],
				assetGroups: []
			} as never,
			rwaPlatformsIndex: {
				platforms: {
					ondo: { logo: 'https://icons/ondo.png' },
					securitize: { logo: 'https://icons/securitize.png' }
				}
			} as never
		})
		expect(result?.platformLogos).toEqual({ ondo: 'https://icons/ondo.png' })
	})

	test('transposes the chain → protocol tvl map into per-protocol chain breakdowns sorted desc', () => {
		expect(
			buildRwaDefiTvlProtocolChainBreakdown({
				Ethereum: { Morpho: 10, Euler: 4 },
				Solana: { Morpho: 2, Kamino: 7 }
			})
		).toEqual([
			{
				protocol: 'Morpho',
				total: 12,
				byChain: [
					['Ethereum', 10],
					['Solana', 2]
				]
			},
			{ protocol: 'Kamino', total: 7, byChain: [['Solana', 7]] },
			{ protocol: 'Euler', total: 4, byChain: [['Ethereum', 4]] }
		])
	})

	test('returns null for an empty tvl map', () => {
		expect(buildRwaDefiTvlProtocolChainBreakdown({})).toBeNull()
	})
})
