import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchPoolDetailCached, fetchPoolHistoryCached, buildPoolVerifiedProps } = vi.hoisted(() => ({
	fetchPoolDetailCached: vi.fn(),
	fetchPoolHistoryCached: vi.fn(),
	buildPoolVerifiedProps: vi.fn()
}))

vi.mock('~/containers/Yields/poolDetail/fetch', () => ({
	isNotFoundError: () => false
}))
vi.mock('~/containers/Yields/poolDetail/fetch.server', () => ({
	fetchPoolDetailCached,
	fetchPoolHistoryCached
}))
vi.mock('~/containers/Yields/poolDetail/verifiedProps', () => ({
	buildPoolVerifiedProps
}))

import { handler } from '~/pages/api/private/yields/pool/[id]'

beforeEach(() => {
	vi.clearAllMocks()
	fetchPoolDetailCached.mockResolvedValue({
		verified: { apy: { avg_1d: 2.5 } },
		available_history: { supply: true, borrow: false }
	})
	buildPoolVerifiedProps.mockReturnValue({ verified: { apy: { avg_1d: 2.5 } } })
})

describe('/api/private/yields/pool/[id]', () => {
	test('fetches max history once and slices a narrower requested range locally', async () => {
		const history = Array.from({ length: 120 }, (_, index) => ({ date: String(index) }))
		fetchPoolHistoryCached.mockResolvedValue(history)
		const res = createMockNextApiResponse()

		await handler({ query: { id: 'pool-id', range: '30d' } } as never, res as never)

		expect(fetchPoolDetailCached).toHaveBeenCalledWith('pool-id', true)
		expect(fetchPoolHistoryCached).toHaveBeenCalledOnce()
		expect(fetchPoolHistoryCached).toHaveBeenCalledWith('pool-id', 'max', true)
		expect(buildPoolVerifiedProps).toHaveBeenCalledWith({
			pool: expect.anything(),
			history: history.slice(-30),
			fullHistory: history,
			sourceVerified: null,
			sourceHistory: null
		})
	})

	test("hands the intrinsic source pool's verified block to the builder", async () => {
		const sourceVerified = { apy: { avg_1d: 3.1 } }
		fetchPoolDetailCached.mockImplementation(async (id: string) =>
			id === 'source-id'
				? { verified: sourceVerified }
				: {
						verified: { apy: { avg_1d: 2.5 } },
						intrinsic: { source_pool: { id: 'source-id' } },
						available_history: { supply: false, borrow: false }
					}
		)
		const res = createMockNextApiResponse()

		await handler({ query: { id: 'pool-id' } } as never, res as never)

		expect(fetchPoolDetailCached).toHaveBeenCalledWith('source-id', true)
		expect(buildPoolVerifiedProps).toHaveBeenCalledWith(expect.objectContaining({ sourceVerified }))
	})

	test("hands the source pool's measured history to the builder", async () => {
		const sourceHistory = [{ date: '2026-01-01' }]
		fetchPoolDetailCached.mockImplementation(async (id: string) =>
			id === 'source-id'
				? { verified: { apy: { avg_1d: 3.1 } } }
				: {
						verified: { apy: { avg_1d: 2.5 } },
						intrinsic: { source_pool: { id: 'source-id' } },
						available_history: { supply: false, borrow: false }
					}
		)
		fetchPoolHistoryCached.mockResolvedValue(sourceHistory)
		const res = createMockNextApiResponse()

		await handler({ query: { id: 'pool-id', range: '30d' } } as never, res as never)

		// Always max: the band rebases to whatever deposit day the reader picks.
		expect(fetchPoolHistoryCached).toHaveBeenCalledWith('source-id', 'max', true)
		expect(buildPoolVerifiedProps).toHaveBeenCalledWith(expect.objectContaining({ sourceHistory }))
	})

	test('survives a source pool whose history cannot be fetched', async () => {
		fetchPoolDetailCached.mockImplementation(async (id: string) =>
			id === 'source-id'
				? { verified: { apy: { avg_1d: 3.1 } } }
				: {
						verified: { apy: { avg_1d: 2.5 } },
						intrinsic: { source_pool: { id: 'source-id' } },
						available_history: { supply: false, borrow: false }
					}
		)
		fetchPoolHistoryCached.mockRejectedValue(new Error('upstream down'))
		const res = createMockNextApiResponse()

		await handler({ query: { id: 'pool-id' } } as never, res as never)

		// The asset band is optional; losing it must not cost the reader the whole measured page.
		expect(buildPoolVerifiedProps).toHaveBeenCalledWith(expect.objectContaining({ sourceHistory: null }))
	})
})
