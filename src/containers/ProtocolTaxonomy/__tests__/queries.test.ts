import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import type { ParentProtocolLite, ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'

const {
	fetchProtocolsMock,
	fetchAdapterChainMetricsMock,
	fetchAdapterChainChartDataMock,
	fetchAdapterChainChartDataByProtocolBreakdownMock,
	fetchAdapterChainChartDataByChainBreakdownMock,
	fetchCategoriesSummaryMock,
	fetchCategoryChartMock,
	fetchTagChartMock,
	fetchCardBreakdownChartMock,
	chainsByTaxonomyMock
} = vi.hoisted(() => ({
	fetchProtocolsMock: vi.fn(),
	fetchAdapterChainMetricsMock: vi.fn(),
	fetchAdapterChainChartDataMock: vi.fn(),
	fetchAdapterChainChartDataByProtocolBreakdownMock: vi.fn(),
	fetchAdapterChainChartDataByChainBreakdownMock: vi.fn(),
	fetchCategoriesSummaryMock: vi.fn(),
	fetchCategoryChartMock: vi.fn(),
	fetchTagChartMock: vi.fn(),
	fetchCardBreakdownChartMock: vi.fn(),
	chainsByTaxonomyMock: vi.fn()
}))

// Every source request goes through fetchJson; route each URL to the handler for that upstream.
vi.mock('~/utils/async', () => ({
	fetchJson: (url: string) => {
		const { href, pathname, searchParams } = new URL(url)
		const dataType = searchParams.get('dataType') ?? undefined
		if (href.startsWith(V2_SERVER_URL)) {
			const path = href.slice(V2_SERVER_URL.length).split('?')[0]
			const match =
				/^\/(metrics|chart)\/([^/]+)(?:\/category\/([^/]+))?(?:\/chain\/([^/]+))?(\/protocol-breakdown|\/chain-breakdown)?$/.exec(
					path
				)
			if (!match) throw new Error(`Unexpected adapter request: ${url}`)
			const [, route, adapterType, category, chain, breakdown] = match
			const request = { adapterType, dataType, category, chain }
			if (route === 'metrics') return fetchAdapterChainMetricsMock(request)
			if (breakdown === '/protocol-breakdown') return fetchAdapterChainChartDataByProtocolBreakdownMock(request)
			if (breakdown === '/chain-breakdown') return fetchAdapterChainChartDataByChainBreakdownMock(request)
			return fetchAdapterChainChartDataMock(request)
		}
		if (pathname === '/lite/protocols2') return fetchProtocolsMock()
		if (pathname === '/lite/chains-by-categories' || pathname === '/lite/chains-by-tags')
			return chainsByTaxonomyMock(url)
		if (href === `${SERVER_URL}/categories`) return fetchCategoriesSummaryMock()
		if (pathname.startsWith('/charts/categories/')) return fetchCategoryChartMock()
		if (pathname.startsWith('/charts/tags/')) return fetchTagChartMock()
		const card = /\/charts\/(network|custody)-breakdown$/.exec(pathname)
		if (card) return fetchCardBreakdownChartMock(card[1])
		throw new Error(`Unexpected request: ${url}`)
	}
}))

import { SERVER_URL, V2_SERVER_URL } from '~/constants'
import {
	buildCategoryCharts,
	buildBreakdownCharts,
	getProtocolTaxonomyPageData,
	getProtocolsCategoriesChartData,
	getProtocolsCategoriesPageData,
	mergeProtocolsWithAdapterFallback
} from '../queries'

const categoriesAndTags = {
	categories: ['Interface'],
	tags: [],
	tagCategoryMap: {},
	configs: {
		Interface: {
			category: 'Interface',
			chains: ['ethereum'],
			slug: 'interface',
			dexs: true,
			fees: true,
			perps: true,
			revenue: true
		}
	}
}

const makeAdapterMetrics = (protocols: IAdapterChainMetrics['protocols']): IAdapterChainMetrics =>
	({
		breakdown24h: null,
		breakdown30d: null,
		chain: null,
		allChains: [],
		total24h: 0,
		total48hto24h: 0,
		total7d: 0,
		total14dto7d: 0,
		total60dto30d: 0,
		total30d: 0,
		total1y: 0,
		change_1d: 0,
		change_7d: 0,
		change_1m: 0,
		change_7dover7d: 0,
		change_30dover30d: 0,
		total7DaysAgo: 0,
		total30DaysAgo: 0,
		totalAllTime: 0,
		protocols
	}) satisfies IAdapterChainMetrics

const makeAdapterProtocol = ({
	defillamaId,
	name,
	parentProtocol,
	total24h,
	total7d,
	total30d
}: {
	defillamaId: string
	name: string
	parentProtocol?: string
	total24h: number | null
	total7d: number | null
	total30d: number | null
}) =>
	({
		total24h,
		total48hto24h: 0,
		total7d,
		total14dto7d: 0,
		total60dto30d: 0,
		total30d,
		total1y: 0,
		totalAllTime: 0,
		average1y: 0,
		monthlyAverage1y: 0,
		change_1d: 0,
		change_7d: 0,
		change_1m: 0,
		change_7dover7d: 0,
		change_30dover30d: 0,
		breakdown24h: {},
		breakdown30d: {},
		total7DaysAgo: 0,
		total30DaysAgo: 0,
		defillamaId,
		id: defillamaId,
		name,
		displayName: name,
		module: name.toLowerCase(),
		category: 'Interface',
		logo: '',
		chains: ['Ethereum'],
		protocolType: 'protocol',
		methodologyURL: '',
		methodology: {},
		latestFetchIsOk: true,
		parentProtocol: parentProtocol ?? '',
		slug: name.toLowerCase().replace(/\s+/g, '-'),
		linkedProtocols: []
	}) satisfies IAdapterChainMetrics['protocols'][number]

const makeLiteProtocol = ({
	defillamaId,
	name,
	...overrides
}: Partial<Omit<ProtocolLite, 'defillamaId' | 'name'>> & {
	defillamaId: string
	name: string
}): ProtocolLite => ({
	defillamaId,
	name,
	symbol: '',
	logo: '',
	url: '',
	category: 'Interface',
	chains: ['Ethereum'],
	chainTvls: {},
	tvl: 0,
	tvlPrevDay: 0,
	tvlPrevWeek: 0,
	tvlPrevMonth: 0,
	mcap: null,
	geckoId: null,
	...overrides
})

const protocolsResponse = ({
	protocols,
	parentProtocols = [],
	chains = []
}: {
	protocols: Array<ProtocolLite>
	parentProtocols?: Array<ParentProtocolLite>
	chains?: Array<string>
}): ProtocolsResponse => ({ protocols, parentProtocols, chains, protocolCategories: [] })

describe('ProtocolTaxonomy queries', () => {
	test('enriches a copied parent chain list without mutating the producer DTO', () => {
		const parent: ParentProtocolLite = {
			id: 'parent#interface-suite',
			name: 'Interface Suite',
			chains: ['Solana'],
			logo: '',
			mcap: null,
			gecko_id: null
		}
		const result = mergeProtocolsWithAdapterFallback({
			protocols: [],
			parentProtocols: [parent],
			adapterProtocols: [
				makeAdapterProtocol({
					defillamaId: 'interface-child',
					name: 'Interface Child',
					parentProtocol: parent.id,
					total24h: 0,
					total7d: 0,
					total30d: 0
				})
			],
			category: 'Interface',
			tag: undefined
		})

		expect(result.parentProtocols[0]?.chains).toEqual(['Solana', 'Ethereum'])
		expect(parent.chains).toEqual(['Solana'])
	})

	beforeEach(() => {
		const liteProtocols: Array<ProtocolLite> = []
		const parentProtocols: Array<ParentProtocolLite> = []

		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: liteProtocols,
				parentProtocols,
				chains: []
			})
		)

		fetchCategoryChartMock.mockResolvedValue({
			tvl: { 1_710_000_000: 100 }
		})
		fetchTagChartMock.mockResolvedValue({
			tvl: { 1_710_000_000: 100 }
		})
		chainsByTaxonomyMock.mockResolvedValue({ Interface: ['Ethereum'] })
		fetchCardBreakdownChartMock.mockResolvedValue([])
		fetchAdapterChainChartDataByProtocolBreakdownMock.mockResolvedValue([])
		fetchAdapterChainChartDataByChainBreakdownMock.mockResolvedValue([])

		fetchAdapterChainMetricsMock.mockImplementation(async ({ adapterType, dataType }) => {
			if (adapterType === 'dexs') {
				return makeAdapterMetrics([
					makeAdapterProtocol({
						defillamaId: 'hybrid',
						name: 'Hybrid UI',
						total24h: 100,
						total7d: 700,
						total30d: 3000
					}),
					makeAdapterProtocol({
						defillamaId: 'child-a',
						name: 'Interface Child A',
						parentProtocol: 'parent#Interface Suite',
						total24h: 20,
						total7d: 140,
						total30d: 600
					}),
					makeAdapterProtocol({
						defillamaId: 'child-b',
						name: 'Interface Child B',
						parentProtocol: 'parent#Interface Suite',
						total24h: 30,
						total7d: 210,
						total30d: 900
					})
				])
			}

			if (adapterType === 'derivatives') {
				return makeAdapterMetrics([
					makeAdapterProtocol({
						defillamaId: 'hybrid',
						name: 'Hybrid UI',
						total24h: 40,
						total7d: 280,
						total30d: 1200
					}),
					makeAdapterProtocol({
						defillamaId: 'child-b',
						name: 'Interface Child B',
						parentProtocol: 'parent#Interface Suite',
						total24h: 10,
						total7d: 70,
						total30d: 300
					})
				])
			}

			if (adapterType === 'fees' && dataType === 'dailyRevenue') {
				return makeAdapterMetrics([])
			}

			if (adapterType === 'fees') {
				return makeAdapterMetrics([])
			}

			return makeAdapterMetrics([])
		})

		fetchAdapterChainChartDataMock.mockImplementation(async ({ adapterType }) => {
			if (adapterType === 'dexs') {
				return [
					[1_710_000_000, 10],
					[1_710_086_400, 20]
				]
			}

			if (adapterType === 'derivatives') {
				return [
					[1_710_000_000, 4],
					[1_710_086_400, 8]
				]
			}

			return []
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	test('builds category charts with final category-aware metric names', () => {
		const chart = buildCategoryCharts({
			effectiveCategory: 'Interface',
			metrics: ['tvl', 'dexVolume', 'perpVolume'],
			tvlChartData: [[1_710_000_000, 100]],
			feesChartData: null,
			revenueChartData: null,
			dexVolumeChartData: [[1_710_000_000, 10]],
			dexAggregatorsVolumeChartData: null,
			perpVolumeChartData: [[1_710_000_000, 4]],
			openInterestChartData: null,
			optionsPremiumVolumeChartData: null,
			optionsNotionalVolumeChartData: null,
			borrowedChartData: undefined,
			stakingChartData: undefined
		})

		expect(chart.dataset.dimensions).toEqual(['timestamp', 'TVL', 'Spot Volume', 'Perp Volume'])
		expect(chart.dataset.source).toEqual([[1_710_000_000_000, 100, 10, 4]])
		expect(chart.charts.map((series) => series.name)).toEqual(['TVL', 'Spot Volume', 'Perp Volume'])
	})

	test('builds revenue-only charts without restoring explicitly disabled TVL', () => {
		const chart = buildCategoryCharts({
			effectiveCategory: 'Physical TCG',
			metrics: ['revenue'],
			tvlChartData: [[1_710_000_000, 100]],
			feesChartData: null,
			revenueChartData: [[1_710_000_000, 25]],
			dexVolumeChartData: null,
			dexAggregatorsVolumeChartData: null,
			perpVolumeChartData: null,
			openInterestChartData: null,
			optionsPremiumVolumeChartData: null,
			optionsNotionalVolumeChartData: null,
			borrowedChartData: undefined,
			stakingChartData: undefined
		})

		expect(chart.dataset).toEqual({ dimensions: ['timestamp', 'Revenue'], source: [[1_710_000_000_000, 25]] })
		expect(chart.charts).toEqual([
			expect.objectContaining({ type: 'bar', name: 'Revenue', yAxisIndex: 1, valueSymbol: '$' })
		])
	})

	test('builds a stacked volume breakdown ordered by all-time total', () => {
		const chart = buildBreakdownCharts(
			[
				[1_710_000_000, { 'Small Card': 5, 'Big Card': 100 }],
				[1_710_086_400, { 'Small Card': 7, 'Big Card': 200, 'New Card': 50 }]
			],
			'protocolBreakdown'
		)

		expect(chart?.dataset.dimensions).toEqual(['timestamp', 'Big Card', 'New Card', 'Small Card'])
		expect(chart?.dataset.source).toEqual([
			[1_710_000_000_000, 100, null, 5],
			[1_710_086_400_000, 200, 50, 7]
		])
		expect(chart?.charts).toEqual([
			expect.objectContaining({ type: 'bar', name: 'Big Card', stack: 'protocolBreakdown', valueSymbol: '$' }),
			expect.objectContaining({ type: 'bar', name: 'New Card', stack: 'protocolBreakdown' }),
			expect.objectContaining({ type: 'bar', name: 'Small Card', stack: 'protocolBreakdown' })
		])
	})

	test('returns no volume breakdown when the response is empty or all-zero', () => {
		expect(buildBreakdownCharts(null, 'protocolBreakdown')).toBeNull()
		expect(buildBreakdownCharts([], 'protocolBreakdown')).toBeNull()
		expect(buildBreakdownCharts([[1_710_000_000, { 'Dead Card': 0 }]], 'protocolBreakdown')).toBeNull()
	})

	test('leaves a revenue-only chart empty when revenue history is unavailable', () => {
		const chart = buildCategoryCharts({
			effectiveCategory: 'Physical TCG',
			metrics: ['revenue'],
			tvlChartData: [[1_710_000_000, 100]],
			feesChartData: null,
			revenueChartData: null,
			dexVolumeChartData: null,
			dexAggregatorsVolumeChartData: null,
			perpVolumeChartData: null,
			openInterestChartData: null,
			optionsPremiumVolumeChartData: null,
			optionsNotionalVolumeChartData: null,
			borrowedChartData: undefined,
			stakingChartData: undefined
		})

		expect(chart.dataset).toEqual({ dimensions: ['timestamp'], source: [] })
		expect(chart.charts).toEqual([])
	})

	test('fetches and publishes Physical TCG revenue history without TVL', async () => {
		fetchAdapterChainChartDataMock.mockImplementation(async ({ adapterType, dataType }) => {
			if (adapterType === 'fees' && dataType === 'dailyRevenue') return [[1_710_000_000, 25]]
			return []
		})

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Physical TCG',
			categoriesAndTags: {
				categories: ['Physical TCG'],
				tags: [],
				tagCategoryMap: {},
				configs: {
					'Physical TCG': {
						category: 'Physical TCG',
						slug: 'physical-tcg',
						fees: true,
						revenue: true
					}
				}
			},
			chainMetadata: {}
		})

		expect(result?.charts.dataset).toEqual({
			dimensions: ['timestamp', 'Revenue'],
			source: [[1_710_000_000_000, 25]]
		})
	})

	test('fetches the protocol volume breakdown for categories that opt in', async () => {
		fetchAdapterChainChartDataByProtocolBreakdownMock.mockImplementation(async ({ adapterType, category }) =>
			adapterType === 'dexs' && category === 'crypto-card-issuer' ? [[1_710_000_000, { 'Nexo Card': 40 }]] : []
		)

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Crypto Card Issuer',
			categoriesAndTags: {
				categories: ['Crypto Card Issuer'],
				tags: [],
				tagCategoryMap: {},
				configs: {
					'Crypto Card Issuer': {
						category: 'Crypto Card Issuer',
						slug: 'crypto-card-issuer',
						dexs: true
					}
				}
			},
			chainMetadata: {}
		})

		expect(result?.breakdownCharts.protocol?.dataset).toEqual({
			dimensions: ['timestamp', 'Nexo Card'],
			source: [[1_710_000_000_000, 40]]
		})
	})

	const cardIssuerParams = {
		kind: 'category' as const,
		category: 'Crypto Card Issuer',
		categoriesAndTags: {
			categories: ['Crypto Card Issuer'],
			tags: [],
			tagCategoryMap: {},
			configs: {
				'Crypto Card Issuer': { category: 'Crypto Card Issuer', slug: 'crypto-card-issuer', dexs: true }
			}
		},
		chainMetadata: { ethereum: { name: 'Ethereum', id: 'ethereum', dexs: true } }
	}

	test('builds the card network and custody breakdowns on the all-chains page', async () => {
		fetchCardBreakdownChartMock.mockImplementation(async (type: string) =>
			type === 'network'
				? [[1_710_000_000, { Visa: 60, Mastercard: 40 }]]
				: [[1_710_000_000, { Custodial: 70, 'Self-custodial': 30 }]]
		)

		const result = await getProtocolTaxonomyPageData(cardIssuerParams)

		expect(result?.breakdownCharts.network?.dataset).toEqual({
			dimensions: ['timestamp', 'Visa', 'Mastercard'],
			source: [[1_710_000_000_000, 60, 40]]
		})
		expect(result?.breakdownCharts.custody?.dataset.dimensions).toEqual(['timestamp', 'Custodial', 'Self-custodial'])
	})

	test('builds the chain breakdown from the category-scoped adapter route', async () => {
		fetchAdapterChainChartDataByChainBreakdownMock.mockImplementation(async ({ adapterType, category }) =>
			adapterType === 'dexs' && category === 'crypto-card-issuer' ? [[1_710_000_000, { Ethereum: 90, Base: 10 }]] : []
		)

		const result = await getProtocolTaxonomyPageData(cardIssuerParams)

		expect(result?.breakdownCharts.chain?.dataset).toEqual({
			dimensions: ['timestamp', 'Ethereum', 'Base'],
			source: [[1_710_000_000_000, 90, 10]]
		})
	})

	test('omits the chain breakdown on chain pages, where it would be a single bar', async () => {
		fetchAdapterChainChartDataByChainBreakdownMock.mockResolvedValue([[1_710_000_000, { Ethereum: 90 }]])
		fetchAdapterChainChartDataByProtocolBreakdownMock.mockResolvedValue([[1_710_000_000, { 'Nexo Card': 40 }]])

		const result = await getProtocolTaxonomyPageData({ ...cardIssuerParams, chain: 'ethereum' })

		expect(result?.breakdownCharts.chain).toBeUndefined()
		expect(result?.breakdownCharts.protocol?.dataset.dimensions).toEqual(['timestamp', 'Nexo Card'])
	})

	test('drops a card breakdown whose upstream request fails without failing the page', async () => {
		fetchCardBreakdownChartMock.mockImplementation(async (type: string) => {
			if (type === 'network') throw new Error('pro api key missing')
			return [[1_710_000_000, { Custodial: 70 }]]
		})

		const result = await getProtocolTaxonomyPageData(cardIssuerParams)

		expect(result?.breakdownCharts.network).toBeUndefined()
		expect(result?.breakdownCharts.custody?.dataset.dimensions).toEqual(['timestamp', 'Custodial'])
	})

	test('builds protocol categories page data with an empty chart source', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					{
						defillamaId: 'dex-one',
						name: 'Dex One',
						symbol: '',
						logo: '',
						url: '',
						category: 'Dexes',
						chains: ['Ethereum'],
						chainTvls: {},
						tvl: 100,
						tvlPrevDay: 80,
						tvlPrevWeek: 75,
						tvlPrevMonth: 50,
						mcap: null,
						geckoId: null
					} satisfies ProtocolLite,
					makeLiteProtocol({
						defillamaId: 'metadata-only',
						name: 'Metadata Only',
						category: 'Dexes',
						tvl: null,
						tvlPrevDay: null,
						tvlPrevWeek: null,
						tvlPrevMonth: null
					}),
					makeLiteProtocol({
						defillamaId: 'explicit-zero',
						name: 'Explicit Zero',
						category: 'Dexes',
						tvl: 0,
						tvlPrevDay: 0,
						tvlPrevWeek: 0,
						tvlPrevMonth: 0
					})
				],
				parentProtocols: [],
				chains: []
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(
			makeAdapterMetrics([
				makeAdapterProtocol({
					defillamaId: 'dex-one',
					name: 'Dex One',
					total24h: 12,
					total7d: 84,
					total30d: 360
				})
			])
		)

		const data = await getProtocolsCategoriesPageData()

		expect(data.categories).toEqual(['Dexes'])
		expect(data.chartSource).toEqual([])
		expect(data.extraTvlCharts).toEqual({})
		expect(data.tableData).toEqual([
			expect.objectContaining({
				name: 'Dexes',
				protocols: 3,
				tvl: 100,
				revenue: 12
			})
		])
	})

	test('returns only requested categories extra TVL chart series', async () => {
		fetchCategoriesSummaryMock.mockResolvedValue({
			categories: { Dexes: [] },
			chart: {
				'1': {
					Dexes: {
						tvl: 100,
						staking: 25,
						borrowed: 10
					}
				}
			}
		})

		const data = await getProtocolsCategoriesChartData({
			extraTvlTypes: ['staking']
		})

		expect(data).toEqual({
			chartSource: [{ timestamp: 1000, Dexes: 100 }],
			extraTvlCharts: {
				Dexes: {
					staking: {
						1000: 25
					}
				}
			}
		})
	})

	test('keeps category parent TVL as the visible child sum when a child has excluded parent overlap', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({
						defillamaId: 'jupiter-lend',
						name: 'Jupiter Lend',
						category: 'Lending',
						chains: ['Solana'],
						parentProtocol: 'parent#jupiter',
						tvl: 988,
						chainTvls: {
							Solana: { tvl: 988, tvlPrevDay: 900, tvlPrevWeek: 800, tvlPrevMonth: 700 },
							excludeParent: { tvl: 545, tvlPrevDay: 500, tvlPrevWeek: 400, tvlPrevMonth: 300 },
							staking: { tvl: null, tvlPrevDay: 10, tvlPrevWeek: 9, tvlPrevMonth: 8 }
						}
					}),
					makeLiteProtocol({
						defillamaId: 'jupiter-orderbook',
						name: 'Jupiter Orderbook',
						category: 'Lending',
						chains: ['Solana'],
						parentProtocol: 'parent#jupiter',
						tvl: 4,
						chainTvls: {
							Solana: { tvl: 4, tvlPrevDay: 3, tvlPrevWeek: 2, tvlPrevMonth: 1 }
						}
					})
				],
				parentProtocols: [
					{ id: 'parent#jupiter', name: 'Jupiter', chains: ['Solana'], logo: '', mcap: 1000, gecko_id: null }
				],
				chains: ['Solana']
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(makeAdapterMetrics([]))
		fetchAdapterChainChartDataMock.mockResolvedValue([])
		chainsByTaxonomyMock.mockResolvedValue({ Lending: ['Solana'] })

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Lending',
			categoriesAndTags: {
				categories: ['Lending'],
				tags: [],
				tagCategoryMap: {},
				configs: {
					Lending: {
						category: 'Lending',
						slug: 'lending'
					}
				}
			},
			chainMetadata: {}
		})

		expect(result).not.toBeNull()
		const parent = result?.protocols.find((protocol) => protocol.name === 'Jupiter')
		expect(parent?.tvl).toBe(992)
		expect(parent?.extraTvls.excludeParent).toBe(545)
		expect(parent?.extraTvls.staking).toBeNull()
		expect(parent?.subRows?.map((row) => row.name)).toEqual(['Jupiter Lend', 'Jupiter Orderbook'])
	})

	test('hides denylisted Options TVL from the parent only', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({
						defillamaId: 'derive-options',
						name: 'Derive Options',
						category: 'Options',
						parentProtocol: 'parent#derive',
						tvl: 0
					}),
					makeLiteProtocol({
						defillamaId: 'derive-v1',
						name: 'Derive V1',
						category: 'Options',
						parentProtocol: 'parent#derive',
						tvl: 134_470
					}),
					makeLiteProtocol({
						defillamaId: 'other-options',
						name: 'Other Options',
						category: 'Options',
						tvl: 50_000
					})
				],
				parentProtocols: [
					{
						id: 'parent#derive',
						name: 'Derive',
						chains: ['Ethereum'],
						logo: '',
						mcap: null,
						gecko_id: null
					}
				]
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(makeAdapterMetrics([]))
		fetchAdapterChainChartDataMock.mockResolvedValue([])

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Options',
			categoriesAndTags: {
				categories: ['Options'],
				tags: [],
				tagCategoryMap: {},
				configs: { Options: { category: 'Options', slug: 'options' } }
			},
			chainMetadata: {}
		})

		const derive = result?.protocols.find((protocol) => protocol.name === 'Derive')
		expect(derive?.tvl).toBeNull()
		expect(derive?.subRows?.map((protocol) => protocol.tvl)).toEqual([134_470, 0])
		expect(result?.protocols.find((protocol) => protocol.name === 'Other Options')?.tvl).toBe(50_000)
	})

	test('matches a hyphenated selected chain exactly and preserves zero borrowed TVL', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({
						defillamaId: 'x-layer-lender',
						name: 'X Layer Lender',
						category: 'Lending',
						chains: ['X-Layer'],
						tvl: 100,
						chainTvls: {
							'X-Layer': { tvl: 100, tvlPrevDay: 90, tvlPrevWeek: 80, tvlPrevMonth: 70 },
							'X-Layer-borrowed': { tvl: 0, tvlPrevDay: 0, tvlPrevWeek: 0, tvlPrevMonth: 0 },
							'X-Layer-staking': { tvl: 10, tvlPrevDay: 9, tvlPrevWeek: 8, tvlPrevMonth: 7 },
							'X-Layer-doublecounted': { tvl: 999, tvlPrevDay: 999, tvlPrevWeek: 999, tvlPrevMonth: 999 }
						}
					}),
					makeLiteProtocol({
						defillamaId: 'missing-x-layer-base',
						name: 'Missing X Layer Base',
						category: 'Lending',
						chains: ['X-Layer'],
						tvl: 200,
						chainTvls: {
							'X-Layer-staking': { tvl: 10, tvlPrevDay: 9, tvlPrevWeek: 8, tvlPrevMonth: 7 }
						}
					})
				],
				chains: ['X-Layer']
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(makeAdapterMetrics([]))
		fetchAdapterChainChartDataMock.mockResolvedValue([])
		chainsByTaxonomyMock.mockResolvedValue({ Lending: ['X-Layer'] })

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Lending',
			chain: 'x-layer',
			categoriesAndTags: {
				categories: ['Lending'],
				tags: [],
				tagCategoryMap: {},
				configs: { Lending: { category: 'Lending', slug: 'lending' } }
			},
			chainMetadata: { 'x-layer': { name: 'X-Layer', id: 'x-layer' } }
		})

		expect(result?.protocols).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'X Layer Lender',
					tvl: 100,
					borrowed: 0,
					supplied: 100,
					suppliedTvl: 1,
					extraTvls: { borrowed: 0, staking: 10 }
				}),
				expect.objectContaining({ name: 'Missing X Layer Base', tvl: null, extraTvls: { staking: 10 } })
			])
		)
	})

	test('excludes off-chain siblings before grouping a chain page', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({
						defillamaId: 'aave-v3',
						name: 'Aave V3',
						category: 'Lending',
						chains: ['Ethereum'],
						parentProtocol: 'parent#aave',
						chainTvls: {
							Ethereum: { tvl: 100, tvlPrevDay: 90, tvlPrevWeek: 80, tvlPrevMonth: 70 }
						}
					}),
					makeLiteProtocol({
						defillamaId: 'aave-aptos',
						name: 'Aave Aptos',
						category: 'Lending',
						chains: ['Aptos'],
						parentProtocol: 'parent#aave',
						chainTvls: {
							Aptos: { tvl: 50, tvlPrevDay: 40, tvlPrevWeek: 30, tvlPrevMonth: 20 }
						}
					})
				],
				parentProtocols: [
					{
						id: 'parent#aave',
						name: 'Aave',
						chains: ['Ethereum', 'Aptos'],
						logo: '',
						mcap: null,
						gecko_id: null
					}
				]
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(
			makeAdapterMetrics([
				makeAdapterProtocol({
					defillamaId: 'aave-aptos',
					name: 'Aave Aptos',
					parentProtocol: 'parent#aave',
					total24h: 1,
					total7d: 7,
					total30d: 30
				})
			])
		)
		fetchAdapterChainChartDataMock.mockResolvedValue([])
		chainsByTaxonomyMock.mockResolvedValue({ Lending: ['Ethereum', 'Aptos'] })

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Lending',
			chain: 'ethereum',
			categoriesAndTags: {
				categories: ['Lending'],
				tags: [],
				tagCategoryMap: {},
				configs: { Lending: { category: 'Lending', slug: 'lending' } }
			},
			chainMetadata: { ethereum: { name: 'Ethereum', id: 'ethereum', fees: true } }
		})

		expect(result?.protocols).toHaveLength(1)
		expect(result?.protocols[0]).toEqual(
			expect.objectContaining({
				name: 'Aave V3',
				tvl: 100
			})
		)
		expect(result?.protocols[0]?.subRows).toBeUndefined()
	})

	test('keeps a chain parent base known when a sibling only reports extra TVL', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({
						defillamaId: 'measured-child',
						name: 'Measured Child',
						chains: ['Ethereum'],
						parentProtocol: 'parent#mixed',
						chainTvls: {
							Ethereum: { tvl: 100, tvlPrevDay: 90, tvlPrevWeek: 80, tvlPrevMonth: 70 }
						}
					}),
					makeLiteProtocol({
						defillamaId: 'unmeasured-child',
						name: 'Unmeasured Child',
						chains: ['Ethereum'],
						parentProtocol: 'parent#mixed',
						chainTvls: {
							'Ethereum-staking': { tvl: 50, tvlPrevDay: 40, tvlPrevWeek: 30, tvlPrevMonth: 20 }
						}
					}),
					makeLiteProtocol({
						defillamaId: 'off-chain-child',
						name: 'Off-chain Child',
						chains: ['Aptos'],
						parentProtocol: 'parent#mixed',
						chainTvls: {
							Aptos: { tvl: 50, tvlPrevDay: 40, tvlPrevWeek: 30, tvlPrevMonth: 20 }
						}
					}),
					makeLiteProtocol({
						defillamaId: 'extra-only-a',
						name: 'Extra Only A',
						parentProtocol: 'parent#extra-only',
						chainTvls: {
							'Ethereum-staking': { tvl: 20, tvlPrevDay: 10, tvlPrevWeek: 5, tvlPrevMonth: 0 }
						}
					}),
					makeLiteProtocol({
						defillamaId: 'extra-only-b',
						name: 'Extra Only B',
						parentProtocol: 'parent#extra-only',
						chainTvls: {
							'Ethereum-staking': { tvl: 30, tvlPrevDay: 20, tvlPrevWeek: 10, tvlPrevMonth: 0 }
						}
					})
				],
				parentProtocols: [
					{
						id: 'parent#mixed',
						name: 'Mixed Parent',
						chains: ['Ethereum', 'Aptos'],
						logo: '',
						mcap: null,
						gecko_id: null
					},
					{
						id: 'parent#extra-only',
						name: 'Extra Only Parent',
						chains: ['Ethereum'],
						logo: '',
						mcap: null,
						gecko_id: null
					}
				]
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(makeAdapterMetrics([]))
		fetchAdapterChainChartDataMock.mockResolvedValue([])
		chainsByTaxonomyMock.mockResolvedValue({ Interface: ['Ethereum', 'Aptos'] })

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Interface',
			chain: 'ethereum',
			categoriesAndTags,
			chainMetadata: { ethereum: { name: 'Ethereum', id: 'ethereum' } }
		})

		const parent = result?.protocols.find((protocol) => protocol.name === 'Mixed Parent')
		expect(parent?.tvl).toBe(100)
		expect(parent?.extraTvls.staking).toBe(50)
		expect(parent?.subRows?.map((row) => row.name)).toEqual(['Measured Child', 'Unmeasured Child'])
		expect(result?.protocols.find((protocol) => protocol.name === 'Extra Only Parent')).toMatchObject({
			tvl: null,
			extraTvls: { staking: 50 }
		})
	})

	test('skips a no-TVL deprecated child in its parent while leaving unknown-parent children public', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({
						defillamaId: 'known-child',
						name: 'Known Child',
						parentProtocol: 'parent#known',
						tvl: 10
					}),
					makeLiteProtocol({
						defillamaId: 'null-child',
						name: 'Null Child',
						parentProtocol: 'parent#known',
						deprecated: true,
						tvl: null
					}),
					makeLiteProtocol({
						defillamaId: 'orphan-child',
						name: 'Orphan Child',
						parentProtocol: 'parent#missing',
						tvl: 5
					})
				],
				parentProtocols: [
					{
						id: 'parent#known',
						name: 'Known Parent',
						logo: '',
						chains: ['Ethereum'],
						gecko_id: null,
						mcap: null
					}
				]
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(makeAdapterMetrics([]))
		fetchAdapterChainChartDataMock.mockResolvedValue([])

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Interface',
			categoriesAndTags,
			chainMetadata: {}
		})

		expect(result?.protocols.find((protocol) => protocol.name === 'Known Parent')?.tvl).toBe(10)
		expect(
			result?.protocols
				.find((protocol) => protocol.name === 'Known Parent')
				?.subRows?.find((protocol) => protocol.name === 'Null Child')?.deprecated
		).toBe(true)
		expect(result?.protocols.find((protocol) => protocol.name === 'Orphan Child')?.tvl).toBe(5)
	})

	test('merges adapter-only interface protocols and preserves both dex and perp metrics', async () => {
		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Interface',
			categoriesAndTags,
			chainMetadata: {}
		})

		expect(result).not.toBeNull()
		if (!result) return

		const hybrid = result.protocols.find((protocol) => protocol.name === 'Hybrid UI')
		expect(hybrid).toBeDefined()
		expect(hybrid?.tvl).toBeNull()
		expect(hybrid?.dexVolume?.total24h).toBe(100)
		expect(hybrid?.perpVolume?.total24h).toBe(40)

		expect(result.protocols.find((protocol) => protocol.name === 'Interface Suite')).toBeUndefined()
		expect(result.protocols.find((protocol) => protocol.name === 'Interface Child A')?.dexVolume?.total24h).toBe(20)
		expect(result.protocols.find((protocol) => protocol.name === 'Interface Child B')).toMatchObject({
			dexVolume: { total24h: 30 },
			perpVolume: { total24h: 10 }
		})
	})

	test('preserves category and tags together when normalizing exact lite rows', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({
						defillamaId: 'tagged-interface',
						name: 'Tagged Interface',
						category: 'Interface',
						tags: ['Special Interface']
					})
				]
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(makeAdapterMetrics([]))
		fetchAdapterChainChartDataMock.mockResolvedValue([])

		const result = await getProtocolTaxonomyPageData({
			kind: 'tag',
			tag: 'Special Interface',
			tagCategory: 'Interface',
			categoriesAndTags: {
				categories: ['Interface'],
				tags: ['Special Interface'],
				tagCategoryMap: { 'Special Interface': 'Interface' },
				configs: categoriesAndTags.configs
			},
			chainMetadata: {}
		})

		expect(result?.protocols).toEqual([expect.objectContaining({ name: 'Tagged Interface' })])
	})

	test('keeps successful omitted adapter activity at zero and failed sources unavailable for direct and parent rows', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({ defillamaId: 'direct', name: 'Direct' }),
					makeLiteProtocol({
						defillamaId: 'child-zero-a',
						name: 'Child Zero A',
						parentProtocol: 'parent#zero'
					}),
					makeLiteProtocol({
						defillamaId: 'child-zero-b',
						name: 'Child Zero B',
						parentProtocol: 'parent#zero'
					})
				],
				parentProtocols: [
					{
						id: 'parent#zero',
						name: 'Zero Parent',
						logo: '',
						chains: ['Ethereum'],
						gecko_id: null,
						mcap: null
					}
				]
			})
		)
		fetchAdapterChainMetricsMock.mockImplementation(async ({ adapterType, dataType }) => {
			if (adapterType === 'fees' && dataType === 'dailyRevenue') throw new Error('revenue unavailable')
			if (adapterType === 'fees') {
				return makeAdapterMetrics([
					makeAdapterProtocol({
						defillamaId: 'direct',
						name: 'Direct',
						total24h: null,
						total7d: null,
						total30d: null
					})
				])
			}
			return makeAdapterMetrics([])
		})

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Interface',
			categoriesAndTags,
			chainMetadata: {}
		})

		const direct = result?.protocols.find((protocol) => protocol.name === 'Direct')
		const parent = result?.protocols.find((protocol) => protocol.name === 'Zero Parent')
		expect(direct?.fees).toEqual({ total24h: 0, total7d: 0, total30d: 0 })
		expect(direct?.revenue).toBeNull()
		expect(parent?.fees).toEqual({ total24h: 0, total7d: 0, total30d: 0 })
		expect(parent?.revenue).toBeNull()
		expect(result?.fees7d).toBe(0)
		expect(result?.revenue7d).toBeNull()
	})

	test('keeps lending supplied known at zero TVL for direct and parent rows', async () => {
		const borrowedEntry = (value: number) => ({
			tvl: value,
			tvlPrevDay: value,
			tvlPrevWeek: value,
			tvlPrevMonth: value
		})
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					makeLiteProtocol({
						defillamaId: 'direct-lender',
						name: 'Direct Lender',
						category: 'Lending',
						tvl: 0,
						chainTvls: { borrowed: borrowedEntry(25) }
					}),
					makeLiteProtocol({
						defillamaId: 'lender-a',
						name: 'Lender A',
						category: 'Lending',
						parentProtocol: 'parent#lender',
						tvl: 0,
						chainTvls: { borrowed: borrowedEntry(10) }
					}),
					makeLiteProtocol({
						defillamaId: 'lender-b',
						name: 'Lender B',
						category: 'Lending',
						parentProtocol: 'parent#lender',
						tvl: 0,
						chainTvls: { borrowed: borrowedEntry(15) }
					})
				],
				parentProtocols: [
					{
						id: 'parent#lender',
						name: 'Lender Parent',
						logo: '',
						chains: ['Ethereum'],
						gecko_id: null,
						mcap: null
					}
				]
			})
		)
		fetchAdapterChainMetricsMock.mockResolvedValue(makeAdapterMetrics([]))

		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Lending',
			categoriesAndTags: {
				categories: ['Lending'],
				tags: [],
				tagCategoryMap: {},
				configs: { Lending: { category: 'Lending', slug: 'lending' } }
			},
			chainMetadata: {}
		})

		expect(result?.protocols.find((protocol) => protocol.name === 'Direct Lender')).toMatchObject({
			tvl: 0,
			borrowed: 25,
			supplied: 25,
			suppliedTvl: null
		})
		expect(result?.protocols.find((protocol) => protocol.name === 'Lender Parent')).toMatchObject({
			tvl: 0,
			borrowed: 25,
			supplied: 25,
			suppliedTvl: null
		})
	})

	test('keeps categories revenue null when its independent adapter source fails', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [makeLiteProtocol({ defillamaId: 'failed-revenue', name: 'Failed Revenue' })]
			})
		)
		fetchAdapterChainMetricsMock.mockRejectedValue(new Error('revenue unavailable'))

		const result = await getProtocolsCategoriesPageData()

		expect(result.tableData).toEqual([expect.objectContaining({ name: 'Interface', revenue: null })])
	})

	test('skips adapter category-chain metric fetches when metadata says the chain is unsupported', async () => {
		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Interface',
			chain: 'polygon',
			categoriesAndTags,
			chainMetadata: {
				polygon: {
					name: 'Polygon',
					id: 'polygon',
					fees: true,
					dexs: true,
					perps: true
				}
			}
		})

		// A skipped adapter source leaves its summary unknown instead of summing to zero.
		expect(result).toMatchObject({ fees7d: null, revenue7d: null, dexVolume7d: null, perpVolume7d: null })
		expect(result?.charts.dataset.dimensions).not.toContain('Spot Volume')
		expect(result?.charts.dataset.dimensions).not.toContain('Perp Volume')
	})

	test('uses dimAgg metric keys to skip unsupported metrics on a supported category chain', async () => {
		const result = await getProtocolTaxonomyPageData({
			kind: 'category',
			category: 'Interface',
			chain: 'polygon',
			categoriesAndTags: {
				...categoriesAndTags,
				configs: {
					Interface: {
						...categoriesAndTags.configs.Interface,
						chains: ['polygon'],
						dimAgg: {
							dexs: {
								dv: { '24h': 1, '7d': 1, '30d': 1 }
							}
						}
					}
				}
			},
			chainMetadata: {
				polygon: {
					name: 'Polygon',
					id: 'polygon',
					fees: true,
					dexs: true,
					perps: true
				}
			}
		})

		expect(result).toMatchObject({ fees7d: null, revenue7d: null, dexVolume7d: 0, perpVolume7d: null })
		expect(result?.charts.dataset.dimensions).toContain('Spot Volume')
		expect(result?.charts.dataset.dimensions).not.toContain('Perp Volume')
	})
})
