import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEntityEarn, getEntityMarkets } from '~/containers/Yields/data/enrich.server'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import { fetchProYieldsDataset } from './yieldsDataset'

vi.mock('~/containers/Yields/data/enrich.server', () => ({
	getEntityEarn: vi.fn(),
	getEntityMarkets: vi.fn()
}))
vi.mock('~/containers/Yields/data/apy', () => ({
	resolveApy: () => ({ total: 1, base: 1, reward: 0 }),
	resolveVariant: () => 1,
	stabilityRatingFromScore: () => 'A'
}))

const earnRow = (chain: string) => ({
	id: `pool-${chain}`,
	chain,
	protocol: 'Protocol',
	protocolSlug: 'protocol',
	display: { label: 'USDC', detail: null },
	category: 'Lending',
	tvl_usd: 100,
	apy: { current: { base: 1, reward: 0, total: 1 }, avg_30d: { base: 1, reward: 0, total: 1 } },
	intrinsic: {},
	stability_30d: {},
	reward_tokens: [],
	underlying_tokens: [],
	pool_token: null,
	reference_asset_symbol: null,
	volume_1d_usd: 0,
	attributes: { stablecoin_only: true, impermanent_loss_risk: false }
})

describe('fetchProYieldsDataset', () => {
	beforeEach(() => {
		vi.mocked(getEntityEarn).mockResolvedValue([earnRow('Ethereum'), earnRow('Base')] as any)
		vi.mocked(getEntityMarkets).mockResolvedValue([])
	})

	it('treats All as the unfiltered dataset', async () => {
		const rows = await fetchProYieldsDataset({} as YieldsSnapshot, ['All'])
		expect(rows.map((row) => row.configID)).toEqual(['pool-Ethereum', 'pool-Base'])
	})

	it('still applies specific chain filters', async () => {
		const rows = await fetchProYieldsDataset({} as YieldsSnapshot, ['Base'])
		expect(rows.map((row) => row.configID)).toEqual(['pool-Base'])
	})
})
