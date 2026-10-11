import * as Ariakit from '@ariakit/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Router, { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '~/auth'
import { subscriptionStatusQueryOptions } from '~/auth/subscriptionStatus'
import { SelectCheckIcon } from '~/components/Select/SelectCheckIcon'
import { AI_SERVER } from '~/constants'
import { PURCHASABLE_PLANS, queryValue, usePlanRecord } from '~/containers/Subscription/purchaseReturn'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import {
	persistSlackAcquisitionIfFirst,
	readSlackAcquisition,
	type SlackAcquisition
} from '~/containers/Subscription/utils/slackAcquisition'
import { readAppStorage, setLlamaAIWalkthroughState, writeAppStorage } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { FieldGroup } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { OptionTile } from '~/ui/OptionTile'
import { popoverMultiSelectCheckStyles } from '~/ui/Popover'
import { LoadingIndicator, PanelLoadingStatus } from '~/ui/Status'
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
		iconName: 'globe' as const,
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
	const [submitted, setSubmitted] = useState(false)
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
		return <PanelLoadingStatus label="Loading your subscription" className="min-h-[60vh]" />
	}

	if (isPaymentFailed) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center px-4">
				<div className="flex max-w-sm flex-col items-center gap-4 text-center">
					<h2 className="heading-sm text-primary">Payment not completed</h2>
					<p className="body-md text-tertiary">Your payment didn't go through, so your plan hasn't changed.</p>
					<Button size="md" onClick={() => void Router.push('/subscription')}>
						Back to plans
					</Button>
				</div>
			</div>
		)
	}

	if (!isAuthenticated) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center px-4">
				<div className="flex max-w-sm flex-col items-center gap-4 text-center">
					<h2 className="heading-sm text-primary">Sign in to continue</h2>
					<p className="body-md text-tertiary">Sign in with the account you subscribed with to see your plan.</p>
					<Button size="md" onClick={onSignIn}>
						Sign in
					</Button>
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
					<h2 className="heading-sm text-primary">
						{isPaymentProcessing ? 'Payment processing' : 'Processing your payment'}
					</h2>
					<p className="body-md text-tertiary">
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
					<Button size="md" onClick={() => window.location.reload()}>
						Refresh
					</Button>
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
				<span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-sub-purple-muted bg-sub-purple-faint px-3 py-1 label-sm tracking-wide text-sub-purple-text">
					<Icon name="check-circle" className="size-3.5" />
					{planName} activated
				</span>
				<h1 className="heading-lg tracking-tight text-primary">Welcome to DefiLlama {planName}</h1>
			</div>

			{slackAcquisition ? (
				<div className="mb-6 flex w-full items-start gap-3 rounded-xl border border-sub-purple-muted bg-sub-purple-faint px-4 py-3 text-left">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sub-purple-tint">
						<Icon name="chat" className="size-4 text-sub-purple-text" />
					</div>
					<div className="flex min-w-0 flex-col gap-0.5">
						<span className="label-md text-primary">LlamaAI is ready in Slack</span>
						<span className="body-sm text-tertiary">
							Mention <span className="mono-sm text-secondary">@LlamaAI</span> in any channel, or DM the bot directly.
						</span>
					</div>
				</div>
			) : null}

			<form
				noValidate
				className="flex w-full flex-col"
				onSubmit={(event) => {
					event.preventDefault()
					if (selectedFeatures.size === 0) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
					handleContinue()
				}}
			>
				<FieldGroup
					label="What brought you here? Pick all that apply."
					error={submitted && selectedFeatures.size === 0 ? 'Choose at least one option.' : null}
				>
					<div className="flex flex-col gap-2">
						{ONBOARDING_OPTIONS.map((option, i) => {
							const isSelected = selectedFeatures.has(option.id)
							const c = option.color
							return (
								<Ariakit.Checkbox
									render={<OptionTile layout="row" selected={isSelected} aria-label={option.label} />}
									aria-description={option.description ?? undefined}
									key={option.id}
									checked={isSelected}
									onChange={() => toggleFeature(option.id)}
									style={{ animationDelay: `${i * 40}ms` }}
									className="animate-[fadein_0.2s_ease-out_both]"
								>
									<span
										className="flex size-9 shrink-0 items-center justify-center rounded-lg"
										style={{ backgroundColor: `color-mix(in srgb, ${c} ${isSelected ? 15 : 8}%, transparent)` }}
									>
										{option.iconType === 'svg' ? (
											<svg className="size-[18px]" style={{ color: isSelected ? '#FDE0A9' : c }}>
												<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
											</svg>
										) : (
											<Icon
												name={option.iconName}
												className="size-4.5"
												style={{ color: isSelected ? c : 'var(--text-tertiary)' }}
											/>
										)}
									</span>
									<span className="flex min-w-0 flex-col gap-0.5">
										<span className="label-md">{option.label}</span>
										{option.description ? <span className="label-sm text-tertiary">{option.description}</span> : null}
									</span>
									<span className={popoverMultiSelectCheckStyles(isSelected)} aria-hidden>
										{isSelected ? <SelectCheckIcon /> : null}
									</span>
								</Ariakit.Checkbox>
							)
						})}
					</div>
				</FieldGroup>

				<div className="sub-api-accent mt-6 flex w-full flex-col items-center gap-2">
					<Button type="submit" variant="primary" size="lg" className="w-full">
						Get started
					</Button>
					<Button variant="ghost" size="md" onClick={() => void Router.push('/account')}>
						Skip
					</Button>
				</div>
			</form>
		</div>
	)
}
