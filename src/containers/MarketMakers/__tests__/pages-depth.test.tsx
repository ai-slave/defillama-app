import { afterEach, describe, expect, it, vi } from 'vitest'

const forgdFetch = vi.fn()
vi.mock('~/containers/MarketMakers/server/client', () => ({ forgdFetch: (...a: unknown[]) => forgdFetch(...a) }))

import { getStaticProps } from '~/pages/market-makers/depth'

afterEach(() => forgdFetch.mockReset())

describe('depth page getStaticProps', () => {
	it('returns the bucketed payload untransformed', async () => {
		forgdFetch.mockResolvedValue({
			depth50: [],
			depth100: [],
			depth200: [
				{
					marketMakerId: 'amber',
					marketMakerName: 'Amber',
					marketMakerImageUrl: null,
					rank: { value: 1, percentile: 100 }
				}
			]
		})
		const res = (await (getStaticProps as any)({})) as { props: { payload: { depth200: unknown[] } } }
		expect(res.props.payload.depth200).toHaveLength(1)
	})
})
