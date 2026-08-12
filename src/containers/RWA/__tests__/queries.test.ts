import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRwaDefiTvlProtocolChainBreakdown, getRWAAssetsOverview, getRWACategoriesOverview } from '../queries'

const fetchRWAActiveTVLsMock = vi.fn()
const fetchRWAChartMetricDataByAssetMock = vi.fn()
const fetchRWAChainBreakdownChartDataMock = vi.fn()
const fetchRWAStatsMock = vi.fn()
const fetchRWACategoryBreakdownChartDataMock = vi.fn()
const fetchRWAPlatformBreakdownChartDataMock = vi.fn()
const fetchRWAAssetGroupBreakdownChartDataMock = vi.fn()
const fetchRWAAssetDataByIdMock = vi.fn()
const fetchRWAAssetChartDataMock = vi.fn()
const fetchRWAPerpsCurrentMock = vi.fn()
const fetchRWAPerpsContractBreakdownChartDataMock = vi.fn()

vi.mock('../api', () => ({
	fetchRWAActiveTVLs: (...args: unknown[]) => fetchRWAActiveTVLsMock(...args),
	fetchRWAChartMetricDataByAsset: (...args: unknown[]) => fetchRWAChartMetricDataByAssetMock(...args),
	fetchRWAChainBreakdownChartData: (...args: unknown[]) => fetchRWAChainBreakdownChartDataMock(...args),
	fetchRWAStats: (...args: unknown[]) => fetchRWAStatsMock(...args),
	fetchRWACategoryBreakdownChartData: (...args: unknown[]) => fetchRWACategoryBreakdownChartDataMock(...args),
	fetchRWAPlatformBreakdownChartData: (...args: unknown[]) => fetchRWAPlatformBreakdownChartDataMock(...args),
	fetchRWAAssetGroupBreakdownChartData: (...args: unknown[]) => fetchRWAAssetGroupBreakdownChartDataMock(...args),
	fetchRWAAssetDataById: (...args: unknown[]) => fetchRWAAssetDataByIdMock(...args),
	fetchRWAAssetChartData: (...args: unknown[]) => fetchRWAAssetChartDataMock(...args)
}))

vi.mock('../Perps/api', () => ({
	fetchRWAPerpsCurrent: (...args: unknown[]) => fetchRWAPerpsCurrentMock(...args),
	fetchRWAPerpsContractBreakdownChartData: (...args: unknown[]) => fetchRWAPerpsContractBreakdownChartDataMock(...args)
}))

describe('rwa queries', () => {
	beforeEach(() => {
		fetchRWAActiveTVLsMock.mockReset()
		fetchRWAChartMetricDataByAssetMock.mockReset()
		fetchRWAChainBreakdownChartDataMock.mockReset()
		fetchRWAStatsMock.mockReset()
		fetchRWACategoryBreakdownChartDataMock.mockReset()
		fetchRWAPlatformBreakdownChartDataMock.mockReset()
		fetchRWAAssetGroupBreakdownChartDataMock.mockReset()
		fetchRWAAssetDataByIdMock.mockReset()
		fetchRWAAssetChartDataMock.mockReset()
		fetchRWAPerpsCurrentMock.mockReset()
		fetchRWAPerpsContractBreakdownChartDataMock.mockReset()
		fetchRWAChartMetricDataByAssetMock.mockResolvedValue(null)
		fetchRWAChainBreakdownChartDataMock.mockResolvedValue([])
		fetchRWACategoryBreakdownChartDataMock.mockResolvedValue([])
		fetchRWAPlatformBreakdownChartDataMock.mockResolvedValue([])
		fetchRWAAssetGroupBreakdownChartDataMock.mockResolvedValue([])
		fetchRWAAssetDataByIdMock.mockResolvedValue(null)
		fetchRWAAssetChartDataMock.mockResolvedValue(null)
		fetchRWAPerpsCurrentMock.mockResolvedValue([])
		fetchRWAPerpsContractBreakdownChartDataMock.mockResolvedValue([])
	})

	it('excludes assets tagged as RWA Perps from the standard rwa overview', async () => {
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

	it('serializes one canonical active-mcap history for the initial regular-page chart', async () => {
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
		fetchRWAChartMetricDataByAssetMock.mockResolvedValue([{ timestamp: 1_000, alpha: 10 }])

		const result = await getRWAAssetsOverview({
			rwaList: { chains: ['Ethereum'], categories: ['Treasuries'], platforms: [], assetGroups: ['Treasuries'] } as never
		})

		expect(fetchRWAChartMetricDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'all' },
			metric: 'activeMcap',
			includeStablecoins: false,
			includeGovernance: false
		})
		expect(result?.initialChartDataset).toEqual({
			metric: 'activeMcap',
			dataset: {
				dimensions: ['timestamp', 'Total Active Mcap', 'Treasuries'],
				source: [[1_000, 10, 10]]
			}
		})
	})

	it('groups the public equities initial chart by platform', async () => {
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
		fetchRWAChartMetricDataByAssetMock.mockResolvedValue([{ timestamp: 1_000, alpha: 10, beta: 20 }])

		const result = await getRWAAssetsOverview({
			assetGroup: 'public-equities',
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Public Equities'],
				platforms: ['Ondo', 'Backed'],
				assetGroups: ['Public Equities']
			} as never
		})

		expect(result?.initialChartDataset).toEqual({
			metric: 'activeMcap',
			dataset: {
				dimensions: ['timestamp', 'Total Active Mcap', 'Backed', 'Ondo'],
				source: [[1_000, 30, 20, 10]]
			}
		})
	})

	it('keeps selected-chain table metric breakdowns filtered and sorted', async () => {
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
				}
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
		expect(result?.assets[0]?.onChainMcap).toEqual({ total: 100, breakdown: [['Ethereum', 100]] })
		expect(result?.assets[0]?.activeMcap).toEqual({ total: 90, breakdown: [['Ethereum', 90]] })
		expect(result?.assets[0]?.defiActiveTvl).toEqual({
			total: 25,
			breakdown: [
				['Aave', 20],
				['Morpho', 5]
			]
		})
		expect(result?.assets[0]?.defiActiveTvlByChain).toEqual({ total: 25, breakdown: [['Ethereum', 25]] })
	})

	it('merges perps contracts into the overview rows', async () => {
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
		fetchRWAPerpsCurrentMock.mockResolvedValue([
			{
				id: 'perps-1',
				timestamp: 1,
				contract: 'xyz:usdy',
				venue: 'xyz',
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
		])
		fetchRWAPerpsContractBreakdownChartDataMock.mockResolvedValue([{ timestamp: 1_000, 'xyz:usdy': 10 }])

		const result = await getRWAAssetsOverview({
			rwaList: {
				chains: ['Ethereum'],
				categories: ['Treasuries', 'RWA Perps'],
				platforms: ['Ondo'],
				assetGroups: ['Treasuries']
			} as never
		})

		expect(result?.assets.map((asset) => asset.kind)).toEqual(['spot', 'perps'])
		expect(result?.assets[0]).toMatchObject({
			kind: 'spot',
			detailHref: '/rwa/asset/ondo%2Fusdy'
		})
		expect(result?.assets[1]).toMatchObject({
			kind: 'perps',
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
		expect(result?.initialOpenInterestChartDataset).toEqual({
			source: [{ timestamp: 1_000_000, 'RWA Perps OI': 10 }],
			dimensions: ['timestamp', 'RWA Perps OI']
		})
		expect(result?.totals.onChainMcap).toBe(100)
		expect(result?.totals.activeMcap).toBe(90)
		expect(result?.totals.defiActiveTvl).toBe(20)
		expect(result?.typeOptions.map((option) => option.key)).toContain('Perp')
		expect(result?.platforms).toContain('Ondo')
		expect(result?.assetGroups).toContain('Treasuries')
	})

	it('falls back to the spot overview when the perps markets request fails', async () => {
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

	it('requests initial category chart data with stablecoins enabled for stablecoin categories', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([])

		const stablecoinCategories = [
			{ label: 'RWA Stablecoins', slug: 'rwa-stablecoins' },
			{ label: 'Non-RWA Stablecoins', slug: 'non-rwa-stablecoins' },
			{ label: 'Fiat Stablecoins', slug: 'fiat-stablecoins' }
		]

		for (const category of stablecoinCategories) {
			fetchRWAChartMetricDataByAssetMock.mockClear()

			await getRWAAssetsOverview({
				category: category.slug,
				rwaList: {
					chains: ['Ethereum'],
					categories: stablecoinCategories.map(({ label }) => label),
					platforms: [],
					assetGroups: []
				} as never
			})

			expect(fetchRWAChartMetricDataByAssetMock).toHaveBeenCalledWith({
				target: { kind: 'category', slug: category.slug },
				metric: 'activeMcap',
				includeStablecoins: true,
				includeGovernance: false
			})
		}
	})

	it('requests initial other-rwas category chart data with stablecoins and governance enabled', async () => {
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

		expect(fetchRWAChartMetricDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'category', slug: 'other-rwas' },
			metric: 'activeMcap',
			includeStablecoins: true,
			includeGovernance: true
		})
	})

	it('infers stablecoin inclusion for a platform whose only spot asset is a stablecoin', async () => {
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

		expect(result?.defaultInclusion).toEqual({
			includeStablecoins: true,
			includeGovernance: false,
			includeRwaPerps: false
		})
		expect(fetchRWAChartMetricDataByAssetMock).toHaveBeenCalledWith({
			target: { kind: 'platform', slug: 'curve' },
			metric: 'activeMcap',
			includeStablecoins: true,
			includeGovernance: false
		})
	})

	it('keeps stablecoins off when a platform has as many base assets as stablecoins', async () => {
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

	it('preserves original category order when filtering by a secondary category', async () => {
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

	it('resolves perps-only platform slugs on platform overview routes', async () => {
		fetchRWAActiveTVLsMock.mockResolvedValue([])
		fetchRWAPerpsCurrentMock.mockResolvedValue([
			{
				id: 'perps-1',
				timestamp: 1,
				contract: 'xyz:gold',
				venue: 'xyz',
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

	it('resolves active metadata-only platforms without inventing assets', async () => {
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
	})

	it('excludes the RWA Perps bucket from category overview rows', async () => {
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

	it('transposes the chain → protocol tvl map into per-protocol chain breakdowns sorted desc', () => {
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

	it('returns null for an empty tvl map', () => {
		expect(buildRwaDefiTvlProtocolChainBreakdown({})).toBeNull()
	})
})
