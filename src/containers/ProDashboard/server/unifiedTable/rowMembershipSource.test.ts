import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchDimensionDatasetMock, requestScope } = vi.hoisted(() => ({
	fetchDimensionDatasetMock: vi.fn(),
	requestScope: {
		earningsRequests: new Map(),
		metricRequests: new Map(),
		scheduleRequest: vi.fn()
	}
}))

vi.mock('~/containers/AdapterMetrics/server/datasets', () => ({
	createDimensionDatasetRequestScope: () => requestScope,
	fetchDimensionDataset: fetchDimensionDatasetMock,
	getDimensionDatasetSpec: vi.fn()
}))

import { fetchProtocolRowMembershipDataset } from './rowMembership'

describe('protocol row membership source', () => {
	beforeEach(() => {
		fetchDimensionDatasetMock.mockReset().mockResolvedValue({ status: 'complete', protocols: [] })
	})

	it('uses the canonical open-interest adapter contract for selected-chain membership', async () => {
		await fetchProtocolRowMembershipDataset(
			{ kind: 'base-metric', family: 'open-interest' },
			{ kind: 'chain', chains: ['Ethereum'] }
		)

		expect(fetchDimensionDatasetMock).toHaveBeenCalledWith(
			{
				adapterType: 'open-interest',
				route: 'open-interest',
				metricName: 'Open Interest',
				dataType: 'openInterestAtEnd',
				chains: ['Ethereum']
			},
			requestScope
		)
	})

	it('rejects a partial membership instead of publishing an incomplete table', async () => {
		fetchDimensionDatasetMock.mockResolvedValueOnce({
			status: 'partial',
			protocols: [],
			unavailableChains: ['Base']
		})

		await expect(
			fetchProtocolRowMembershipDataset(
				{ kind: 'base-metric', family: 'open-interest' },
				{ kind: 'chain', chains: ['Base'] }
			)
		).rejects.toThrow('Canonical open-interest membership is unavailable for: Base')
	})
})
