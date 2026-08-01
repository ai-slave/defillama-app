import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IAdapterProtocolOverview } from '~/containers/AdapterMetrics/types'
import { getStaticProps as getProtocolStaticProps } from '~/pages/protocol/[protocol]'
import { getStaticProps as getProtocolActiveLoansStaticProps } from '~/pages/protocol/active-loans/[protocol]'
import { getStaticProps as getProtocolDexStaticProps } from '~/pages/protocol/dexs/[protocol]'
import { getStaticProps as getProtocolFeesStaticProps } from '~/pages/protocol/fees/[protocol]'
import { getStaticProps as getProtocolOptionsStaticProps } from '~/pages/protocol/options/[protocol]'
import { getStaticProps as getProtocolTvlStaticProps } from '~/pages/protocol/tvl/[protocol]'
import type { IProtocolOverviewPageData, IProtocolPageMetrics } from '../types'

const mocks = vi.hoisted(() => ({
	fetchOptionalEntityQuestions: vi.fn(),
	fetchProtocolOverviewMetrics: vi.fn(),
	getAdapterProtocolOverview: vi.fn(),
	getProtocolMetricFlags: vi.fn(),
	getProtocolOverviewPageData: vi.fn(),
	getProtocolWarningBanners: vi.fn(),
	protocolMetadata: {}
}))

vi.mock('~/containers/LlamaAI/entityQuestions', () => ({
	fetchOptionalEntityQuestions: mocks.fetchOptionalEntityQuestions
}))

vi.mock('~/containers/ProtocolOverview/api', () => ({
	fetchProtocolOverviewMetrics: mocks.fetchProtocolOverviewMetrics
}))

vi.mock('~/containers/AdapterMetrics/queries', () => ({
	getAdapterProtocolOverview: mocks.getAdapterProtocolOverview
}))

vi.mock('~/containers/ProtocolOverview/queries', () => ({
	getProtocolMetricFlags: mocks.getProtocolMetricFlags,
	getProtocolOverviewPageData: mocks.getProtocolOverviewPageData
}))

vi.mock('~/containers/ProtocolOverview/utils', () => ({
	getProtocolWarningBanners: mocks.getProtocolWarningBanners
}))

vi.mock('~/containers/ProtocolOverview/server/routes', () => ({
	resolveProtocolParamFromMetadata: vi.fn(() => ({
		id: 'test-protocol',
		canonicalSlug: 'test-protocol',
		metadata: {
			displayName: 'Test Protocol',
			tvl: true,
			fees: true,
			revenue: true,
			holdersRevenue: true,
			dexs: true,
			dexsNotionalVolume: true,
			optionsPremiumVolume: true,
			optionsNotionalVolume: true,
			borrowed: true
		}
	})),
	resolveProtocolFeatureRouteFromMetadata: vi.fn(() => ({
		type: 'route',
		route: {
			id: 'test-protocol',
			canonicalSlug: 'test-protocol',
			metadata: {
				displayName: 'Test Protocol',
				tvl: true,
				fees: true,
				revenue: true,
				holdersRevenue: true,
				dexs: true,
				dexsNotionalVolume: true,
				optionsPremiumVolume: true,
				optionsNotionalVolume: true,
				borrowed: true
			}
		}
	}))
}))

vi.mock('~/containers/Cexs/server/routes', () => ({
	resolveCexParamFromMetadata: vi.fn(() => null)
}))

vi.mock('~/utils/metadata', () => ({
	default: {
		chainMetadata: {},
		tokenlist: {},
		cgExchangeIdentifiers: [],
		emissionsSupplyMetrics: {},
		protocolLlamaswapDataset: null,
		protocolMetadata: mocks.protocolMetadata,
		tokenDirectory: null
	}
}))

vi.mock('~/utils/maxAgeForNext', () => ({
	maxAgeForNext: vi.fn(() => 22)
}))

vi.mock('~/utils/perf', () => ({
	withPerformanceLogging: <T extends (...args: never[]) => Promise<object>>(_name: string, fn: T) => fn,
	createRoutePhaseTimer: () => ({
		start: () => () => undefined,
		time: <T>(_name: string, fn: () => T) => fn(),
		record: () => undefined
	})
}))

vi.mock('~/utils/telemetry', () => ({
	addRouteTelemetryAttributes: vi.fn()
}))

const expectJsonRoundTrip = (value: object) => {
	expect(JSON.parse(JSON.stringify(value))).toStrictEqual(value)
}

const createAdapterProtocolOverview = (
	overrides: Partial<IAdapterProtocolOverview> = {}
): IAdapterProtocolOverview => ({
	defillamaId: 'test-protocol',
	name: 'test-protocol',
	displayName: 'Test Protocol',
	module: 'test-protocol',
	category: 'Lending',
	logo: '',
	chains: ['Ethereum'],
	protocolType: 'protocol',
	methodologyURL: null,
	methodology: null,
	slug: 'test-protocol',
	id: 'test-protocol',
	totalAllTime: 100,
	totalDataChart: [[1_700_000_000, 1]],
	...overrides
})

const protocolMetrics: IProtocolPageMetrics = {
	tvl: true,
	dexs: false,
	dexsNotionalVolume: false,
	perps: false,
	openInterest: false,
	optionsPremiumVolume: false,
	optionsNotionalVolume: false,
	dexAggregators: false,
	perpsAggregators: false,
	bridgeAggregators: false,
	stablecoins: false,
	bridge: false,
	treasury: false,
	unlocks: false,
	incentives: false,
	yields: false,
	fees: false,
	revenue: false,
	forks: false,
	governance: false,
	nfts: false,
	dev: false,
	inflows: false,
	liquidity: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false
}

const createProtocolPageData = (): IProtocolOverviewPageData => ({
	initialMultiSeriesChartData: { TVL: [[1_700_000_000_000, 100]] },
	id: 'test-protocol',
	name: 'Test Protocol',
	token: { symbol: 'TEST', gecko_id: null, gecko_url: null, explorer_url: null, tokenPageRoute: null },
	category: null,
	tags: null,
	otherProtocols: null,
	deprecated: false,
	chains: ['Ethereum'],
	currentTvlByChain: { Ethereum: 100 },
	description: 'Test protocol',
	website: null,
	isWebsiteReferral: false,
	twitter: null,
	safeHarbor: false,
	tvlMethodology: null,
	tvlMethodologyUrl: null,
	github: null,
	metrics: protocolMetrics,
	fees: null,
	revenue: null,
	holdersRevenue: null,
	dexVolume: null,
	dexNotionalVolume: null,
	dexAggregatorVolume: null,
	perpVolume: null,
	openInterest: null,
	perpAggregatorVolume: null,
	bridgeAggregatorVolume: null,
	optionsPremiumVolume: null,
	optionsNotionalVolume: null,
	liquidationVolume: null,
	collateralLiquidated: null,
	bridgeVolume: null,
	incentives: null,
	treasury: null,
	unlocks: null,
	yields: null,
	governance: null,
	articles: null,
	users: null,
	raises: null,
	expenses: null,
	tokenLiquidity: null,
	tokenCGData: null,
	outstandingFDV: null,
	audits: null,
	isCEX: false,
	hasKeyMetrics: false,
	competitors: [],
	hacks: [],
	chartDenominations: [{ symbol: 'USD', geckoId: null }],
	chartColors: { TVL: '#000000' },
	availableCharts: ['TVL'],
	hallmarks: [],
	rangeHallmarks: [],
	geckoId: null,
	governanceApis: null,
	incomeStatement: null,
	warningBanners: [],
	defaultChartView: 'daily',
	seoTitle: 'Test Protocol TVL',
	seoDescription: 'Test Protocol overview',
	defaultToggledCharts: ['TVL'],
	isOracleProtocol: false,
	oracleTvs: null,
	entityQuestions: [],
	faqItems: [],
	treasuryMethodologyUrl: null,
	llamaswapChains: null
})

describe('protocol static props serialization', () => {
	beforeEach(() => {
		mocks.fetchOptionalEntityQuestions.mockReset()
		mocks.fetchProtocolOverviewMetrics.mockReset()
		mocks.getAdapterProtocolOverview.mockReset()
		mocks.getProtocolMetricFlags.mockReset()
		mocks.getProtocolOverviewPageData.mockReset()
		mocks.getProtocolWarningBanners.mockReset()
		for (const protocolId of Object.keys(mocks.protocolMetadata)) {
			Reflect.deleteProperty(mocks.protocolMetadata, protocolId)
		}
	})

	it('keeps the overview route result JSON serializable after adding entity questions', async () => {
		mocks.getProtocolOverviewPageData.mockResolvedValueOnce(createProtocolPageData())
		mocks.fetchOptionalEntityQuestions.mockResolvedValueOnce({ questions: ['What is Test Protocol?'] })

		const result = await getProtocolStaticProps({ params: { protocol: 'test-protocol' } })

		expectJsonRoundTrip(result)
	})

	it('keeps the TVL route result JSON serializable and protocol-only', async () => {
		mocks.fetchProtocolOverviewMetrics.mockResolvedValueOnce({
			name: 'Test Protocol',
			currentChainTvls: {
				Ethereum: 100,
				staking: 20,
				doublecounted: 30
			}
		})
		mocks.getProtocolMetricFlags.mockReturnValueOnce({ tvl: true, inflows: false })
		mocks.getProtocolWarningBanners.mockReturnValueOnce([])

		const result = await getProtocolTvlStaticProps({ params: { protocol: 'test-protocol' } })

		expectJsonRoundTrip(result)
		expect(result).toMatchObject({
			props: {
				otherProtocols: null,
				toggleOptions: [{ name: 'Staking', key: 'staking' }],
				chainsUnique: ['Ethereum']
			}
		})
	})

	it('keeps zero all-time fee subtype totals and serializes the fee route result', async () => {
		mocks.fetchProtocolOverviewMetrics.mockResolvedValueOnce({
			name: 'Test Protocol',
			currentChainTvls: {},
			isParentProtocol: false,
			otherProtocols: null,
			category: 'Lending',
			deprecated: false,
			dimensions: null
		})
		mocks.getAdapterProtocolOverview
			.mockResolvedValueOnce(
				createAdapterProtocolOverview({ totalAllTime: 100, totalDataChart: [[1_700_000_000, 10]] })
			)
			.mockResolvedValueOnce(
				createAdapterProtocolOverview({
					totalAllTime: 0,
					totalDataChart: [[1_700_000_000, 0]],
					chains: ['Arbitrum', 'Base']
				})
			)
			.mockRejectedValueOnce(new Error('holders revenue unavailable'))
		mocks.getProtocolMetricFlags.mockReturnValueOnce(protocolMetrics)
		mocks.getProtocolWarningBanners.mockReturnValueOnce([])

		const result = await getProtocolFeesStaticProps({ params: { protocol: 'test-protocol' } })

		expectJsonRoundTrip(result)
		expect(result).toMatchObject({
			props: {
				fees: { totalAllTime: 100 },
				revenue: { totalAllTime: 0 },
				holdersRevenue: null,
				protocolRevenueChains: ['Arbitrum', 'Base'],
				failedMetrics: ['Holders Revenue']
			}
		})
	})

	it.each([
		['DEX', getProtocolDexStaticProps],
		['Options', getProtocolOptionsStaticProps]
	])('keeps notional-only children out of the %s primary breakdown props', async (_name, getStaticProps) => {
		Object.assign(mocks.protocolMetadata, {
			'primary-v2': { displayName: 'Primary V2', dexs: true, optionsPremiumVolume: true },
			'notional-v2': {
				displayName: 'Notional V2',
				dexsNotionalVolume: true,
				optionsNotionalVolume: true
			}
		})
		mocks.fetchProtocolOverviewMetrics.mockResolvedValueOnce({
			name: 'Test Protocol',
			currentChainTvls: {},
			isParentProtocol: true,
			otherProtocols: null,
			category: 'DEX',
			deprecated: false,
			dimensions: null
		})
		mocks.getAdapterProtocolOverview
			.mockResolvedValueOnce(createAdapterProtocolOverview({ linkedProtocols: ['Test Protocol', 'Primary V2'] }))
			.mockResolvedValueOnce(createAdapterProtocolOverview({ linkedProtocols: ['Test Protocol', 'Notional V2'] }))
		mocks.getProtocolMetricFlags.mockReturnValueOnce(protocolMetrics)
		mocks.getProtocolWarningBanners.mockReturnValueOnce([])

		const result = await getStaticProps({ params: { protocol: 'test-protocol' } })

		expectJsonRoundTrip(result)
		expect(result).toMatchObject({ props: { protocolVersions: ['Primary V2'] } })
	})

	it('serializes active-loans props without protocol TVL toggle controls', async () => {
		mocks.fetchProtocolOverviewMetrics.mockResolvedValueOnce({
			name: 'Test Protocol',
			parentProtocol: null,
			otherProtocols: null,
			category: 'Lending',
			currentChainTvls: {
				Ethereum: 100,
				staking: 20,
				pool2: 0,
				doublecounted: 30,
				govtokens: 40,
				borrowed: 0,
				liquidstaking: 50,
				'Ethereum-borrowed': 10
			}
		})
		mocks.getProtocolMetricFlags.mockReturnValueOnce(protocolMetrics)
		mocks.getProtocolWarningBanners.mockReturnValueOnce([])

		const result = await getProtocolActiveLoansStaticProps({ params: { protocol: 'test-protocol' } })

		expectJsonRoundTrip(result)
		expect(result).toMatchObject({
			props: {
				otherProtocols: []
			}
		})
		expect(result).not.toHaveProperty('props.toggleOptions')
	})
})
