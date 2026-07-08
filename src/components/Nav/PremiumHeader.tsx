import { BasicLink } from '~/components/Link'
import { useAuthContext } from '~/containers/Subscription/auth'
import { useIsClient } from '~/hooks/useIsClient'
import { freeTrialBadgeStyles, SidebarDivider } from './shared'

export const PremiumHeader = () => {
	const { hasActiveSubscription, isAuthenticated, loaders } = useAuthContext()
	const hasMounted = useIsClient()

	// Only show badge after hydration AND when we're sure user doesn't have subscription
	const showFreeTrial = hasMounted && !hasActiveSubscription && (!isAuthenticated || !loaders.userLoading)

	return (
		<>
			<SidebarDivider className="my-2 -ml-1.5 max-lg:hidden" />
			<p className="mb-1 flex items-center gap-2">
				<span className="label-sm font-medium tracking-wide text-secondary">PREMIUM</span>
				<BasicLink
					href="/subscription"
					className={`${freeTrialBadgeStyles} ${showFreeTrial ? '' : 'invisible'}`.trim()}
				>
					Try free
				</BasicLink>
			</p>
		</>
	)
}
