import { describe, expect, test } from 'vitest'
import { getProtocolTvlStrike } from '../tvlStrike'
import type { IProtocol } from '../types'

const entry = { tvl: 1, tvlPrevDay: 1, tvlPrevWeek: 1, tvlPrevMonth: 1 }

function row(overrides: Partial<IProtocol>): IProtocol {
	return {
		id: 'p',
		name: 'Protocol',
		slug: 'p',
		chains: ['Ethereum'],
		category: 'Lending',
		tvl: { default: entry },
		tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
		mcap: null,
		tokenPrice: null,
		mcaptvl: null,
		strikeTvl: true,
		...overrides
	} as IProtocol
}

const bothOff = { doublecounted: false, liquidstaking: false }
const bothOn = { doublecounted: true, liquidstaking: true }

describe('getProtocolTvlStrike', () => {
	test('shows nothing when the row was never struck', () => {
		expect(getProtocolTvlStrike(row({ strikeTvl: false }), bothOff)).toEqual({ struck: false, text: null })
	})

	test('clears the strike entirely when every subtracted section is toggled back in', () => {
		const doubleCounted = row({ tvl: { default: entry, doublecounted: entry } })
		const liquidStaking = row({ tvl: { default: entry, liquidstaking: entry } })
		const both = row({ tvl: { default: entry, doublecounted: entry, liquidstaking: entry } })

		expect(getProtocolTvlStrike(doubleCounted, bothOn)).toEqual({ struck: false, text: null })
		expect(getProtocolTvlStrike(liquidStaking, bothOn)).toEqual({ struck: false, text: null })
		expect(getProtocolTvlStrike(both, bothOn)).toEqual({ struck: false, text: null })
	})

	test('names the specific toggle that is off', () => {
		const doubleCounted = row({ tvl: { default: entry, doublecounted: entry } })
		const liquidStaking = row({ tvl: { default: entry, liquidstaking: entry } })

		expect(getProtocolTvlStrike(doubleCounted, { doublecounted: false, liquidstaking: true }).text).toMatch(
			/"Double Count" toggle is off/
		)
		expect(getProtocolTvlStrike(liquidStaking, { doublecounted: true, liquidstaking: false }).text).toMatch(
			/"Liquid Staking" toggle is off/
		)
	})

	test('keeps the strike when only the OTHER section is toggled in', () => {
		const both = row({ tvl: { default: entry, doublecounted: entry, liquidstaking: entry } })
		const dcOnlyOn = getProtocolTvlStrike(both, { doublecounted: true, liquidstaking: false })

		expect(dcOnlyOn.struck).toBe(true)
		expect(dcOnlyOn.text).toMatch(/"Liquid Staking" toggle is off/)
		expect(getProtocolTvlStrike(both, bothOff).text).toMatch(/both "Liquid Staking" and "Double Count"/)
	})

	test('always strikes removed categories, regardless of toggles', () => {
		const cex = row({ category: 'CEX', tvl: { default: entry } })
		const result = getProtocolTvlStrike(cex, bothOn)

		expect(result.struck).toBe(true)
		expect(result.text).toBe('CEX protocols are not counted into Chain TVL')
	})

	test("derives a parent's strike from its children and clears it with the toggles", () => {
		const struckChild = row({ id: 'child', tvl: { default: entry, doublecounted: entry } })
		const parent = row({ tvl: { default: entry }, childProtocols: [struckChild] })

		expect(getProtocolTvlStrike(parent, bothOff)).toEqual({
			struck: true,
			text: 'Some sub-protocols are excluded from chain tvl'
		})
		expect(getProtocolTvlStrike(parent, bothOn)).toEqual({ struck: false, text: null })
	})

	test('keeps the white-labeled vault message while the strike is active', () => {
		const veda = row({ name: 'Veda', tvl: { default: entry, doublecounted: entry } })

		expect(getProtocolTvlStrike(veda, bothOff).text).toMatch(/white-labeled vaults/)
		expect(getProtocolTvlStrike(veda, bothOn)).toEqual({ struck: false, text: null })
	})
})
