import * as Ariakit from '@ariakit/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Router, { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '~/auth'
import { subscriptionStatusQueryOptions } from '~/auth/subscriptionStatus'
import { AI_SERVER } from '~/constants'
import { PURCHASABLE_PLANS, queryValue, usePlanRecord } from '~/containers/Subscription/purchaseReturn'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import {
	persistSlackAcquisitionIfFirst,
	readSlackAcquisition,
	type SlackAcquisition
} from '~/containers/Subscription/utils/slackAcquisition'
import { readAppStorage, setLlamaAIWalkthroughState, writeAppStorage } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { LoadingIndicator } from '~/ui/Status'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const ONBOARDING_OPTIONS = [
	{
		id: 'llamaai',
		label: 'LlamaAI',
		description: 'Research & analysis',
		iconType: 'svg' as const,
		color: '#C99A4A',
		destination: '/ai/chat'
	},
	{
		id: 'csv',
		label: 'CSV Downloads',
		description: 'Export any dataset',
		iconType: 'icon' as const,
		iconName: 'download-cloud' as const,
		color: '#2564eb',
		destination: '/downloads'
	},
	{
		id: 'dashboards',
		label: 'Pro Dashboards',
		description: 'Build custom views',
		iconType: 'icon' as const,
		iconName: 'layout-grid' as const,
		color: '#e04dc0',
		destination: '/pro'
	},
	{
		id: 'verified-yields',
		label: 'Verified APY',
		description: 'What yield pools actually paid',
		iconType: 'icon' as const,
		iconName: 'badge-check' as const,
		color: '#3b82f6',
		destination: '/yields'
	},
	{
		id: 'llamafeed',
		label: 'LlamaFeed',
		description: 'Real-time premium insights',
		iconType: 'icon' as const,
		iconName: 'activity' as const,
		color: '#8b5cf6',
		destination: 'https://llamafeed.io'
	},
	{
		id: 'sheets',
		label: 'DefiLlama Sheets',
		description: 'Blockchain data in spreadsheets',
		iconType: 'icon' as const,
		iconName: 'sheets' as const,
		color: '#22c55e',
		destination: '/sheets'
	},
	{
		id: 'exploring',
		label: 'Just exploring everything',
		description: null,
		iconType: 'icon' as const,
		iconName: 'earth' as const,
		color: '#8a8c90',
		destination: null
	}
] as const

const PRIORITY_ORDER = ['llamaai', 'dashboards', 'csv', 'llamafeed', 'sheets', 'verified-yields'] as const

// `window.sessionStorage` throws by itself when browser policy denies storage, so the access has to be
// guarded and not just the getItem call. Both effects below read through this.
function getSessionStorage(): Storage | null {
	try {
		return window.sessionStorage
	} catch {
		return null
	}
}

// Reads and consumes the checkout marker: the storage calls need a try, and the marker's own tests are
// value blocks the compiler cannot lower inside one.
function readTrialCheckoutMarker(storage: Storage): { variant: string } | null {
	try {
		const raw = storage.getItem('llamaai_checkout')
		if (!raw) return null
		// Consumed even when stale, so a stale marker cannot fire later.
		storage.removeItem('llamaai_checkout')
		const marker = JSON.parse(raw) as { variant?: string; ts?: number }
		if (!marker.ts || Date.now() - marker.ts >= 60 * 60 * 1000) return null
		return { variant: marker.variant ?? 'trial' }
	} catch {
		// Storage can be unavailable or the marker malformed; the event is not tracked.
		return null
	}
}

export function WelcomeOnboarding() {
	const signInDialogStore = Ariakit.useDialogStore()
	// Mounted beside the steps, not in the signed-out one, so a sign-in from another tab keeps the dialog's "You're
	// signed in" step.
	return (
		<>
			<WelcomeOnboardingSteps onSignIn={signInDialogStore.show} />
			<SignInModal store={signInDialogStore} />
		</>
	)
}

function WelcomeOnboardingSteps({ onSignIn }: { onSignIn: () => void }) {
	const queryClient = useQueryClient()
	const router = useRouter()
	const { user, authToken, isAuthenticated, hasActiveSubscription, loaders, authorizedFetch } = useAuthContext()
	const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set())
	const [slackAcquisition, setSlackAcquisition] = useState<SlackAcquisition | null>(null)

	// The purchase params stay in the URL: the Refresh button below reloads, and without them a reload would confirm any
	// active plan. Stripe's payment intent and its client secret are dropped, so the secret never sits in the address
	// bar or history. Stripe reports a declined redirect payment as `failed` or `requires_payment_method`; a processing one can
	// still clear while the page is open, so it waits for the plan like a paid one.
	const returnPlan = queryValue(router.query.plan)
	const returnInterval = queryValue(router.query.interval)
	const redirectStatus = queryValue(router.query.redirect_status)
	const isPaymentFailed = redirectStatus === 'failed' || redirectStatus === 'requires_payment_method'
	const isPaymentProcessing = redirectStatus === 'processing'
	// Null on a plain visit or an older link without the plan: any active plan then confirms, as before. The return URL
	// is user-editable, so only a plan the checkout sells is trusted as the purchase.
	const purchase =
		!isPaymentFailed && returnPlan && returnInterval && PURCHASABLE_PLANS.has(returnPlan)
			? { plan: returnPlan, interval: returnInterval }
			: null

	// Any active plan is not the purchase: an API subscriber buying Pro already reads active. The untyped status read
	// returns just the first active plan, so the bought one is read by type, under the subscription key so the reads
	// below refresh it. A trial checkout lands here too, so a trial record of the bought plan confirms it.
	const purchasedSubscription = usePlanRecord(purchase?.plan ?? null)
	const activeSubscription = useQuery(
		subscriptionStatusQueryOptions({ userId: user?.id ?? null, token: authToken })
	).data
	const isConfirmed =
		!isPaymentFailed &&
		(purchase
			? purchasedSubscription != null &&
				purchasedSubscription.type === purchase.plan &&
				purchasedSubscription.billing_interval === purchase.interval
			: hasActiveSubscription)

	// Stripe redirects here before the webhook grants the entitlement. Re-read the
	// canonical status a bounded number of times because one read can race the webhook.
	// The Refresh button below stays as the manual recovery path.
	const CONFIRMATION_READS = 6
	const [confirmationReads, setConfirmationReads] = useState(0)
	useEffect(() => {
		if (!isAuthenticated || isConfirmed || isPaymentFailed || loaders.userLoading || !router.isReady) return
		if (confirmationReads >= CONFIRMATION_READS) return
		const id = window.setTimeout(
			() => {
				void queryClient.invalidateQueries({ queryKey: ['subscription'] })
				setConfirmationReads((reads) => reads + 1)
			},
			confirmationReads === 0 ? 0 : 4000
		)
		return () => window.clearTimeout(id)
	}, [
		confirmationReads,
		isAuthenticated,
		isConfirmed,
		loaders.userLoading,
		router.isReady,
		isPaymentFailed,
		queryClient
	])

	useEffect(() => {
		if (!router.isReady || (!router.query.payment_intent && !router.query.payment_intent_client_secret)) return
		const { payment_intent: _intent, payment_intent_client_secret: _secret, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [router])

	// The marker is removed as it is read, so the event fires once per checkout.
	useEffect(() => {
		if (!isConfirmed) return
		const storage = getSessionStorage()
		if (!storage) return
		const marker = readTrialCheckoutMarker(storage)
		if (!marker) return
		trackUmamiEvent('llamaai-trial-activated', { variant: marker.variant })
	}, [isConfirmed])

	useEffect(() => {
		if (!hasActiveSubscription || !isAuthenticated || loaders.userLoading) return
		const storage = getSessionStorage()
		if (!storage) return
		// Removed from storage as it is read, so later runs find nothing and it is persisted once.
		const acquisition = readSlackAcquisition(storage)
		if (!acquisition) return
		// sessionStorage is only readable after hydration, and reading it consumes it, so it cannot move into render.
		// oxlint-disable-next-line react/set-state-in-effect -- see above
		setSlackAcquisition(acquisition)
		void persistSlackAcquisitionIfFirst(acquisition, {
			fetch: authorizedFetch,
			aiServer: AI_SERVER
		}).catch((error) => {
			console.warn('[welcome] persistSlackAcquisitionIfFirst failed', error)
		})
	}, [hasActiveSubscription, isAuthenticated, loaders.userLoading, authorizedFetch])

	const toggleFeature = useCallback((id: string) => {
		setSelectedFeatures((prev) => {
			if (prev.has(id)) {
				const next = new Set(prev)
				next.delete(id)
				return next
			}
			if (id === 'exploring') {
				return new Set(['exploring'])
			}
			const next = new Set(prev)
			next.delete('exploring')
			next.add(id)
			return next
		})
	}, [])

	const handleContinue = useCallback(() => {
		const features = Array.from(selectedFeatures)

		trackUmamiEvent('onboarding-intent', { features })

		const storage = readAppStorage()
		storage.ONBOARDING_INTENT = features
		if (selectedFeatures.has('llamaai')) {
			setLlamaAIWalkthroughState('armed', storage)
		} else {
			writeAppStorage(storage)
		}

		if (selectedFeatures.has('exploring')) {
			void Router.push('/')
			return
		}

		const navigate = (url: string) => {
			if (url.startsWith('http')) {
				window.location.href = url
			} else {
				void Router.push(url)
			}
		}

		// Always clean up the returnUrl regardless of path taken
		const session = getSessionStorage()
		const returnUrl = session?.getItem('onboarding_returnUrl') ?? null
		if (returnUrl) session!.removeItem('onboarding_returnUrl')

		if (features.length === 1) {
			const option = ONBOARDING_OPTIONS.find((o) => o.id === features[0])
			if (option?.destination) {
				if (option.id === 'csv' && returnUrl) {
					navigate(returnUrl)
				} else {
					navigate(option.destination)
				}
				return
			}
		}

		for (const id of PRIORITY_ORDER) {
			if (selectedFeatures.has(id)) {
				const option = ONBOARDING_OPTIONS.find((o) => o.id === id)
				if (option?.destination) {
					navigate(option.destination)
					return
				}
			}
		}
	}, [selectedFeatures])

	// Until the router reads the query, a checkout return looks like a plain visit and would confirm any active plan.
	if (loaders.userLoading || !router.isReady) {
		return (
			<div role="status" aria-live="polite" className="flex min-h-[60vh] items-center justify-center">
				<LoadingIndicator label="Loading your subscription" />
			</div>
		)
	}

	if (isPaymentFailed) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center px-4">
				<div className="flex max-w-sm flex-col items-center gap-4 text-center">
					<h2 className="heading-sm text-on-brand">Payment not completed</h2>
					<p className="body-md text-sub-text-muted">Your payment didn't go through, so your plan hasn't changed.</p>
					<button
						type="button"
						onClick={() => void Router.push('/subscription')}
						className="rounded-lg border border-sub-line px-4 py-2 text-sm text-sub-text-muted transition-colors hover:bg-sub-dark-card-raised hover:text-on-brand"
					>
						Back to plans
					</button>
				</div>
			</div>
		)
	}

	if (!isAuthenticated) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center px-4">
				<div className="flex max-w-sm flex-col items-center gap-4 text-center">
					<h2 className="heading-sm text-on-brand">Sign in to continue</h2>
					<p className="body-md text-sub-text-muted">Sign in with the account you subscribed with to see your plan.</p>
					<button
						type="button"
						onClick={onSignIn}
						className="rounded-lg border border-sub-line px-4 py-2 text-sm text-sub-text-muted transition-colors hover:bg-sub-dark-card-raised hover:text-on-brand"
					>
						Sign in
					</button>
				</div>
			</div>
		)
	}

	if (!isConfirmed) {
		// The automatic re-reads above are bounded, so once they run out the page stops promising more.
		const checking = confirmationReads < CONFIRMATION_READS
		return (
			<div className="flex min-h-[60vh] items-center justify-center px-4">
				<div className="flex max-w-sm flex-col items-center gap-4 text-center">
					<h2 className="heading-sm text-on-brand">
						{isPaymentProcessing ? 'Payment processing' : 'Processing your payment'}
					</h2>
					<p className="body-md text-sub-text-muted">
						{isPaymentProcessing
							? checking
								? 'Your bank is still processing the payment. Your plan updates once it clears.'
								: 'Your bank is still processing the payment. Refresh the page later to see your plan.'
							: checking
								? 'This usually takes a few seconds, and this page checks again automatically.'
								: 'Confirming your payment is taking longer than usual. Refresh the page to check again.'}
					</p>
					{checking ? (
						<div role="status" aria-live="polite">
							<LoadingIndicator label="Checking your payment" />
						</div>
					) : null}
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="rounded-lg border border-sub-line px-4 py-2 text-sm text-sub-text-muted transition-colors hover:bg-sub-dark-card-raised hover:text-on-brand"
					>
						Refresh
					</button>
				</div>
			</div>
		)
	}

	// A crypto checkout returns without the plan params, so a plain visit names the active plan the auth read found.
	const planType = purchase ? purchase.plan : activeSubscription?.type
	const planName = planType === 'api' ? 'API' : 'Pro'
	return (
		<div className="mx-auto flex w-full max-w-[580px] animate-[fadein_0.3s_ease-out] flex-col items-center px-4 py-14">
			<div className="mb-8 flex flex-col items-center gap-1.5 text-center">
				<span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-sub-purple/25 bg-sub-purple/8 px-3 py-1 text-xs font-medium tracking-wide text-sub-purple-soft">
					<Icon name="check-circle" height={13} width={13} />
					{planName} activated
				</span>
				<h1 className="text-2xl font-bold tracking-tight text-on-brand">Welcome to DefiLlama {planName}</h1>
				<p className="text-sm text-sub-text-muted">What brought you here? Pick all that apply.</p>
			</div>

			{slackAcquisition ? (
				<div className="mb-6 flex w-full items-start gap-3 rounded-xl border border-sub-purple/25 bg-sub-purple/8 px-4 py-3 text-left">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sub-purple/15">
						<Icon name="chat" height={16} width={16} className="text-sub-purple-soft" />
					</div>
					<div className="flex min-w-0 flex-col gap-0.5">
						<span className="text-sm font-medium text-on-brand">LlamaAI is ready in Slack</span>
						<span className="text-xs leading-snug text-sub-text-muted">
							Mention <span className="font-mono text-sub-text-soft">@LlamaAI</span> in any channel, or DM the bot
							directly.
						</span>
					</div>
				</div>
			) : null}

			<Ariakit.Group aria-label="What brought you here? Pick all that apply." className="flex w-full flex-col gap-2">
				{ONBOARDING_OPTIONS.map((option, i) => {
					const isSelected = selectedFeatures.has(option.id)
					const c = option.color
					return (
						<Ariakit.Checkbox
							render={<button type="button" aria-label={option.label} />}
							aria-description={option.description ?? undefined}
							key={option.id}
							checked={isSelected}
							onChange={() => toggleFeature(option.id)}
							style={{
								animationDelay: `${i * 40}ms`,
								...(isSelected ? { borderColor: `${c}66`, backgroundColor: `${c}0f` } : {})
							}}
							className={`group flex animate-[fadein_0.2s_ease-out_both] items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-all duration-200 focus-visible:focus-ring ${
								isSelected ? '' : 'border-sub-line bg-sub-dark-panel hover:border-sub-line hover:bg-sub-dark-card'
							}`}
						>
							<div
								className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
								style={{
									backgroundColor: isSelected ? `${c}26` : `${c}14`
								}}
							>
								{option.iconType === 'svg' ? (
									<svg className="size-[18px]" style={{ color: isSelected ? '#FDE0A9' : c }}>
										<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
									</svg>
								) : (
									<Icon
										name={option.iconName}
										height={18}
										width={18}
										className="transition-colors duration-200"
										style={{ color: isSelected ? c : '#8a8c90' }}
									/>
								)}
							</div>
							<div className="flex min-w-0 flex-col">
								<span
									className={`text-sm leading-tight font-medium ${isSelected ? 'text-on-brand' : 'text-sub-text-soft'}`}
								>
									{option.label}
								</span>
								{option.description ? (
									<span className="mt-0.5 text-xs leading-tight text-sub-text-muted">{option.description}</span>
								) : null}
							</div>
							<div className="ml-auto shrink-0">
								<div
									className={`flex size-[18px] items-center justify-center rounded-full border transition-all duration-200 ${
										isSelected ? '' : 'border-sub-line group-hover:border-[#555]'
									}`}
									style={isSelected ? { borderColor: c, backgroundColor: c } : undefined}
								>
									{isSelected ? <Icon name="check" height={10} width={10} className="text-on-brand" /> : null}
								</div>
							</div>
						</Ariakit.Checkbox>
					)
				})}
			</Ariakit.Group>

			<div className="mt-6 flex w-full flex-col items-center gap-2">
				<button
					type="button"
					onClick={handleContinue}
					disabled={selectedFeatures.size === 0}
					className="w-full rounded-xl bg-sub-purple py-3 text-sm font-semibold text-on-brand transition-all duration-200 hover:bg-sub-purple-hover hover:shadow-sub-purple-glow disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
				>
					Get started
				</button>
				<button
					type="button"
					onClick={() => void Router.push('/account')}
					className="py-1 text-xs text-sub-text-muted transition-colors hover:text-sub-text-soft"
				>
					Skip
				</button>
			</div>
		</div>
	)
}
