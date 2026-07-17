import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readJson: vi.fn() }))

vi.mock('~/server/datasetSnapshots/reader.server', () => ({
	datasetSnapshotReader: { readJson: mocks.readJson }
}))

beforeEach(() => {
	vi.clearAllMocks()
})

describe('markets dataset snapshot', () => {
	it('resolves retired CEX Markets slugs to canonical exchange profiles', async () => {
		mocks.readJson.mockResolvedValue({
			'crypto-com': { exchange: 'crypto-com', defillama_slug: 'Crypto.com' }
		})

		const { resolveExchangeByDefillamaCexSlug } = await import('~/containers/Markets/server/dataset.server')

		await expect(resolveExchangeByDefillamaCexSlug('Crypto-com')).resolves.toEqual({
			exchange: 'crypto-com',
			defillama_slug: 'Crypto.com'
		})
		expect(mocks.readJson).toHaveBeenCalledWith('markets', 'cex-by-defillama-slug.json')
	})
})
