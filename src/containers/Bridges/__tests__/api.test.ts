import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from '~/utils/async'
import {
	fetchBridgeDayStats,
	fetchBridgeNetflows,
	fetchBridgeVolumeAll,
	fetchBridgeVolumeByChain,
	fetchBridgeVolumeBySlug,
	fetchRawBridgeVolumeByChain
} from '../api'

vi.mock('~/utils/async', () => ({
	fetchJson: vi.fn()
}))

describe('fetchBridgeDayStats', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
		vi.mocked(fetchJson).mockResolvedValue({
			date: 0,
			totalDepositedUSD: 0,
			totalWithdrawnUSD: 0,
			totalDepositTxs: 0,
			totalWithdrawalTxs: 0,
			totalTokensDeposited: {},
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		})
	})

	it('uses UTC midnight in the request URL', async () => {
		const timestamp = Date.parse('2026-07-19T16:42:00Z') / 1000
		const utcMidnight = Date.parse('2026-07-19T00:00:00Z') / 1000

		await fetchBridgeDayStats(timestamp, 'Base')

		expect(fetchJson).toHaveBeenCalledOnce()
		expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining(`/bridgedaystats/${utcMidnight}/Base`))
	})
})

describe('fetchBridgeNetflows', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	it('normalizes finite nonblank numeric strings once at the API boundary', async () => {
		vi.mocked(fetchJson).mockResolvedValue([
			{ chain: 'Base', net_flow: '0.0', deposited_usd: '12.5', withdrawn_usd: '12.5' }
		])

		await expect(fetchBridgeNetflows('day')).resolves.toEqual([
			{ chain: 'Base', netFlow: 0, depositedUsd: 12.5, withdrawnUsd: 12.5 }
		])
	})
})

describe('fetchBridgeVolumeByChain', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	it('normalizes valid chart arrays, including empty arrays', async () => {
		const chart = [{ date: '1784678400', depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }]
		vi.mocked(fetchJson).mockResolvedValueOnce(chart).mockResolvedValueOnce([]).mockResolvedValueOnce(chart)

		await expect(fetchBridgeVolumeByChain('Arbitrum')).resolves.toEqual([
			{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }
		])
		await expect(fetchBridgeVolumeByChain('Zkfair')).resolves.toEqual([])
		await expect(fetchRawBridgeVolumeByChain('Base')).resolves.toBe(chart)
	})
})

describe('fetchBridgeVolumeAll', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	it('normalizes a valid bridge chart array', async () => {
		const chart = [{ date: '1784678400', depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }]
		vi.mocked(fetchJson).mockResolvedValue(chart)

		await expect(fetchBridgeVolumeAll(12)).resolves.toEqual([
			{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 }
		])
	})
})

describe('fetchBridgeVolumeBySlug', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	it('normalizes every date in a valid slug response and preserves nullable legs', async () => {
		const response = {
			bridge: { id: 1, displayName: 'Across', slug: 'across', bridgeDbName: 'across' },
			dailyVolumes: [
				{ date: '1784678400', depositUSD: 10, withdrawUSD: null, depositTxs: 1, withdrawTxs: 0 },
				{ date: '1784764800', depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 }
			]
		}
		vi.mocked(fetchJson).mockResolvedValue(response)

		await expect(fetchBridgeVolumeBySlug('across')).resolves.toEqual({
			bridge: response.bridge,
			dailyVolumes: [
				{ date: 1_784_678_400, depositUSD: 10, withdrawUSD: null, depositTxs: 1, withdrawTxs: 0 },
				{ date: 1_784_764_800, depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 }
			]
		})
	})

	it('preserves zero transaction counts', async () => {
		vi.mocked(fetchJson).mockResolvedValue({
			bridge: { id: 1, displayName: 'Across', slug: 'across', bridgeDbName: 'across' },
			dailyVolumes: [{ date: '1784678400', depositUSD: 0, withdrawUSD: 0, depositTxs: 0, withdrawTxs: 0 }]
		})

		await expect(fetchBridgeVolumeBySlug('across')).resolves.toMatchObject({
			dailyVolumes: [{ date: 1_784_678_400, depositUSD: 0, withdrawUSD: 0, depositTxs: 0, withdrawTxs: 0 }]
		})
	})
})
