import { describe, expect, test } from 'vitest'
import { earnRow } from '~/utils/test/yieldsEarnFixture'
import { installYieldsFixtures, yieldsSnapshot } from '~/utils/test/yieldsSnapshotFixture'
import { fetchProYieldsDataset } from './yieldsDataset'

installYieldsFixtures()

const snapshot = () =>
	yieldsSnapshot({
		earn: [
			earnRow('pool-eth', 100),
			{
				...earnRow('pool-base', 200),
				chain: 'Base',
				apy: {
					current: { base: 2, reward: 3, total: 5 },
					avg_7d: { base: null, reward: null, total: null },
					avg_30d: { base: null, reward: null, total: 4 }
				},
				reward_tokens: [{ symbol: 'OP' } as never],
				attributes: { stablecoin_only: true, single_asset_exposure: true, impermanent_loss_risk: false }
			}
		]
	})

describe('fetchProYieldsDataset', () => {
	test('treats All as the unfiltered dataset, largest TVL first', async () => {
		const rows = await fetchProYieldsDataset(snapshot(), ['All'])
		expect(rows.map((row) => row.configID)).toEqual(['pool-base', 'pool-eth'])
	})

	test('applies specific chain filters and resolves base plus reward APY', async () => {
		const rows = await fetchProYieldsDataset(snapshot(), ['Base'])
		expect(rows).toEqual([
			expect.objectContaining({
				configID: 'pool-base',
				chains: ['Base'],
				tvl: 200,
				apy: 5,
				apyBase: 2,
				apyReward: 3,
				apyMean30d: 4,
				rewardTokensSymbols: ['OP'],
				stablecoin: true
			})
		])
	})
})
