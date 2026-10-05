import { useRouter } from 'next/router'
import * as React from 'react'
import { useAuthContext } from '~/auth'
import { useIsClient } from '~/hooks/useIsClient'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { trackUmamiEvent, UMAMI_READY_EVENT, type UmamiEventAttributes } from '~/utils/analytics/umami'
import { getDismissedAnnouncements, subscribeToAnnouncementDismissals } from '~/utils/cookies'
import { ANNOUNCEMENT_REGISTRY } from './registry'
import { isLaunchOpen, type ResolvedAnnouncement, resolveAnnouncement } from './resolveAnnouncement'
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
	// The HTML and the hydrating client judge the launch window at the page clock; after that it can close while
	// the page stays open. Only the open/closed answer feeds the choice, so a clock tick inside the window keeps the
	// same banner and does not count a second impression.
	const nowSec = useNowSeconds()
	const launchOpen = isLaunchOpen(ANNOUNCEMENT_REGISTRY.launch, nowSec * 1000)
	// Closing any banner empties the slot for the rest of this page view, even if the profile arrives
	// afterwards and would have picked a different one.
	const [dismissedThisView, setDismissedThisView] = React.useState(false)
	// Follows the dismissal cookie rather than the close click, so the banner's own button writes the
	// cookie before the slot empties.
	React.useEffect(() => subscribeToAnnouncementDismissals(() => setDismissedThisView(true)), [])

	// Dismissals from earlier page views are read once per resolution, not subscribed to.
	const resolved = React.useMemo(
		() =>
			resolveAnnouncement({
				registry: ANNOUNCEMENT_REGISTRY,
				launchOpen,
				profile,
				hasActiveSubscription,
				dismissedTokens: isClient ? getDismissedAnnouncements() : []
			}),
		[isClient, profile, hasActiveSubscription, launchOpen]
	)

	if (dismissedThisView || !resolved) return null
	return <AnnouncementSlot key={resolved.banner.id} resolved={resolved} page={page} trackImpressions={canTarget} />
}

function AnnouncementSlot({
	resolved,
	page,
	trackImpressions
}: {
	resolved: ResolvedAnnouncement
	/** The route template (`/` or `/chain/[chain]`), so events group by page type rather than by chain. */
	page: string
	trackImpressions: boolean
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

	const data = eventDataFor(resolved, page)
	return resolved.banner.render({
		cta: umamiEventAttributes('announcement-click', data),
		dismiss: umamiEventAttributes('announcement-dismiss', data)
	})
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

function umamiEventAttributes(event: string, data: Record<string, string>): UmamiEventAttributes {
	const attributes: UmamiEventAttributes = { 'data-umami-event': event }
	for (const key in data) attributes[`data-umami-event-${key}`] = data[key]
	return attributes
}
