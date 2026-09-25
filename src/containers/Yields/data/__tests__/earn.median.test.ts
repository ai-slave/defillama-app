import { describe, expect, test } from 'vitest'
import { installYieldsFixtures } from '~/utils/testing/yieldsSnapshotFixture'
import { apyOf, earnPage, pool } from './earnSnapshot'

installYieldsFixtures()

const withApy = (id: string, total: number | null, chain = 'Ethereum') => pool(id, { apy: apyOf(total), chain })

describe('getEarnPage medianApy', () => {
	test('is the median of the FULL filtered set, not the returned page', async () => {
		const result = await earnPage(
			{ earn: [withApy('a', 1), withApy('b', 2), withApy('c', 3), withApy('d', 4), withApy('e', 5)] },
			{ pageSize: '2' }
		)
		expect(result.rows).toHaveLength(2)
		expect(result.medianApy).toBe(3)
	})

	test('follows the active filters', async () => {
		const result = await earnPage(
			{
				earn: [
					withApy('eth-1', 1),
					withApy('eth-2', 2),
					withApy('base-1', 10, 'Base'),
					withApy('base-2', 20, 'Base'),
					withApy('base-3', 30, 'Base')
				]
			},
			{ chain: 'Base', pageSize: 'all' }
		)
		expect(result.total).toBe(3)
		expect(result.medianApy).toBe(20)
	})

	test('averages the middle pair for an even count and skips null APYs', async () => {
		const result = await earnPage(
			{ earn: [withApy('a', 1), withApy('b', 3), withApy('c', 6), withApy('d', 10), withApy('null', null)] },
			{ pageSize: 'all' }
		)
		expect(result.total).toBe(5)
		expect(result.medianApy).toBe(4.5)
	})

	test('is null when no filtered row has an APY', async () => {
		const result = await earnPage({ earn: [withApy('a', null)] }, { pageSize: 'all' })
		expect(result.medianApy).toBeNull()
	})
})
