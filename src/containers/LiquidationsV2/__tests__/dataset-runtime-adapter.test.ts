import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readJson: vi.fn() }))

vi.mock('~/server/datasetSnapshots/refresh.server', () => ({
	acquireDatasetSnapshot: vi.fn().mockResolvedValue({ handle: { readJson: mocks.readJson } })
}))

beforeEach(() => {
	vi.clearAllMocks()
})

describe('liquidations dataset snapshot', () => {
	it('reads protocol chain ids from the all-liquidations snapshot', async () => {
		mocks.readJson.mockResolvedValue({
			timestamp: 1,
			data: {
				aave: {
					ethereum: [],
					arbitrum: []
				}
			}
		})

		const { getLiquidationsProtocolChainIds } = await import('~/containers/LiquidationsV2/server/dataset.server')

		await expect(getLiquidationsProtocolChainIds('aave')).resolves.toEqual(['ethereum', 'arbitrum'])
		expect(mocks.readJson).toHaveBeenCalledWith('raw/all.json')
	})
})
