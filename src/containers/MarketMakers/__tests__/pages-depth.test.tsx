import { afterEach, describe, expect, test, vi } from 'vitest'

const forgdFetch = vi.fn()
vi.mock('~/containers/MarketMakers/server/client', () => ({ forgdFetch: (...a: Array<unknown>) => forgdFetch(...a) }))

import { getStaticProps } from '~/pages/market-makers/depth'

afterEach(() => forgdFetch.mockReset())

describe('depth page getStaticProps', () => {
	test('returns the bucketed payload untransformed', async () => {
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
		const res = (await (getStaticProps as any)({})) as { props: { payload: { depth200: Array<unknown> } } }
		expect(res.props.payload.depth200).toHaveLength(1)
	})
})
