import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { hasTokenLiquidationsData } from '~/containers/LiquidationsV2/server/dataset.server'
import { getTokenIncomeStatement } from '~/containers/ProtocolOverview/queries'
import type { Raise } from '~/containers/Raises/model'
import { fetchRaisesByDefillamaId } from '~/containers/Raises/server/dataset.server'
import { getTokenRiskData } from '~/containers/Token/queries'
import {
	getTokenOverviewData,
	type TokenOverviewCurrentMetrics,
	type TokenOverviewData
} from '~/containers/Token/tokenOverview'
import type { TokenPageProps, TokenPageSection } from '~/containers/Token/types'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import {
	fetchTokenRightsEntries,
	fetchTokenRightsEntryByDefillamaId,
	fetchTokenRightsEntryByName
} from '~/containers/TokenRights/server/dataset.server'
import { parseTokenRightsEntry } from '~/containers/TokenRights/utils'
import { getTokenOverviewCurrentSnapshot } from '~/containers/Tokens/queries.server'
import type { RawTreasuryProtocol } from '~/containers/Treasuries/api.types'
import { fetchTreasuryById } from '~/containers/Treasuries/server/dataset.server'
import type { ProtocolEmissionSupplyMetricsMap } from '~/containers/Unlocks/api.types'
import { getTokenBorrowRoutes, getTokenEarnRows } from '~/containers/Yields/data/server/tokenPage'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import { acquireOptionalYieldsSnapshot } from '~/containers/Yields/server/dataset.server'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import TokenPage, { getServerSideProps } from '~/pages/token/[token]'
import { DatasetSnapshotIntegrityError } from '~/server/datasetSnapshots/errors'
import { EMPTY_TOKEN_FILTER_METADATA, type TokenFilterMetadataArtifact } from '~/utils/metadata/tokenFilters'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import type { TokenDirectory } from '~/utils/tokenDirectory'
import type { TokenRiskResponse } from '../tokenRisk.types'
import { buildTokenRiskProtocolSummaries } from '../tokenRisk.utils'

type TokenPageResult =
	| { props: TokenPageProps }
	| { redirect: { destination: string; permanent: boolean } }
	| { notFound: true }

const runTokenPageRequest = getServerSideProps as unknown as (context: never) => Promise<TokenPageResult>

const { capturedTokenNavSections, renderedTokenSections, setPageHeader, getTokensCacheControlMock } = vi.hoisted(
	() => ({
		capturedTokenNavSections: [] as Array<{ id: string; label: string }>,
		renderedTokenSections: [] as Array<string>,
		setPageHeader: vi.fn(),
		getTokensCacheControlMock: vi.fn(() => 'public, s-maxage=123, must-revalidate')
	})
)

const tokenRightsEntryFixture: IRawTokenRightsEntry = {
	'Protocol Name': 'Bitcoin',
	Token: ['BTC'],
	'Token Type': ['Governance'],
	'Brief description': 'desc',
	'Governance Details (Summary)': 'gov summary',
	'Governance Decisions': ['BTC'],
	'Treasury Decisions': ['BTC'],
	'Revenue Decisions': ['N/A'],
	'Fee Switch Status': 'OFF',
	Buybacks: ['N/A'],
	Dividends: ['N/A'],
	Burns: 'N/A',
	'Associated Entities': [],
	'Last Updated': '2026-04-15',
	'DefiLlama ID': 'bitcoin'
}

const tokenRightsFixture = parseTokenRightsEntry(tokenRightsEntryFixture)

const overviewFixture: TokenOverviewData = {
	categories: [],
	website: null,
	twitter: null,
	telegram: null,
	discord: null,
	name: 'Bitcoin',
	displayName: 'BTC',
	symbol: 'BTC',
	marketData: {
		currentPrice: 100,
		percentChange24h: 5,
		ath: 120,
		athDate: '2024-01-01',
		atl: 1,
		atlDate: '2020-01-01',
		circulatingSupply: 21,
		totalSupply: 21,
		maxSupply: 21,
		mcap: 1000,
		fdv: 1500,
		volume24h: {
			total: 500,
			cex: 300,
			dex: 200
		}
	},
	treasury: null,
	raises: null,
	outstandingFDV: null,
	rawChartData: {
		'Token Price': [
			[1_711_929_600_000, 100],
			[1_712_016_000_000, 110]
		]
	}
}

const state: {
	tokensJson: TokenDirectory
	tokenFilterMetadata: TokenFilterMetadataArtifact
	tokenRightsEntries: Array<unknown>
	protocolMetadata: Record<string, IProtocolMetadata>
	chainMetadata: Record<string, { name: string }>
	liquidationsTokenSymbols: Array<string>
	liquidationsTokenSymbolsSet: Set<string>
	hasTokenLiquidationsData: boolean
	hasTokenMarkets: boolean
	emissionsProtocolsList: Array<string>
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
	incomeStatementData: unknown
	tokenRiskData: TokenRiskResponse | null
	initialYieldsRows: Array<unknown>
	initialTokenBorrowRoutesData: unknown
	tokenlist: Record<string, unknown>
} = {
	tokenFilterMetadata: EMPTY_TOKEN_FILTER_METADATA,
	tokensJson: {
		btc: { name: 'Bitcoin', symbol: 'BTC', token_nk: 'coingecko:bitcoin', route: '/token/BTC', mcap_rank: 1 },
		eth: { name: 'Ethereum', symbol: 'ETH', token_nk: 'coingecko:ethereum', route: '/token/ETH', mcap_rank: 2 }
	},
	tokenRightsEntries: [],
	protocolMetadata: {},
	chainMetadata: {},
	liquidationsTokenSymbols: [],
	liquidationsTokenSymbolsSet: new Set<string>(),
	hasTokenLiquidationsData: false,
	hasTokenMarkets: false,
	emissionsProtocolsList: [],
	emissionsSupplyMetrics: {},
	incomeStatementData: null,
	tokenRiskData: null,
	initialYieldsRows: [],
	initialTokenBorrowRoutesData: null,
	tokenlist: {
		bitcoin: {
			symbol: 'btc',
			current_price: 100,
			price_change_24h: 5,
			price_change_percentage_24h: 5,
			ath: null,
			ath_date: null,
			atl: null,
			atl_date: null,
			market_cap: 1000,
			fully_diluted_valuation: 1500,
			total_volume: 500,
			total_supply: null,
			circulating_supply: 21,
			max_supply: 21
		}
	}
}

function resetState() {
	state.tokenFilterMetadata = EMPTY_TOKEN_FILTER_METADATA
	state.tokensJson = {
		btc: { name: 'Bitcoin', symbol: 'BTC', token_nk: 'coingecko:bitcoin', route: '/token/BTC', mcap_rank: 1 },
		eth: { name: 'Ethereum', symbol: 'ETH', token_nk: 'coingecko:ethereum', route: '/token/ETH', mcap_rank: 2 }
	}
	state.tokenRightsEntries = []
	state.protocolMetadata = {}
	state.chainMetadata = {}
	state.liquidationsTokenSymbols = []
	state.liquidationsTokenSymbolsSet = new Set<string>()
	state.hasTokenLiquidationsData = false
	state.hasTokenMarkets = false
	state.emissionsProtocolsList = []
	state.emissionsSupplyMetrics = {}
	state.incomeStatementData = null
	state.tokenRiskData = null
	state.initialYieldsRows = []
	state.initialTokenBorrowRoutesData = null
	state.tokenlist = {
		bitcoin: {
			symbol: 'btc',
			current_price: 100,
			price_change_24h: 5,
			price_change_percentage_24h: 5,
			ath: null,
			ath_date: null,
			atl: null,
			atl_date: null,
			market_cap: 1000,
			fully_diluted_valuation: 1500,
			total_volume: 500,
			total_supply: null,
			circulating_supply: 21,
			max_supply: 21
		}
	}
}

function makeYieldRow(overrides: Partial<IYieldTableRow> = {}): IYieldTableRow {
	return {
		id: 'pool-1',
		pool: 'stETH-ETH',
		poolMeta: null,
		project: 'Aave',
		projectslug: 'aave',
		airdrop: false,
		raiseValuationUsd: null,
		configID: 'pool-1',
		chains: ['Ethereum'],
		tvl: 1_000_000,
		apy: 5.1,
		apyBase: null,
		apyReward: null,
		apyMean30d: null,
		apyRewardRaw: null,
		rewardTokens: [],
		rewardTokensSymbols: [],
		intrinsicSourceSymbol: null,
		volumeUsd1d: null,
		pricePerShare: null,
		holderCount: null,
		avgPositionUsd: null,
		top10Pct: null,
		stabilityScore: null,
		stabilityRating: null,
		sparkline: null,
		resolvedApy: { base: null, reward: null, intrinsic: null, total: 5.1 },
		stablecoin: false,
		tokenSymbols: ['stETH', 'ETH'],
		singleAssetExposure: false,
		ilRisk: false,
		url: 'https://example.com/pool-1',
		category: 'Lending',
		referenceAsset: 'ETH',
		...overrides
	}
}

function makeRouteRow(overrides: Partial<RouteTableRow> = {}): RouteTableRow {
	return {
		id: 'coll:borrow',
		collateralId: 'coll',
		borrowId: 'borrow',
		configID: 'borrow',
		pool: 'ETH / USDC',
		poolMeta: null,
		url: 'https://example.com/pool',
		project: 'Aave',
		projectslug: 'aave-v3',
		airdrop: false,
		raiseValuationUsd: null,
		chain: 'Ethereum',
		chains: ['Ethereum'],
		collateralSymbol: 'ETH',
		borrowSymbol: 'USDC',
		supplyApy: 3,
		supplyApyBase: 3,
		supplyApyReward: null,
		supplyApyIntrinsic: null,
		supplyIntrinsicSourceSymbol: null,
		borrowApy: 2,
		borrowApyBase: 2,
		borrowApyReward: null,
		borrowApyIntrinsic: null,
		borrowIntrinsicSourceSymbol: null,
		supplyRewardTokensSymbols: [],
		borrowRewardTokensSymbols: [],
		netApy: 5,
		availableBorrowUsd: 500_000,
		totalBorrowUsd: 1_000_000,
		borrowCapacityFilled: 0.5,
		ltv: 0.8,
		...overrides
	}
}

function makeTokenPageProps(sections: Array<TokenPageSection>): TokenPageProps {
	return {
		seoTitle: 'title',
		seoDescription: 'description',
		canonicalUrl: '/token/btc',
		sections
	}
}

function makeOverviewSection(overrides: Partial<Extract<TokenPageSection, { id: 'token-overview' }>> = {}) {
	return {
		id: 'token-overview',
		label: 'Overview',
		overview: overviewFixture,
		geckoId: 'bitcoin',
		logo: null,
		issuer: null,
		chain: null,
		...overrides
	} satisfies TokenPageSection
}

function makeUsageSection(tokenSymbol = 'BTC') {
	return {
		id: 'token-usage',
		label: 'Token Usage',
		tokenSymbol
	} satisfies TokenPageSection
}

function tokenPageSectionIds(sections: Array<TokenPageSection>): Array<string> {
	return sections.map((section) => section.id)
}

function findTokenPageSection<Id extends TokenPageSection['id']>(
	sections: Array<TokenPageSection>,
	id: Id
): Extract<TokenPageSection, { id: Id }> | undefined {
	return sections.find((section): section is Extract<TokenPageSection, { id: Id }> => section.id === id)
}

function normalizeName(value: string): string {
	return value
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

vi.mock('~/containers/Token/TokenOverviewSection', () => ({
	TokenOverviewSection: () => {
		renderedTokenSections.push('token-overview')
		return null
	}
}))

vi.mock('~/containers/Token/tokenOverview', () => ({
	getTokenOverviewData: vi.fn(() => Promise.resolve(overviewFixture)),
	TOKEN_OVERVIEW_DEFAULT_CHARTS: ['Token Price']
}))

vi.mock('~/containers/Token/TokenUsageSection', () => ({
	TokenUsageSection: () => {
		renderedTokenSections.push('token-usage')
		return null
	}
}))

vi.mock('~/containers/Token/TokenLiquidationsSection', () => ({
	TokenLiquidationsSection: () => {
		renderedTokenSections.push('token-liquidations')
		return null
	}
}))

vi.mock('~/containers/Token/TokenMarketsSection', () => ({
	TokenMarketsSection: () => {
		renderedTokenSections.push('token-markets')
		return null
	}
}))

vi.mock('~/containers/Markets/server/dataset.server', () => ({
	getTokenMarketSummary: vi.fn(async () => null),
	hasTokenMarkets: vi.fn((geckoId: string) => Promise.resolve(geckoId === 'bitcoin'))
}))

vi.mock('~/containers/Token/TokenYieldsSection', () => ({
	TokenYieldsSection: () => {
		renderedTokenSections.push('token-yields')
		return null
	}
}))

vi.mock('~/containers/Token/TokenUnlocksSection', () => ({
	TokenUnlocksSection: ({ resolvedUnlocksSlug }: { resolvedUnlocksSlug?: string | null }) => {
		if (!resolvedUnlocksSlug) return null
		renderedTokenSections.push('token-unlocks')
		return null
	}
}))

vi.mock('~/containers/Token/TokenBorrowSection', () => ({
	TokenBorrowSection: () => {
		renderedTokenSections.push('token-borrow')
		return null
	}
}))

vi.mock('~/containers/Token/TokenRisksSection', () => ({
	TokenRisksSection: () => {
		renderedTokenSections.push('token-risks')
		return null
	}
}))

vi.mock('~/containers/Token/TokenIncomeStatementSection', () => ({
	TokenIncomeStatementSection: () => {
		renderedTokenSections.push('token-income-statement')
		return null
	}
}))

vi.mock('~/containers/TokenRights/TokenRightsByProtocol', () => ({
	TokenRightsByProtocol: () => {
		renderedTokenSections.push('token-rights-and-value-accrual')
		return null
	}
}))

vi.mock('~/containers/Token/TokenPageSectionNav', () => ({
	TokenPageSectionNav: ({ sections }: { sections: Array<{ id: string; label: string }> }) => {
		capturedTokenNavSections.length = 0
		capturedTokenNavSections.push(...sections)
		return null
	}
}))

vi.mock('~/layout', () => ({
	default: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))

vi.mock('~/containers/Tokens/cache.server', () => ({
	getTokensCacheControl: getTokensCacheControlMock,
	getTokensCacheRevision: () => 42
}))

vi.mock('~/containers/Tokens/queries.server', () => ({
	getTokenOverviewCurrentSnapshot: vi.fn().mockResolvedValue({ generatedAt: 42, metrics: null, categories: [] })
}))

vi.mock('~/utils/telemetry', () => ({
	withServerSidePropsTelemetry: (_route: string, handler: (context: any) => unknown) => (context: any) =>
		handler({
			query: {},
			resolvedUrl: '/token/test',
			req: { method: 'GET' },
			res: { setHeader: setPageHeader },
			...context
		})
}))

vi.mock('~/containers/TokenRights/server/dataset.server', () => ({
	fetchTokenRightsEntries: vi.fn(() => Promise.resolve(state.tokenRightsEntries)),
	fetchTokenRightsEntryByDefillamaId: vi.fn((defillamaId: string) =>
		Promise.resolve(
			(state.tokenRightsEntries as Array<Record<string, unknown>>).find(
				(entry) => entry['DefiLlama ID'] === defillamaId
			) ?? null
		)
	),
	fetchTokenRightsEntryByName: vi.fn((protocolName: string) => {
		const normalizedName = normalizeName(protocolName)
		return Promise.resolve(
			(state.tokenRightsEntries as Array<Record<string, unknown>>).find(
				(entry) => normalizeName(String(entry['Protocol Name'] ?? '')) === normalizedName
			) ?? null
		)
	})
}))

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: {
		get tokenFilterMetadata() {
			return state.tokenFilterMetadata
		},
		get tokenDirectory() {
			return state.tokensJson
		},
		get tokenDirectoryRecordByRouteSegment() {
			const records: Record<string, TokenDirectory[string]> = {}
			for (const key in state.tokensJson) {
				const token = state.tokensJson[key]
				if (!token) throw new Error('Missing token fixture')
				const route = token.route ?? `/token/${encodeURIComponent(token.symbol)}`
				if (!route.startsWith('/token/')) continue
				records[decodeURIComponent(route.slice('/token/'.length))] = token
			}
			return records
		},
		get tokenlist() {
			return state.tokenlist
		},
		get protocolMetadata() {
			return state.protocolMetadata
		},
		get chainMetadata() {
			return state.chainMetadata
		},
		get liquidationsTokenSymbols() {
			return state.liquidationsTokenSymbols
		},
		get liquidationsTokenSymbolsSet() {
			return state.liquidationsTokenSymbolsSet
		},
		get emissionsProtocolsList() {
			return state.emissionsProtocolsList
		},
		get emissionsSupplyMetrics() {
			return state.emissionsSupplyMetrics
		},
		get protocolDisplayNames() {
			return new Map<string, string>()
		},
		get chainDisplayNames() {
			return new Map<string, string>()
		}
	},
	refreshMetadataIfStale: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('~/containers/ProtocolOverview/queries', () => ({
	getTokenIncomeStatement: vi.fn(() => Promise.resolve(state.incomeStatementData))
}))

vi.mock('~/containers/Token/queries', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/Token/queries')>()),
	getTokenRiskData: vi.fn(() => Promise.resolve(state.tokenRiskData))
}))

vi.mock('~/containers/Yields/server/dataset.server', () => ({
	acquireOptionalYieldsSnapshot: vi.fn(() => Promise.resolve({ readJson: vi.fn() })),
	readYieldsMeta: vi.fn(() => Promise.resolve(null))
}))

vi.mock('~/containers/Yields/data/server/tokenPage', () => ({
	getTokenEarnRows: vi.fn(() => Promise.resolve({ rows: state.initialYieldsRows, tokenKeys: ['family:test'] })),
	getTokenBorrowRoutes: vi.fn(() =>
		Promise.resolve(
			state.initialTokenBorrowRoutesData
				? { ...(state.initialTokenBorrowRoutesData as object), tokenKeys: ['family:test'] }
				: null
		)
	)
}))

vi.mock('~/containers/LiquidationsV2/server/dataset.server', () => ({
	hasTokenLiquidationsData: vi.fn(() => Promise.resolve(state.hasTokenLiquidationsData)),
	getTokenLiquidationsSectionData: vi.fn()
}))

vi.mock('~/containers/Raises/server/dataset.server', () => ({
	fetchRaisesByDefillamaId: vi.fn().mockResolvedValue([])
}))

vi.mock('~/containers/Treasuries/server/dataset.server', () => ({
	fetchTreasuryById: vi.fn().mockResolvedValue(null)
}))

vi.mock('~/containers/Token/server/dataset.risk.server', () => ({
	getIndexedTokenRiskBorrowCapacity: vi.fn().mockResolvedValue({})
}))

afterEach(() => {
	resetState()
	capturedTokenNavSections.length = 0
	renderedTokenSections.length = 0
	vi.clearAllMocks()
})

describe('token page', () => {
	test('preserves the category order supplied by the shared market snapshot', async () => {
		const categories = [
			{ id: 'defi', label: 'DeFi' },
			{ id: 'chain-tokens', label: 'Chain Tokens' }
		]
		vi.mocked(getTokenOverviewCurrentSnapshot).mockResolvedValueOnce({ generatedAt: 42, metrics: null, categories })
		await runTokenPageRequest({ params: { token: 'ETH' } } as never)
		expect(getTokenOverviewData).toHaveBeenLastCalledWith(expect.objectContaining({ categories }))
	})

	const raise: Raise = {
		date: 1,
		name: 'Stake DAO',
		round: 'Seed',
		amountUsd: 0,
		valuationUsd: null,
		chains: [],
		sector: null,
		category: null,
		categoryGroup: null,
		leadInvestors: [],
		otherInvestors: [],
		source: '',
		defillamaId: 'parent#stake-dao'
	}
	const treasury: RawTreasuryProtocol = {
		id: 'parent#stake-dao-treasury',
		name: 'Stake DAO',
		logo: '',
		slug: 'stake-dao',
		tvl: 50,
		chainTvls: {},
		mcap: null,
		tokenBreakdowns: { ownTokens: 0, stablecoins: 50, majors: 0, others: 0 }
	}

	test.each(['raises', 'treasury', 'both'] as const)(
		'contains ordinary %s failures and recovers on the next request',
		async (failed) => {
			state.tokensJson = {
				sdt: {
					name: 'Stake DAO',
					symbol: 'SDT',
					route: '/token/SDT',
					token_nk: 'coingecko:stake-dao',
					protocolId: 'parent#stake-dao'
				}
			}
			const log = vi.spyOn(console, 'error').mockImplementation(() => {})
			try {
				if (failed === 'raises' || failed === 'both')
					vi.mocked(fetchRaisesByDefillamaId).mockRejectedValueOnce(new Error('Raises unavailable'))
				else vi.mocked(fetchRaisesByDefillamaId).mockResolvedValueOnce([raise])
				if (failed === 'treasury' || failed === 'both')
					vi.mocked(fetchTreasuryById).mockRejectedValueOnce(new Error('Treasury unavailable'))
				else vi.mocked(fetchTreasuryById).mockResolvedValueOnce(treasury)
				await expect(runTokenPageRequest({ params: { token: 'SDT' } } as never)).resolves.toHaveProperty('props')
				expect(fetchRaisesByDefillamaId).toHaveBeenLastCalledWith('parent#stake-dao')
				expect(fetchTreasuryById).toHaveBeenLastCalledWith('parent#stake-dao-treasury')
				expect(getTokenOverviewData).toHaveBeenLastCalledWith(
					expect.objectContaining({
						source: {
							kind: 'prefetched',
							raises: failed === 'treasury' ? [raise] : null,
							treasury: failed === 'raises' ? treasury : null
						}
					})
				)
				expect(log).toHaveBeenCalledTimes(failed === 'both' ? 2 : 1)
				vi.mocked(fetchRaisesByDefillamaId).mockResolvedValueOnce([raise])
				vi.mocked(fetchTreasuryById).mockResolvedValueOnce(treasury)
				await expect(runTokenPageRequest({ params: { token: 'SDT' } } as never)).resolves.toHaveProperty('props')
				expect(getTokenOverviewData).toHaveBeenLastCalledWith(
					expect.objectContaining({ source: { kind: 'prefetched', raises: [raise], treasury } })
				)
				expect(getTokenOverviewCurrentSnapshot).toHaveBeenCalledTimes(2)
			} finally {
				log.mockRestore()
			}
		}
	)

	test('keeps empty funding distinct from an outage and never fetches a chain treasury', async () => {
		state.tokensJson = {
			eth: {
				name: 'Ethereum',
				symbol: 'ETH',
				route: '/token/ETH',
				chainId: 'Ethereum',
				protocolId: 'parent#ethereum',
				token_nk: 'coingecko:ethereum'
			}
		}
		const log = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(runTokenPageRequest({ params: { token: 'ETH' } } as never)).resolves.toHaveProperty('props')
			expect(fetchRaisesByDefillamaId).toHaveBeenCalledWith('chain#ethereum')
			expect(fetchTreasuryById).not.toHaveBeenCalled()
			expect(getTokenOverviewData).toHaveBeenCalledWith(
				expect.objectContaining({ source: { kind: 'prefetched', raises: [], treasury: null } })
			)
			expect(log).not.toHaveBeenCalled()
		} finally {
			log.mockRestore()
		}
	})

	test.each(['raises', 'treasuries'] as const)(
		'rethrows %s snapshot corruption instead of rendering missing data',
		async (domain) => {
			state.tokensJson = {
				sdt: {
					name: 'Stake DAO',
					symbol: 'SDT',
					route: '/token/SDT',
					protocolId: 'parent#stake-dao',
					token_nk: 'coingecko:stake-dao'
				}
			}
			const error = new DatasetSnapshotIntegrityError(domain, 'raw/all.json', new Error('Corrupt artifact'))
			if (domain === 'raises') vi.mocked(fetchRaisesByDefillamaId).mockRejectedValueOnce(error)
			else vi.mocked(fetchTreasuryById).mockRejectedValueOnce(error)
			await expect(runTokenPageRequest({ params: { token: 'SDT' } } as never)).rejects.toBe(error)
			expect(getTokenOverviewData).not.toHaveBeenCalled()
		}
	)

	test.each([
		{ hasEarn: false, hasBorrow: false },
		{ hasEarn: true, hasBorrow: false },
		{ hasEarn: false, hasBorrow: true },
		{ hasEarn: true, hasBorrow: true }
	])('gates queries and sections independently with $hasEarn Earn and $hasBorrow Borrow', async (flags) => {
		Object.assign(state.tokensJson.btc, flags)
		state.initialYieldsRows = [makeYieldRow()]
		state.initialTokenBorrowRoutesData = { useAsCollateral: [makeRouteRow()], borrowThis: [] }

		const result = await runTokenPageRequest({ params: { token: 'BTC' } } as never)
		if (!('props' in result)) throw new Error('expected props')

		expect(acquireOptionalYieldsSnapshot).toHaveBeenCalledTimes(flags.hasEarn || flags.hasBorrow ? 1 : 0)
		expect(getTokenEarnRows).toHaveBeenCalledTimes(flags.hasEarn ? 1 : 0)
		expect(getTokenBorrowRoutes).toHaveBeenCalledTimes(flags.hasBorrow ? 1 : 0)
		expect(Boolean(findTokenPageSection(result.props.sections, 'token-yields'))).toBe(flags.hasEarn)
		expect(Boolean(findTokenPageSection(result.props.sections, 'token-borrow'))).toBe(flags.hasBorrow)
	})

	test('hides Earn and Borrow when enabled lookups return no rows', async () => {
		Object.assign(state.tokensJson.btc, { hasEarn: true, hasBorrow: true })
		const result = await runTokenPageRequest({ params: { token: 'BTC' } } as never)
		if (!('props' in result)) throw new Error('expected props')
		expect(getTokenEarnRows).toHaveBeenCalledOnce()
		expect(getTokenBorrowRoutes).toHaveBeenCalledOnce()
		expect(findTokenPageSection(result.props.sections, 'token-yields')).toBeUndefined()
		expect(findTokenPageSection(result.props.sections, 'token-borrow')).toBeUndefined()
	})

	test('shares each request’s current snapshot and Yields handle across concurrent detail construction', async () => {
		state.tokensJson = {
			sdt: {
				name: 'Stake DAO',
				symbol: 'SDT',
				route: '/token/SDT',
				protocolId: 'parent#stake-dao',
				token_nk: 'coingecko:stake-dao',
				hasEarn: true,
				hasBorrow: true
			}
		}
		const snapshot = { generationId: 'test-detail', generatedAt: 1, readJson: vi.fn() }
		vi.mocked(acquireOptionalYieldsSnapshot)
			.mockResolvedValueOnce(snapshot)
			.mockResolvedValueOnce(snapshot)
			.mockResolvedValueOnce(snapshot)
		const current = Promise.withResolvers<Awaited<ReturnType<typeof getTokenOverviewCurrentSnapshot>>>()
		vi.mocked(getTokenOverviewCurrentSnapshot)
			.mockReturnValueOnce(current.promise)
			.mockReturnValueOnce(current.promise)
			.mockReturnValueOnce(current.promise)
		const requests: Array<Promise<TokenPageResult>> = []
		try {
			for (let count = 1; count <= 3; count++) {
				requests.push(runTokenPageRequest({ params: { token: 'SDT' } } as never))
				// Resolve Vitest's dynamic module mocks sequentially while keeping all data requests pending.
				await vi.waitFor(() => expect(acquireOptionalYieldsSnapshot).toHaveBeenCalledTimes(count))
			}
		} finally {
			current.resolve({ generatedAt: 42, metrics: null, categories: [] })
		}
		const results = await Promise.all(requests)
		for (const result of results) expect(result).toHaveProperty('props')
		expect(getTokenOverviewCurrentSnapshot).toHaveBeenCalledTimes(3)
		expect(acquireOptionalYieldsSnapshot).toHaveBeenCalledTimes(3)
		expect(fetchRaisesByDefillamaId).toHaveBeenCalledTimes(3)
		expect(fetchTreasuryById).toHaveBeenCalledTimes(3)
		expect(getTokenEarnRows).toHaveBeenCalledTimes(3)
		expect(getTokenBorrowRoutes).toHaveBeenCalledTimes(3)
		for (const [handle] of vi.mocked(getTokenEarnRows).mock.calls) expect(handle).toBe(snapshot)
		for (const [handle] of vi.mocked(getTokenBorrowRoutes).mock.calls) expect(handle).toBe(snapshot)
	})

	test('propagates a core failure while optional Yields acquisition is pending', async () => {
		state.tokensJson.btc.hasEarn = true
		const pendingYields = Promise.withResolvers<Awaited<ReturnType<typeof acquireOptionalYieldsSnapshot>>>()
		vi.mocked(acquireOptionalYieldsSnapshot).mockReturnValueOnce(pendingYields.promise)
		const error = new Error('Current snapshot unavailable')
		vi.mocked(getTokenOverviewCurrentSnapshot).mockRejectedValueOnce(error)
		const outcome = runTokenPageRequest({ params: { token: 'BTC' } } as never).then(
			() => 'resolved',
			(caughtError: unknown) => caughtError
		)
		try {
			expect(
				await Promise.race([outcome, new Promise((resolve) => setTimeout(() => resolve('still waiting'), 1000))])
			).toBe(error)
		} finally {
			pendingYields.resolve(null)
			await outcome
		}
	})

	test('renders the sticky section nav and token sections in manifest order', () => {
		const sections: Array<TokenPageSection> = [
			makeOverviewSection(),
			{
				id: 'token-income-statement',
				label: 'Income Statement',
				tokenSymbol: 'BTC',
				incomeStatement: { data: {} } as never
			},
			{
				id: 'token-risks',
				label: 'Risks',
				tokenSymbol: 'BTC',
				riskData: {} as TokenRiskResponse
			},
			{
				id: 'token-rights-and-value-accrual',
				label: 'Token Rights',
				name: 'Bitcoin',
				symbol: 'BTC',
				tokenRightsData: tokenRightsFixture
			},
			makeUsageSection(),
			{
				id: 'token-liquidations',
				label: 'Liquidations',
				tokenSymbol: 'BTC'
			},
			{
				id: 'token-unlocks',
				label: 'Unlocks',
				resolvedUnlocksSlug: 'chainlink'
			},
			{
				id: 'token-yields',
				label: 'Yields',
				tokenSymbol: 'BTC',
				hydration: {
					rows: [makeYieldRow({ pool: 'pool-1' })],
					rowCount: 1,
					chainList: [],
					pageSize: 10,
					tokenKeys: ['family:test']
				}
			},
			{
				id: 'token-borrow',
				label: 'Borrow',
				tokenSymbol: 'BTC',
				hydration: {
					data: {
						useAsCollateral: [makeRouteRow({ pool: 'borrow-1' })],
						borrowThis: []
					},
					counts: {
						useAsCollateral: 1,
						borrowThis: 0
					},
					chainLists: {
						useAsCollateral: [],
						borrowThis: []
					},
					pageSize: 10,
					tokenKeys: ['family:test']
				}
			}
		]

		renderToStaticMarkup(<TokenPage {...makeTokenPageProps(sections)} />)

		expect(capturedTokenNavSections).toEqual([
			{ id: 'token-overview', label: 'Overview' },
			{ id: 'token-income-statement', label: 'Income Statement' },
			{ id: 'token-risks', label: 'Risks' },
			{ id: 'token-rights-and-value-accrual', label: 'Token Rights' },
			{ id: 'token-usage', label: 'Token Usage' },
			{ id: 'token-liquidations', label: 'Liquidations' },
			{ id: 'token-unlocks', label: 'Unlocks' },
			{ id: 'token-yields', label: 'Yields' },
			{ id: 'token-borrow', label: 'Borrow' }
		])
		expect(renderedTokenSections).toEqual(sections.map((section) => section.id))
	})

	test('limits the section nav to the sections that actually render', () => {
		renderToStaticMarkup(<TokenPage {...makeTokenPageProps([makeOverviewSection(), makeUsageSection()])} />)

		expect(capturedTokenNavSections).toEqual([
			{ id: 'token-overview', label: 'Overview' },
			{ id: 'token-usage', label: 'Token Usage' }
		])
		expect(renderedTokenSections).toEqual(['token-overview', 'token-usage'])
	})

	test('renders the markets section when hasMarkets is true', () => {
		renderToStaticMarkup(
			<TokenPage
				{...makeTokenPageProps([
					makeOverviewSection(),
					{
						id: 'token-markets',
						label: 'Markets',
						geckoId: 'bitcoin',
						tokenSymbol: 'BTC'
					},
					makeUsageSection()
				])}
			/>
		)

		expect(capturedTokenNavSections).toContainEqual({ id: 'token-markets', label: 'Markets' })
		expect(renderedTokenSections).toEqual(['token-overview', 'token-markets', 'token-usage'])
	})

	test('renders each yield-related section from its own prefetched dataset', () => {
		renderToStaticMarkup(
			<TokenPage
				{...makeTokenPageProps([
					makeOverviewSection(),
					{
						id: 'token-risks',
						label: 'Risks',
						tokenSymbol: 'BTC',
						riskData: {} as TokenRiskResponse
					},
					makeUsageSection(),
					{
						id: 'token-borrow',
						label: 'Borrow',
						tokenSymbol: 'BTC',
						hydration: {
							data: {
								useAsCollateral: [makeRouteRow({ pool: 'borrow-1' })],
								borrowThis: []
							},
							counts: {
								useAsCollateral: 1,
								borrowThis: 0
							},
							chainLists: {
								useAsCollateral: [],
								borrowThis: []
							},
							pageSize: 10,
							tokenKeys: ['family:test']
						}
					}
				])}
			/>
		)

		expect(renderedTokenSections).toEqual(['token-overview', 'token-risks', 'token-usage', 'token-borrow'])
		expect(renderedTokenSections).not.toContain('token-yields')
		expect(renderedTokenSections).not.toContain('token-unlocks')
	})

	test('runTokenPageRequest returns notFound when params.token is missing', async () => {
		await expect(runTokenPageRequest({ params: {} } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('runTokenPageRequest returns notFound for an unknown token key', async () => {
		await expect(runTokenPageRequest({ params: { token: 'litecoin' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('runTokenPageRequest resolves the route param by slugging the token key', async () => {
		await expect(runTokenPageRequest({ params: { token: 'BTC' } } as never)).resolves.toMatchObject({
			props: {
				seoTitle: 'BTC Price, Market Cap, Supply & Trading Volume',
				seoDescription: 'Track BTC price, market cap, circulating supply, max supply, and trading volume.',
				canonicalUrl: '/token/BTC',
				sections: [
					{
						id: 'token-overview',
						overview: overviewFixture,
						geckoId: 'bitcoin'
					},
					{
						id: 'token-markets',
						geckoId: 'bitcoin',
						tokenSymbol: 'BTC'
					},
					{
						id: 'token-usage',
						tokenSymbol: 'BTC'
					}
				]
			}
		})
		expect(setPageHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=123, must-revalidate')
		expect(getTokensCacheControlMock).toHaveBeenCalledWith(42)
	})

	test('runTokenPageRequest passes the canonical rankings metrics to the token overview', async () => {
		const currentMetrics: TokenOverviewCurrentMetrics = {
			currentPrice: 2,
			percentChange24h: -3,
			circulatingSupply: 500,
			totalSupply: 900,
			maxSupply: 1000,
			mcap: 1000,
			fdv: 2000,
			volume24h: 777,
			outstandingFDV: 1200
		}
		vi.mocked(getTokenOverviewCurrentSnapshot).mockResolvedValueOnce({
			generatedAt: 42,
			metrics: currentMetrics,
			categories: []
		})

		await runTokenPageRequest({ params: { token: 'BTC' } } as never)

		expect(getTokenOverviewCurrentSnapshot).toHaveBeenCalledWith('bitcoin')
		expect(getTokenOverviewData).toHaveBeenCalledWith(expect.objectContaining({ currentMetrics }))
	})

	test('runTokenPageRequest redirects lowercase token params when metadata defines a canonical route', async () => {
		await expect(runTokenPageRequest({ params: { token: 'btc' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/token/BTC',
				permanent: false
			}
		})
	})

	test('runTokenPageRequest does not resolve arbitrary non-token routes during alias lookup', async () => {
		state.tokensJson = {
			proto: { name: 'Protocol Token', symbol: 'PROTO', route: '/protocol/proto' }
		}

		await expect(runTokenPageRequest({ params: { token: 'missing-token' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('runTokenPageRequest treats API-provided mixed-case and spaced token routes as canonical', async () => {
		state.tokensJson = {
			tbtc: { name: 'Threshold Bitcoin', symbol: 'TBTC', route: '/token/tBTC' },
			'velodrome-finance': {
				name: 'Velodrome Finance',
				symbol: 'VELO',
				route: '/token/Velodrome%20Finance'
			}
		}

		await expect(runTokenPageRequest({ params: { token: 'tbtc' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/token/tBTC',
				permanent: false
			}
		})
		await expect(runTokenPageRequest({ params: { token: 'tBTC' } } as never)).resolves.toMatchObject({
			props: {
				canonicalUrl: '/token/tBTC'
			}
		})
		await expect(runTokenPageRequest({ params: { token: 'Velodrome Finance' } } as never)).resolves.toMatchObject({
			props: {
				canonicalUrl: '/token/Velodrome%20Finance'
			}
		})
	})

	test('runTokenPageRequest enables the liquidations section when metadata includes the token symbol with rows', async () => {
		state.liquidationsTokenSymbols = ['BTC']
		state.liquidationsTokenSymbolsSet = new Set(['BTC'])
		state.hasTokenLiquidationsData = true

		const result = await runTokenPageRequest({ params: { token: 'BTC' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		expect(tokenPageSectionIds(result.props.sections)).toContain('token-liquidations')
	})

	test('uses the canonical Token record symbol for liquidations availability', async () => {
		state.tokensJson = {
			wsteth: { name: 'Wrapped stETH', symbol: 'wstETH', route: '/token/wstETH' }
		}
		state.liquidationsTokenSymbols = ['wstETH']
		state.liquidationsTokenSymbolsSet = new Set(['wstETH'])
		state.hasTokenLiquidationsData = true

		const result = await runTokenPageRequest({ params: { token: 'wstETH' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')
		expect(hasTokenLiquidationsData).toHaveBeenCalledWith('wstETH')
		expect(result.props.sections).toContainEqual({
			id: 'token-liquidations',
			label: 'Liquidations',
			tokenSymbol: 'wstETH'
		})
	})

	test('runTokenPageRequest skips the liquidations section when metadata has the token but no rows', async () => {
		state.liquidationsTokenSymbols = ['BTC']
		state.liquidationsTokenSymbolsSet = new Set(['BTC'])

		const result = await runTokenPageRequest({ params: { token: 'BTC' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		expect(tokenPageSectionIds(result.props.sections)).not.toContain('token-liquidations')
	})

	test('runTokenPageRequest does not resolve by token name slug', async () => {
		await expect(runTokenPageRequest({ params: { token: 'bitcoin' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('runTokenPageRequest returns props even when token market stats are missing', async () => {
		state.tokensJson = {
			btc: { name: 'Bitcoin', symbol: 'BTC', route: '/token/BTC' }
		}
		state.tokenlist = {}

		await expect(runTokenPageRequest({ params: { token: 'BTC' } } as never)).resolves.toMatchObject({
			props: {
				seoTitle: 'BTC Price, Market Cap, Supply & Trading Volume',
				seoDescription: 'Track BTC price, market cap, circulating supply, max supply, and trading volume.',
				canonicalUrl: '/token/BTC',
				sections: [
					{
						id: 'token-overview',
						overview: overviewFixture,
						geckoId: null
					},
					{
						id: 'token-usage',
						tokenSymbol: 'BTC'
					}
				]
			}
		})
	})

	test('runTokenPageRequest redirects to an encoded symbol when metadata route is missing', async () => {
		state.tokensJson = {
			swing: { name: 'Swing.xyz', symbol: '$SWING', token_nk: 'coingecko:swing-xyz' }
		}
		state.tokenlist = {
			'swing-xyz': {
				symbol: '$swing',
				current_price: 1,
				price_change_24h: 0,
				price_change_percentage_24h: 0,
				ath: null,
				ath_date: null,
				atl: null,
				atl_date: null,
				market_cap: 10,
				fully_diluted_valuation: 10,
				total_volume: 1,
				total_supply: null,
				circulating_supply: 10,
				max_supply: 10
			}
		}

		await expect(runTokenPageRequest({ params: { token: 'swing' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/token/%24SWING',
				permanent: false
			}
		})
	})

	test('runTokenPageRequest renders an encoded symbol canonical route when metadata route is missing', async () => {
		state.tokensJson = {
			swing: { name: 'Swing.xyz', symbol: '$SWING', token_nk: 'coingecko:swing-xyz' }
		}
		state.tokenlist = {
			'swing-xyz': {
				symbol: '$swing',
				current_price: 1,
				price_change_24h: 0,
				price_change_percentage_24h: 0,
				ath: null,
				ath_date: null,
				atl: null,
				atl_date: null,
				market_cap: 10,
				fully_diluted_valuation: 10,
				total_volume: 1,
				total_supply: null,
				circulating_supply: 10,
				max_supply: 10
			}
		}

		await expect(runTokenPageRequest({ params: { token: '$SWING' } } as never)).resolves.toMatchObject({
			props: {
				seoTitle: '$SWING Price, Market Cap, Supply & Trading Volume',
				seoDescription: 'Track $SWING price, market cap, circulating supply, max supply, and trading volume.',
				canonicalUrl: '/token/%24SWING',
				sections: [
					{
						id: 'token-overview',
						overview: overviewFixture,
						geckoId: 'swing-xyz'
					},
					{
						id: 'token-usage',
						tokenSymbol: '$SWING'
					}
				]
			}
		})
	})

	test('runTokenPageRequest includes token rights data when the token record has the flag', async () => {
		state.tokenRightsEntries = [
			{
				'Protocol Name': 'Chainlink',
				Token: ['LINK'],
				'Token Type': ['Governance'],
				'Brief description': 'desc',
				'Governance Details (Summary)': 'gov summary',
				'Governance Decisions': ['LINK'],
				'Treasury Decisions': ['LINK'],
				'Revenue Decisions': ['N/A'],
				'Fee Switch Status': 'OFF',
				Buybacks: ['N/A'],
				Dividends: ['N/A'],
				Burns: 'N/A',
				'Associated Entities': [],
				'Last Updated': '2026-04-15',
				'DefiLlama ID': 'parent#chainlink'
			}
		]
		state.tokensJson = {
			link: {
				name: 'Chainlink',
				symbol: 'LINK',
				token_nk: 'coingecko:chainlink',
				protocolId: 'parent#chainlink',
				tokenRights: true
			}
		}
		state.tokenlist = {
			chainlink: {
				symbol: 'link',
				current_price: 10,
				price_change_24h: 1,
				price_change_percentage_24h: 10,
				ath: null,
				ath_date: null,
				atl: null,
				atl_date: null,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				total_supply: null,
				circulating_supply: 20,
				max_supply: 1000
			}
		}
		const result = await runTokenPageRequest({ params: { token: 'LINK' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		const tokenRightsSection = findTokenPageSection(result.props.sections, 'token-rights-and-value-accrual')
		expect(result).toMatchObject({
			props: {
				seoTitle: 'LINK Price, Market Cap, Supply, Trading Volume & Token Rights',
				seoDescription:
					'Track LINK price, market cap, circulating supply, max supply, trading volume, and token rights.',
				canonicalUrl: '/token/LINK'
			}
		})
		expect(tokenPageSectionIds(result.props.sections)).toEqual([
			'token-overview',
			'token-rights-and-value-accrual',
			'token-usage'
		])
		expect(tokenRightsSection?.tokenRightsData.overview).toMatchObject({
			protocolName: 'Chainlink',
			tokens: ['LINK'],
			tokenTypes: ['Governance'],
			description: 'desc',
			utility: null,
			lastUpdated: '2026-04-15'
		})
	})

	test('runTokenPageRequest includes token rights data for flagged tokens without protocol metadata', async () => {
		state.tokenRightsEntries = [
			{
				'Protocol Name': 'Backpack',
				Token: ['BP', 'sBP'],
				'Token Type': ['Utility'],
				'Brief description': 'desc',
				'Governance Details (Summary)': 'gov summary',
				'Governance Decisions': ['N/A'],
				'Treasury Decisions': ['N/A'],
				'Revenue Decisions': ['N/A'],
				'Fee Switch Status': 'OFF',
				Buybacks: ['N/A'],
				Dividends: ['N/A'],
				Burns: 'N/A',
				'Associated Entities': [],
				'Last Updated': '2026-04-15',
				'DefiLlama ID': '4266'
			}
		]
		state.tokensJson = {
			bp: {
				name: 'Backpack',
				symbol: 'BP',
				token_nk: 'coingecko:backpack',
				route: '/token/BP',
				tokenRights: true
			}
		}
		state.tokenlist = {
			backpack: {
				symbol: 'bp',
				current_price: 1,
				price_change_24h: 0,
				price_change_percentage_24h: 0,
				ath: null,
				ath_date: null,
				atl: null,
				atl_date: null,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				total_supply: null,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const result = await runTokenPageRequest({ params: { token: 'BP' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		const tokenRightsSection = findTokenPageSection(result.props.sections, 'token-rights-and-value-accrual')
		expect(tokenRightsSection?.tokenRightsData.overview).toMatchObject({
			protocolName: 'Backpack',
			tokens: ['BP', 'sBP'],
			tokenTypes: ['Utility'],
			description: 'desc',
			utility: null,
			lastUpdated: '2026-04-15'
		})
		expect(tokenPageSectionIds(result.props.sections)).toEqual([
			'token-overview',
			'token-rights-and-value-accrual',
			'token-usage'
		])
		expect(fetchTokenRightsEntryByName).toHaveBeenCalledWith('Backpack')
		expect(fetchTokenRightsEntries).not.toHaveBeenCalled()
		expect(fetchTokenRightsEntryByDefillamaId).not.toHaveBeenCalled()
	})

	test('runTokenPageRequest falls back to protocol id when a token rights chain id has no row', async () => {
		state.tokenRightsEntries = [
			{
				'Protocol Name': 'Hyperliquid',
				Token: ['HYPE'],
				'Token Type': ['Governance'],
				'Brief description': 'desc',
				'Governance Details (Summary)': 'gov summary',
				'Governance Decisions': ['HYPE'],
				'Treasury Decisions': ['HYPE'],
				'Revenue Decisions': ['HYPE'],
				'Fee Switch Status': 'ON',
				Buybacks: ['HYPE'],
				Dividends: ['N/A'],
				Burns: 'N/A',
				'Associated Entities': [],
				'Last Updated': '2026-04-15',
				'DefiLlama ID': 'parent#hyperliquid'
			}
		]
		state.tokensJson = {
			hype: {
				name: 'Hyperliquid',
				symbol: 'HYPE',
				token_nk: 'coingecko:hyperliquid',
				chainId: 'hyperliquid',
				protocolId: 'parent#hyperliquid',
				tokenRights: true
			}
		}
		state.tokenlist = {
			hyperliquid: {
				symbol: 'hype',
				current_price: 10,
				price_change_percentage_24h: 0,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const result = await runTokenPageRequest({ params: { token: 'HYPE' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		expect(tokenPageSectionIds(result.props.sections)).toEqual([
			'token-overview',
			'token-rights-and-value-accrual',
			'token-usage'
		])
		expect(
			findTokenPageSection(result.props.sections, 'token-rights-and-value-accrual')?.tokenRightsData.overview
		).toMatchObject({
			protocolName: 'Hyperliquid',
			tokens: ['HYPE']
		})
		expect(fetchTokenRightsEntryByDefillamaId).toHaveBeenNthCalledWith(1, 'hyperliquid')
		expect(fetchTokenRightsEntryByDefillamaId).toHaveBeenNthCalledWith(2, 'parent#hyperliquid')
	})

	test('runTokenPageRequest skips token rights for flagged tokens without a matching row', async () => {
		state.tokenRightsEntries = [
			{
				'Protocol Name': 'Other',
				Token: ['OTHER'],
				'Token Type': ['Utility'],
				'Brief description': 'desc',
				'Governance Details (Summary)': 'gov summary',
				'Governance Decisions': ['N/A'],
				'Treasury Decisions': ['N/A'],
				'Revenue Decisions': ['N/A'],
				'Fee Switch Status': 'OFF',
				Buybacks: ['N/A'],
				Dividends: ['N/A'],
				Burns: 'N/A',
				'Associated Entities': [],
				'Last Updated': '2026-04-15',
				'DefiLlama ID': '9999'
			}
		]
		state.tokensJson = {
			bp: {
				name: 'Backpack',
				symbol: 'BP',
				token_nk: 'coingecko:backpack',
				tokenRights: true
			}
		}
		state.tokenlist = {
			backpack: {
				symbol: 'bp',
				current_price: 1,
				price_change_percentage_24h: 0,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const result = await runTokenPageRequest({ params: { token: 'BP' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		expect(findTokenPageSection(result.props.sections, 'token-rights-and-value-accrual')).toBeUndefined()
		expect(tokenPageSectionIds(result.props.sections)).toEqual(['token-overview', 'token-usage'])
	})

	test('runTokenPageRequest resolves embedded unlocks by protocol display name when the slug is cached', async () => {
		state.tokensJson = {
			link: {
				name: 'Chainlink',
				symbol: 'LINK',
				token_nk: 'coingecko:chainlink',
				protocolId: 'parent#chainlink'
			}
		}
		state.protocolMetadata = {
			'parent#chainlink': {
				displayName: 'Chainlink'
			} as IProtocolMetadata
		}
		state.emissionsProtocolsList = ['chainlink']
		state.tokenlist = {
			chainlink: {
				symbol: 'link',
				current_price: 10,
				price_change_percentage_24h: 10,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const result = await runTokenPageRequest({ params: { token: 'LINK' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		expect(findTokenPageSection(result.props.sections, 'token-unlocks')?.resolvedUnlocksSlug).toBe('chainlink')
	})

	test('runTokenPageRequest falls back to chain-name unlock slugs when the chain is cached', async () => {
		state.tokensJson = {
			sol: {
				name: 'Solana',
				symbol: 'SOL',
				token_nk: 'coingecko:solana',
				chainId: 'solana'
			}
		}
		state.chainMetadata = {
			solana: {
				name: 'Solana'
			}
		}
		state.emissionsProtocolsList = ['solana']
		state.tokenlist = {
			solana: {
				symbol: 'sol',
				current_price: 10,
				price_change_percentage_24h: 10,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const result = await runTokenPageRequest({ params: { token: 'SOL' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		expect(findTokenPageSection(result.props.sections, 'token-unlocks')?.resolvedUnlocksSlug).toBe('solana')
	})

	test('runTokenPageRequest includes income statement data when the token is flagged', async () => {
		const incomeStatementData = {
			data: {
				monthly: {},
				quarterly: {
					'2026-Q1': {
						'Gross Protocol Revenue': { value: 10, 'by-label': {} },
						'Cost Of Revenue': { value: -2, 'by-label': {} },
						'Gross Profit': { value: 8, 'by-label': {} },
						Earnings: { value: 8, 'by-label': {} }
					}
				},
				yearly: {},
				cumulative: {}
			},
			labelsByType: {},
			methodology: {},
			breakdownMethodology: {},
			hasOtherTokenHolderFlows: false,
			hasTokenHolderNetIncome: false
		}

		state.tokensJson = {
			aave: {
				name: 'Aave',
				symbol: 'AAVE',
				token_nk: 'coingecko:aave',
				protocolId: 'parent#aave',
				incomeStatement: true
			}
		}
		state.protocolMetadata = {
			'parent#aave': {
				displayName: 'Aave',
				fees: true,
				revenue: true,
				incentives: true
			} as IProtocolMetadata
		}
		state.incomeStatementData = incomeStatementData
		state.tokenlist = {
			aave: {
				symbol: 'aave',
				current_price: 10,
				price_change_percentage_24h: 10,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const result = await runTokenPageRequest({ params: { token: 'AAVE' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		const incomeStatementSection = findTokenPageSection(result.props.sections, 'token-income-statement')
		expect(result).toMatchObject({
			props: {
				seoTitle: 'AAVE Price, Market Cap, Supply & Trading Volume',
				seoDescription: 'Track AAVE price, market cap, circulating supply, max supply, and trading volume.',
				canonicalUrl: '/token/AAVE'
			}
		})
		expect(tokenPageSectionIds(result.props.sections)).toEqual([
			'token-overview',
			'token-income-statement',
			'token-usage'
		])
		expect(incomeStatementSection).toMatchObject({
			tokenSymbol: 'AAVE',
			incomeStatement: incomeStatementData
		})
		expect(getTokenIncomeStatement).toHaveBeenCalledWith({ token: 'AAVE' })
	})

	test('runTokenPageRequest skips income statements when the token is not flagged', async () => {
		state.tokensJson = {
			aave: {
				name: 'Aave',
				symbol: 'AAVE',
				token_nk: 'coingecko:aave',
				protocolId: 'parent#aave'
			}
		}
		state.protocolMetadata = {
			'parent#aave': {
				displayName: 'Aave',
				fees: true,
				revenue: true
			} as IProtocolMetadata
		}
		state.incomeStatementData = { data: {} }
		state.tokenlist = {
			aave: {
				symbol: 'aave',
				current_price: 10,
				price_change_percentage_24h: 10,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const result = await runTokenPageRequest({ params: { token: 'AAVE' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')
		expect(findTokenPageSection(result.props.sections, 'token-income-statement')).toBeUndefined()
		expect(getTokenIncomeStatement).not.toHaveBeenCalled()
	})

	test('runTokenPageRequest falls back to null token risk data when the risk query throws', async () => {
		state.tokensJson = {
			link: {
				name: 'Chainlink',
				symbol: 'LINK',
				token_nk: 'coingecko:chainlink',
				hasEarn: true,
				hasBorrow: true
			}
		}
		state.tokenlist = {
			chainlink: {
				symbol: 'link',
				current_price: 10,
				price_change_percentage_24h: 10,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}
		state.initialYieldsRows = [makeYieldRow({ pool: 'pool-1' })]
		state.initialTokenBorrowRoutesData = {
			useAsCollateral: [],
			borrowThis: []
		}

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.mocked(getTokenRiskData).mockRejectedValueOnce(new Error('risk failed'))

		const result = await runTokenPageRequest({ params: { token: 'LINK' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		const yieldsSection = findTokenPageSection(result.props.sections, 'token-yields')
		expect(findTokenPageSection(result.props.sections, 'token-risks')).toBeUndefined()
		expect(yieldsSection).toMatchObject({
			hydration: {
				rows: state.initialYieldsRows,
				rowCount: state.initialYieldsRows.length
			}
		})
		expect(findTokenPageSection(result.props.sections, 'token-borrow')).toBeUndefined()
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load token risk data for chainlink', expect.any(Error))

		consoleErrorSpy.mockRestore()
	})

	test('runTokenPageRequest limits prefetched yields tables to the first page while preserving total counts', async () => {
		state.tokensJson = {
			link: {
				name: 'Chainlink',
				symbol: 'LINK',
				token_nk: 'coingecko:chainlink',
				hasEarn: true,
				hasBorrow: true
			}
		}
		state.tokenlist = {
			chainlink: {
				symbol: 'link',
				current_price: 10,
				price_change_percentage_24h: 10,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}
		state.initialYieldsRows = Array.from({ length: 12 }, (_, index) => ({
			pool: `LINK-USDC-${index}`,
			chains: ['Ethereum']
		}))
		state.initialTokenBorrowRoutesData = {
			useAsCollateral: Array.from({ length: 13 }, (_, index) => ({
				pool: `collateral-${index}`,
				chains: ['Ethereum']
			})),
			borrowThis: Array.from({ length: 11 }, (_, index) => ({
				pool: `debt-${index}`,
				chains: ['Arbitrum']
			}))
		}

		const result = await runTokenPageRequest({ params: { token: 'LINK' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		const yieldsSection = findTokenPageSection(result.props.sections, 'token-yields')
		const borrowSection = findTokenPageSection(result.props.sections, 'token-borrow')
		expect(yieldsSection?.hydration.rows).toHaveLength(10)
		expect(yieldsSection?.hydration.rowCount).toBe(12)
		expect(yieldsSection?.hydration.pageSize).toBe(10)
		expect(borrowSection?.hydration.data.useAsCollateral).toHaveLength(10)
		expect(borrowSection?.hydration.data.borrowThis).toHaveLength(10)
		expect(borrowSection?.hydration.pageSize).toBe(10)
		expect(borrowSection?.hydration.counts).toEqual({
			useAsCollateral: 13,
			borrowThis: 11
		})
	})

	test('runTokenPageRequest keeps the page renderable when optional token fetches fail', async () => {
		state.tokensJson = {
			link: {
				name: 'Chainlink',
				symbol: 'LINK',
				token_nk: 'coingecko:chainlink',
				protocolId: 'parent#chainlink',
				incomeStatement: true,
				tokenRights: true,
				hasEarn: true,
				hasBorrow: true
			}
		}
		state.protocolMetadata = {
			'parent#chainlink': {
				name: 'chainlink',
				displayName: 'Chainlink',
				incentives: true
			} as IProtocolMetadata
		}
		state.tokenlist = {
			chainlink: {
				symbol: 'link',
				current_price: 10,
				price_change_percentage_24h: 10,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.mocked(fetchTokenRightsEntryByDefillamaId).mockRejectedValueOnce(new Error('token rights failed'))
		vi.mocked(getTokenIncomeStatement).mockRejectedValueOnce(new Error('income failed'))
		vi.mocked(getTokenEarnRows).mockRejectedValueOnce(new Error('yields failed'))
		vi.mocked(getTokenBorrowRoutes).mockRejectedValueOnce(new Error('borrow routes failed'))
		vi.mocked(getTokenRiskData).mockRejectedValueOnce(new Error('risk failed'))

		const result = await runTokenPageRequest({ params: { token: 'LINK' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')

		expect(findTokenPageSection(result.props.sections, 'token-rights-and-value-accrual')).toBeUndefined()
		expect(findTokenPageSection(result.props.sections, 'token-income-statement')).toBeUndefined()
		expect(findTokenPageSection(result.props.sections, 'token-yields')).toBeUndefined()
		expect(findTokenPageSection(result.props.sections, 'token-borrow')).toBeUndefined()
		expect(findTokenPageSection(result.props.sections, 'token-risks')).toBeUndefined()
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Failed to load token rights data for parent#chainlink',
			expect.any(Error)
		)
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Failed to load income statement data for Chainlink',
			expect.any(Error)
		)
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load token yields data for LINK', expect.any(Error))
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load token borrow routes data for LINK', expect.any(Error))
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load token risk data for chainlink', expect.any(Error))

		consoleErrorSpy.mockRestore()
	})

	test('runTokenPageRequest keeps the page renderable when the optional Yields snapshot is unavailable', async () => {
		state.tokensJson = {
			link: {
				name: 'Chainlink',
				symbol: 'LINK',
				token_nk: 'coingecko:chainlink',
				hasEarn: true,
				hasBorrow: true
			}
		}
		vi.mocked(acquireOptionalYieldsSnapshot).mockResolvedValueOnce(null)

		const result = await runTokenPageRequest({ params: { token: 'LINK' } } as never)

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('expected props')
		expect(findTokenPageSection(result.props.sections, 'token-yields')).toBeUndefined()
		expect(findTokenPageSection(result.props.sections, 'token-borrow')).toBeUndefined()
		expect(getTokenEarnRows).not.toHaveBeenCalled()
		expect(getTokenBorrowRoutes).not.toHaveBeenCalled()
	})

	test('rethrows dataset snapshot integrity errors from optional dataset sections', async () => {
		state.liquidationsTokenSymbolsSet = new Set(['BTC'])
		const integrityError = new DatasetSnapshotIntegrityError(
			'liquidations',
			'raw/all.json',
			new Error('corrupt liquidations index')
		)
		vi.mocked(hasTokenLiquidationsData).mockRejectedValueOnce(integrityError)

		await expect(runTokenPageRequest({ params: { token: 'BTC' } } as never)).rejects.toThrow(
			'corrupt liquidations index'
		)
	})

	test('renders the risks section only when runTokenPageRequest returns token risk data', async () => {
		state.tokensJson = {
			link: {
				name: 'Chainlink',
				symbol: 'LINK',
				token_nk: 'coingecko:chainlink'
			}
		}
		state.tokenlist = {
			chainlink: {
				symbol: 'link',
				current_price: 10,
				price_change_percentage_24h: 10,
				market_cap: 100,
				fully_diluted_valuation: 150,
				total_volume: 50,
				circulating_supply: 20,
				max_supply: 1000
			}
		}

		const withoutRisk = await runTokenPageRequest({ params: { token: 'LINK' } } as never)
		if (!('props' in withoutRisk)) throw new Error('expected props')

		renderToStaticMarkup(<TokenPage {...withoutRisk.props} />)
		expect(renderedTokenSections).not.toContain('token-yields')
		expect(renderedTokenSections).not.toContain('token-borrow')
		expect(renderedTokenSections).not.toContain('token-risks')

		const riskRows: TokenRiskResponse['exposures']['rows'] = [
			{
				protocol: 'aave-v3',
				protocolDisplayName: 'Aave V3',
				chain: 'ethereum',
				chainDisplayName: 'Ethereum',
				assetSymbol: 'LINK',
				assetAddress: '0x5149',
				currentMaxBorrowUsd: 10,
				minBadDebtAtPriceZeroUsd: 6,
				minBadDebtAtPriceZeroCoverage: 'known'
			}
		]

		state.tokenRiskData = {
			candidates: [{ key: 'ethereum:0x5149', chain: 'ethereum', address: '0x5149', displayName: 'Ethereum' }],
			scopeCandidates: [{ key: 'ethereum:0x5149', chain: 'ethereum', address: '0x5149', displayName: 'Ethereum' }],
			selectedCandidateKey: null,
			exposures: {
				summary: {
					totalCurrentMaxBorrowUsd: 10,
					totalMinBadDebtAtPriceZeroUsd: 6,
					exposureCount: 1,
					protocolCount: 1,
					chainCount: 1,
					minBadDebtKnownCount: 1,
					minBadDebtUnknownCount: 0
				},
				rows: riskRows,
				protocolSummaries: buildTokenRiskProtocolSummaries(riskRows),
				methodologies: {
					asset: 'asset',
					currentMaxBorrowUsd: 'cap',
					minBadDebtAtPriceZeroUsd: 'zero-price'
				}
			},
			limitations: ['limit']
		}

		const withRisk = await runTokenPageRequest({ params: { token: 'LINK' } } as never)
		if (!('props' in withRisk)) throw new Error('expected props')

		renderedTokenSections.length = 0
		renderToStaticMarkup(<TokenPage {...withRisk.props} />)
		expect(renderedTokenSections).not.toContain('token-yields')
		expect(renderedTokenSections).not.toContain('token-borrow')
		expect(renderedTokenSections).toContain('token-risks')
	})
})

/**
 * Starts a request while the dataset module is still loading and the current snapshot is still pending,
 * and hands back the levers to settle either one. Each outcome settles them in its own order, so they
 * are separate tests rather than branches inside one.
 */
async function overlapColdModuleLoad() {
	vi.resetModules()
	const moduleStarted = Promise.withResolvers<void>()
	const moduleReady = Promise.withResolvers<void>()
	vi.doMock('~/containers/Markets/server/dataset.server', async () => {
		moduleStarted.resolve()
		await moduleReady.promise
		return { getTokenMarketSummary: vi.fn(async () => null), hasTokenMarkets: vi.fn(async () => false) }
	})
	const { getTokenOverviewCurrentSnapshot: readCurrent } = await import('~/containers/Tokens/queries.server')
	const current = Promise.withResolvers<Awaited<ReturnType<typeof readCurrent>>>()
	vi.mocked(readCurrent).mockReturnValueOnce(current.promise)
	const { getServerSideProps: request } = await import('~/pages/token/[token]')
	const result = request({ params: { token: 'BTC' } } as never).then(
		(value) => ({ value }),
		(caughtError: unknown) => ({ reason: caughtError })
	)
	const settle = async () => {
		current.resolve({ generatedAt: 42, metrics: null, categories: [] })
		moduleReady.resolve()
		await result
		// A current-snapshot failure settles the request before its imports finish.
		await vi.dynamicImportSettled()
		vi.doMock('~/containers/Markets/server/dataset.server', () => ({
			getTokenMarketSummary: vi.fn(async () => null),
			hasTokenMarkets: vi.fn(async () => false)
		}))
	}

	// Settled on failure too, or a deferred import stays pending for the rest of the file.
	try {
		// Bounded against `result`: when the mocked factory never runs, the request
		// settles without it and this would otherwise wait for the whole timeout.
		await Promise.race([
			moduleStarted.promise,
			result.then(() => {
				throw new Error('getServerSideProps settled before the mocked dataset module started loading')
			})
		])
		expect(readCurrent).toHaveBeenCalledOnce()
	} catch (error) {
		await settle()
		throw error
	}

	return { current, moduleReady, result, settle }
}

test('overlaps a cold module load and a resolving current snapshot', async () => {
	const overlap = await overlapColdModuleLoad()
	try {
		overlap.current.resolve({ generatedAt: 42, metrics: null, categories: [] })
		overlap.moduleReady.resolve()

		expect(await overlap.result).toHaveProperty('value.props')
	} finally {
		await overlap.settle()
	}
})

test('surfaces a current-snapshot failure from an overlapped cold module load', async () => {
	const overlap = await overlapColdModuleLoad()
	const error = new Error('current failure')
	try {
		overlap.current.reject(error)

		await expect(overlap.result).resolves.toEqual({ reason: error })
	} finally {
		await overlap.settle()
	}
})

test('surfaces a module import failure from an overlapped cold module load', async () => {
	const overlap = await overlapColdModuleLoad()
	const error = new Error('import failure')
	try {
		overlap.moduleReady.reject(error)

		// Vitest wraps a failed module factory; the loader's rejection must still escape.
		await expect(overlap.result).resolves.toMatchObject({ reason: { cause: error } })
	} finally {
		await overlap.settle()
	}
})
