import type { RewardBenefitAudience, RewardLifecycle, RewardType, RewardVerification } from './types'

// /rewards returns Airtable fields directly; empty cells are omitted.
export interface RewardsApiRecord {
	program_id: string
	defillama_id: string
	/** Backend-resolved ranking identity; not the row's navigation destination. */
	project_path: string | null
	protocol: string
	program_name?: string
	reward_types?: RewardType[]
	lifecycle: RewardLifecycle
	verification: RewardVerification
	publish_status: 'Draft' | 'Published' | 'Needs Review'
	visibility?: 'Public' | 'Hidden'
	start_date?: string
	end_date?: string
	last_verified?: string
	summary: string
	benefit_audience: RewardBenefitAudience
	visitor_benefit: string
	referrer_benefit: string
	referral_url?: string
	source_url?: string
}

/** Produced by defillama-server's cron-rewards-popularity command. Times are Unix milliseconds. */
export interface RewardsPopularity {
	version: 1
	startAt: number
	endAt: number
	viewsByPath: Record<string, number>
}
