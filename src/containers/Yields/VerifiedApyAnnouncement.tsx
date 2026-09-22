import { Announcement } from '~/components/Announcement'
import { SealGlyph } from './Tables/Measured'
import { useSubscribeProModal } from './useSubscribeProModal'
import { useVerifiedAccess } from './useVerifiedAccess'

/** Shared with the announcement registry so closing the strip on /yields also closes the targeted banner. */
export const VERIFIED_APY_ANNOUNCEMENT = { id: 'verified-apy', version: '2026-09-03' } as const

/**
 * The strip above the earn table, above a measured pool's page, and in the home slot for a yields
 * reader without a subscription: the claim in one line and one way to buy it. Gold, so it reads as a
 * different message from the green UTR banner and the blue app banner. The explanation only appears
 * on wide screens; on a phone the banner is the headline and the button. Dismissal rides the site's
 * announcement cookie, so closing it anywhere keeps it closed everywhere; bump `version` to bring it
 * back. A subscriber never sees it.
 */
export function VerifiedApyAnnouncement({
	placement = 'banner',
	hasAccess: hasAccessFromProps = false
}: {
	placement?: string
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
				className="border border-verified-announcement-border bg-(image:--verified-announcement-bg) text-verified-announcement-text shadow-verified-announcement"
				contentClassName="flex flex-wrap items-center gap-x-3 gap-y-2 py-0.5 pl-1.5 text-left"
				dismissButtonClassName="hover:bg-verified-announcement-dismiss"
				dismissLabel="Dismiss"
			>
				<SealGlyph size={16} className="text-verified-announcement-seal" />
				<span className="min-w-48 flex-1">
					<strong className="font-semibold">Verified APY</strong>: what you would actually have earned.
					<span className="hidden lg:inline">
						{' '}
						Every day we simulate a real holder withdrawing from each pool on-chain and record what they received.
					</span>
				</span>
				<button
					type="button"
					onClick={show}
					className="ml-auto shrink-0 rounded-lg bg-verified-announcement-button px-3 py-1.5 label-sm text-verified-announcement-button-text transition-colors hover:bg-verified-announcement-button-hover"
				>
					Unlock Verified APY
				</button>
			</Announcement>
			{modal}
		</>
	)
}
