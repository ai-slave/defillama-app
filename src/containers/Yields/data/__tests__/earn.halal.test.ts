import { describe, expect, test } from 'vitest'
import { installYieldsFixtures } from '~/utils/test/yieldsSnapshotFixture'
import { ATTRIBUTES, earnPage, pool } from './earnSnapshot'

installYieldsFixtures()

// The fixture meta whitelists `uniswap-v2` and `lido` as halal; `aave-v3` is not on it.
describe('getEarnPage halal filter', () => {
	test('keeps only whitelisted-protocol rows when halal=true', async () => {
		const result = await earnPage(
			{
				earn: [
					pool('a', { protocol: 'uniswap-v2' }),
					pool('b', { protocol: 'aave-v3' }),
					pool('c', { protocol: 'lido' }),
					pool('d', { protocol: 'unknown' }),
					pool('e', { protocol: 'compound-v3' })
				]
			},
			{ halal: 'true', pageSize: 'all' }
		)
		expect(result.rows.map((r) => r.projectslug).sort()).toEqual(['lido', 'uniswap-v2'])
	})

	test('does not filter by whitelist when halal is absent', async () => {
		const result = await earnPage(
			{
				earn: [
					pool('a', { protocol: 'uniswap-v2' }),
					pool('b', { protocol: 'aave-v3' }),
					pool('c', { protocol: 'unknown' })
				]
			},
			{ pageSize: 'all' }
		)
		expect(result.rows.map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
	})

	test('composes with other filters (halal ∩ stablecoin)', async () => {
		const stable = { ...ATTRIBUTES, stablecoin_only: true }
		const result = await earnPage(
			{
				earn: [
					pool('halal-stable', { protocol: 'uniswap-v2', attributes: stable }),
					pool('halal-nonstable', { protocol: 'lido' }),
					pool('nonhalal-stable', { protocol: 'aave-v3', attributes: stable })
				]
			},
			{ halal: 'true', stablecoin: 'true', pageSize: 'all' }
		)
		expect(result.rows.map((r) => r.id)).toEqual(['halal-stable'])
	})

	test('does not classify unknown attributes as explicit false values', async () => {
		const result = await earnPage(
			{
				earn: [
					pool('safe'),
					pool('unknown', {
						attributes: { stablecoin_only: null, single_asset_exposure: null, impermanent_loss_risk: null }
					}),
					pool('risky', { attributes: { ...ATTRIBUTES, impermanent_loss_risk: true } })
				]
			},
			{ noIlRisk: 'true', pageSize: 'all' }
		)
		expect(result.rows.map((item) => item.id)).toEqual(['safe'])
	})
})
