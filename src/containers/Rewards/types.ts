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
export const BENEFIT_AUDIENCES = ['Visitor only', 'Referrer only', 'Both', 'Unknown'] as const

export type RewardType = (typeof REWARD_TYPES)[number]
export type RewardLifecycle = (typeof LIFECYCLES)[number]
export type RewardVerification = 'Verified' | 'Unverified'
export type RewardBenefitAudience = (typeof BENEFIT_AUDIENCES)[number]

export interface RewardSource {
	url: string
	/** Hostname, so a source reads as its publisher rather than "Source 1". */
	label: string
}

export interface RewardProgram {
	programId: string
	defillamaId: string | null
	projectPath: string | null
	protocol: string
	programName: string | null
	category: string | null
	protocolHref: string | null
	logo: string | null
	rewardTypes: ReadonlyArray<RewardType>
	lifecycle: RewardLifecycle
	verification: RewardVerification
	/** Earliest known date, including programs that only specify an end date. */
	sortDate: string | null
	dateRangeLabel: string | null
	summary: string
	benefitAudience: RewardBenefitAudience
	visitorBenefit: string
	referrerBenefit: string | null
	referralUrl: string | null
	sources: Array<RewardSource>
	lastVerified: string | null
}

export interface RewardsPageProps {
	programs: Array<RewardProgram>
	popularityOrder: Array<string>
	featuredCardIds: Array<string>
}

export interface RewardsFilters {
	search: string
	lifecycle: RewardLifecycle | 'All'
	rewardTypes: Array<RewardType>
	hideUnverified: boolean
}
