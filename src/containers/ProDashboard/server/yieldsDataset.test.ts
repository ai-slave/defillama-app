import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEntityEarn, getEntityMarkets } from '~/containers/Yields/data/enrich.server'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { EntityEarnRow } from '~/containers/Yields/data/types'
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

const earnRow = (chain: string): EntityEarnRow => ({
	id: `pool-${chain}`,
	pool_key: `pool-${chain}`,
	chain,
	protocol: 'Protocol',
	protocolSlug: 'protocol',
	chainSlug: chain.toLowerCase(),
	isEvm: true,
	display: { label: 'USDC', detail: null },
	category: 'Lending',
	hasAudit: false,
	protocolHasToken: false,
	tvl_usd: 100,
	apy: {
		current: { base: 1, reward: 0, total: 1 },
		avg_7d: { base: 1, reward: 0, total: 1 },
		avg_30d: { base: 1, reward: 0, total: 1 }
	},
	intrinsic: null,
	stability_30d: { base: null, base_reward: null, base_intrinsic: null, base_reward_intrinsic: null },
	reward_tokens: [],
	underlying_tokens: [],
	pool_token: null,
	reference_asset_symbol: null,
	url: null,
	holders: { count: null, avg_position_usd: null, top_10_share_pct: null },
	price_per_share: null,
	volume_1d_usd: 0,
	available_supply_usd: null,
	attributes: { stablecoin_only: true, single_asset_exposure: true, impermanent_loss_risk: false }
})

const snapshot: YieldsSnapshot = { generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() }

describe('fetchProYieldsDataset', () => {
	beforeEach(() => {
		vi.mocked(getEntityEarn).mockResolvedValue([earnRow('Ethereum'), earnRow('Base')])
		vi.mocked(getEntityMarkets).mockResolvedValue([])
	})

	it('treats All as the unfiltered dataset', async () => {
		const rows = await fetchProYieldsDataset(snapshot, ['All'])
		expect(rows.map((row) => row.configID)).toEqual(['pool-Ethereum', 'pool-Base'])
	})

	it('still applies specific chain filters', async () => {
		const rows = await fetchProYieldsDataset(snapshot, ['Base'])
		expect(rows.map((row) => row.configID)).toEqual(['pool-Base'])
	})
})
