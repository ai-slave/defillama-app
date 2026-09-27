import { useRouter } from 'next/router'
import * as React from 'react'
import { useAuthContext } from '~/auth'
import { useIsClient } from '~/hooks/useIsClient'
import { useNowSecondsOnce } from '~/hooks/useNowSeconds'
import { usePageClockSec } from '~/hooks/usePageClock'
import { trackUmamiEvent, UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { getDismissedAnnouncements } from '~/utils/cookies'
import { ANNOUNCEMENT_REGISTRY } from './registry'
import { type ResolvedAnnouncement, resolveAnnouncement } from './resolveAnnouncement'
import { useUserInterests } from './useUserInterests'

/**
 * The page-wide announcement slot on the home and chain pages. Chain-to-chain navigation keeps the page
 * component mounted, so the slot is keyed by path: each page view starts its own selection, dismissal,
 * and impression.
 */
export function TargetedAnnouncement() {
	const { asPath, pathname } = useRouter()
	return <PageViewAnnouncement key={asPath} page={pathname} />
}

/**
 * The server and the first client render pick from the launch and fallback only, so the HTML is stable
 * for the signed-out majority. Once the reader's profile and subscription have settled, the slot
 * re-resolves and may swap to a targeted banner.
 */
function PageViewAnnouncement({ page }: { page: string }) {
	const { hasActiveSubscription, loaders } = useAuthContext()
	const isClient = useIsClient()
	const interests = useUserInterests()
	// Targeting waits for the entitlement lookup: an upsell for something the reader already owns is
	// worse than a moment of the fallback.
	const canTarget = isClient && interests.status !== 'loading' && !loaders.subscriptionInitialCheck
	const profile = canTarget && interests.status === 'ready' ? interests.profile : null
	// The launch window is judged at the page clock, so the HTML and the hydrating client agree. A page without a
	// data function has no clock; there the launch banner waits for mount instead of guessing.
	const pageClockSec = usePageClockSec()
	const nowSec = useNowSecondsOnce(pageClockSec ?? 0)
	const now = pageClockSec !== null || isClient ? nowSec * 1000 : Number.POSITIVE_INFINITY
	// Closing any banner empties the slot for the rest of this page view, even if the profile arrives
	// afterwards and would have picked a different one.
	const [dismissedThisView, setDismissedThisView] = React.useState(false)

	// Dismissals from earlier page views are read once per resolution, not subscribed to.
	const resolved = React.useMemo(
		() =>
			resolveAnnouncement({
				registry: ANNOUNCEMENT_REGISTRY,
				now,
				profile,
				hasActiveSubscription,
				dismissedTokens: isClient ? getDismissedAnnouncements() : []
			}),
		[isClient, profile, hasActiveSubscription, now]
	)

	if (dismissedThisView || !resolved) return null
	return (
		<AnnouncementSlot
			key={resolved.banner.id}
			resolved={resolved}
			page={page}
			trackImpressions={canTarget}
			onDismiss={() => setDismissedThisView(true)}
		/>
	)
}

function AnnouncementSlot({
	resolved,
	page,
	trackImpressions,
	onDismiss
}: {
	resolved: ResolvedAnnouncement
	/** The route template (`/` or `/chain/[chain]`), so events group by page type rather than by chain. */
	page: string
	trackImpressions: boolean
	onDismiss: () => void
}) {
	// Only the final choice counts as an impression; the fallback shown while the profile loads is not one.
	// Umami loads lazily, so a banner that settles before the script is ready sends once it fires.
	React.useEffect(() => {
		if (!trackImpressions) return
		let sent = false
		const send = () => {
			if (sent || !window.umami) return
			sent = true
			trackUmamiEvent('announcement-impression', eventDataFor(resolved, page))
		}
		send()
		window.addEventListener(UMAMI_READY_EVENT, send)
		return () => window.removeEventListener(UMAMI_READY_EVENT, send)
	}, [trackImpressions, resolved, page])

	const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement
		if (target.closest('[data-announcement-dismiss]')) {
			trackUmamiEvent('announcement-dismiss', eventDataFor(resolved, page))
			onDismiss()
		} else if (target.closest('a, button')) {
			trackUmamiEvent('announcement-click', eventDataFor(resolved, page))
		}
	}

	return <div onClickCapture={onClickCapture}>{resolved.banner.render()}</div>
}

function eventDataFor(resolved: ResolvedAnnouncement, page: string) {
	const { id, version } = resolved.banner
	switch (resolved.kind) {
		case 'targeted':
			return { id, version, page, kind: resolved.kind, category: resolved.category }
		case 'segment':
			return { id, version, page, kind: resolved.kind, segment: resolved.segment }
		default:
			return { id, version, page, kind: resolved.kind }
	}
}
