import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from '~/utils/async'
import { fetchBridgeDayStats, fetchBridgeLargeTransactions, fetchBridges, fetchBridgeVolumeByChain } from '../api'
import type { RawBridgeDayStats, RawBridgesWithChainsResponse } from '../api.types'
import {
	buildTableDataByChain,
	buildVolumeDataByChain,
	getBridgeChainNetInflows,
	getBridgeOverviewPageData
} from '../queries.server'

vi.mock('~/utils/async', () => ({
	fetchJson: vi.fn()
}))

vi.mock('../api', () => ({
	fetchBridgeDayStats: vi.fn(),
	fetchBridgeLargeTransactions: vi.fn(),
	fetchBridges: vi.fn(),
	fetchBridgeVolumeByChain: vi.fn()
}))

vi.mock('~/utils/metadata', () => ({
	default: { chainMetadata: {} }
}))

beforeEach(() => {
	vi.mocked(fetchJson).mockReset()
	vi.mocked(fetchBridgeDayStats).mockReset()
	vi.mocked(fetchBridgeLargeTransactions).mockReset()
	vi.mocked(fetchBridges).mockReset()
	vi.mocked(fetchBridgeVolumeByChain).mockReset()
})

describe('getBridgeChainNetInflows', () => {
	it('returns the latest chain deposit value without fetching bridge overview data', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { XDC: ['xdc-network'] } })
		vi.mocked(fetchBridgeVolumeByChain).mockResolvedValue([
			{ date: '2026-04-27', depositUSD: 12, withdrawUSD: 3, depositTxs: 1, withdrawTxs: 1 },
			{ date: '2026-04-28', depositUSD: 42, withdrawUSD: 5, depositTxs: 2, withdrawTxs: 1 }
		])

		await expect(getBridgeChainNetInflows('XDC', Date.parse('2026-04-28T12:00:00Z'))).resolves.toEqual({
			netInflows: 42
		})
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledOnce()
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledWith('XDC')
	})

	it('keeps zero net inflows hidden', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { XDC: ['xdc-network'] } })
		vi.mocked(fetchBridgeVolumeByChain).mockResolvedValue([
			{ date: '2026-04-28', depositUSD: 0, withdrawUSD: 5, depositTxs: 2, withdrawTxs: 1 }
		])

		await expect(getBridgeChainNetInflows('XDC', Date.parse('2026-04-28T12:00:00Z'))).resolves.toBeNull()
	})

	it('does not add another retry layer when a bridge request fails', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { XDC: ['xdc-network'] } })
		vi.mocked(fetchBridgeVolumeByChain).mockRejectedValue(new Error('bridge request failed'))

		await expect(getBridgeChainNetInflows('XDC')).rejects.toThrow('bridge volume for chain XDC is broken')
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledOnce()
	})
})

describe('getBridgeOverviewPageData', () => {
	it('fetches per-bridge volume only for bridges that support the selected chain', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ chainCoingeckoIds: { Base: ['base'] } })
		const bridgesResponse: RawBridgesWithChainsResponse = {
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
			chains: [{ name: 'Base', volumePrevDay: 0, lastDailyVolume: 0 }]
		}
		vi.mocked(fetchBridges).mockResolvedValue(bridgesResponse)
		vi.mocked(fetchBridgeVolumeByChain).mockResolvedValue([])
		vi.mocked(fetchBridgeDayStats).mockResolvedValue({})
		vi.mocked(fetchBridgeLargeTransactions).mockResolvedValue([])

		const result = await getBridgeOverviewPageData('Base')

		expect(fetchBridgeVolumeByChain).toHaveBeenCalledTimes(2)
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledWith('Base', 1)
		expect(fetchBridgeVolumeByChain).toHaveBeenCalledWith('Base')
		expect(fetchBridgeVolumeByChain).not.toHaveBeenCalledWith('Base', 2)
		expect(result.bridgeNames).toEqual(['Base Bridge'])
	})
})

describe('buildVolumeDataByChain', () => {
	it('falls back to tracked chain volume when the destination-chain series is empty', () => {
		const result = buildVolumeDataByChain({
			volume: [[{ date: '1783382400', depositUSD: 100, withdrawUSD: 20, depositTxs: 2, withdrawTxs: 1 }], []],
			chains: ['Ethereum', 'Robinhood Chain'],
			destinationChain: 'Robinhood Chain'
		})

		expect(result['All Chains']).toEqual([{ date: 1783382400, Deposited: 100, Withdrawn: -20 }])
	})
})

describe('buildTableDataByChain token series', () => {
	it('aggregates contract rows by selectable token symbol on an individual chain', () => {
		const ethereum: RawBridgeDayStats = {
			date: 1,
			totalTokensDeposited: {
				first: { symbol: 'USDC', usdValue: 7, amount: '7', decimals: 6 },
				second: { symbol: 'USDC', usdValue: 5, amount: '5', decimals: 6 },
				third: { symbol: 'ETH', usdValue: 3, amount: '3', decimals: 18 }
			},
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		}

		const result = buildTableDataByChain({ prevDayDataByChain: { Ethereum: ethereum }, chainsList: ['Ethereum'] })

		expect(result.Ethereum.tokenDeposits.peers).toEqual([
			{ name: 'USDC', value: 12 },
			{ name: 'ETH', value: 3 }
		])
	})
})
