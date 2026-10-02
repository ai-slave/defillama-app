import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { subscriptionStatusQueryOptions } from '~/auth/subscriptionStatus'
import { BasicLink } from '~/components/Link'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'
import { Button, buttonStyles } from '~/ui/Button'
import { passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingDots } from '~/ui/Loaders'

// A retry that succeeds leaves; the account link above it stays, so it takes focus.
const focusAccountOnLeave = passFocusOnLeave((retry) =>
	retry.closest('[data-account]')?.querySelector<HTMLElement>('a[href="/account"]')
)

export function Account() {
	const { isAuthenticated, authToken, user, hasActiveSubscription, loaders } = useAuthContext()
	const subscriptionUserId = isAuthenticated ? (user?.id ?? null) : null
	const subscriptionToken = isAuthenticated ? authToken : null
	const subscriptionQueryConfig = useMemo(
		() => subscriptionStatusQueryOptions({ userId: subscriptionUserId, token: subscriptionToken }),
		[subscriptionUserId, subscriptionToken]
	)
	const { data, errorUpdatedAt, dataUpdatedAt, isFetching, refetch } = useQuery(subscriptionQueryConfig)
	// Attempt times, not isError: design.md → Status states.
	const failed = errorUpdatedAt > dataUpdatedAt
	// With no status at all, the failure is the account's subtitle and outranks the provider's loading state.
	const unavailable = failed && data === undefined
	const isClient = useIsClient()

	if (!isClient) {
		return <div className="flex min-h-7 w-full items-center justify-center" />
	}

	return (
		<>
			{loaders?.userLoading && !(isAuthenticated && user && unavailable) ? (
				<div className="flex min-h-7 w-full items-center justify-center">
					<p className="flex items-center gap-1">
						Loading
						<LoadingDots />
					</p>
				</div>
			) : isAuthenticated && user ? (
				<div data-account className="flex w-full flex-col">
					<BasicLink
						href="/account"
						className="flex w-full items-center gap-3 rounded-md p-1 hover:bg-hover-row focus-visible:bg-hover-row"
					>
						<img src="/assets/account_avatar.png" alt="Account avatar" className="size-6 shrink-0 rounded-full" />
						<div className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="label-sm text-primary">My Account</span>
							<span
								className={`truncate label-xs ${unavailable ? 'text-data-down' : hasActiveSubscription ? 'text-data-up' : 'text-tertiary'}`}
							>
								{unavailable
									? 'Subscription unavailable'
									: hasActiveSubscription
										? 'Active Subscription'
										: 'No Subscription'}
							</span>
						</div>
						<Icon name="chevron-right" className="size-5 shrink-0 text-tertiary" />
					</BasicLink>
					{failed ? (
						<div className="ml-10 flex flex-wrap items-center gap-2">
							{unavailable ? null : <span className="label-xs text-data-down">Subscription unavailable</span>}
							<Button
								size="sm"
								ref={focusAccountOnLeave}
								pendingLabel={isFetching ? 'Retrying…' : null}
								onClick={() => void refetch()}
							>
								Try again
							</Button>
						</div>
					) : null}
				</div>
			) : null}
			{/* Mounted in every state, so a sign-in that finishes here or in another tab keeps its dialog through the
			    loading and account states until its last step closes it. Its trigger shows only while signed out. */}
			<SignInModal
				text="Sign In / Subscribe"
				className={`${buttonStyles({ variant: 'primary', size: 'sm' })} w-full`}
			/>
		</>
	)
}
