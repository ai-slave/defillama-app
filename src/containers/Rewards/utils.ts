import type { RewardLifecycle, RewardProgram, RewardsFilters, RewardType } from './types'

export function getRewardsView(programs: Array<RewardProgram>, filters: RewardsFilters) {
	const rows: Array<RewardProgram> = []
	const lifecycleCounts: Record<RewardLifecycle | 'All', number> = {
		All: 0,
		Live: 0,
		Upcoming: 0,
		'Season Gap': 0,
		Ended: 0,
		Unknown: 0
	}
	const rewardCounts: Record<RewardType, number> = {
		Points: 0,
		Commission: 0,
		'Fee Discount': 0,
		Airdrop: 0,
		Cashback: 0,
		'Prize Pool': 0,
		'Trading Rewards': 0,
		Rebate: 0,
		'Signup Bonus': 0
	}
	// Which chips exist tracks the whole dataset, not the current facet, so the
	// toolbar cannot reflow under the cursor while someone is clicking through it.
	const availableLifecycles = new Set<RewardLifecycle>()
	const availableRewardTypes = new Set<RewardType>()
	let unverified = 0
	const search = filters.search.trim().toLowerCase()
	for (const program of programs) {
		availableLifecycles.add(program.lifecycle)
		for (const type of program.rewardTypes) availableRewardTypes.add(type)
		if (
			search &&
			!program.protocol.toLowerCase().includes(search) &&
			!program.programName?.toLowerCase().includes(search)
		)
			continue
		const matchesLifecycle = filters.lifecycle === 'All' || program.lifecycle === filters.lifecycle
		const matchesReward =
			filters.rewardTypes.length === 0 || filters.rewardTypes.some((type) => program.rewardTypes.includes(type))
		const matchesVerification = !filters.hideUnverified || program.verification === 'Verified'
		// Each facet ignores its own selection so alternatives remain discoverable.
		if (matchesVerification && matchesReward) {
			lifecycleCounts.All++
			lifecycleCounts[program.lifecycle]++
		}
		if (matchesLifecycle && matchesVerification) {
			for (const type of program.rewardTypes) rewardCounts[type]++
		}
		if (matchesLifecycle && matchesReward) {
			if (program.verification === 'Unverified') unverified++
			if (matchesVerification) rows.push(program)
		}
	}
	return { rows, lifecycleCounts, rewardCounts, unverified, availableLifecycles, availableRewardTypes }
}
