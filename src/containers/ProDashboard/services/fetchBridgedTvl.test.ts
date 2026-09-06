import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchJson } from '~/utils/async'
import { fetchProDashboardBridgedTvl } from './fetchBridgedTvl'

vi.mock('~/utils/async', () => ({ fetchJson: vi.fn() }))

describe('fetchProDashboardBridgedTvl', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	test('uses the app route that keeps the Pro API key server-side', async () => {
		vi.mocked(fetchJson).mockResolvedValue([{ timestamp: 1_700_000_000, data: { total: 42 } }])

		await expect(fetchProDashboardBridgedTvl('OP Mainnet')).resolves.toEqual([[1_700_000_000, 42]])
		expect(fetchJson).toHaveBeenCalledWith('/api/public/chains/charts?kind=bridged-tvl&chain=OP+Mainnet')
	})

	test('preserves a confirmed empty chart', async () => {
		vi.mocked(fetchJson).mockResolvedValue([])

		await expect(fetchProDashboardBridgedTvl('Base')).resolves.toEqual([])
	})

	test('propagates an unavailable upstream response instead of caching a fake empty chart', async () => {
		vi.mocked(fetchJson).mockRejectedValue(new Error('Bridged TVL chart is unavailable upstream'))

		await expect(fetchProDashboardBridgedTvl('Base')).rejects.toThrow('Bridged TVL chart is unavailable upstream')
	})
})
