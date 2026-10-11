import dynamic from 'next/dynamic'
import Head from 'next/head'
import Router, { useRouter } from 'next/router'
import { useEffect } from 'react'
import { AuthProvider, useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { Toast } from '~/components/Toast'
import { ClientOnly } from '~/layout/ClientOnly'
import { Button } from '~/ui/Button'
import { EmptyState, InlineStatus } from '~/ui/Status'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const SignInFlow = dynamic(() => import('~/containers/Subscription/SignInDialog').then((mod) => mod.SignInFlow), {
	ssr: false
})

export default function AuthPage() {
	return (
		<ClientOnly>
			<AuthProvider>
				<AuthContent />
			</AuthProvider>
		</ClientOnly>
	)
}

// Subscription details go only to the two add-ons that sign in here (DefiLlama/google-sheets-plugin).
// Google's OAuth2 library for Apps Script returns to its script's own usercallback, keyed by the script id.
const SHEETS_CALLBACK_URL =
	'https://script.google.com/macros/d/1QqeBzdso-_WVCAamI1F0uKUhzYGFX9KbG8ufLVJ2AKupWAblK9agpcl4/usercallback'
// Local Excel sign-in is unsupported; subscription details go only to the published add-in.
const EXCEL_ORIGIN = 'https://excel.llama.fi'

function AuthContent() {
	const router = useRouter()
	const { isAuthenticated, logout, user } = useAuthContext()
	// Read through locals: the pages router keeps one object identity and swaps `query` on navigation,
	// so these are the values that actually change.
	const routerQuery = router.query
	const redirectUrl = routerQuery.redirect_uri
	const isUnknownRedirect = redirectUrl !== undefined && redirectUrl !== SHEETS_CALLBACK_URL

	const { subscription, isSubscriptionLoading, isSubscriptionError, isSubscriptionRetrying, refetchSubscription } =
		useSubscribe()

	useEffect(() => {
		// A failed read must not be forwarded as an inactive subscription.
		if (isAuthenticated && !isSubscriptionLoading && !isSubscriptionError) {
			trackUmamiEvent('sheets-auth-sign-in', { user_id: user?.id })
			if (redirectUrl === SHEETS_CALLBACK_URL) {
				void Router.push({
					pathname: SHEETS_CALLBACK_URL,
					query: {
						...routerQuery,
						subscription_id: subscription?.id || '',
						subscription_status: subscription?.status || '',
						expires_at: subscription?.expires_at || '',
						provider: subscription?.provider || ''
					}
				})
			} else if (redirectUrl === undefined && window.opener) {
				const message = {
					subscription_id: subscription?.id || '',
					subscription_status: subscription?.status || '',
					expires_at: subscription?.expires_at || '',
					provider: subscription?.provider || ''
				}
				// The browser drops a message whose target origin is not the opener's, so an unknown opener receives nothing.
				window.opener.postMessage(message, EXCEL_ORIGIN)
				window.close()
			}
		}
	}, [isAuthenticated, redirectUrl, routerQuery, user, isSubscriptionLoading, isSubscriptionError, subscription])

	return (
		<>
			<Head>
				<title>Sign In - DefiLlama</title>
				<link rel="icon" type="image/png" href="/favicon-32x32.png" />
				<meta name="robots" content="noindex, nofollow" />
			</Head>
			<div className="theme-dark col-span-full flex min-h-screen w-full items-center justify-center bg-page px-5">
				{isAuthenticated ? (
					<div className="w-full max-w-md rounded-xl border border-subtle bg-surface px-8 pb-8 text-center">
						<div className="mb-6">
							<EmptyState size="lg" tone="success" headingAs="h2" title="Signed in">
								{user?.email ?? null}
							</EmptyState>
							{isUnknownRedirect ? (
								<div className="mt-2 text-left">
									<InlineStatus variant="error">
										This sign-in link did not come from the DefiLlama Sheets or Excel add-on, so your subscription was
										not shared. Start signing in again from the add-on.
									</InlineStatus>
								</div>
							) : isSubscriptionError ? (
								<div className="mt-2 text-left">
									<InlineStatus
										variant="error"
										retry={{ refetch: refetchSubscription, isFetching: isSubscriptionRetrying }}
									>
										Couldn&apos;t load your subscription.
									</InlineStatus>
								</div>
							) : (
								<p className="mt-2 body-md text-tertiary">
									You should be automatically redirected to finish the authentication process.
								</p>
							)}
						</div>

						<Button size="lg" className="w-full" onClick={logout}>
							Sign out
						</Button>
					</div>
				) : (
					<div className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl border border-medium bg-overlay">
						<SignInFlow />
					</div>
				)}
				<Toast />
			</div>
		</>
	)
}
