import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RWA_SERVER_URL, SERVER_URL, V2_SERVER_URL } from '~/constants'
import type { ParentProtocolLite, ProtocolLite } from '~/containers/ProtocolLists/api.types'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import type { IProtocolExpenses } from '../api.types'
import { buildProtocolExpenseRows } from '../expenses'
import { getProtocolOverviewPageData, getTokenIncomeStatement } from '../queries'

const http = installFixtureFetch()

const protocolDetails = {
	id: 'test-protocol',
	name: 'Test Protocol',
	symbol: 'TEST',
	url: 'https://example.com',
	description: null,
	logo: null,
	gecko_id: 'test-token',
	cmcId: null,
	category: 'Dexes',
	chain: 'Ethereum',
	module: 'test/index.js',
	chains: ['Ethereum'],
	currentChainTvls: {},
	mcap: null,
	raises: [],
	hacks: []
}

// The Yields dataset adapter: reading fails, as when the snapshot is unavailable.
const yieldsSnapshot = {
	generationId: 'test-gen',
	generatedAt: 0,
	readJson: vi.fn().mockRejectedValue(new Error('yields unavailable'))
}

const EMPTY_PROTOCOLS = { protocols: [], chains: [], parentProtocols: [] }

function serveProtocol(slug: string, details: Record<string, unknown>) {
	http.serve({ [`${V2_SERVER_URL}/metrics/tvl/protocol/${slug}`]: details })
}

beforeEach(() => {
	serveProtocol('test-protocol', protocolDetails)
	http.serve({
		[`${V2_SERVER_URL}/chart/tvl/protocol/`]: [],
		'/lite/protocols2': EMPTY_PROTOCOLS,
		'https://features.llama.fi/research/sponsors/lookup/': { sponsor: null, reports: [] },
		'/blockExplorers.json': []
	})
})

function pageData(overrides: Partial<Parameters<typeof getProtocolOverviewPageData>[0]> = {}) {
	return getProtocolOverviewPageData({
		protocolId: 'test-protocol',
		currentProtocolMetadata: { displayName: 'Test Protocol' },
		chainMetadata: {},
		tokenlist: {},
		cgExchangeIdentifiers: [],
		emissionsSupplyMetrics: {},
		rwaPlatformActiveAum: null,
		yieldsSnapshot,
		...overrides
	})
}

describe('getProtocolOverviewPageData', () => {
	test('defaults missing invite eligibility to a serializable false', async () => {
		serveProtocol('test-protocol', protocolDetails)
		expect((await pageData()).hasInviteCodes).toBe(false)
	})

	test.each([
		{ platformAum: 928_552_482, chart: [[1, 1_008_557_369]], expected: 928_552_482 },
		{ platformAum: 0, chart: [[1, 1_008_557_369]], expected: 0 },
		{ platformAum: null, chart: [[1, 1_008_557_369]], expected: 1_008_557_369 },
		{ platformAum: 928_552_482, chart: [], expected: 928_552_482 },
		{ platformAum: null, chart: [], expected: null }
	])('resolves platform AUM from $platformAum with chart $chart', async ({ platformAum, chart, expected }) => {
		http.serve({ [`${RWA_SERVER_URL}/chart/platform-breakdown`]: platformBreakdown(chart) })
		const page = await pageData({
			currentProtocolMetadata: { displayName: 'Test Protocol', tvl: false, rwaPlatformSlug: 'test-platform' },
			rwaPlatformActiveAum: platformAum
		})
		expect(page.rwaActiveAum).toBe(expected)
		expect(page.initialMultiSeriesChartData['RWA AUM'] ?? []).toEqual(chart)
		expect(page.hasKeyMetrics).toBe(expected != null)
	})

	test.each([
		{ chart: [[1, 4242]], expected: 4242 },
		{ chart: [[1, 0]], expected: 0 },
		{ chart: [], expected: null }
	])('keeps protocol-issued AUM ahead of the parent platform figure: $expected', async ({ chart, expected }) => {
		http.serve({ [`${RWA_SERVER_URL}/protocol/test-protocol/mcap/chart`]: chart })
		const page = await pageData({
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				tvl: false,
				rwaPlatformSlug: 'test-platform',
				rwaProtocolMcapSlug: 'test-protocol'
			},
			rwaPlatformActiveAum: 928_552_482
		})
		expect(page.rwaActiveAum).toBe(expected)
	})

	test('tolerates RWA upstream failure while TVL is live', async () => {
		http.serve({ [`${RWA_SERVER_URL}/chart/platform-breakdown`]: fixtureStatus(404) })
		const page = await pageData({
			currentProtocolMetadata: { displayName: 'Test Protocol', tvl: true, rwaPlatformSlug: 'test-platform' }
		})
		expect(page.rwaActiveAum).toBeNull()
		expect(page.metrics.tvl).toBe(true)
	})

	test('rejects RWA upstream failure when TVL is retired', async () => {
		http.serve({ [`${RWA_SERVER_URL}/chart/platform-breakdown`]: fixtureStatus(404) })
		await expect(
			pageData({
				currentProtocolMetadata: { displayName: 'Test Protocol', tvl: false, rwaPlatformSlug: 'test-platform' }
			})
		).rejects.toThrow('[404]')
	})

	test.each([
		{ chains: ['Ethereum', 'Base'], expected: ['Ethereum', 'Base'] },
		{ chains: [], expected: ['Ethereum'] },
		{ chains: undefined, expected: ['Ethereum'] }
	])('uses metadata chains with protocol fallback: $chains', async ({ chains, expected }) => {
		const data = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', chains } })

		expect(data.chains).toEqual(expected)
		const answer = data.faqItems?.find((item) => item.id === 'chains')?.answer
		expect(answer?.map((part) => part.text).join('')).toBe(
			expected.length === 1
				? 'Test Protocol operates on Ethereum.'
				: 'Test Protocol operates on 2 chains: Ethereum and Base.'
		)
	})

	test.each([
		[
			{ gasTokenGeckoId: 'ethereum', gasTokenSymbol: 'ETH' },
			[
				{ symbol: 'USD', geckoId: null },
				{ symbol: 'ETH', geckoId: 'ethereum' }
			]
		],
		[{}, [{ symbol: 'USD', geckoId: null }]]
	])('uses gas metadata for protocol denominations without assuming the official token', async (gas, expected) => {
		serveProtocol('test-protocol', { ...protocolDetails, currentChainTvls: { Arbitrum: 100, Ethereum: 10 } })
		const data = await pageData({
			chainMetadata: {
				arbitrum: { name: 'Arbitrum', id: 'arbitrum', gecko_id: 'arbitrum', tokenSymbol: 'ARB', ...gas }
			}
		})
		expect(data.chartDenominations).toEqual(expected)
	})

	test('looks up sponsored reports by the canonical protocol page identity', async () => {
		const report = {
			id: 'report-id',
			title: 'Canonical report',
			slug: 'canonical-report',
			section: 'report' as const,
			coverImage: null,
			carouselImage: null,
			excerpt: null,
			reportDescription: null,
			displayDate: null,
			publishedAt: '2026-08-01T00:00:00.000Z'
		}
		http.serve({
			'https://features.llama.fi/research/sponsors/lookup/protocol/canonical-test-protocol': {
				sponsor: null,
				reports: [report]
			}
		})

		const data = await pageData({ researchSponsorEntitySlug: 'canonical-test-protocol' })

		expect(data.articles).toEqual([report])
		expect(data.researchSponsorEntity).toEqual({ entityType: 'protocol', entitySlug: 'canonical-test-protocol' })
	})

	test('excludes child protocols from their parent protocol competitors', async () => {
		serveProtocol('arcus', {
			id: 'parent#arcus',
			name: 'Arcus',
			isParentProtocol: true,
			symbol: null,
			url: 'https://arcus.exchange',
			description: 'Arcus parent protocol',
			logo: 'arcus.png',
			gecko_id: null,
			cmcId: null,
			chains: ['Robinhood Chain'],
			currentChainTvls: {},
			mcap: null,
			raises: [],
			hacks: [],
			otherProtocols: ['Arcus', 'Arcus Perps', 'Arcus Spot'],
			twitter: null,
			treasury: null
		})
		http.serve({
			'/lite/protocols2': {
				protocols: [
					{
						name: 'Arcus Perps',
						defillamaId: 'arcus-perps',
						parentProtocol: 'parent#arcus',
						category: 'Derivatives',
						chains: ['Robinhood Chain'],
						tvl: 20_000_000
					},
					{
						name: 'Lighter Robinhood Perps',
						defillamaId: 'lighter-robinhood-perps',
						parentProtocol: 'parent#lighter',
						category: 'Derivatives',
						chains: ['Robinhood Chain'],
						tvl: 11_000_000
					}
				],
				chains: ['Robinhood Chain'],
				parentProtocols: []
			}
		})

		const data = await pageData({
			protocolId: 'parent#arcus',
			currentProtocolMetadata: { displayName: 'Arcus' } satisfies IProtocolMetadata
		})

		expect(data.competitors).toEqual([{ name: 'Lighter Robinhood Perps', tvl: 11_000_000 }])
		expect(data.childProtocols).toEqual([
			{ name: 'Arcus Perps', href: '/protocol/arcus-perps', category: 'Derivatives', chains: ['Robinhood Chain'] }
		])
	})

	test('uses the same ordered peers for the competitors card and FAQ', async () => {
		serveProtocol('boros', {
			...protocolDetails,
			id: 'boros',
			name: 'Boros',
			symbol: null,
			gecko_id: null,
			category: 'Interest Rate Derivatives',
			chains: ['Arbitrum'],
			currentChainTvls: { Arbitrum: 8 }
		})
		http.serve({
			'/lite/protocols2': {
				protocols: [
					{ name: 'Boros', defillamaId: 'boros', category: 'Interest Rate Derivatives', chains: ['Arbitrum'], tvl: 8 },
					{
						name: 'Rho X',
						defillamaId: 'rho-x',
						category: 'Interest Rate Derivatives',
						chains: ['Ethereum'],
						tvl: 10,
						parentProtocol: 'parent#rho'
					},
					{
						name: 'Arbitrum Rates',
						defillamaId: 'arbitrum-rates',
						category: 'Interest Rate Derivatives',
						chains: ['Arbitrum'],
						tvl: 1
					}
				],
				chains: ['Arbitrum', 'Ethereum'],
				parentProtocols: []
			}
		})

		const data = await pageData({
			protocolId: 'boros',
			currentProtocolMetadata: { displayName: 'Boros', tvl: true } satisfies IProtocolMetadata
		})
		const faqPeers =
			data.faqItems
				?.find((item) => item.id === 'comparison')
				?.answer.filter((part) => part.href?.startsWith('/protocol/'))
				.map((part) => part.text) ?? []

		expect(data.competitors).toEqual([
			{ name: 'Arbitrum Rates', tvl: 1 },
			{ name: 'Rho X', tvl: 10 }
		])
		expect(faqPeers).toEqual(['Arbitrum Rates', 'Rho X'])
	})

	test('distinguishes absent TVL capability from successful empty and explicit-zero TVL responses', async () => {
		const absent = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', tvl: false } })
		expect(absent.currentTvlByChain).toBeNull()

		const empty = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', tvl: true } })
		expect(empty.currentTvlByChain).toStrictEqual({})

		serveProtocol('test-protocol', { ...protocolDetails, gecko_id: null, currentChainTvls: { Ethereum: 0 } })
		const zero = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', tvl: true } })
		expect(zero.currentTvlByChain).toStrictEqual({ Ethereum: 0 })
	})

	test.each([
		{ fees: { total30d: 100 }, hasKeyMetrics: true },
		{ fees: { total30d: 0 }, hasKeyMetrics: true },
		{ fees: { total24h: null, total7d: null, total30d: null, totalAllTime: null }, hasKeyMetrics: false }
	])(
		'shows key metrics for period-only and zero fees but hides unavailable fees: $fees',
		async ({ fees, hasKeyMetrics }) => {
			http.serve({ [`${V2_SERVER_URL}/metrics/fees/protocol/test-protocol`]: { ...fees, methodology: null } })
			const data = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', fees: true } })
			expect(data.hasKeyMetrics).toBe(hasKeyMetrics)
		}
	)

	test('retains a successful activity summary when every metric is explicit zero', async () => {
		http.serve({ [`${V2_SERVER_URL}/metrics/`]: { total24h: 0 } })

		const data = await pageData({
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				activeUsers: true,
				newUsers: true,
				txCount: true,
				gasUsed: true
			} satisfies IProtocolMetadata
		})

		expect(data.users).toEqual({ activeUsers: 0, newUsers: 0, transactions: 0, gasUsed: 0, gasUsedUsd: 0 })
	})

	test('keeps native gas usage separate from its USD cost', async () => {
		serveProtocol('polymarket', { ...protocolDetails, id: 'polymarket', name: 'Polymarket' })
		const activity = `${V2_SERVER_URL}/metrics/active-users/protocol/polymarket`
		http.serve({
			[`${activity}?dataType=dailyGasUsed`]: { total24h: 398_354 },
			[`${activity}?dataType=dailyGasUsedUsd`]: { total24h: 28_520 }
		})

		const data = await pageData({
			protocolId: 'polymarket',
			currentProtocolMetadata: { displayName: 'Polymarket', gasUsed: true } satisfies IProtocolMetadata
		})

		expect(data.users).toEqual({
			activeUsers: null,
			newUsers: null,
			transactions: null,
			gasUsed: 398_354,
			gasUsedUsd: 28_520
		})
	})

	describe('open interest', () => {
		const openInterest = (protocol: string) =>
			`${V2_SERVER_URL}/metrics/open-interest/protocol/${protocol}?dataType=openInterestAtEnd`
		const child = (name: string, defillamaId: string, displayName = name) => ({
			name,
			displayName,
			defillamaId,
			methodology: null
		})
		const optionsMetadata = {
			displayName: 'Test Protocol',
			openInterest: true,
			optionsOpenInterest: true
		} satisfies IProtocolMetadata
		// The parent total lags its children; the options child's adapter name differs from its display name.
		const parent = {
			name: 'Test Protocol',
			total24h: 90,
			childProtocols: [child('Test Perps', '1'), child('test-options', '2', 'Test Options')]
		}

		beforeEach(() => {
			http.serve({
				[openInterest('test-protocol')]: parent,
				[openInterest('test-perps')]: { defillamaId: '1', category: 'Derivatives', total24h: 100 },
				[openInterest('test-options')]: { defillamaId: '2', category: 'Options', total24h: 30 }
			})
		})

		test('sums perp and options open interest from their own children', async () => {
			const data = await pageData({ currentProtocolMetadata: optionsMetadata })

			expect(data.openInterest?.total24h).toBe(100)
			expect(data.optionsOpenInterest?.total24h).toBe(30)
			expect(data.optionsOpenInterestSeries).toEqual(['Test Options', 'test-options'])
			expect(data.availableCharts).toEqual(expect.arrayContaining(['Open Interest', 'Options Open Interest']))
		})

		test('shows no open interest at all when a child fails to load', async () => {
			http.serve({ [openInterest('test-options')]: fixtureStatus(500) })

			const data = await pageData({ currentProtocolMetadata: optionsMetadata })

			expect(data.openInterest).toBeNull()
			expect(data.optionsOpenInterest).toBeNull()
		})

		test('hides an options total the options child has not reported, and keeps its chart', async () => {
			http.serve({ [openInterest('test-options')]: { defillamaId: '2', category: 'Options', total24h: null } })

			const data = await pageData({ currentProtocolMetadata: optionsMetadata })

			expect(data.openInterest?.total24h).toBe(100)
			expect(data.optionsOpenInterest?.total24h).toBeNull()
			expect(data.availableCharts).toContain('Options Open Interest')
		})

		test('keeps children of other categories in open interest', async () => {
			http.serve({
				[openInterest('test-protocol')]: {
					name: 'Test Protocol',
					total24h: 650,
					childProtocols: [child('Test Perps', '1'), child('Test Predictions', '3')]
				},
				[openInterest('test-predictions')]: { defillamaId: '3', category: 'Prediction Market', total24h: 550 }
			})

			const data = await pageData({ currentProtocolMetadata: optionsMetadata })

			expect(data.openInterest?.total24h).toBe(650)
			expect(data.optionsOpenInterest).toBeNull()
			expect(data.availableCharts).not.toContain('Options Open Interest')
		})

		test('an options protocol shows all its open interest as options open interest', async () => {
			http.serve({ [openInterest('test-protocol')]: { name: 'Test Protocol', category: 'Options', total24h: 30 } })

			const data = await pageData({
				currentProtocolMetadata: { displayName: 'Test Protocol', optionsOpenInterest: true } satisfies IProtocolMetadata
			})

			expect(data.openInterest).toBeNull()
			expect(data.optionsOpenInterest?.total24h).toBe(30)
			expect(data.optionsOpenInterestSeries).toEqual([])
			expect(data.availableCharts).toContain('Options Open Interest')
			expect(data.availableCharts).not.toContain('Open Interest')
		})

		// A parent whose only options child has no options volume adapter, like Synapse and Hypercall.
		test('the options open interest flag alone splits out an options child', async () => {
			http.serve({
				[openInterest('test-protocol')]: {
					name: 'Test Protocol',
					total24h: 30,
					childProtocols: [child('test-options', '2', 'Test Options')]
				}
			})

			const data = await pageData({
				currentProtocolMetadata: { displayName: 'Test Protocol', optionsOpenInterest: true } satisfies IProtocolMetadata
			})

			expect(data.openInterest).toBeNull()
			expect(data.optionsOpenInterest?.total24h).toBe(30)
		})

		test('an options exchange without open interest requests none', async () => {
			http.serve({
				[`${V2_SERVER_URL}/metrics/options/protocol/test-protocol?dataType=dailyPremiumVolume`]: { total24h: 5 }
			})

			const data = await pageData({
				currentProtocolMetadata: {
					displayName: 'Test Protocol',
					optionsPremiumVolume: true
				} satisfies IProtocolMetadata
			})

			expect(data.optionsPremiumVolume?.total24h).toBe(5)
			expect(http.urls().filter((url) => url.includes('/open-interest/'))).toEqual([])
		})
	})

	test('default-toggles secondary charts without server-prefetching their series', async () => {
		http.serve({ [`${V2_SERVER_URL}/metrics/fees/protocol/test-protocol`]: { totalAllTime: 1, methodology: null } })
		const data = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', fees: true } })

		expect(data.availableCharts).toContain('Fees')
		expect(data.defaultToggledCharts).toContain('Fees')
		expect(data.initialMultiSeriesChartData).toEqual({})
	})

	test('default-toggles seeded primary chart data', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chart/tvl/protocol/test-protocol`]: [
				[1_700_000_000, 10],
				[1_700_086_400, 12]
			]
		})

		const data = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', tvl: true } })

		expect(data.defaultToggledCharts).toEqual(['TVL'])
		expect(data.initialMultiSeriesChartData).toEqual({
			TVL: [
				[1_700_000_000_000, 10],
				[1_700_086_400_000, 12]
			]
		})
	})

	describe('oracle providers', () => {
		const chainlink = { protocolId: 'chainlink', currentProtocolMetadata: { displayName: 'Chainlink', tvl: true } }

		beforeEach(() => {
			serveProtocol('chainlink', { ...protocolDetails, id: 'chainlink', name: 'Chainlink' })
			http.serve({ [`${V2_SERVER_URL}/chart/oracle/protocol/chainlink`]: [] })
		})

		test('keeps configured TVS available while seeding only a nonempty exact producer array', async () => {
			http.serve({
				[`${V2_SERVER_URL}/metrics/oracle`]: {
					oracles: {},
					chainsByOracle: {},
					protocolsByOracleChain: {},
					oraclesTVS: {}
				}
			})
			const emptyData = await pageData(chainlink)
			expect(emptyData.availableCharts).toContain('TVS')
			expect(emptyData.availableCharts).not.toContain('TVL')
			expect(emptyData.defaultToggledCharts).toContain('TVS')
			expect(emptyData.initialMultiSeriesChartData).toEqual({})

			http.serve({ [`${V2_SERVER_URL}/chart/oracle/protocol/chainlink`]: [[1_700_000_000, 42]] })
			expect((await pageData(chainlink)).initialMultiSeriesChartData.TVS).toEqual([[1_700_000_000_000, 42]])
		})

		test('aggregates every consumer measurement for an oracle provider', async () => {
			http.serve({
				[`${V2_SERVER_URL}/metrics/oracle`]: {
					oracles: { Chainlink: ['Chainlink', 'Aave'] },
					chainsByOracle: { Chainlink: ['Ethereum', 'Arbitrum'] },
					protocolsByOracleChain: { Chainlink: { Ethereum: ['Chainlink', 'Aave'], Arbitrum: ['Aave'] } },
					oraclesTVS: { Chainlink: { Chainlink: { Ethereum: 0 }, Aave: { Ethereum: 20, Arbitrum: 5 } } }
				}
			})
			expect((await pageData(chainlink)).oracleTvs).toEqual({ Ethereum: 20, Arbitrum: 5 })
		})

		test('treats an omitted canonical Oracle member as zero contribution', async () => {
			http.serve({
				[`${V2_SERVER_URL}/metrics/oracle`]: {
					oracles: { Chainlink: ['Measured', 'Missing'] },
					chainsByOracle: { Chainlink: ['Ethereum'] },
					protocolsByOracleChain: { Chainlink: { Ethereum: ['Measured', 'Missing'] } },
					oraclesTVS: { Chainlink: { Measured: { Ethereum: 10 } } }
				}
			})
			expect((await pageData(chainlink)).oracleTvs).toEqual({ Ethereum: 10 })
		})

		test('preserves extra-only Oracle measurements while default TVS is zero', async () => {
			http.serve({
				[`${V2_SERVER_URL}/metrics/oracle`]: {
					oracles: { Chainlink: ['Extra Only'] },
					chainsByOracle: { Chainlink: ['Ethereum'] },
					protocolsByOracleChain: { Chainlink: { Ethereum: ['Extra Only'] } },
					oraclesTVS: { Chainlink: { 'Extra Only': { 'Ethereum-staking': 5 } } }
				}
			})
			expect((await pageData(chainlink)).oracleTvs).toEqual({ 'Ethereum-staking': 5 })
		})

		test('preserves Oracle identity when its optional measurement request fails', async () => {
			http.serve({ [`${V2_SERVER_URL}/metrics/oracle`]: fixtureStatus(404) })
			expect(await pageData(chainlink)).toMatchObject({ isOracleProtocol: true, oracleTvs: null, hasKeyMetrics: true })
		})
	})

	test('constructs token FAQ data from the shared token market summary', async () => {
		const getTokenMarketSummary = vi.fn(async () => ({
			symbol: 'TEST',
			marketCapRank: 10,
			currentPrice: 2,
			priceChange7d: 2,
			priceChange30d: 3,
			marketCap: 1000,
			fdv: 2000,
			circulatingSupply: 500,
			totalSupply: 1000,
			maxSupply: 1000,
			ath: 5,
			athDate: '2026-01-01T00:00:00Z'
		}))

		const data = await pageData({
			currentProtocolMetadata: { displayName: 'Test Protocol', gecko_id: 'test-token' } satisfies IProtocolMetadata,
			tokenDirectory: {
				test: { name: 'Test Token', symbol: 'TEST', token_nk: 'coingecko:test-token', route: '/token/TEST' }
			},
			getTokenMarketSummary
		})

		expect(data.faqItems?.find((item) => item.id === 'token-valuation')?.answer).toContainEqual({
			text: 'TEST',
			href: '/token/TEST'
		})
	})

	test('builds protocol page data when the primary TVL chart seed fails', async () => {
		http.serve({ [`${V2_SERVER_URL}/chart/tvl/protocol/test-protocol`]: fixtureStatus(404) })
		const data = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', tvl: true } })

		expect(data.availableCharts).toContain('TVL')
		expect(data.defaultToggledCharts).toEqual(['TVL'])
		expect(data.initialMultiSeriesChartData).toEqual({})
	})

	test('builds protocol page data when optional treasury data fails', async () => {
		http.serve({ [`${SERVER_URL}/treasuries`]: fixtureStatus(404) })
		const data = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', treasury: true } })
		expect(data.treasury).toBeNull()
	})

	test('keeps a present all-zero Treasury distinct from an absent Treasury', async () => {
		http.serve({
			[`${SERVER_URL}/treasuries`]: [
				{
					id: 'test-protocol-treasury',
					name: 'Test Protocol (treasury)',
					logo: '',
					slug: 'test-protocol-(treasury)',
					tvl: 0,
					chainTvls: {},
					tokenBreakdowns: { majors: 0, stablecoins: 0, ownTokens: 0, others: 0 },
					mcap: null
				}
			]
		})
		const data = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', treasury: true } })
		expect(data.treasury).toEqual({ majors: 0, stablecoins: 0, ownTokens: 0, others: 0, total: 0 })
	})

	test('preserves signed expense categories and missing optional metadata', async () => {
		http.serve({
			'https://api.llama.fi/_internal/operational-costs/expenses': [
				{
					protocolId: 'test-protocol',
					annualUsdCost: { operations: 100, adjustment: -25 },
					sources: null,
					lastUpdate: '2026-08-30'
				}
			]
		})
		const data = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', expenses: true } })

		expect(data.expenses).toEqual({
			headcount: null,
			annualUsdCost: [
				['Operations', 100],
				['Adjustment', -25]
			],
			total: 75,
			sources: null,
			notes: null,
			lastUpdate: '2026-08-30'
		})
	})

	test('builds protocol page data without Yields when the snapshot fails or is absent', async () => {
		const failed = await pageData({ currentProtocolMetadata: { displayName: 'Test Protocol', yields: true } })
		expect(failed.yields).toBeNull()

		const absent = await pageData({
			currentProtocolMetadata: { displayName: 'Test Protocol', yields: true },
			yieldsSnapshot: null
		})
		expect(absent.yields).toBeNull()
		expect(JSON.parse(JSON.stringify(absent))).toEqual(absent)
	})

	describe('outstanding FDV', () => {
		const tokenlist = (currentPrice: number) => ({
			'test-token': {
				symbol: 'test',
				current_price: currentPrice,
				price_change_24h: null,
				price_change_percentage_24h: null,
				ath: null,
				ath_date: null,
				atl: null,
				atl_date: null,
				market_cap: null,
				fully_diluted_valuation: null,
				total_volume: null,
				total_supply: null,
				circulating_supply: null,
				max_supply: null
			}
		})
		const supply = (adjustedSupply: number) => ({
			'test-protocol': {
				name: 'Test Protocol',
				supplyMetrics: {
					maxSupply: 1000,
					adjustedSupply,
					tbdAmount: 0,
					incentiveAmount: 0,
					nonIncentiveAmount: adjustedSupply
				}
			}
		})

		// Emissions pages also chart the token; that history is optional here.
		beforeEach(() => {
			http.serve({ 'https://api.coingecko.com/': fixtureStatus(404), 'https://coins.llama.fi/': fixtureStatus(404) })
		})

		test.each([
			{ adjustedSupply: 500, currentPrice: 2, expected: 1000 },
			{ adjustedSupply: 0, currentPrice: 2, expected: 0 },
			{ adjustedSupply: 500, currentPrice: 0, expected: 0 }
		])(
			'prices the adjusted supply: $adjustedSupply at $currentPrice',
			async ({ adjustedSupply, currentPrice, expected }) => {
				const data = await pageData({
					currentProtocolMetadata: { displayName: 'Test Protocol', emissions: true } satisfies IProtocolMetadata,
					tokenlist: tokenlist(currentPrice),
					emissionsSupplyMetrics: supply(adjustedSupply)
				})
				expect(data.outstandingFDV).toBe(expected)
			}
		)
	})
})

test('fetches token income statements from the token endpoint without mutating the response', async () => {
	const response = {
		components: [
			{ name: 'Hyperliquid', id: 'chain#hyperliquid', protocolType: 'chain', module: 'hyperliquid' },
			{ name: 'Hyper Foundation', id: 'parent#hyper-foundation', protocolType: 'protocol', module: null }
		],
		aggregates: {
			monthly: { '2026-01': { Earnings: { value: -5 }, Revenue: { value: 0, 'by-label': { Fees: 0 } } } },
			quarterly: {},
			yearly: {}
		}
	}
	http.serve({ [`${V2_SERVER_URL}/metrics/financial-statement/token/hype?q=30`]: response })

	const incomeStatement = await getTokenIncomeStatement({ token: 'HYPE' })

	const month = {
		timestamp: Date.parse('2026-01'),
		values: { Earnings: { value: -5 }, Revenue: { value: 0, 'by-label': { Fees: 0 } } }
	}
	expect(incomeStatement?.data.monthly['2026-01']).toEqual(month)
	expect(incomeStatement?.data.cumulative.cumulative).toEqual(month)
	expect(incomeStatement?.components).toEqual(response.components)
})

function platformBreakdown(chart: Array<Array<number>>) {
	return chart.map(([timestamp, value]) => ({ timestamp, 'test-platform': value }))
}

const expenseProtocol = {
	name: 'Child Protocol',
	symbol: 'CHILD',
	logo: null,
	url: '',
	chains: [],
	chainTvls: {},
	tvl: null,
	tvlPrevDay: null,
	tvlPrevWeek: null,
	tvlPrevMonth: null,
	mcap: null,
	defillamaId: '10',
	geckoId: null,
	category: 'Dexs'
} satisfies ProtocolLite

const expenseParentProtocol = {
	id: 'parent#example',
	name: 'Parent Protocol',
	chains: [],
	gecko_id: null,
	mcap: null,
	logo: ''
} satisfies ParentProtocolLite

describe('Protocol Expenses rows', () => {
	test('joins child and parent identities and sums signed whole-USD categories', () => {
		const expenses: Array<IProtocolExpenses> = [
			{
				protocolId: '10',
				headcount: 0,
				annualUsdCost: { salaries: 100, adjustment: -25 },
				sources: [],
				lastUpdate: '2026-01-01'
			},
			{ protocolId: 'parent#example', annualUsdCost: { operations: 200 }, sources: null, lastUpdate: '2026-01-02' }
		]

		expect(
			buildProtocolExpenseRows({ expenses, protocols: [expenseProtocol], parentProtocols: [expenseParentProtocol] })
		).toEqual([
			{
				name: 'Parent Protocol',
				protocol: { ...expenseParentProtocol, defillamaId: 'parent#example' },
				headcount: null,
				sources: null,
				sumAnnualUsdExpenses: 200
			},
			{ name: 'Child Protocol', protocol: expenseProtocol, headcount: 0, sources: [], sumAnnualUsdExpenses: 75 }
		])
	})

	test('fails page construction when producer identity has no protocol metadata', () => {
		const expenses: Array<IProtocolExpenses> = [
			{ protocolId: 'missing', annualUsdCost: { operations: 1 }, sources: null, lastUpdate: '2026-01-01' }
		]
		expect(() => buildProtocolExpenseRows({ expenses, protocols: [], parentProtocols: [] })).toThrow(
			'Protocol Expenses metadata is missing for missing'
		)
	})
})
