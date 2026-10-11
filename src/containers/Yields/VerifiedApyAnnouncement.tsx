import { Announcement, announcementCtaStyles, type AnnouncementTracking } from '~/components/Announcement'
import { Icon } from '~/ui/Icon'
import { useSubscribeProModal } from './useSubscribeProModal'
import { useVerifiedAccess } from './useVerifiedAccess'

/** Shared with the announcement registry so closing the strip on /yields also closes the targeted banner. */
export const VERIFIED_APY_ANNOUNCEMENT = { id: 'verified-apy', version: '2026-09-03' } as const

/**
 * The strip above the earn table, above a measured pool's page, and in the home slot for a yields
 * reader without a subscription: the claim in one line and one way to buy it. Gold, so it reads as a
 * different message from the cream and gold LlamaAI promo and the blue app banner. The explanation only appears
 * on wide screens; on a phone the banner is one row, the headline and a short button. Dismissal rides the site's
 * announcement cookie, so closing it anywhere keeps it closed everywhere; bump `version` to bring it
 * back. A subscriber never sees it.
 */
export function VerifiedApyAnnouncement({
	placement = 'banner',
	hasAccess: hasAccessFromProps = false,
	track
}: {
	placement?: string
	/** Set only in the home slot, which measures its banners. */
	track?: AnnouncementTracking
	/** The page's own verdict (server-rendered for a subscriber) so their HTML never carries the strip. */
	hasAccess?: boolean
}) {
	const { show, modal } = useSubscribeProModal('verified-yields', placement)
	const { hasAccess: hasClientAccess } = useVerifiedAccess()
	// Rendered while access is still pending: the strip occupies layout, so hiding it until auth
	// settles would shift the page under every anonymous reader after hydration.
	if (hasAccessFromProps || hasClientAccess) return null
	return (
		<>
			<Announcement
				announcementId={VERIFIED_APY_ANNOUNCEMENT.id}
				version={VERIFIED_APY_ANNOUNCEMENT.version}
				className="verified-announcement-scope border border-verified-announcement-border bg-(image:--verified-announcement-bg) text-verified-announcement-text shadow-verified-announcement"
				contentClassName="flex items-center gap-x-3 gap-y-2 py-0.5 pl-1.5 text-left sm:flex-wrap"
				dismissLabel="Dismiss"
				dismissTracking={track?.dismiss}
			>
				<Icon name="badge-check" className="size-5 shrink-0 text-verified-announcement-seal" aria-hidden />
				<span className="flex-1 sm:min-w-48">
					<strong className="font-semibold">Verified APY</strong>: what you would actually have earned.
					<span className="hidden lg:inline">
						{' '}
						Every day we simulate a real holder withdrawing from each pool on-chain and record what they received.
					</span>
				</span>
				<button type="button" {...track?.cta} onClick={show} className={`ml-auto ${announcementCtaStyles}`}>
					Unlock<span className="hidden sm:inline"> Verified APY</span>
				</button>
			</Announcement>
			{modal}
		</>
	)
}
