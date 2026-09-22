import type { InterestCategory, UserInterestsResponse, UserSegment } from '~/api/users.types'
import { createAnnouncementDismissalToken } from '~/utils/cookies'
import type { AnnouncementRegistry, BannerDefinition } from './registry'

export type ResolvedAnnouncement =
	| { kind: 'launch'; banner: BannerDefinition }
	| { kind: 'segment'; banner: BannerDefinition; segment: UserSegment }
	| { kind: 'targeted'; banner: BannerDefinition; category: InterestCategory }
	| { kind: 'fallback'; banner: BannerDefinition }

export interface ResolveAnnouncementInput {
	registry: AnnouncementRegistry
	now: number
	/** `null` while the profile is unknown: signed out, still loading, or failed. Only the launch and fallback apply then. */
	profile: UserInterestsResponse | null
	hasActiveSubscription: boolean
	dismissedTokens: Array<string>
}

/**
 * Picks the one banner for a page view. Order: page-wide launch, account segment, browsing interest,
 * fallback. Categories without a banner are skipped, so a reader whose interests are only protocols and
 * chains lands on the fallback. Dismissals are read once by the caller: the slot goes empty after a
 * dismiss instead of cascading to the next candidate.
 */
export function resolveAnnouncement({
	registry,
	now,
	profile,
	hasActiveSubscription,
	dismissedTokens
}: ResolveAnnouncementInput): ResolvedAnnouncement | null {
	const isEligible = (banner: BannerDefinition | undefined): banner is BannerDefinition => {
		if (!banner) return false
		if (banner.hideForSubscribers && hasActiveSubscription) return false
		return !dismissedTokens.includes(createAnnouncementDismissalToken(banner.id, banner.version))
	}

	const launch = registry.launch
	if (launch && now < Date.parse(launch.until) && isEligible(launch)) {
		return { kind: 'launch', banner: launch }
	}

	if (profile) {
		for (const segment of profile.segments) {
			const banner = registry.segments[segment]
			if (isEligible(banner)) return { kind: 'segment', banner, segment }
		}
		for (const { category } of profile.interests) {
			const banner = registry.targeted[category]
			if (isEligible(banner)) return { kind: 'targeted', banner, category }
		}
	}

	return isEligible(registry.fallback) ? { kind: 'fallback', banner: registry.fallback } : null
}
