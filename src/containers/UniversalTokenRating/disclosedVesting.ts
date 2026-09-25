import type { UtrDisclosedTokenomicsGroup } from './types'

function clampPct(value: number): number {
	return Math.max(0, Math.min(100, value))
}

function unlockedShareOfGroup(group: UtrDisclosedTokenomicsGroup, month: number): number {
	const tge = clampPct(group.tgeUnlockPct)
	if (month < group.lockUpDurationMonths) return tge
	if (group.unlockDurationMonths <= 0) return 100
	const cliff = Math.min(clampPct(group.cliffUnlockPct), 100 - tge)
	const linearProgress = Math.min(1, (month - group.lockUpDurationMonths) / group.unlockDurationMonths)
	return tge + cliff + (100 - tge - cliff) * linearProgress
}

export function uniqueGroupLabels(groups: Array<UtrDisclosedTokenomicsGroup>): Array<string> {
	const seen = new Map<string, number>()
	return groups.map((group) => {
		const occurrence = (seen.get(group.groupName) ?? 0) + 1
		seen.set(group.groupName, occurrence)
		return occurrence === 1 ? group.groupName : `${group.groupName} (${occurrence})`
	})
}

export function disclosedVestingDurationMonths(groups: Array<UtrDisclosedTokenomicsGroup>): number | null {
	if (groups.length === 0) return null
	return Math.max(...groups.map((group) => group.lockUpDurationMonths + group.unlockDurationMonths))
}

export function disclosedVestingSchedule(groups: Array<UtrDisclosedTokenomicsGroup>): {
	months: Array<number>
	series: Array<{ name: string; data: Array<number> }>
} {
	const duration = disclosedVestingDurationMonths(groups) ?? 0
	const months = Array.from({ length: Math.ceil(duration) + 1 }, (_, month) => month)
	const labels = uniqueGroupLabels(groups)
	return {
		months,
		series: groups.map((group, index) => ({
			name: labels[index],
			data: months.map((month) => (group.allocationPct * unlockedShareOfGroup(group, month)) / 100)
		}))
	}
}
