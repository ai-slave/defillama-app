import type * as React from 'react'
import type { InterestCategory, UserSegment } from '~/api/users.types'
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
	render: () => React.ReactNode
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

const llamaAIPromo: BannerDefinition = { ...LLAMAAI_PROMO_ANNOUNCEMENT, render: () => <LlamaAIPromoAnnouncement /> }

export const ANNOUNCEMENT_REGISTRY: AnnouncementRegistry = {
	launch: llamaAIPromo,
	segments: {
		crypto_project: { ...INVESTOR_RELATIONS_ANNOUNCEMENT, render: () => <InvestorRelationsAnnouncement /> },
		// A fund reading yields is probably providing liquidity, which is what Verified APY is for.
		fund_institutional: {
			...ENTERPRISE_DATA_ANNOUNCEMENT,
			deferTo: ['yields'],
			render: () => <EnterpriseDataAnnouncement />
		}
	},
	targeted: {
		yields: {
			...VERIFIED_APY_ANNOUNCEMENT,
			hideForSubscribers: true,
			render: () => <VerifiedApyAnnouncement placement="home-banner" />
		},
		llamaai: { ...LLAMAAI_MOBILE_APP_ANNOUNCEMENT, render: () => <LlamaAIMobileAppAnnouncement /> }
	},
	fallback: llamaAIPromo
}
