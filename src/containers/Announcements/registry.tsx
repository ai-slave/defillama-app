import type * as React from 'react'
import type { InterestCategory, UserSegment } from '~/api/users.types'
import type { AnnouncementTracking } from '~/components/Announcement'
import { VERIFIED_APY_ANNOUNCEMENT, VerifiedApyAnnouncement } from '../Yields/VerifiedApyAnnouncement'
import { ENTERPRISE_DATA_ANNOUNCEMENT, EnterpriseDataAnnouncement } from './EnterpriseDataAnnouncement'
import { INVESTOR_RELATIONS_ANNOUNCEMENT, InvestorRelationsAnnouncement } from './InvestorRelationsAnnouncement'
import { LLAMAAI_MOBILE_APP_ANNOUNCEMENT, LlamaAIMobileAppAnnouncement } from './LlamaAIMobileAppAnnouncement'
import { LLAMAAI_PROMO_ANNOUNCEMENT, LlamaAIPromoAnnouncement } from './LlamaAIPromoAnnouncement'

export interface BannerDefinition {
	/** Stable per product. Together with `version` it forms the dismissal cookie token. */
	id: string
	/** The date the copy or offer changed. Bumping it re-shows the banner to everyone who dismissed it. */
	version: string
	render: (track: AnnouncementTracking) => React.ReactNode
	/** An upsell a subscriber already owns: never pick it for them. */
	hideForSubscribers?: true
}

export interface SegmentBannerDefinition extends BannerDefinition {
	/**
	 * Interests whose banner beats this one when the reader has them: the affiliation says who they are,
	 * but some browsing says what they are doing right now.
	 */
	deferTo?: Array<InterestCategory>
}

export interface AnnouncementRegistry {
	/**
	 * Shown to everyone ahead of any targeting. `until` is an ISO date, exclusive; without it the banner shows
	 * until it is removed from the registry.
	 */
	launch: (BannerDefinition & { until?: string }) | null
	/** Account segments outrank browsing interests: affiliation is a stronger signal than page views. */
	segments: Partial<Record<UserSegment, SegmentBannerDefinition>>
	targeted: Partial<Record<InterestCategory, BannerDefinition>>
	/** For readers with no match, including everyone signed out. */
	fallback: BannerDefinition
}

const llamaAIPromo: BannerDefinition = {
	...LLAMAAI_PROMO_ANNOUNCEMENT,
	render: (track) => <LlamaAIPromoAnnouncement track={track} />
}

export const ANNOUNCEMENT_REGISTRY: AnnouncementRegistry = {
	launch: llamaAIPromo,
	segments: {
		crypto_project: {
			...INVESTOR_RELATIONS_ANNOUNCEMENT,
			render: (track) => <InvestorRelationsAnnouncement track={track} />
		},
		// A fund reading yields is probably providing liquidity, which is what Verified APY is for.
		fund_institutional: {
			...ENTERPRISE_DATA_ANNOUNCEMENT,
			deferTo: ['yields'],
			render: (track) => <EnterpriseDataAnnouncement track={track} />
		}
	},
	targeted: {
		yields: {
			...VERIFIED_APY_ANNOUNCEMENT,
			hideForSubscribers: true,
			render: (track) => <VerifiedApyAnnouncement placement="home-banner" track={track} />
		},
		llamaai: { ...LLAMAAI_MOBILE_APP_ANNOUNCEMENT, render: (track) => <LlamaAIMobileAppAnnouncement track={track} /> }
	},
	fallback: llamaAIPromo
}
