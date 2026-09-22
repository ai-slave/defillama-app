import type * as React from 'react'
import type { InterestCategory, UserSegment } from '~/api/users.types'
import { VERIFIED_APY_ANNOUNCEMENT, VerifiedApyAnnouncement } from '../Yields/VerifiedApyAnnouncement'
import { LLAMAAI_MOBILE_APP_ANNOUNCEMENT, LlamaAIMobileAppAnnouncement } from './LlamaAIMobileAppAnnouncement'
import { UTR_ANNOUNCEMENT, UniversalTokenRatingAnnouncement } from './UniversalTokenRatingAnnouncement'

export interface BannerDefinition {
	/** Stable per product. Together with `version` it forms the dismissal cookie token. */
	id: string
	/** The date the copy or offer changed. Bumping it re-shows the banner to everyone who dismissed it. */
	version: string
	render: () => React.ReactNode
	/** An upsell a subscriber already owns: never pick it for them. */
	hideForSubscribers?: true
}

export interface AnnouncementRegistry {
	/** Shown to everyone while the window is open, ahead of any targeting. `until` is an ISO date, exclusive. */
	launch: (BannerDefinition & { until: string }) | null
	/** Account segments outrank browsing interests: affiliation is a stronger signal than page views. */
	segments: Partial<Record<UserSegment, BannerDefinition>>
	targeted: Partial<Record<InterestCategory, BannerDefinition>>
	/** For readers with no match, including everyone signed out. */
	fallback: BannerDefinition
}

const utr: BannerDefinition = { ...UTR_ANNOUNCEMENT, render: () => <UniversalTokenRatingAnnouncement /> }

export const ANNOUNCEMENT_REGISTRY: AnnouncementRegistry = {
	launch: { ...utr, until: '2026-10-02' },
	segments: {},
	targeted: {
		yields: {
			...VERIFIED_APY_ANNOUNCEMENT,
			hideForSubscribers: true,
			render: () => <VerifiedApyAnnouncement placement="home-banner" />
		},
		llamaai: { ...LLAMAAI_MOBILE_APP_ANNOUNCEMENT, render: () => <LlamaAIMobileAppAnnouncement /> }
	},
	fallback: utr
}
