import { beforeEach, describe, expect, test } from 'vitest'
import { RISK_SERVER_URL } from '~/constants'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { earnPageRow } from '~/utils/testing/yieldsEarnFixture'
import {
	buildInitialBorrowRoutesSnapshot,
	buildInitialYieldsSnapshot,
	getTokenPageSections,
	getTokenRiskData,
	resetTokenRiskBorrowRoutesCache
} from '../queries'
import type { TokenOverviewData } from '../tokenOverview'

const http = installFixtureFetch()
const BORROW_CAPACITY_URL = `${RISK_SERVER_URL}/get-borrow-capacity-by-asset`

function createBorrowCapacityResponse() {
	return {
		methodologies: {
			asset: 'Collateral asset',
			chain: 'Chain',
			protocol: 'Protocol',
			collateralMaxBorrowUsdGovernance: 'Governance max borrow',
			collateralMaxBorrowUsdLiquidity: 'Liquidity max borrow',
			collateralBorrowedDebtUsd: 'Borrowed debt',
			minBadDebtAtPriceZeroUsd: 'Minimum bad debt at zero'
		},
		timestamp: 1,
		hourlyTimestamp: 1,
		tokens: [
			{
				asset: {
					symbol: 'USDC',
					address: '0xA0b8',
					priceUsd: 1
				},
				chain: 'ethereum',
				totals: {
					collateralMaxBorrowUsdGovernance: 1800,
					collateralMaxBorrowUsdLiquidity: 1500,
					collateralBorrowedDebtUsd: null,
					minBadDebtAtPriceZeroUsd: 400
				},
				byProtocol: [
					{
						protocol: 'aave-v3',
						collateralMaxBorrowUsdGovernance: 1200,
						collateralMaxBorrowUsdLiquidity: 1000,
						collateralBorrowedDebtUsd: 400,
						minBadDebtAtPriceZeroUsd: 400
					},
					{
						protocol: 'morpho-blue',
						collateralMaxBorrowUsdGovernance: null,
						collateralMaxBorrowUsdLiquidity: 500,
						collateralBorrowedDebtUsd: null,
						minBadDebtAtPriceZeroUsd: null
					}
				]
			},
			{
				asset: {
					symbol: 'WSTETH',
					address: '0xWstEth',
					priceUsd: 2000
				},
				chain: 'ethereum',
				totals: {
					collateralMaxBorrowUsdGovernance: null,
					collateralMaxBorrowUsdLiquidity: 750,
					collateralBorrowedDebtUsd: 250,
					minBadDebtAtPriceZeroUsd: 250
				},
				byProtocol: [
					{
						protocol: 'morpho-blue',
						collateralMaxBorrowUsdGovernance: null,
						collateralMaxBorrowUsdLiquidity: 750,
						collateralBorrowedDebtUsd: 250,
						minBadDebtAtPriceZeroUsd: 250
					}
				]
			},
			{
				asset: {
					symbol: 'USDC',
					address: '0x8335',
					priceUsd: 1
				},
				chain: 'base',
				totals: {
					collateralMaxBorrowUsdGovernance: 500,
					collateralMaxBorrowUsdLiquidity: 300,
					collateralBorrowedDebtUsd: 50,
					minBadDebtAtPriceZeroUsd: 25
				},
				byProtocol: [
					{
						protocol: 'aave-v3',
						collateralMaxBorrowUsdGovernance: 500,
						collateralMaxBorrowUsdLiquidity: 300,
						collateralBorrowedDebtUsd: 50,
						minBadDebtAtPriceZeroUsd: 25
					}
				]
			}
		]
	}
}

const displayLookups = {
	protocolDisplayNames: new Map([
		['aave-v3', 'Aave V3'],
		['morpho-blue', 'Morpho Blue']
	]),
	chainDisplayNames: new Map([
		['ethereum', 'Ethereum'],
		['base', 'Base']
	])
}

// The borrow capacity payload is cached per process; each test serves its own.
beforeEach(() => resetTokenRiskBorrowRoutesCache())

describe('getTokenRiskData', () => {
	test('builds token risk exposure data from the borrow capacity payload', async () => {
		http.serve({ [BORROW_CAPACITY_URL]: createBorrowCapacityResponse() })

		const payload = await getTokenRiskData({
			tokenSymbol: 'USDC',
			displayLookups
		})

		expect(payload).not.toBeNull()
		expect(payload?.candidates).toEqual([
			{
				key: 'ethereum:0xa0b8',
				chain: 'ethereum',
				address: '0xa0b8',
				displayName: 'Ethereum'
			},
			{
				key: 'base:0x8335',
				chain: 'base',
				address: '0x8335',
				displayName: 'Base'
			}
		])
		expect(payload?.scopeCandidates).toEqual(payload?.candidates)
		expect(payload?.selectedCandidateKey).toBeNull()
		expect(payload?.exposures.rows).toHaveLength(3)
		expect(payload?.exposures.rows[0]?.protocolDisplayName).toBe('Aave V3')
		expect(payload?.exposures.rows[0]?.chainDisplayName).toBe('Ethereum')
		expect(payload?.exposures.rows[0]).not.toHaveProperty('collateralBorrowedDebtUsd')
		expect(payload?.exposures.summary.totalCurrentMaxBorrowUsd).toBe(1800)
		expect(payload?.exposures.summary.totalMinBadDebtAtPriceZeroUsd).toBe(425)
		expect(payload?.exposures.summary.minBadDebtKnownCount).toBe(2)
		expect(payload?.exposures.summary.minBadDebtUnknownCount).toBe(1)
		expect(payload?.exposures.protocolSummaries).toEqual([
			{
				protocol: 'aave-v3',
				protocolDisplayName: 'Aave V3',
				totalCurrentMaxBorrowUsd: 1300,
				totalMinBadDebtAtPriceZeroUsd: 425,
				minBadDebtAtPriceZeroCoverage: 'known',
				chainBreakdowns: [
					{
						chain: 'ethereum',
						chainDisplayName: 'Ethereum',
						totalCurrentMaxBorrowUsd: 1000,
						totalMinBadDebtAtPriceZeroUsd: 400,
						minBadDebtAtPriceZeroCoverage: 'known'
					},
					{
						chain: 'base',
						chainDisplayName: 'Base',
						totalCurrentMaxBorrowUsd: 300,
						totalMinBadDebtAtPriceZeroUsd: 25,
						minBadDebtAtPriceZeroCoverage: 'known'
					}
				]
			},
			{
				protocol: 'morpho-blue',
				protocolDisplayName: 'Morpho Blue',
				totalCurrentMaxBorrowUsd: 500,
				totalMinBadDebtAtPriceZeroUsd: null,
				minBadDebtAtPriceZeroCoverage: 'unavailable',
				chainBreakdowns: [
					{
						chain: 'ethereum',
						chainDisplayName: 'Ethereum',
						totalCurrentMaxBorrowUsd: 500,
						totalMinBadDebtAtPriceZeroUsd: null,
						minBadDebtAtPriceZeroCoverage: 'unavailable'
					}
				]
			}
		])
		expect(payload?.limitations).toContain(
			'Bad debt at $0 is a lower bound when some contributing markets return null for zero-price bad debt; null rows are excluded instead of being treated as zero.'
		)
	})

	test('groups native and wrapped symbol aliases across chains', async () => {
		http.serve({
			[BORROW_CAPACITY_URL]: {
				...createBorrowCapacityResponse(),
				tokens: [
					{
						asset: {
							symbol: 'ETH',
							address: '0x0000000000000000000000000000000000000000',
							priceUsd: 3000
						},
						chain: 'ethereum',
						totals: {
							collateralMaxBorrowUsdGovernance: null,
							collateralMaxBorrowUsdLiquidity: 100,
							collateralBorrowedDebtUsd: null,
							minBadDebtAtPriceZeroUsd: 10
						},
						byProtocol: [
							{
								protocol: 'sparklend',
								collateralMaxBorrowUsdGovernance: null,
								collateralMaxBorrowUsdLiquidity: 100,
								collateralBorrowedDebtUsd: null,
								minBadDebtAtPriceZeroUsd: 10
							}
						]
					},
					{
						asset: {
							symbol: 'ETH',
							address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
							priceUsd: 3000
						},
						chain: 'ethereum',
						totals: {
							collateralMaxBorrowUsdGovernance: null,
							collateralMaxBorrowUsdLiquidity: 25,
							collateralBorrowedDebtUsd: null,
							minBadDebtAtPriceZeroUsd: 5
						},
						byProtocol: [
							{
								protocol: 'fluid',
								collateralMaxBorrowUsdGovernance: null,
								collateralMaxBorrowUsdLiquidity: 25,
								collateralBorrowedDebtUsd: null,
								minBadDebtAtPriceZeroUsd: 5
							}
						]
					},
					{
						asset: {
							symbol: 'ETH',
							address: '0x0000000000000000000000000000000000000000',
							priceUsd: 3000
						},
						chain: 'optimism',
						totals: {
							collateralMaxBorrowUsdGovernance: null,
							collateralMaxBorrowUsdLiquidity: 50,
							collateralBorrowedDebtUsd: null,
							minBadDebtAtPriceZeroUsd: 15
						},
						byProtocol: [
							{
								protocol: 'aave-v3',
								collateralMaxBorrowUsdGovernance: null,
								collateralMaxBorrowUsdLiquidity: 50,
								collateralBorrowedDebtUsd: null,
								minBadDebtAtPriceZeroUsd: 15
							}
						]
					},
					{
						asset: {
							symbol: 'WETH',
							address: '0xWethBsc',
							priceUsd: 3000
						},
						chain: 'bsc',
						totals: {
							collateralMaxBorrowUsdGovernance: null,
							collateralMaxBorrowUsdLiquidity: 200,
							collateralBorrowedDebtUsd: null,
							minBadDebtAtPriceZeroUsd: 20
						},
						byProtocol: [
							{
								protocol: 'venus-core-pool',
								collateralMaxBorrowUsdGovernance: null,
								collateralMaxBorrowUsdLiquidity: 200,
								collateralBorrowedDebtUsd: null,
								minBadDebtAtPriceZeroUsd: 20
							}
						]
					},
					{
						asset: {
							symbol: 'WBTC',
							address: '0xBtc',
							priceUsd: 100_000
						},
						chain: 'ethereum',
						totals: {
							collateralMaxBorrowUsdGovernance: null,
							collateralMaxBorrowUsdLiquidity: 1000,
							collateralBorrowedDebtUsd: null,
							minBadDebtAtPriceZeroUsd: 1000
						},
						byProtocol: [
							{
								protocol: 'aave-v3',
								collateralMaxBorrowUsdGovernance: null,
								collateralMaxBorrowUsdLiquidity: 1000,
								collateralBorrowedDebtUsd: null,
								minBadDebtAtPriceZeroUsd: 1000
							}
						]
					}
				]
			}
		})

		const payload = await getTokenRiskData({
			tokenSymbol: 'ETH',
			displayLookups
		})

		expect(payload?.scopeCandidates).toEqual([
			{
				key: 'ethereum:native:eth',
				chain: 'ethereum',
				address: '0x0000000000000000000000000000000000000000',
				displayName: 'Ethereum'
			},
			{
				key: 'optimism:native:eth',
				chain: 'optimism',
				address: '0x0000000000000000000000000000000000000000',
				displayName: 'optimism'
			},
			{
				key: 'bsc:0xwethbsc',
				chain: 'bsc',
				address: '0xwethbsc',
				displayName: 'bsc'
			}
		])
		expect(payload?.exposures.summary.totalCurrentMaxBorrowUsd).toBe(375)
		expect(payload?.exposures.summary.totalMinBadDebtAtPriceZeroUsd).toBe(50)
		expect(payload?.exposures.summary.protocolCount).toBe(4)
		expect(payload?.exposures.summary.chainCount).toBe(3)
	})

	test('infers token candidates from borrow capacity symbols', async () => {
		http.serve({ [BORROW_CAPACITY_URL]: createBorrowCapacityResponse() })

		const payload = await getTokenRiskData({
			tokenSymbol: 'WSTETH',
			displayLookups
		})

		expect(payload).not.toBeNull()
		expect(payload?.candidates).toContainEqual({
			key: 'ethereum:0xwsteth',
			chain: 'ethereum',
			address: '0xwsteth',
			displayName: 'Ethereum'
		})
		expect(payload?.exposures.summary.totalCurrentMaxBorrowUsd).toBe(750)
		expect(payload?.exposures.summary.totalMinBadDebtAtPriceZeroUsd).toBe(250)
		expect(payload?.limitations).not.toContain(
			'Bad debt at $0 is a lower bound when some contributing markets return null for zero-price bad debt; null rows are excluded instead of being treated as zero.'
		)
	})

	test('returns null when the token symbol has no borrow capacity rows', async () => {
		http.serve({ [BORROW_CAPACITY_URL]: createBorrowCapacityResponse() })

		const payload = await getTokenRiskData({
			tokenSymbol: 'MISSING',
			displayLookups
		})

		expect(payload).toBeNull()
		expect(http.urls()).toEqual([BORROW_CAPACITY_URL])
	})
})

function pool(id: string, chain: string) {
	return earnPageRow(id, { chains: [chain] })
}
function route(id: string, chain: string) {
	return { id, chains: [chain] } as RouteTableRow
}

describe('token page hydration snapshots', () => {
	test('hydrates only the first yields page while keeping the full count and chain list', () => {
		const rows = Array.from({ length: 12 }, (_, index) => pool(`pool-${index}`, index % 2 ? 'Base' : 'Ethereum'))

		const snapshot = buildInitialYieldsSnapshot(rows, ['asset:btc'])

		expect(snapshot.rows.map((row) => row.id)).toEqual(rows.slice(0, 10).map((row) => row.id))
		expect(snapshot).toMatchObject({
			rowCount: 12,
			pageSize: 10,
			chainList: ['Base', 'Ethereum'],
			tokenKeys: ['asset:btc']
		})
	})

	test('hydrates the first page of each borrow leg with its own count and chains', () => {
		const useAsCollateral = Array.from({ length: 13 }, (_, index) => route(`use-${index}`, 'Ethereum'))
		const borrowThis = [route('borrow-0', 'Base')]

		const snapshot = buildInitialBorrowRoutesSnapshot({ useAsCollateral, borrowThis }, ['asset:btc'])

		expect(snapshot?.data.useAsCollateral).toHaveLength(10)
		expect(snapshot).toMatchObject({
			counts: { useAsCollateral: 13, borrowThis: 1 },
			chainLists: { useAsCollateral: ['Ethereum'], borrowThis: ['Base'] }
		})
		expect(buildInitialBorrowRoutesSnapshot(null, [])).toBeNull()
	})
})

describe('getTokenPageSections', () => {
	const overview = { symbol: 'BTC' } as TokenOverviewData
	const yieldsWithRows = buildInitialYieldsSnapshot([pool('pool-1', 'Ethereum')], ['asset:btc'])
	const routesWithRows = buildInitialBorrowRoutesSnapshot(
		{ useAsCollateral: [route('r', 'Ethereum')], borrowThis: [] },
		['asset:btc']
	)
	const none = {
		geckoId: 'bitcoin' as string | null,
		tokenRightsData: null,
		incomeStatement: null,
		tokenRiskData: null,
		hasLiquidations: false,
		hasMarkets: false,
		resolvedUnlocksSlug: null as string | null,
		yieldsSnapshot: yieldsWithRows,
		borrowRoutesSnapshot: routesWithRows,
		issuer: null,
		chain: null,
		overview
	}
	const ids = (flags: { hasEarn?: boolean; hasBorrow?: boolean }, overrides: Partial<typeof none> = {}) =>
		getTokenPageSections({ record: { name: 'Bitcoin', symbol: 'BTC', ...flags }, ...none, ...overrides }).map(
			(section) => section.id
		)

	test('always shows overview and usage', () => {
		expect(ids({})).toEqual(['token-overview', 'token-usage'])
	})

	test.each([
		{ hasEarn: true, hasBorrow: false, expected: ['token-yields'] },
		{ hasEarn: false, hasBorrow: true, expected: ['token-borrow'] },
		{ hasEarn: true, hasBorrow: true, expected: ['token-yields', 'token-borrow'] }
	])('gates Earn ($hasEarn) and Borrow ($hasBorrow) independently', ({ expected, ...flags }) => {
		expect(ids(flags).slice(2)).toEqual(expected)
	})

	test('hides Earn and Borrow when their lookups found no rows', () => {
		expect(
			ids(
				{ hasEarn: true, hasBorrow: true },
				{
					yieldsSnapshot: buildInitialYieldsSnapshot([], []),
					borrowRoutesSnapshot: buildInitialBorrowRoutesSnapshot({ useAsCollateral: [], borrowThis: [] }, [])
				}
			)
		).toEqual(['token-overview', 'token-usage'])
	})

	test('lists every available section in page order', () => {
		expect(
			ids(
				{ hasEarn: true, hasBorrow: true },
				{
					incomeStatement: {} as never,
					tokenRiskData: {} as never,
					hasMarkets: true,
					tokenRightsData: {} as never,
					hasLiquidations: true,
					resolvedUnlocksSlug: 'bitcoin'
				}
			)
		).toEqual([
			'token-overview',
			'token-income-statement',
			'token-risks',
			'token-markets',
			'token-rights-and-value-accrual',
			'token-usage',
			'token-liquidations',
			'token-unlocks',
			'token-yields',
			'token-borrow'
		])
	})

	test('shows markets only for a CoinGecko token whose markets index has pairs', () => {
		expect(ids({}, { hasMarkets: true, geckoId: null })).toEqual(['token-overview', 'token-usage'])
		expect(ids({}, { hasMarkets: true })).toContain('token-markets')
	})
})
