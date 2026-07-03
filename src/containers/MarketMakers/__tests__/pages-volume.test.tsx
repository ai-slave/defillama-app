import { afterEach, describe, expect, it, vi } from 'vitest'

const forgdFetch = vi.fn()
vi.mock('~/containers/MarketMakers/server/client', () => ({ forgdFetch: (...a: unknown[]) => forgdFetch(...a) }))

import { getStaticProps } from '~/pages/market-makers/volume'

afterEach(() => forgdFetch.mockReset())

describe('volume page getStaticProps', () => {
	it('returns rows keyed by market maker', async () => {
		forgdFetch.mockResolvedValue([
			{
				marketMakerId: 'lhava',
				marketMakerName: 'Lhava',
				marketMakerImageUrl: null,
				rank: { value: 1, percentile: 100 },
				orderFillVolumeTotal: { value: 1744638, percentile: 100, rank: 1 }
			}
		])
		const res = (await (getStaticProps as any)({})) as { props: { rows: Array<{ marketMakerId: string }> } }
		expect(res.props.rows[0].marketMakerId).toBe('lhava')
	})
})
