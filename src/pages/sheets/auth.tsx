import * as Ariakit from '@ariakit/react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { AuthProvider, useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { Toast } from '~/components/Toast'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { WalletProvider } from '~/layout/WalletProvider'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const SignInFlow = dynamic<{ dialogStore: Ariakit.DialogStore }>(
	() => import('~/containers/Subscription/SignInDialog').then((mod) => mod.SignInFlow),
	{ ssr: false }
)

export default function AuthPage() {
	return (
		<WalletProvider>
			<AuthProvider>
				<AuthContent />
			</AuthProvider>
		</WalletProvider>
	)
}

function AuthContent() {
	const router = useRouter()
	const { isAuthenticated, logout, user } = useAuthContext()
	const redirectUrl = router.query.redirect_uri

	const { subscription, isSubscriptionLoading, isSubscriptionError, isSubscriptionRetrying, refetchSubscription } =
		useSubscribe()

	useEffect(() => {
		// A failed read must not be forwarded as an inactive subscription.
		if (isAuthenticated && !isSubscriptionLoading && !isSubscriptionError) {
			trackUmamiEvent('sheets-auth-sign-in', { user_id: user?.id })
			// google sheets auth, requiring redirect url
			if (redirectUrl) {
				void router.push({
					pathname: redirectUrl as string,
					query: {
						...router.query,
						subscription_id: subscription?.id || '',
						subscription_status: subscription?.status || '',
						expires_at: subscription?.expires_at || '',
						provider: subscription?.provider || ''
					}
				})
			} else if (window.opener) {
				// ms excel auth, we open auth page with `window.open` and send back the sub data to parent window
				window.opener.postMessage(
					{
						subscription_id: subscription?.id || '',
						subscription_status: subscription?.status || '',
						expires_at: subscription?.expires_at || '',
						provider: subscription?.provider || ''
					},
					'*'
				)

				window.close()
			}
		}
	}, [
		isAuthenticated,
		redirectUrl,
		router,
		router.query,
		user,
		isSubscriptionLoading,
		isSubscriptionError,
		subscription
	])

	const dialogStore = Ariakit.useDialogStore({ defaultOpen: true })

	return (
		<>
			<Head>
				<title>Sign In - DefiLlama</title>
				<link rel="icon" type="image/png" href="/favicon-32x32.png" />
				<meta name="robots" content="noindex, nofollow" />
			</Head>
			<div className="col-span-full flex min-h-screen w-full items-center justify-center bg-sub-dark-panel px-5">
				{isAuthenticated ? (
					<div className="w-full max-w-md rounded-xl border border-sub-line bg-sub-dark-panel p-8 text-center">
						<div className="mb-6">
							<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success/10">
								<Icon name="check" height={24} width={24} className="text-success" />
							</div>
							<h2 className="mb-2 text-2xl font-bold text-on-brand">Successfully logged in.</h2>
							{user?.email ? <p className="text-sm text-sub-text-muted">Signed in as {user.email}</p> : null}
							{isSubscriptionError ? (
								<div className="mt-2 text-left">
									<SubscriptionLoadError
										isRetrying={isSubscriptionRetrying}
										onRetry={() => void refetchSubscription()}
									/>
								</div>
							) : (
								<p className="mt-2 text-sm text-sub-text-muted">
									You should be automatically redirected to finish the authentication process.
								</p>
							)}
						</div>

						<div className="space-y-3">
							<button
								type="button"
								onClick={logout}
								className="w-full rounded-lg border border-sub-line bg-transparent py-3 font-medium text-on-brand transition-colors hover:bg-sub-dark-card-raised"
							>
								Sign Out
							</button>
						</div>
					</div>
				) : (
					<div className="w-full max-w-[331px] rounded-2xl bg-[#181a1b] px-5 pt-6 pb-5 shadow-2xl">
						<SignInFlow dialogStore={dialogStore} />
					</div>
				)}
				<Toast />
			</div>
		</>
	)
}
