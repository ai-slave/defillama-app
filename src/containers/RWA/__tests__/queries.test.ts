import { beforeEach, describe, expect, test, vi } from 'vitest'
import { buildRwaDefiTvlProtocolChainBreakdown, getRWAAssetsOverview, getRWACategoriesOverview } from '../queries'

const fetchRWAActiveTVLsMock = vi.fn()
const fetchRWAChartDataByAssetMock = vi.fn()
const fetchRWAChainBreakdownChartDataMock = vi.fn()
const fetchRWAStatsMock = vi.fn()
const fetchRWACategoryBreakdownChartDataMock = vi.fn()
const fetchRWAPlatformBreakdownChartDataMock = vi.fn()
const fetchRWAAssetGroupBreakdownChartDataMock = vi.fn()
const fetchRWAAssetDataByIdMock = vi.fn()
const fetchRWAAssetChartDataMock = vi.fn()
const fetchRWAPerpsCurrentMock = vi.fn()
const fetchRWAPerpsContractBreakdownChartDataMock = vi.fn()
const fetchRWAPerpsOverviewBreakdownChartDataMock = vi.fn()

vi.mock('../api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../api')>()
	return {
		...actual,
		fetchRWAActiveTVLs: (...args: Array<unknown>) => fetchRWAActiveTVLsMock(...args),
		fetchRWAChartDataByAsset: (...args: Array<unknown>) => fetchRWAChartDataByAssetMock(...args),
		fetchRWAChainBreakdownChartData: (...args: Array<unknown>) => fetchRWAChainBreakdownChartDataMock(...args),
		fetchRWAStats: (...args: Array<unknown>) => fetchRWAStatsMock(...args),
		fetchRWACategoryBreakdownChartData: (...args: Array<unknown>) => fetchRWACategoryBreakdownChartDataMock(...args),
		fetchRWAPlatformBreakdownChartData: (...args: Array<unknown>) => fetchRWAPlatformBreakdownChartDataMock(...args),
		fetchRWAAssetGroupBreakdownChartData: (...args: Array<unknown>) =>
			fetchRWAAssetGroupBreakdownChartDataMock(...args),
		fetchRWAAssetDataById: (...args: Array<unknown>) => fetchRWAAssetDataByIdMock(...args),
		fetchRWAAssetChartData: (...args: Array<unknown>) => fetchRWAAssetChartDataMock(...args)
	}
})

vi.mock('../Perps/api', () => ({
	fetchRWAPerpsCurrent: (...args: Array<unknown>) => fetchRWAPerpsCurrentMock(...args),
	fetchRWAPerpsContractBreakdownChartData: (...args: Array<unknown>) =>
		fetchRWAPerpsContractBreakdownChartDataMock(...args),
	fetchRWAPerpsOverviewBreakdownChartData: (...args: Array<unknown>) =>
		fetchRWAPerpsOverviewBreakdownChartDataMock(...args)
}))

describe('rwa queries', () => {
	beforeEach(() => {
		fetchRWAActiveTVLsMock.mockReset()
		fetchRWAChartDataByAssetMock.mockReset()
		fetchRWAChainBreakdownChartDataMock.mockReset()
		fetchRWAStatsMock.mockReset()
		fetchRWACategoryBreakdownChartDataMock.mockReset()
		fetchRWAPlatformBreakdownChartDataMock.mockReset()
		fetchRWAAssetGroupBreakdownChartDataMock.mockReset()
		fetchRWAAssetDataByIdMock.mockReset()
		fetchRWAAssetChartDataMock.mockReset()
		fetchRWAPerpsCurrentMock.mockReset()
		fetchRWAPerpsContractBreakdownChartDataMock.mockReset()
		fetchRWAChartDataByAssetMock.mockResolvedValue(null)
		fetchRWAChainBreakdownChartDataMock.mockResolvedValue([])
		fetchRWACategoryBreakdownChartDataMock.mockResolvedValue([])
		fetchRWAPlatformBreakdownChartDataMock.mockResolvedValue([])
		fetchRWAAssetGroupBreakdownChartDataMock.mockResolvedValue([])
		fetchRWAAssetDataByIdMock.mockResolvedValue(null)
		fetchRWAAssetChartDataMock.mockResolvedValue(null)
		fetchRWAPerpsCurrentMock.mockResolvedValue([])
		fetchRWAPerpsContractBreakdownChartDataMock.mockResolvedValue([])
		fetchRWAPerpsOverviewBreakdownChartDataMock.mockReset()
		fetchRWAPerpsOverviewBreakdownChartDataMock.mockResolvedValue([])
	})

	test('excludes assets tagged as RWA Perps from the standard rwa overview', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChartDataByAssetMock.mockResolvedValue({
			activeMcap: [{ timestamp: 1, alpha: 10 }],
			onChainMcap: [],
			defiActiveTvl: []
		})

		const result = await getRWAAssetsOverview({
			rwaList: { chains: ['Ethereum'], categories: ['Treasuries'], platforms: [], assetGroups: ['Treasuries'] } as never
		})

		expect(fetchRWAChartDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'all' },
			includeStablecoins: true,
			includeGovernance: true
		})
		expect(fetchRWAChartDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'chain', slug: 'ethereum' },
			includeStablecoins: true,
			includeGovernance: true
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
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChartDataByAssetMock.mockImplementation(({ target }: { target: { kind: string; slug?: string } }) => {
			if (target.kind === 'all')
				return Promise.resolve({ activeMcap: [{ timestamp: 1, alpha: 15 }], onChainMcap: [], defiActiveTvl: [] })
			if (target.slug === 'ethereum')
				return Promise.resolve({ activeMcap: [{ timestamp: 1, alpha: 10 }], onChainMcap: [], defiActiveTvl: [] })
			return Promise.reject(new Error('solana down'))
		})
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum', 'Solana'],
				categories: ['Treasuries'],
				platforms: [],
				assetGroups: ['Treasuries']
			} as never
		})

		errorSpy.mockRestore()
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
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChainBreakdownChartDataMock.mockResolvedValue([
			{ timestamp: 0, Ethereum: 8 },
			{ timestamp: 31 * 24 * 60 * 60 * 1000, Ethereum: 10 }
		])
		fetchRWAPerpsOverviewBreakdownChartDataMock.mockImplementation(({ includeCex }: { includeCex: boolean }) =>
			Promise.resolve([
				{ timestamp: 1, Hyperliquid: 5, ...(includeCex ? { Binance: 20 } : {}) },
				{ timestamp: 2, Hyperliquid: 6, ...(includeCex ? { Binance: 24 } : {}) }
			])
		)

		const result = await getRWAAssetsOverview({
			rwaList: { chains: ['Ethereum'], categories: ['Treasuries'], platforms: [], assetGroups: ['Treasuries'] } as never
		})
		expect(fetchRWAPerpsOverviewBreakdownChartDataMock).toHaveBeenCalledWith({
			breakdown: 'venue',
			key: 'openInterest',
			target: { kind: 'all' },
			includeCex: true
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
			rwaList: { chains: ['Ethereum'], categories: ['Treasuries'], platforms: [], assetGroups: ['Treasuries'] } as never
		})
		expect(scoped).not.toBeNull()
		expect(scoped?.cards).toBeNull()
	})

	test('keeps suspicious assets visible while excluding them from initial totals and charts', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChartDataByAssetMock.mockResolvedValue({
			activeMcap: [{ timestamp: 1, alpha: 10, beta: 20 }],
			onChainMcap: [],
			defiActiveTvl: []
		})

		const result = await getRWAAssetsOverview({
			rwaList: { chains: ['Ethereum'], categories: ['Treasuries'], platforms: [], assetGroups: ['Treasuries'] } as never
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
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChartDataByAssetMock.mockResolvedValue({
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

	test('keeps selected-chain table metric breakdowns filtered and sorted', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		expect(asset.onChainMcap).toEqual({ total: 100, breakdown: [['Ethereum', 100]] })
		expect(asset.activeMcap).toEqual({ total: 90, breakdown: [['Ethereum', 90]] })
		expect(asset.defiActiveTvl).toEqual({
			total: 25,
			breakdown: [
				['Aave', 20],
				['Morpho', 5]
			]
		})
		expect(asset.defiActiveTvlByChain).toEqual({ total: 25, breakdown: [['Ethereum', 25]] })
		expect(asset.bridgeTvl).toBe(5)
		expect(asset.bridgeTvlByChain).toEqual({ total: 5, breakdown: [['Ethereum', 5]] })
		expect(asset.bridgeTvlByProtocol).toEqual({ total: 5, breakdown: [['Morpho', 5]] })
	})

	test('merges perps contracts into the overview rows', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAPerpsCurrentMock.mockResolvedValue([
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
		])
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
		expect(fetchRWAPerpsCurrentMock).toHaveBeenLastCalledWith(true)
		expect(fetchRWAPerpsContractBreakdownChartDataMock).not.toHaveBeenCalled()
		expect(result?.assets[1]).toMatchObject({ venueType: 'DEX', attestations: null })
		expect(result?.assets[2]).toMatchObject({ venueType: 'CEX', attestations: null })
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
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAPerpsCurrentMock.mockRejectedValue(new Error('temporary outage'))

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
		fetchRWAActiveTVLsMock.mockResolvedValue([])

		const stablecoinCategories = [
			{ label: 'RWA Stablecoins', slug: 'rwa-stablecoins' },
			{ label: 'Non-RWA Stablecoins', slug: 'non-rwa-stablecoins' },
			{ label: 'Fiat Stablecoins', slug: 'fiat-stablecoins' }
		]

		for (const category of stablecoinCategories) {
			fetchRWAChartDataByAssetMock.mockClear()

			await getRWAAssetsOverview({
				category: category.slug,
				rwaList: {
					chains: ['Ethereum'],
					categories: stablecoinCategories.map(({ label }) => label),
					platforms: [],
					assetGroups: []
				} as never
			})

			expect(fetchRWAChartDataByAssetMock).toHaveBeenCalledWith({
				target: { kind: 'category', slug: category.slug },
				includeStablecoins: true,
				includeGovernance: true
			})
		}
	})

	test('requests initial other-rwas category chart data with stablecoins and governance enabled', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([])

		await getRWAAssetsOverview({
			category: 'other-rwas',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Other RWAs'],
				platforms: [],
				assetGroups: []
			} as never
		})

		expect(fetchRWAChartDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'category', slug: 'other-rwas' },
			includeStablecoins: true,
			includeGovernance: true
		})
	})

	test('infers stablecoin inclusion for a platform whose only spot asset is a stablecoin', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		expect(fetchRWAChartDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'platform', slug: 'curve' },
			includeStablecoins: true,
			includeGovernance: true
		})
	})

	test('keeps stablecoins off when a platform has as many base assets as stablecoins', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
			rwaList: { chains: ['Ethereum'], categories: [], platforms: ['Mixed'], assetGroups: [] } as never
		})

		expect(result?.defaultInclusion.includeStablecoins).toBe(false)
	})

	test('attaches seven day prior values and first seen from the prefetched series', async () => {
		const day = 86_400
		const latest = 1_800_000_000
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChartDataByAssetMock.mockResolvedValue({
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
			rwaList: { chains: ['Ethereum'], categories: ['Treasuries'], platforms: [], assetGroups: [] } as never
		})

		const rows = new Map(result?.assets.map((asset) => [asset.id, asset]))
		const alpha = rows.get('alpha')
		const beta = rows.get('beta')
		if (alpha?.kind !== 'spot' || beta?.kind !== 'spot') throw new Error('expected spot rows')
		expect(alpha.priors?.['7d']).toEqual({ activeMcap: 80, onChainMcap: 95, defiActiveTvl: 8, bridgeTvl: 1 })
		expect(alpha.priors?.['1d']).toEqual({ activeMcap: 85, onChainMcap: 99, defiActiveTvl: null, bridgeTvl: null })
		expect(alpha.firstSeen).toBe((latest - 7 * day) * 1e3)
		expect(beta.priors?.['7d']).toEqual({ activeMcap: 0, onChainMcap: 0, defiActiveTvl: 0, bridgeTvl: 0 })
		expect(beta.firstSeen).toBe((latest - 2 * day) * 1e3)
		expect(result?.seriesLatestTimestamp).toBe(latest * 1e3)
		expect(result?.platformLogos).toEqual({})
	})

	test('preserves original category order when filtering by a secondary category', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
				key: 'RWA Stablecoins',
				name: 'RWA Stablecoins',
				help: expect.stringContaining('Fiat-pegged stablecoins')
			},
			{
				key: 'Other RWAs',
				name: 'Other RWAs',
				help: expect.stringContaining('alternative or niche real-world assets')
			}
		])
	})

	test('resolves perps-only platform slugs on platform overview routes', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([])
		fetchRWAPerpsCurrentMock.mockResolvedValue([
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
		])

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
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChartDataByAssetMock.mockResolvedValue({
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
		expect(fetchRWAChartDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'platform', slug: 'crypto-com' },
			includeStablecoins: true,
			includeGovernance: true
		})
	})

	test('preloads the onchain fallback for an untracked regular-page scope', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChartDataByAssetMock.mockResolvedValue({
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
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
		fetchRWAChartDataByAssetMock.mockResolvedValue({
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
		expect(fetchRWAChartDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'platform', slug: 'robinhood' },
			includeStablecoins: true,
			includeGovernance: true
		})
	})

	test('resolves active metadata-only platforms without inventing assets', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([])

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

	test('excludes the RWA Perps bucket from category overview rows', async () => {
		fetchRWAStatsMock.mockResolvedValue({
			byCategory: {
				Treasuries: {
					base: { onChainMcap: 100, activeMcap: 90, defiActiveTvl: 10, assetCount: 1, assetIssuers: ['Issuer A'] },
					stablecoinsOnly: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
					governanceOnly: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
					stablecoinsAndGovernance: {
						onChainMcap: 0,
						activeMcap: 0,
						defiActiveTvl: 0,
						assetCount: 0,
						assetIssuers: []
					}
				},
				'RWA Perps': {
					base: { onChainMcap: 500, activeMcap: 450, defiActiveTvl: 0, assetCount: 2, assetIssuers: ['Issuer P'] },
					stablecoinsOnly: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
					governanceOnly: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
					stablecoinsAndGovernance: {
						onChainMcap: 0,
						activeMcap: 0,
						defiActiveTvl: 0,
						assetCount: 0,
						assetIssuers: []
					}
				}
			}
		})

		const result = await getRWACategoriesOverview()

		expect(result.rows.map((row) => row.category)).toEqual(['Treasuries'])
	})

	test('ships only the logos of platforms present in the rows', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([
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
			rwaList: { chains: ['Ethereum'], categories: ['Treasuries'], platforms: ['Ondo'], assetGroups: [] } as never,
			rwaPlatformsIndex: {
				platforms: { ondo: { logo: 'https://icons/ondo.png' }, securitize: { logo: 'https://icons/securitize.png' } }
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
