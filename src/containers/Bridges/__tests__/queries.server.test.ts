import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchJson } from '~/utils/async'
import {
	fetchBridgeDayStats,
	fetchBridgeLargeTransactions,
	fetchBridgeNetflows,
	fetchBridges,
	fetchBridgeVolumeAll,
	fetchBridgeVolumeByChain
} from '../api'
import type { BridgeDayStats, RawBridgesWithChainsResponse } from '../api.types'
import { getBridgeOverviewSummaryTotals } from '../bridgeOverviewChartData'
import {
	buildPrevDayDataByChain,
	buildTableDataByChain,
	buildVolumeDataByChain,
	getBridgeChainNetInflows,
	getBridgeOverviewPageData
} from '../queries.server'

const REQUIRED_DAY_TOTALS = {
	totalDepositedUSD: 0,
	totalWithdrawnUSD: 0,
	totalDepositTxs: 0,
	totalWithdrawalTxs: 0
}

vi.mock('~/utils/async', () => ({
	fetchJson: vi.fn()
}))

vi.mock('../api', () => ({
	fetchBridgeDayStats: vi.fn(),
	fetchBridgeLargeTransactions: vi.fn(),
	fetchBridgeNetflows: vi.fn(),
	fetchBridges: vi.fn(),
	fetchBridgeVolumeAll: vi.fn(),
	fetchBridgeVolumeByChain: vi.fn()
}))

vi.mock('~/utils/metadata', () => ({
	default: { chainMetadata: {} }
}))

beforeEach(() => {
	vi.mocked(fetchJson).mockReset()
	vi.mocked(fetchBridgeDayStats).mockReset()
	vi.mocked(fetchBridgeLargeTransactions).mockReset()
	vi.mocked(fetchBridgeNetflows).mockReset()
	vi.mocked(fetchBridges).mockReset()
	vi.mocked(fetchBridgeVolumeAll).mockReset()
	vi.mocked(fetchBridgeVolumeByChain).mockReset()
})

describe('getBridgeChainNetInflows', () => {
	test('returns the latest completed UTC-day net flow without fetching bridge overview data', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { XDC: ['xdc-network'] } })
		vi.mocked(fetchBridgeVolumeByChain).mockResolvedValue([
			{ date: Date.parse('2026-04-27T00:00:00Z') / 1e3, depositUSD: 12, withdrawUSD: 3, depositTxs: 1, withdrawTxs: 1 },
			{ date: Date.parse('2026-04-28T00:00:00Z') / 1e3, depositUSD: 42, withdrawUSD: 5, depositTxs: 2, withdrawTxs: 1 }
		])

		await expect(getBridgeChainNetInflows('XDC', Date.parse('2026-04-28T12:00:00Z'))).resolves.toEqual({
			netInflows: 9
		})
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledOnce()
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledWith('XDC')
	})

	test.each([
		{ label: 'negative', depositUSD: 5, withdrawUSD: 12, expected: -7 },
		{ label: 'zero', depositUSD: 5, withdrawUSD: 5, expected: 0 },
		{ label: 'deposit-only', depositUSD: 5, withdrawUSD: null, expected: null },
		{ label: 'withdrawal-only', depositUSD: null, withdrawUSD: 5, expected: null },
		{ label: 'missing', depositUSD: null, withdrawUSD: null, expected: null }
	])('preserves a $label net-flow result', async ({ depositUSD, withdrawUSD, expected }) => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { XDC: ['xdc-network'] } })
		vi.mocked(fetchBridgeVolumeByChain).mockResolvedValue([
			{ date: Date.parse('2026-04-27T00:00:00Z') / 1e3, depositUSD, withdrawUSD, depositTxs: 0, withdrawTxs: 0 }
		])

		await expect(getBridgeChainNetInflows('XDC', Date.parse('2026-04-28T12:00:00Z'))).resolves.toEqual({
			netInflows: expected
		})
	})

	test.each([
		{ label: 'empty', chart: [] },
		{
			label: 'without the latest completed day',
			chart: [
				{
					date: Date.parse('2026-04-26T00:00:00Z') / 1e3,
					depositUSD: 12,
					withdrawUSD: 3,
					depositTxs: 1,
					withdrawTxs: 1
				}
			]
		}
	])('returns zero for a successful sparse response that is $label', async ({ chart }) => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { XDC: ['xdc-network'] } })
		vi.mocked(fetchBridgeVolumeByChain).mockResolvedValue(chart)

		await expect(getBridgeChainNetInflows('XDC', Date.parse('2026-04-28T12:00:00Z'))).resolves.toEqual({
			netInflows: 0
		})
	})

	test('does not add another retry layer when a bridge request fails', async () => {
		const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { XDC: ['xdc-network'] } })
		vi.mocked(fetchBridgeVolumeByChain).mockRejectedValue(new Error('bridge request failed'))

		await expect(getBridgeChainNetInflows('XDC')).rejects.toThrow('bridge volume for chain XDC is broken')
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledOnce()
		expect(consoleLog).toHaveBeenCalledWith('[bridges][fetch-failed] fetchBridgeVolumeByChain(XDC)', expect.any(Error))
		consoleLog.mockRestore()
	})
})

describe('getBridgeOverviewPageData', () => {
	test('projects global raw volume into the summary series', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: {} })
		const bridgesResponse: RawBridgesWithChainsResponse = {
			dataUpdatedAt: '2026-07-28T16:00:00.000Z',
			bridges: [],
			chains: []
		}
		vi.mocked(fetchBridges).mockResolvedValue(bridgesResponse)
		vi.mocked(fetchBridgeVolumeAll).mockResolvedValue([
			{ date: 1, depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 },
			{ date: 2, depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 }
		])
		vi.mocked(fetchBridgeLargeTransactions).mockResolvedValue([])
		vi.mocked(fetchBridgeNetflows).mockResolvedValue([])

		const result = await getBridgeOverviewPageData('')

		expect(result.chain).toBe('All')
		expect(result.chainVolumeData).toEqual([
			{ date: 1, volume: 7, Deposits: null, Withdrawals: null },
			{ date: 2, volume: null, Deposits: null, Withdrawals: null }
		])
		expect(
			getBridgeOverviewSummaryTotals({
				selectedChain: result.chain,
				bridges: [{ lastDailyVolume: 5, weeklyVolume: 50, monthlyVolume: 500 }],
				chainVolumeData: result.chainVolumeData
			})
		).toEqual({ dayTotalVolume: 5, weekTotalVolume: 50, monthTotalVolume: 500 })
		expect(result.rawBridgeVolumeData).toHaveLength(2)
	})

	test('fetches per-bridge volume only for bridges that support the selected chain', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { Base: ['base'] } })
		const bridgesResponse: RawBridgesWithChainsResponse = {
			dataUpdatedAt: '2026-07-28T16:00:00.000Z',
			bridges: [
				{
					id: 1,
					name: 'base-bridge',
					displayName: 'Base Bridge',
					icon: 'chain:Base',
					volumePrevDay: 0,
					volumePrev2Day: 0,
					lastHourlyVolume: 0,
					last24hVolume: 0,
					lastDailyVolume: 0,
					dayBeforeLastVolume: 0,
					weeklyVolume: 0,
					monthlyVolume: 0,
					chains: ['Base'],
					destinationChain: 'false'
				},
				{
					id: 2,
					name: 'ethereum-bridge',
					displayName: 'Ethereum Bridge',
					icon: 'chain:Ethereum',
					volumePrevDay: 0,
					volumePrev2Day: 0,
					lastHourlyVolume: 0,
					last24hVolume: 0,
					lastDailyVolume: 0,
					dayBeforeLastVolume: 0,
					weeklyVolume: 0,
					monthlyVolume: 0,
					chains: ['Ethereum'],
					destinationChain: 'false'
				}
			],
			chains: [{ name: 'Base', volumePrevDay: 0, gecko_id: 'base', tokenSymbol: null }]
		}
		vi.mocked(fetchBridges).mockResolvedValue(bridgesResponse)
		vi.mocked(fetchBridgeVolumeByChain).mockResolvedValue([])
		vi.mocked(fetchBridgeDayStats).mockResolvedValue({
			date: 1,
			...REQUIRED_DAY_TOTALS,
			totalTokensDeposited: {},
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		})
		vi.mocked(fetchBridgeLargeTransactions).mockResolvedValue([])

		const result = await getBridgeOverviewPageData('Base')

		expect(result.chain).toBe('Base')
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledTimes(2)
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledWith('Base', 1)
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledWith('Base')
		expect(fetchBridgeVolumeByChain).not.toHaveBeenCalledWith('Base', 2)
		expect(fetchBridgeDayStats).toHaveBeenCalledWith(expect.any(Number), 'Base', { rollingHours: 24 })
		expect(result.bridgeNames).toEqual(['Base Bridge'])
	})

	test('preserves the large-transaction chain perspective on selected-chain pages', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { Base: ['base'] } })
		const bridgesResponse: RawBridgesWithChainsResponse = {
			dataUpdatedAt: '2026-08-24T00:00:00.000Z',
			bridges: [],
			chains: [{ name: 'Base', volumePrevDay: 0, gecko_id: 'base', tokenSymbol: null }]
		}
		vi.mocked(fetchBridges).mockResolvedValue(bridgesResponse)
		vi.mocked(fetchBridgeVolumeByChain).mockResolvedValue([])
		vi.mocked(fetchBridgeDayStats).mockResolvedValue({
			date: 1,
			...REQUIRED_DAY_TOTALS,
			totalTokensDeposited: {},
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		})
		vi.mocked(fetchBridgeLargeTransactions).mockResolvedValue([
			{
				date: 1,
				txHash: 'selected-leg',
				from: 'from',
				to: 'to',
				token: 'base:token',
				symbol: 'USDC',
				amount: '1',
				isDeposit: true,
				bridge: 'Circle',
				chain: 'Base',
				usdValue: '1'
			},
			{
				date: 2,
				txHash: 'opposite-leg',
				from: 'from',
				to: 'to',
				token: 'ethereum:token',
				symbol: 'USDC',
				amount: '1',
				isDeposit: true,
				bridge: 'Circle',
				chain: 'Ethereum',
				usdValue: '1'
			}
		])

		const result = await getBridgeOverviewPageData('Base')

		expect(result.largeTxsData.map(({ txHash, isDeposit }) => [txHash, isDeposit])).toEqual([
			['selected-leg', true],
			['opposite-leg', false]
		])
	})
})

describe('buildVolumeDataByChain', () => {
	test('sorts staggered per-chain rows in the all-chain series', () => {
		const result = buildVolumeDataByChain({
			volume: [
				[{ date: 200_000, depositUSD: 20, withdrawUSD: 2, depositTxs: 1, withdrawTxs: 1 }],
				[{ date: 100_000, depositUSD: 10, withdrawUSD: 1, depositTxs: 1, withdrawTxs: 1 }]
			],
			chains: ['Later', 'Earlier'],
			destinationChain: 'false'
		})

		const allChains = result['All Chains']
		if (!allChains) throw new Error('Missing all-chain bridge volume series')
		expect(allChains.map(({ date }) => date)).toEqual([86_400, 172_800])
	})

	test('falls back to tracked chain volume when the destination-chain series is empty', () => {
		const result = buildVolumeDataByChain({
			volume: [[{ date: 1_783_382_400, depositUSD: 100, withdrawUSD: 20, depositTxs: 2, withdrawTxs: 1 }], []],
			chains: ['Ethereum', 'Robinhood Chain'],
			destinationChain: 'Robinhood Chain'
		})

		expect(result['All Chains']).toEqual([{ date: 1_783_382_400, Deposited: 100, Withdrawn: -20 }])
	})

	test('preserves missing legs through per-chain and all-chain aggregation', () => {
		const result = buildVolumeDataByChain({
			volume: [
				[{ date: 1_783_382_400, depositUSD: 100, withdrawUSD: null, depositTxs: 1, withdrawTxs: 0 }],
				[{ date: 1_783_382_400, depositUSD: 50, withdrawUSD: 20, depositTxs: 1, withdrawTxs: 1 }]
			],
			chains: ['Ethereum', 'Base'],
			destinationChain: 'false'
		})

		expect(result.Ethereum).toEqual([{ date: 1_783_382_400, Deposited: 100, Withdrawn: null }])
		expect(result['All Chains']).toEqual([{ date: 1_783_382_400, Deposited: 150, Withdrawn: null }])
	})
})

describe('buildTableDataByChain token series', () => {
	test('preserves null USD values through aggregate totals and detail rows', () => {
		const stats: BridgeDayStats = {
			date: 1,
			totalDepositedUSD: null,
			totalWithdrawnUSD: 10,
			totalDepositTxs: 1,
			totalWithdrawalTxs: 2,
			totalTokensDeposited: { token: { symbol: 'USDC', usdValue: null } },
			totalTokensWithdrawn: {},
			totalAddressDeposited: { address: { usdValue: null, txs: 1 } },
			totalAddressWithdrawn: {}
		}
		const prevDayDataByChain = buildPrevDayDataByChain({
			statsOnPrevDay: [{ chain: 'Base', stats }],
			destinationChain: 'false'
		})

		expect(prevDayDataByChain['All Chains']).toMatchObject({
			totalDepositedUSD: null,
			totalWithdrawnUSD: 10,
			totalTokensDeposited: { token: { symbol: 'USDC', usdValue: null } },
			totalAddressDeposited: { address: { usdValue: null, txs: 1 } }
		})
		expect(buildTableDataByChain({ prevDayDataByChain, chainsList: ['All Chains'] })['All Chains']).toMatchObject({
			totalDepositedUSD: null,
			tokensTableData: [{ symbol: 'USDC', token: 'token', deposited: null, withdrawn: 0, volume: null }],
			addressesTableData: [{ address: 'address', deposited: null, withdrawn: 0, txs: 1 }],
			tokenDeposits: null
		})
	})

	test('keeps a known-null deposit unknown when the same token and address also withdraw', () => {
		const stats: BridgeDayStats = {
			date: 1,
			...REQUIRED_DAY_TOTALS,
			totalTokensDeposited: { token: { symbol: 'USDC', usdValue: null } },
			totalTokensWithdrawn: { token: { symbol: 'USDC', usdValue: 5 } },
			totalAddressDeposited: { address: { usdValue: null, txs: 1 } },
			totalAddressWithdrawn: { address: { usdValue: 5, txs: 2 } }
		}

		expect(buildTableDataByChain({ prevDayDataByChain: { Base: stats }, chainsList: ['Base'] }).Base).toMatchObject({
			tokensTableData: [{ symbol: 'USDC', token: 'token', deposited: null, withdrawn: 5, volume: null }],
			addressesTableData: [{ address: 'address', deposited: null, withdrawn: 5, txs: 3 }],
			tokenDeposits: null
		})
	})

	test('keeps missing day stats distinct from a known-empty successful day', () => {
		const emptyStats: BridgeDayStats = {
			date: 1,
			...REQUIRED_DAY_TOTALS,
			totalTokensDeposited: {},
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		}
		const result = buildTableDataByChain({
			prevDayDataByChain: { Base: emptyStats },
			chainsList: ['Base', 'Missing']
		})

		expect(result.Base).toMatchObject({
			tokensTableData: [],
			addressesTableData: [],
			tokenDeposits: { peers: [] },
			tokenWithdrawals: { peers: [] }
		})
		expect(result.Missing).toBeUndefined()
	})

	test('keeps same-symbol contract identities distinct in tables and token selectors', () => {
		const ethereum: BridgeDayStats = {
			date: 1,
			...REQUIRED_DAY_TOTALS,
			totalTokensDeposited: {
				first: { symbol: 'USDC', usdValue: 7 },
				second: { symbol: 'USDC', usdValue: 5 },
				third: { symbol: 'ETH', usdValue: 3 }
			},
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		}

		const result = buildTableDataByChain({ prevDayDataByChain: { Ethereum: ethereum }, chainsList: ['Ethereum'] })

		expect(result).toMatchObject({
			Ethereum: {
				tokenDeposits: {
					peers: [
						{ name: 'USDC · first', value: 7 },
						{ name: 'USDC · second', value: 5 },
						{ name: 'ETH · third', value: 3 }
					]
				},
				tokensTableData: [
					{ symbol: 'USDC', token: 'first', deposited: 7, withdrawn: 0, volume: 7 },
					{ symbol: 'USDC', token: 'second', deposited: 5, withdrawn: 0, volume: 5 },
					{ symbol: 'ETH', token: 'third', deposited: 3, withdrawn: 0, volume: 3 }
				]
			}
		})
	})

	test('sums exact producer identities while keeping distinct same-symbol identities separate', () => {
		const stats = (
			symbol: string,
			usdValue: number,
			txs: number,
			token = 'ethereum:usdc',
			address = 'Ethereum:0x1'
		): BridgeDayStats => ({
			date: 1,
			...REQUIRED_DAY_TOTALS,
			totalTokensDeposited: { [token]: { symbol, usdValue } },
			totalTokensWithdrawn: {},
			totalAddressDeposited: { [address]: { usdValue, txs } },
			totalAddressWithdrawn: {}
		})
		const prevDayDataByChain = buildPrevDayDataByChain({
			statsOnPrevDay: [
				{ chain: 'Ethereum', stats: stats('', 2, 1) },
				{ chain: 'Ethereum', stats: stats('USDC', 3, 2) },
				{ chain: 'Base', stats: stats('USDC', 5, 4, 'ethereum:usdc', 'Base:0x1') },
				{ chain: 'Base', stats: stats('USDC', 4, 5, 'base:alternate', 'Base:other') }
			],
			destinationChain: 'false'
		})

		expect(prevDayDataByChain).toMatchObject({
			'All Chains': {
				totalTokensDeposited: {
					'ethereum:usdc': { symbol: 'USDC', usdValue: 10 },
					'base:alternate': { symbol: 'USDC', usdValue: 4 }
				}
			}
		})

		const table = buildTableDataByChain({ prevDayDataByChain, chainsList: ['All Chains'] })
		expect(table).toMatchObject({
			'All Chains': {
				tokensTableData: [
					{ symbol: 'USDC', token: 'ethereum:usdc', deposited: 10, withdrawn: 0, volume: 10 },
					{ symbol: 'USDC', token: 'base:alternate', deposited: 4, withdrawn: 0, volume: 4 }
				],
				tokenDeposits: {
					peers: [
						{ name: 'USDC · ethereum:usdc', value: 10 },
						{ name: 'USDC · base:alternate', value: 4 }
					]
				},
				addressesTableData: [
					{ address: 'Ethereum:0x1', deposited: 5, withdrawn: 0, txs: 3 },
					{ address: 'Base:0x1', deposited: 5, withdrawn: 0, txs: 4 },
					{ address: 'Base:other', deposited: 4, withdrawn: 0, txs: 5 }
				]
			}
		})
	})

	test('rejects conflicting nonempty symbols for the same producer identity', () => {
		const stats = (symbol: string): BridgeDayStats => ({
			date: 1,
			...REQUIRED_DAY_TOTALS,
			totalTokensDeposited: { token: { symbol, usdValue: 1 } },
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		})

		expect(() =>
			buildPrevDayDataByChain({
				statsOnPrevDay: [
					{ chain: 'Ethereum', stats: stats('USDC') },
					{ chain: 'Ethereum', stats: stats('USDT') }
				],
				destinationChain: 'false'
			})
		).toThrow('Conflicting symbols for bridge token token')
	})
})
