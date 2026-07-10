import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { useAuthContext } from '~/containers/Subscription/auth'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'
import { buttonStyles } from '~/ui/Button'
import { LoadingDots } from '~/ui/Loaders'

export function Account({ asPath: _asPath }: { asPath: string }) {
	const { isAuthenticated, user, hasActiveSubscription, loaders } = useAuthContext()
	const isClient = useIsClient()

	if (!isClient) {
		return <div className="flex min-h-7 w-full items-center justify-center" />
	}

	if (loaders?.userLoading) {
		return (
			<div className="flex min-h-7 w-full items-center justify-center">
				<p className="flex items-center gap-1">
					Loading
					<LoadingDots />
				</p>
			</div>
		)
	}

	if (isAuthenticated && user) {
		return (
			<BasicLink
				href="/account"
				className="flex w-full items-center gap-3 rounded-md p-1 hover:bg-hover-row focus-visible:bg-hover-row"
			>
				<img src="/assets/account_avatar.png" alt="Account avatar" className="size-6 shrink-0 rounded-full" />
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="label-sm text-primary">My Account</span>
					<span className={`truncate label-xs ${hasActiveSubscription ? 'text-data-up' : 'text-tertiary'}`}>
						{hasActiveSubscription ? 'Active Subscription' : 'No Subscription'}
					</span>
				</div>
				<Icon name="chevron-right" className="size-5 shrink-0 text-tertiary" />
			</BasicLink>
		)
	}

	return (
		<SignInModal
			text="Sign In / Subscribe"
			className={buttonStyles({ variant: 'primary', size: 'sm' }) + ' w-full'}
			hideWhenAuthenticated={false}
		/>
	)
}
