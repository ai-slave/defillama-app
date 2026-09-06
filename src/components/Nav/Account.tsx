import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { subscriptionStatusQueryOptions } from '~/auth/subscriptionStatus'
import { BasicLink } from '~/components/Link'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingDots } from '~/ui/Loaders'

export function Account({ asPath: _asPath }: { asPath: string }) {
	const { isAuthenticated, authToken, user, hasActiveSubscription, loaders } = useAuthContext()
	const subscriptionUserId = isAuthenticated ? (user?.id ?? null) : null
	const subscriptionToken = isAuthenticated ? authToken : null
	const subscriptionQueryConfig = useMemo(
		() => subscriptionStatusQueryOptions({ userId: subscriptionUserId, token: subscriptionToken }),
		[subscriptionUserId, subscriptionToken]
	)
	const subscriptionQuery = useQuery(subscriptionQueryConfig)
	const isClient = useIsClient()

	if (!isClient) {
		return <div className="flex min-h-7 w-full items-center justify-center" />
	}

	if (isAuthenticated && user && subscriptionQuery.isError && subscriptionQuery.data === undefined) {
		return (
			<div className="flex w-full flex-col">
				<BasicLink
					href="/account"
					className="flex w-full items-center gap-3 rounded-md p-1 hover:bg-hover-row focus-visible:bg-hover-row"
				>
					<img src="/assets/account_avatar.png" alt="Account avatar" className="size-6 shrink-0 rounded-full" />
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="label-sm text-primary">My Account</span>
						<span className="truncate label-xs text-data-down">Subscription unavailable</span>
					</div>
					<Icon name="chevron-right" className="size-5 shrink-0 text-tertiary" />
				</BasicLink>
				<button
					type="button"
					disabled={subscriptionQuery.isFetching}
					onClick={() => void subscriptionQuery.refetch()}
					className="mr-auto ml-10 label-xs text-link hover:underline disabled:opacity-60"
				>
					{subscriptionQuery.isFetching ? 'Retrying…' : 'Retry'}
				</button>
			</div>
		)
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
			<div className="flex w-full flex-col">
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
				{subscriptionQuery.isError ? (
					<button
						type="button"
						disabled={subscriptionQuery.isFetching}
						onClick={() => void subscriptionQuery.refetch()}
						className="mr-auto ml-10 label-xs text-data-down hover:underline disabled:opacity-60"
					>
						{subscriptionQuery.isFetching ? 'Retrying…' : 'Subscription unavailable · Retry'}
					</button>
				) : null}
			</div>
		)
	}

	return (
		<SignInModal
			text="Sign In / Subscribe"
			className={`${buttonStyles({ variant: 'primary', size: 'sm' })} w-full`}
			hideWhenAuthenticated={false}
		/>
	)
}
