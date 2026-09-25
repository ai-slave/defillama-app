import { describe, expect, test } from 'vitest'
import { disclosedVestingDurationMonths, disclosedVestingSchedule } from '../disclosedVesting'
import type { UtrDisclosedTokenomicsGroup } from '../types'

function group(overrides: Partial<UtrDisclosedTokenomicsGroup>): UtrDisclosedTokenomicsGroup {
	return {
		groupName: 'Team',
		allocationPct: 20,
		groupCategory: 'Founders & Team',
		tgeUnlockPct: 0,
		lockUpDurationMonths: 0,
		cliffUnlockPct: 0,
		unlockDurationMonths: 0,
		unlockFrequency: 'Monthly',
		...overrides
	}
}

describe('disclosed vesting schedule', () => {
	test('unlocks TGE share, then the cliff after lock-up, then the rest linearly', () => {
		const team = group({ tgeUnlockPct: 10, lockUpDurationMonths: 12, cliffUnlockPct: 20, unlockDurationMonths: 10 })
		const { months, series } = disclosedVestingSchedule([team])

		expect(months).toHaveLength(23)
		expect(series[0].data[0]).toBeCloseTo(2)
		expect(series[0].data[11]).toBeCloseTo(2)
		expect(series[0].data[12]).toBeCloseTo(6)
		expect(series[0].data[17]).toBeCloseTo(13)
		expect(series[0].data[22]).toBeCloseTo(20)
	})

	test('never unlocks more than the group allocation when TGE and cliff exceed 100%', () => {
		const seed = group({ allocationPct: 7, tgeUnlockPct: 30, lockUpDurationMonths: 12, cliffUnlockPct: 100 })
		const { series } = disclosedVestingSchedule([seed])

		expect(series[0].data[0]).toBeCloseTo(2.1)
		expect(Math.max(...series[0].data)).toBeCloseTo(7)
	})

	test('uses the longest lock-up plus unlock duration and keeps duplicate group names apart', () => {
		const groups = [
			group({ lockUpDurationMonths: 12, unlockDurationMonths: 24 }),
			group({ tgeUnlockPct: 100 }),
			group({ lockUpDurationMonths: 6, unlockDurationMonths: 6 })
		]

		expect(disclosedVestingDurationMonths(groups)).toBe(36)
		expect(disclosedVestingDurationMonths([])).toBeNull()
		expect(disclosedVestingSchedule(groups).series.map((entry) => entry.name)).toEqual(['Team', 'Team (2)', 'Team (3)'])
	})
})
