import { beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireDatasetSnapshot } from '~/server/datasetSnapshots/refresh.server'

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

	it('builds all sitemap protocol chains from one snapshot read', async () => {
		mocks.readJson.mockImplementation(async (file: string) => {
			if (file === 'raw/protocols.json') return { protocols: ['aave', 'compound'] }
			return {
				timestamp: 1,
				data: {
					aave: { ethereum: [], arbitrum: [] },
					compound: { base: [] }
				}
			}
		})
		const { getLiquidationsSitemapProtocolChains } = await import('~/containers/LiquidationsV2/server/dataset.server')

		await expect(getLiquidationsSitemapProtocolChains()).resolves.toEqual([
			{ protocolId: 'aave', chainIds: ['ethereum', 'arbitrum'] },
			{ protocolId: 'compound', chainIds: ['base'] }
		])
		expect(acquireDatasetSnapshot).toHaveBeenCalledTimes(1)
		expect(mocks.readJson).toHaveBeenCalledTimes(2)
	})
})
