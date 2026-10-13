import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { GetServerSidePropsContext } from 'next'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { DATASETS_SERVER_URL, V2_SERVER_URL, VAULT_RISK_API } from '~/constants'
import { hasTokenLiquidationsData } from '~/containers/LiquidationsV2/server/dataset.server'
import { getTokenMarkets } from '~/containers/Markets/server/dataset.server'
import { fetchRaisesByDefillamaId } from '~/containers/Raises/server/dataset.server'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import {
	fetchTokenRightsEntryByDefillamaIds,
	fetchTokenRightsEntryByName
} from '~/containers/TokenRights/server/dataset.server'
import { fetchTreasuryById } from '~/containers/Treasuries/server/dataset.server'
import { acquireOptionalYieldsSnapshot } from '~/containers/Yields/server/dataset.server'
import TokenPage, { getServerSideProps } from '~/pages/token/[token]'
import { DatasetSnapshotIntegrityError } from '~/server/datasetSnapshots/errors'
import { EMPTY_TOKEN_FILTER_METADATA } from '~/utils/metadata/tokenFilters'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { waitForUi } from '~/utils/testing/waitForUi'
import { earnRow } from '~/utils/testing/yieldsEarnFixture'
import { yieldsMeta, yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'
import { createTokenDirectoryRecordByRouteSegment, type TokenDirectory } from '~/utils/tokenDirectory'
import type { TokenRiskBorrowCapacityResponse } from '../api.types'
import { getIndexedTokenRiskBorrowCapacity } from '../server/dataset.risk.server'
import { indexBorrowCapacityByAssetKey } from '../tokenRisk.utils'

vi.mock('next/router', () => ({
	useRouter: () => ({
		pathname: '/token/[token]',
		asPath: '/token/BTC',
		query: {},
		events: { on() {}, off() {} },
		push() {},
		replace() {},
		prefetch: async () => {}
	})
}))
vi.mock('~/containers/Markets/server/dataset.server', () => ({
	getTokenMarkets: vi.fn(),
	fetchTokenMarketSummaries: async () => ({})
}))
vi.mock('~/containers/LiquidationsV2/server/dataset.server', () => ({ hasTokenLiquidationsData: vi.fn() }))
vi.mock('~/containers/Raises/server/dataset.server', () => ({ fetchRaisesByDefillamaId: vi.fn() }))
vi.mock('~/containers/Treasuries/server/dataset.server', () => ({ fetchTreasuryById: vi.fn() }))
vi.mock('~/containers/TokenRights/server/dataset.server', () => ({
	fetchTokenRightsEntries: async () => [],
	fetchTokenRightsEntryByDefillamaIds: vi.fn(),
	fetchTokenRightsEntryByName: vi.fn()
}))
vi.mock('~/containers/Yields/server/dataset.server', () => ({ acquireOptionalYieldsSnapshot: vi.fn() }))
vi.mock('~/containers/Token/server/dataset.risk.server', () => ({
	getIndexedTokenRiskBorrowCapacity: vi.fn()
}))

const { serve } = installFixtureFetch()

function borrowCapacity(tokens: TokenRiskBorrowCapacityResponse['tokens']) {
	const data: TokenRiskBorrowCapacityResponse = {
		tokens,
		timestamp: 1,
		hourlyTimestamp: 1,
		methodologies: {
			asset: 'Asset',
			chain: 'Chain',
			protocol: 'Protocol',
			collateralMaxBorrowUsdGovernance: 'Governance capacity',
			collateralMaxBorrowUsdLiquidity: 'Liquidity capacity',
			collateralBorrowedDebtUsd: 'Borrowed debt',
			minBadDebtAtPriceZeroUsd: 'Bad debt at zero'
		}
	}
	return { data, indexedTokens: indexBorrowCapacityByAssetKey(tokens) }
}
const { seed } = installMetadataSeeder()
let now = Date.parse('2026-01-01T00:00:00Z')
const btc = { name: 'Bitcoin', symbol: 'BTC', token_nk: 'coingecko:bitcoin', route: '/token/BTC', mcap_rank: 1 }
function directory(tokens: TokenDirectory) {
	seed({ tokenDirectory: tokens, tokenDirectoryRecordByRouteSegment: createTokenDirectoryRecordByRouteSegment(tokens) })
}

beforeEach(() => {
	vi.clearAllMocks()
	// A new cache window isolates the real in-memory market snapshot between tests.
	now += 300_000
	vi.spyOn(Date, 'now').mockReturnValue(now)
	// Seeded metadata must not be replaced by the unrelated background refresher.
	vi.stubEnv('NODE_ENV', 'development')
	vi.stubEnv('API_KEY', '')
	vi.mocked(acquireOptionalYieldsSnapshot).mockResolvedValue(null)
	vi.mocked(getIndexedTokenRiskBorrowCapacity).mockResolvedValue(borrowCapacity([]))
	vi.mocked(getTokenMarkets).mockResolvedValue({ summary: null, hasMarkets: false })
	vi.mocked(hasTokenLiquidationsData).mockResolvedValue(false)
	vi.mocked(fetchRaisesByDefillamaId).mockResolvedValue([])
	vi.mocked(fetchTreasuryById).mockResolvedValue(null)
	vi.mocked(fetchTokenRightsEntryByDefillamaIds).mockResolvedValue(null)
	vi.mocked(fetchTokenRightsEntryByName).mockResolvedValue(null)
	directory({ btc })
	seed({
		protocolMetadata: {},
		chainMetadata: {},
		tokenlist: {},
		cgExchangeIdentifiers: [],
		emissionsProtocolsList: [],
		emissionsSupplyMetrics: {},
		liquidationsTokenSymbolsSet: new Set()
	})
	serve({
		[`${DATASETS_SERVER_URL}/tokenlist/rankings.json`]: [
			{
				id: 'bitcoin',
				name: 'Bitcoin',
				symbol: 'btc',
				current_price: 100,
				price_change_percentage_24h: 5,
				circulating_supply: 10,
				total_supply: 21,
				max_supply: 21,
				market_cap: 1000,
				fully_diluted_valuation: 2100,
				total_volume: 500
			}
		],
		'/api/v3/coins/bitcoin/market_chart': { prices: [[1_700_000_000_000, 100]] },
		'/api/v3/coins/bitcoin': { market_data: { current_price: { usd: 100 }, total_supply: 21, circulating_supply: 10 } }
	})
})
afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllEnvs()
})

async function request(token: string | undefined) {
	const res = createMockNextApiResponse()
	const result = await getServerSideProps({
		params: { token },
		query: {},
		resolvedUrl: `/token/${token}`,
		req: { method: 'GET' },
		res
	} as unknown as GetServerSidePropsContext)
	return { result, cache: res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1] }
}
async function props(token = 'BTC') {
	const { result } = await request(token)
	if (!('props' in result)) throw new Error('Expected token page props')
	return await result.props
}
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

describe('token page', () => {
	test.each([undefined, 'missing', 'bitcoin'])('returns notFound for an unresolvable token %s', async (token) => {
		expect(await request(token)).toEqual({ result: { notFound: true }, cache: 'private, no-store' })
	})
	test('redirects aliases to the metadata canonical route', async () => {
		expect(await request('btc')).toEqual({
			result: { redirect: { destination: '/token/BTC', permanent: false } },
			cache: 'private, no-store'
		})
	})
	test('keeps mixed-case and spaced metadata routes canonical', async () => {
		directory({ btc: { ...btc, route: '/token/Bit Coin' } })
		expect((await request('BTC')).result).toEqual({ redirect: { destination: '/token/Bit Coin', permanent: false } })
		expect((await props('Bit Coin')).canonicalUrl).toBe('/token/Bit Coin')
	})
	test('encodes symbols when metadata has no route', async () => {
		directory({ btc: { ...btc, symbol: 'BTC / Test', route: undefined } })
		expect((await request('btc')).result).toEqual({
			redirect: { destination: '/token/BTC%20%2F%20Test', permanent: false }
		})
		expect((await props('BTC%20%2F%20Test')).canonicalUrl).toBe('/token/BTC%20%2F%20Test')
	})
	test('does not accept a non-token metadata route as a token alias', async () => {
		directory({ btc: { ...btc, route: '/protocol/bitcoin' } })
		expect((await request('bitcoin')).result).toEqual({ notFound: true })
	})
	test('returns current rankings metrics and caches only until the next shared window', async () => {
		const { result, cache } = await request('BTC')
		expect(cache).toBe('public, s-maxage=300, must-revalidate')
		expect(result).toMatchObject({
			props: {
				canonicalUrl: '/token/BTC',
				sections: [
					{
						id: 'token-overview',
						overview: {
							marketData: { currentPrice: 100, mcap: 1000, totalSupply: 21 },
							rawChartData: { 'Token Price': [[1_700_000_000_000, 100]] }
						}
					},
					{ id: 'token-usage', tokenSymbol: 'BTC' }
				]
			}
		})
	})
	test('renders the real overview and only supported section links', async () => {
		const page = await props()
		const client = new QueryClient()
		try {
			const html = renderToStaticMarkup(
				<QueryClientProvider client={client}>
					<AuthProvider>
						<TokenPage {...page} />
					</AuthProvider>
				</QueryClientProvider>
			)
			expect(html).toContain('Market Cap')
			expect(html).toContain('href="#token-overview"')
			expect(html).toContain('href="#token-usage"')
			expect(html).not.toContain('href="#token-liquidations"')
		} finally {
			client.clear()
		}
	})
	test('includes markets and liquidations only when the indexes contain data', async () => {
		seed({ liquidationsTokenSymbolsSet: new Set(['BTC']) })
		vi.mocked(hasTokenLiquidationsData).mockResolvedValue(true)
		vi.mocked(getTokenMarkets).mockResolvedValue({ summary: null, hasMarkets: true })
		expect((await props()).sections.map((s) => s.id)).toContain('token-liquidations')
		expect((await props()).sections.map((s) => s.id)).toContain('token-markets')
		vi.mocked(hasTokenLiquidationsData).mockResolvedValue(false)
		vi.mocked(getTokenMarkets).mockResolvedValue({ summary: null, hasMarkets: false })
		expect((await props()).sections.map((s) => s.id)).toEqual(['token-overview', 'token-usage'])
	})
	test('contains optional source failures and recovers on the next request', async () => {
		directory({ btc: { ...btc, protocolId: 'bitcoin', tokenRights: true } })
		vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.mocked(fetchRaisesByDefillamaId).mockRejectedValueOnce(new Error('Raises unavailable'))
		vi.mocked(fetchTreasuryById).mockRejectedValueOnce(new Error('Treasury unavailable'))
		vi.mocked(getTokenMarkets).mockRejectedValueOnce(new Error('Markets unavailable'))
		expect((await props()).sections[0]).toMatchObject({
			id: 'token-overview',
			overview: { raises: null, treasury: null, marketData: { currentPrice: 100 } }
		})
		vi.mocked(fetchTokenRightsEntryByDefillamaIds).mockResolvedValue(tokenRightsEntryFixture)
		vi.mocked(fetchRaisesByDefillamaId).mockResolvedValue([
			{
				date: 1,
				name: 'Bitcoin',
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
				defillamaId: 'bitcoin'
			}
		])
		const recovered = await props()
		expect(recovered.sections[0]).toMatchObject({ overview: { raises: [{ amountUsd: 0 }] } })
		expect(recovered.sections.map((s) => s.id)).toContain('token-rights-and-value-accrual')
	})
	test.each(['raises', 'treasuries'] as const)('propagates %s snapshot corruption', async (domain) => {
		directory({ btc: { ...btc, protocolId: 'bitcoin' } })
		const error = new DatasetSnapshotIntegrityError(domain, 'raw/all.json', new Error('Corrupt artifact'))
		if (domain === 'raises') vi.mocked(fetchRaisesByDefillamaId).mockRejectedValueOnce(error)
		else vi.mocked(fetchTreasuryById).mockRejectedValueOnce(error)
		await expect(request('BTC')).rejects.toBe(error)
	})
	test('looks up rights by chain then protocol id and hides missing rights', async () => {
		directory({ btc: { ...btc, chainId: 'Bitcoin', protocolId: 'bitcoin', tokenRights: true } })
		vi.mocked(fetchTokenRightsEntryByDefillamaIds).mockImplementation(async (ids) =>
			ids.join() === 'Bitcoin,bitcoin' ? tokenRightsEntryFixture : null
		)
		expect((await props()).sections).toContainEqual(expect.objectContaining({ id: 'token-rights-and-value-accrual' }))
		vi.mocked(fetchTokenRightsEntryByDefillamaIds).mockResolvedValue(null)
		expect((await props()).sections.map((s) => s.id)).not.toContain('token-rights-and-value-accrual')
	})
	test('selects cached protocol unlocks before chain unlocks and hides unavailable unlocks', async () => {
		directory({ btc: { ...btc, protocolId: 'bitcoin', chainId: 'Bitcoin' } })
		seed({
			protocolMetadata: { bitcoin: { name: 'bitcoin', displayName: 'Bitcoin Protocol' } },
			chainMetadata: { bitcoin: { id: 'bitcoin', name: 'Bitcoin Network' } },
			emissionsProtocolsList: ['bitcoin-protocol', 'bitcoin-network']
		})
		expect((await props()).sections).toContainEqual({
			id: 'token-unlocks',
			label: 'Unlocks',
			resolvedUnlocksSlug: 'bitcoin-protocol'
		})
		seed({ emissionsProtocolsList: ['bitcoin-network'] })
		expect((await props()).sections).toContainEqual({
			id: 'token-unlocks',
			label: 'Unlocks',
			resolvedUnlocksSlug: 'bitcoin-network'
		})
		seed({ emissionsProtocolsList: [] })
		expect((await props()).sections.map((s) => s.id)).not.toContain('token-unlocks')
	})
	test('looks up rights by token name when the record has no chain or protocol id', async () => {
		directory({ btc: { ...btc, tokenRights: true } })
		vi.mocked(fetchTokenRightsEntryByName).mockImplementation(async (name) =>
			name === 'Bitcoin' ? tokenRightsEntryFixture : null
		)
		expect((await props()).sections.map((s) => s.id)).toContain('token-rights-and-value-accrual')
	})
	test('keeps the page when flagged rights and income statement sources fail', async () => {
		directory({ btc: { ...btc, protocolId: 'bitcoin', tokenRights: true, incomeStatement: true } })
		vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.mocked(fetchTokenRightsEntryByDefillamaIds).mockRejectedValue(new Error('Rights unavailable'))
		serve({ [`${V2_SERVER_URL}/metrics/financial-statement/token/btc?q=30`]: fixtureStatus(500) })
		const ids = (await props()).sections.map((s) => s.id)
		expect(ids).not.toContain('token-rights-and-value-accrual')
		expect(ids).not.toContain('token-income-statement')
		expect(ids).toContain('token-overview')
	})
	test('includes real income statement data only for flagged tokens', async () => {
		directory({ btc: { ...btc, incomeStatement: true } })
		serve({
			[`${V2_SERVER_URL}/metrics/financial-statement/token/btc?q=30`]: {
				aggregates: { monthly: {}, quarterly: {}, yearly: {} }
			}
		})
		expect((await props()).sections).toContainEqual(expect.objectContaining({ id: 'token-income-statement' }))
		directory({ btc })
		expect((await props()).sections.map((s) => s.id)).not.toContain('token-income-statement')
	})
	test('hydrates only the first yield page while retaining the full matching count', async () => {
		directory({ btc: { ...btc, hasEarn: true } })
		const earn = Array.from({ length: 125 }, (_, index) => earnRow(`btc-${index}`, 1000 + index))
		const snapshot = yieldsSnapshot({
			earn: [...earn, earnRow('unrelated', 1_000_000)],
			tokenKeys: earn.map(({ id }) => ({ id, reference_asset: ['asset:btc'], reference_asset_exact: ['asset:btc'] })),
			meta: { ...yieldsMeta, tokens: { families: [], assets: [{ value: 'asset:btc', symbol: 'BTC' }] } }
		})
		vi.mocked(acquireOptionalYieldsSnapshot).mockResolvedValue(snapshot)
		serve({
			'/lite/protocols2': { protocols: [], parentProtocols: [], chains: [], protocolCategories: [] },
			'/raises': { raises: [] },
			[VAULT_RISK_API]: { data: [] }
		})
		const section = (await props()).sections.find((section) => section.id === 'token-yields')
		if (section?.id !== 'token-yields') throw new Error('Expected populated yields section')
		expect(section.hydration.rowCount).toBe(125)
		expect(section.hydration.pageSize).toBe(10)
		expect(section.hydration.rows).toHaveLength(10)
		expect(section.hydration.rows[0]).toMatchObject({ id: 'btc-124', tvl: 1124 })
		expect(section.hydration.tokenKeys).toEqual(['asset:btc'])
		expect(section.hydration.chainList).toEqual(['Ethereum'])
	})
	test('finishes other token sources while optional yields acquisition is pending', async () => {
		directory({ btc: { ...btc, hasEarn: true } })
		let resolveSnapshot!: (value: null) => void
		vi.mocked(acquireOptionalYieldsSnapshot).mockReturnValue(
			new Promise((resolve) => {
				resolveSnapshot = resolve
			})
		)
		let marketsFinished = false
		vi.mocked(getTokenMarkets).mockImplementation(async () => {
			marketsFinished = true
			return { summary: null, hasMarkets: false }
		})
		const pending = props()
		await waitForUi(() => expect(marketsFinished).toBe(true))
		resolveSnapshot(null)
		const page = await pending
		expect(page.sections.map((section) => section.id)).not.toContain('token-yields')
		expect(page.sections.map((section) => section.id)).not.toContain('token-borrow')
	})
	test('propagates a required rankings failure', async () => {
		serve({ [`${DATASETS_SERVER_URL}/tokenlist/rankings.json`]: fixtureStatus(400) })
		await expect(request('BTC')).rejects.toThrow(/400/)
	})
	test('shows only the token own categories with their directory labels', async () => {
		seed({
			tokenFilterMetadata: {
				...EMPTY_TOKEN_FILTER_METADATA,
				generatedAt: now,
				tokens: { bitcoin: { chains: [], primaryChain: null, categories: ['defi'] } },
				categories: [
					{ id: 'defi', label: 'DeFi' },
					{ id: 'stablecoins', label: 'Stablecoins' }
				]
			}
		})
		expect((await props()).sections[0]).toMatchObject({ overview: { categories: [{ id: 'defi', label: 'DeFi' }] } })
	})
	test('propagates liquidations index corruption', async () => {
		seed({ liquidationsTokenSymbolsSet: new Set(['BTC']) })
		const error = new DatasetSnapshotIntegrityError('liquidations', 'raw/all.json', new Error('Corrupt index'))
		vi.mocked(hasTokenLiquidationsData).mockRejectedValueOnce(error)
		await expect(request('BTC')).rejects.toBe(error)
	})
	test('shows risks only when the borrow capacity index has exposure for the token', async () => {
		vi.mocked(getIndexedTokenRiskBorrowCapacity).mockResolvedValue(
			borrowCapacity([
				{
					asset: { symbol: 'BTC', address: '0x1', priceUsd: 100 },
					chain: 'ethereum',
					totals: {
						collateralMaxBorrowUsdGovernance: 100,
						collateralMaxBorrowUsdLiquidity: 90,
						collateralBorrowedDebtUsd: 50,
						minBadDebtAtPriceZeroUsd: 10
					},
					byProtocol: [
						{
							protocol: 'aave-v3',
							collateralMaxBorrowUsdGovernance: 100,
							collateralMaxBorrowUsdLiquidity: 90,
							collateralBorrowedDebtUsd: 50,
							minBadDebtAtPriceZeroUsd: 10
						}
					]
				}
			])
		)
		expect((await props()).sections.map((section) => section.id)).toContain('token-risks')

		vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.mocked(getIndexedTokenRiskBorrowCapacity).mockRejectedValueOnce(new Error('Risk index unavailable'))
		expect((await props()).sections.map((section) => section.id)).not.toContain('token-risks')
	})
})

/**
 * The page starts the current-market read before its dataset modules finish loading, so a failure there
 * must reject the request instead of surfacing later as an unhandled rejection. The longer timeout covers
 * re-importing the page's module graph after vi.resetModules, which takes about two seconds on a loaded machine.
 */
test('rejects with a current-market failure while the dataset modules are still loading', async () => {
	vi.resetModules()
	const moduleStarted = Promise.withResolvers<void>()
	const moduleReady = Promise.withResolvers<void>()
	// Only the request loads this module, so holding it open holds the request's imports open.
	vi.doMock('~/containers/Treasuries/server/dataset.server', async () => {
		moduleStarted.resolve()
		await moduleReady.promise
		return { fetchTreasuryById: async () => null }
	})
	try {
		const freshMetadata = (await import('~/utils/metadata')).default
		Object.assign(freshMetadata, {
			tokenDirectory: { btc },
			tokenDirectoryRecordByRouteSegment: createTokenDirectoryRecordByRouteSegment({ btc })
		})
		serve({ [`${DATASETS_SERVER_URL}/tokenlist/rankings.json`]: fixtureStatus(400) })
		const { getServerSideProps: coldRequest } = await import('~/pages/token/[token]')
		const outcome = coldRequest({
			params: { token: 'BTC' },
			query: {},
			resolvedUrl: '/token/BTC',
			req: { method: 'GET' },
			res: createMockNextApiResponse()
		} as unknown as GetServerSidePropsContext).then(
			() => 'resolved',
			(error: Error) => error.message
		)
		await Promise.race([moduleStarted.promise, outcome])

		// Bounded: a request that waits for its imports before observing the failure never settles here.
		const settled = await Promise.race([
			outcome,
			new Promise((resolve) => setTimeout(() => resolve('still waiting for imports'), 1000))
		])
		expect(settled).toMatch(/400/)
	} finally {
		moduleReady.resolve()
		await vi.dynamicImportSettled()
		vi.doUnmock('~/containers/Treasuries/server/dataset.server')
	}
}, 10_000)
