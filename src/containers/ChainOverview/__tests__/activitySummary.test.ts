import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchAdapterProtocolMetrics: vi.fn(),
	fetchAdapterChainMetrics: vi.fn(),
	fetchCexVolume: vi.fn()
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterProtocolMetrics: mocks.fetchAdapterProtocolMetrics,
	fetchAdapterChainMetrics: mocks.fetchAdapterChainMetrics,
	fetchCexVolume: mocks.fetchCexVolume
}))

import { fetchChainActivityProtocolMetricTotal } from '../queries.server'

describe('fetchChainActivityProtocolMetricTotal', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('fetches active address totals from the protocol-backed chain activity endpoint', async () => {
		mocks.fetchAdapterProtocolMetrics.mockResolvedValue({ total24h: 123 })

		await expect(
			fetchChainActivityProtocolMetricTotal({ chain: 'Ethereum', adapterType: 'active-users' })
		).resolves.toBe(123)

		expect(mocks.fetchAdapterProtocolMetrics).toHaveBeenCalledWith({
			protocol: 'Ethereum',
			adapterType: 'active-users'
		})
		expect(mocks.fetchAdapterChainMetrics).not.toHaveBeenCalled()
	})

	it('fetches transaction totals from the protocol-backed chain activity endpoint', async () => {
		mocks.fetchAdapterProtocolMetrics.mockResolvedValue({ total24h: 456 })

		await expect(
			fetchChainActivityProtocolMetricTotal({
				chain: 'Ethereum',
				adapterType: 'active-users',
				dataType: 'dailyTransactionsCount'
			})
		).resolves.toBe(456)

		expect(mocks.fetchAdapterProtocolMetrics).toHaveBeenCalledWith({
			protocol: 'Ethereum',
			adapterType: 'active-users',
			dataType: 'dailyTransactionsCount'
		})
		expect(mocks.fetchAdapterChainMetrics).not.toHaveBeenCalled()
	})

	it('fetches new address totals from the protocol-backed chain activity endpoint', async () => {
		mocks.fetchAdapterProtocolMetrics.mockResolvedValue({ total24h: 789 })

		await expect(fetchChainActivityProtocolMetricTotal({ chain: 'Ethereum', adapterType: 'new-users' })).resolves.toBe(
			789
		)

		expect(mocks.fetchAdapterProtocolMetrics).toHaveBeenCalledWith({
			protocol: 'Ethereum',
			adapterType: 'new-users'
		})
		expect(mocks.fetchAdapterChainMetrics).not.toHaveBeenCalled()
	})
})
