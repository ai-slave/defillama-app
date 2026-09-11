import { useAuthContext } from '~/auth'
import { useIsClient } from '~/hooks/useIsClient'

export type VerifiedAccessStatus = 'pending' | 'granted' | 'denied'

export function getVerifiedAccessStatus({
	mounted,
	isAuthenticated,
	hasActiveSubscription,
	subscriptionInitialCheck
}: {
	mounted: boolean
	isAuthenticated: boolean
	hasActiveSubscription: boolean
	subscriptionInitialCheck: boolean
}): VerifiedAccessStatus {
	if (!mounted) return 'pending'
	if (!isAuthenticated) return 'denied'
	if (hasActiveSubscription) return 'granted'
	// A signed-in reader without confirmed access waits for the first lookup to settle, so a
	// server-rendered subscriber (or a remembered denial) is not flashed the locked variant. A lookup
	// that failed has settled too: the reader gets the public rows now and the retry upgrades later.
	return subscriptionInitialCheck ? 'pending' : 'denied'
}

/**
 * The client-side verified-yields entitlement, including the hydration boundary. Until the app has
 * mounted and the first entitlement lookup has settled, the tier is unknown: callers must neither
 * fetch the public fallback nor show a Pro denial. Keeping that third state here prevents each
 * surface from inventing its own interpretation of the auth loaders (or forgetting the server-render
 * dance entirely). Deliberately NOT `userLoading`: that flag stays true while a failed lookup
 * retries, which would hold the table empty for as long as the auth server is down.
 *
 * Which flag a surface reads: fetchers and server-tiered seeds hold on `isPending`; inline
 * affordances (padlocks, PRO badges) wait for `isDenied`, since they cost no layout and a subscriber
 * should never see them; block-level upsells that occupy layout render on `!hasAccess`, so the SSR
 * HTML stays stable for the anonymous majority instead of shifting after hydration.
 */
export function useVerifiedAccess() {
	const { authorizedFetch, hasActiveSubscription, isAuthenticated, loaders } = useAuthContext()
	const mounted = useIsClient()
	const status = getVerifiedAccessStatus({
		mounted,
		isAuthenticated,
		hasActiveSubscription,
		subscriptionInitialCheck: loaders.subscriptionInitialCheck
	})

	return {
		authorizedFetch,
		status,
		hasAccess: status === 'granted',
		isPending: status === 'pending',
		isDenied: status === 'denied'
	}
}
