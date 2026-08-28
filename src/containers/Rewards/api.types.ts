import type { RewardLifecycle, RewardType, RewardVerification } from './types'

// /rewards returns Airtable fields directly; empty cells are omitted.
export interface RewardsApiRecord {
	program_id: string
	defillama_id: string
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
	visitor_benefit: string
	referrer_benefit: string
	referral_url: string
	source_url?: string
}
