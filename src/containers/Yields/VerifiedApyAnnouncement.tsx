import { Announcement } from '~/components/Announcement'
import { SealGlyph } from './Tables/Measured'
import { useSubscribeProModal } from './useSubscribeProModal'
import { useVerifiedAccess } from './useVerifiedAccess'

/**
 * The strip above the earn table, and above a measured pool's page, for a reader without a
 * subscription: the claim in one line and one way to buy it. Dismissal rides the site's
 * announcement cookie, so closing it on either page keeps it closed on both; bump `version` to
 * bring it back. A subscriber never sees it.
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
				announcementId="verified-apy"
				version="2026-09-03"
				// A faint brand wash: on the bare surface the strip vanished into the filter bar above and the
				// table below. Still a step quieter than the site's default announcement tint.
				className="border border-brand/20 bg-brand-faint"
				contentClassName="flex flex-wrap items-center gap-x-3 gap-y-2 py-0.5 pl-1.5 text-left"
				dismissButtonClassName="text-secondary hover:text-primary"
				dismissLabel="Dismiss"
			>
				<SealGlyph size={16} />
				<span className="shrink-0 rounded-md bg-brand-muted px-1.5 py-0.5 label-xs tracking-widest text-link">NEW</span>
				<span className="min-w-0 flex-1 text-secondary">
					<strong className="font-semibold text-primary">Verified APY</strong>: What would you actually have earned?
					Every day we simulate a real holder withdrawing from each pool on-chain and record what they received.
				</span>
				<button
					type="button"
					onClick={show}
					className="ml-auto shrink-0 rounded-lg bg-brand px-3 py-1.5 label-sm text-on-brand hover:brightness-110 focus-visible:focus-ring-on-brand"
				>
					Unlock Verified APY
				</button>
			</Announcement>
			{modal}
		</>
	)
}
