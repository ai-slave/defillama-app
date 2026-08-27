import type { RewardsApiRecord } from '../api.types'
import type { RewardProgram, RewardsFilters } from '../types'

export function apiRecord(overrides: Partial<RewardsApiRecord>): RewardsApiRecord {
	return {
		program_id: 'referral',
		defillama_id: '1',
		protocol: 'Example',
		reward_types: ['Points'],
		lifecycle: 'Live',
		verification: 'Verified',
		publish_status: 'Published',
		visibility: 'Public',
		summary: 'Earn points.',
		visitor_benefit: 'Earn points on deposits.',
		referrer_benefit: 'Referrers earn 5% of referred deposits.',
		referral_url: 'https://example.com/join?ref=llama',
		source_url: 'https://example.com/terms',
		...overrides
	}
}

export function program(overrides: Partial<RewardProgram>): RewardProgram {
	return {
		programId: 'referral',
		defillamaId: '1',
		fees30d: null,
		tvl: null,
		protocol: 'Example',
		programName: null,
		category: 'Lending',
		protocolHref: null,
		logo: null,
		rewardTypes: ['Points'],
		lifecycle: 'Live',
		verification: 'Verified',
		sortDate: null,
		dateRangeLabel: null,
		summary: 'Earn points.',
		visitorBenefit: 'Earn points on deposits.',
		referrerBenefit: 'Referrers earn 5% of referred deposits.',
		referralUrl: 'https://example.com/join',
		sources: [{ url: 'https://example.com/terms', label: 'example.com' }],
		lastVerified: null,
		...overrides
	}
}

export function filters(overrides: Partial<RewardsFilters>): RewardsFilters {
	return { search: '', lifecycle: 'Live', rewardTypes: [], hideUnverified: false, ...overrides }
}
