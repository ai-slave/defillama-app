export const REWARD_TYPES = [
	'Points',
	'Commission',
	'Fee Discount',
	'Airdrop',
	'Cashback',
	'Prize Pool',
	'Trading Rewards',
	'Rebate',
	'Signup Bonus'
] as const
export const LIFECYCLES = ['Live', 'Upcoming', 'Season Gap', 'Ended', 'Unknown'] as const

export type RewardType = (typeof REWARD_TYPES)[number]
export type RewardLifecycle = (typeof LIFECYCLES)[number]
export type RewardVerification = 'Verified' | 'Unverified'

export interface RewardSource {
	url: string
	/** Hostname, so a source reads as its publisher rather than "Source 1". */
	label: string
}

export interface RewardProgram {
	programId: string
	defillamaId: string
	projectPath: string | null
	protocol: string
	programName: string | null
	category: string | null
	protocolHref: string | null
	logo: string | null
	rewardTypes: readonly RewardType[]
	lifecycle: RewardLifecycle
	verification: RewardVerification
	/** Earliest known date, including programs that only specify an end date. */
	sortDate: string | null
	dateRangeLabel: string | null
	summary: string
	visitorBenefit: string
	referrerBenefit: string
	referralUrl: string | null
	sources: RewardSource[]
	lastVerified: string | null
}

export interface RewardsPageProps {
	programs: RewardProgram[]
	analyticsMode: RewardsAnalyticsMode
}

export type RewardsAnalyticsMode = 'off' | 'test' | 'production'

export interface RewardsFilters {
	search: string
	lifecycle: RewardLifecycle | 'All'
	rewardTypes: RewardType[]
	hideUnverified: boolean
}
