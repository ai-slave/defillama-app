import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { subscriptionStatusQueryOptions } from '~/auth/subscriptionStatus'
import { useSubscribe } from '~/auth/useSubscribe'
import { SEO } from '~/components/SEO'
import { Toast } from '~/components/Toast'
import { EndTrialModal } from '~/containers/Account/EndTrialModal'
import { getReturnIntentAction, ReturnModal, withoutReturnUrl } from '~/containers/Subscription/components/ReturnModal'
import {
	COMPARISON_SECTIONS,
	FAQ_ITEMS,
	PLAN_ORDER,
	PRICING_CARDS_BY_CYCLE,
	TRUST_LOGOS
} from '~/containers/Subscription/data'
import { observePricingPage, trackPricingClick } from '~/containers/Subscription/pricingExperiment'
import {
	SubscriptionBackground,
	SubscriptionComparisonSection,
	SubscriptionFaqBlock,
	SubscriptionFooter,
	SubscriptionHeader,
	SubscriptionPricingSection,
	SubscriptionTrustedBlock
} from '~/containers/Subscription/sections'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { useStripeCheckout } from '~/containers/Subscription/shared/useStripeCheckout'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import type { BillingCycle, PlanKey } from '~/containers/Subscription/types'
import { planCheckoutBlock, readSubscribedPlan, useSubscriptionPageState } from '~/containers/Subscription/usePageState'
import { applySlackAcquisitionFromQuery } from '~/containers/Subscription/utils/slackAcquisition'
import { ClientOnly } from '~/layout/ClientOnly'
import pb from '~/utils/pocketbase'
import { safeInternalPath } from '~/utils/routerQuery'

const StripeCheckoutModal = lazy(() =>
	import('~/containers/Subscription/shared/StripeCheckoutModal').then((m) => ({ default: m.StripeCheckoutModal }))
)

const planKeyToSubType = (key: PlanKey): 'api' | 'llamafeed' => (key === 'api' ? 'api' : 'llamafeed')

const SUBSCRIPTION_UNKNOWN = "Couldn't load your subscription. Retry loading it before changing plans."

type PlanAction = { method: 'card' | 'crypto' | 'trial'; plan: PlanKey; interval: 'year' | 'month' }

function SubscriptionContent() {
	const router = useRouter()
	const { pathname, query, replace } = router
	const returnUrl = safeInternalPath(query.returnUrl)

	const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly')
	const {
		isAuthenticated,
		currentPlan,
		isTrial,
		userBillingCycle,
		isManualSubscription,
		currentProvider,
		isTeamProvided,
		isSubscriptionError,
		isLoading: isPageStateLoading
	} = useSubscriptionPageState()
	const { user, loaders, promptVerifyEmail, isNewSignup, consumeSignupOutcome } = useAuthContext()
	const {
		handleSubscribe,
		loading,
		isTrialAvailable: isTrialAvailableFromApi,
		subscription,
		createPortalSession,
		isSubscriptionRetrying,
		refetchSubscription
	} = useSubscribe()

	const isTrialAvailable = isAuthenticated ? isTrialAvailableFromApi : true

	const isCancelPending = subscription?.metadata?.isCanceled === 'true'

	const signInDialog = Ariakit.useDialogStore()
	// The plan action a signed-out click asked for, continued once sign-in finishes.
	const [planAfterSignIn, setPlanAfterSignIn] = useState<PlanAction | null>(null)
	const queryClient = useQueryClient()

	const stripeCheckout = useStripeCheckout()

	/* ── End trial modal ──────────────────────────────────────────────── */
	const [showEndTrialModal, setShowEndTrialModal] = useState(false)
	const [cryptoError, setCryptoError] = useState<{ cardKey: PlanKey; message: string } | null>(null)

	/* ── Slack acquisition source capture ─────────────────────────────── */
	useEffect(() => {
		if (typeof window === 'undefined' || !router.isReady) return
		applySlackAcquisitionFromQuery(router.query, window.sessionStorage)
	}, [router.isReady, router.query])

	/* ── Return modal (redirect after sign-in) ────────────────────────── */
	// The return URL the reader dismissed, or that a new signup dropped. Either way it is not offered again.
	const [handledReturnUrl, setHandledReturnUrl] = useState<string>()
	const returnIntent = getReturnIntentAction({
		isAuthenticated,
		userLoading: loaders.userLoading,
		isNewSignup,
		returnUrl,
		handledReturnUrl
	})

	// Right after signup, onboarding takes over: the destination leaves the URL, and only then does the signup
	// outcome end, so no render offers the return in between.
	useEffect(() => {
		if (returnIntent !== 'consume') return
		void replace({ pathname, query: withoutReturnUrl(query) }, undefined, { shallow: true }).then(() => {
			setHandledReturnUrl(returnUrl)
			consumeSignupOutcome()
		})
	}, [returnIntent, returnUrl, consumeSignupOutcome, pathname, query, replace])

	/* ── Helpers ───────────────────────────────────────────────────────── */
	const billingInterval = billingCycle === 'yearly' ? 'year' : 'month'

	const openSignIn = (action: PlanAction | null) => {
		setPlanAfterSignIn(action)
		signInDialog.show()
	}

	const requireVerified = (action: () => void) => {
		if (!user?.verified && !user?.walletAddress) {
			promptVerifyEmail(user?.id)
			return
		}
		action()
	}

	const runPlanAction = ({ method, plan, interval }: PlanAction) =>
		requireVerified(() => {
			if (method !== 'crypto') {
				stripeCheckout.open({ type: planKeyToSubType(plan), billingInterval: interval, isTrial: method === 'trial' })
				return
			}
			setCryptoError(null)
			handleSubscribe('llamapay', planKeyToSubType(plan), interval).catch((error: Error) =>
				setCryptoError({ cardKey: plan, message: error.message })
			)
		})

	// Signed out, the action waits for sign-in and then for the new account's plan.
	const startPlanAction = (action: PlanAction) => {
		if (isAuthenticated) runPlanAction(action)
		else openSignIn(action)
	}
	const startTrial = () => startPlanAction({ method: 'trial', plan: 'pro', interval: 'month' })

	// The plan is unknown until the new account's subscription loads, so the guards wait for that read.
	const continueAfterSignIn = useMutation({
		mutationFn: (_action: PlanAction) =>
			queryClient.fetchQuery(
				subscriptionStatusQueryOptions({ userId: pb.authStore.record!.id, token: pb.authStore.token })
			),
		onSuccess: (accountSubscription, action) => {
			const plan = readSubscribedPlan(accountSubscription)
			const block = planCheckoutBlock(action.plan, { ...plan, isTrial })
			if (block && block !== 'skip') toast.error(block)
			// As on the pricing cards, crypto and the trial only start a plan; a paid plan changes by card.
			else if (!block && (action.method === 'card' || plan.currentPlan === 'free')) runPlanAction(action)
		},
		onError: () => toast.error(SUBSCRIPTION_UNKNOWN)
	})

	/* ── Card handlers ─────────────────────────────────────────────────── */
	const handlePrimaryCtaClick = (cardKey: PlanKey) => {
		if (cardKey === 'free') {
			openSignIn(null)
			return
		}
		if (cardKey === 'enterprise') {
			window.location.href = 'mailto:sales@defillama.com'
			return
		}
		startPlanAction({ method: 'card', plan: cardKey, interval: billingInterval })
	}

	const handleUpgradeToYearly = (cardKey: PlanKey) =>
		requireVerified(() =>
			stripeCheckout.open({ type: planKeyToSubType(cardKey), billingInterval: 'year', isUpgradeFlow: true })
		)

	// Self-serve plan changes only apply to Stripe-billed personal plans. Everyone
	// else (manual, team seat, LlamaPay, app store) keeps the comparison buttons
	// hidden, matching the pricing cards; the click guards below stay as backstop.
	const canSelfServePlanChange =
		!isAuthenticated || !currentPlan || currentPlan === 'free'
			? true
			: currentProvider === 'stripe' && !isTeamProvided && !isManualSubscription

	const handleComparisonPlanAction = (plan: PlanKey) => {
		// Contact Us stays valid regardless of how the current plan is billed.
		if (plan === 'enterprise') {
			window.location.href = 'mailto:sales@defillama.com'
			return
		}

		// With the current plan unknown, checkout could double-subscribe.
		if (isSubscriptionError) {
			toast.error(SUBSCRIPTION_UNKNOWN)
			return
		}

		// Same guards the pricing cards enforce
		if (currentPlan) {
			const block = planCheckoutBlock(plan, {
				currentPlan,
				isTrial,
				isManualSubscription,
				isTeamProvided,
				currentProvider
			})
			if (block === 'skip') return
			if (block) {
				toast.error(block)
				return
			}
		}

		if (plan === 'free') {
			if (!isAuthenticated) openSignIn(null)
			return
		}

		startPlanAction({ method: 'card', plan, interval: billingInterval })
	}

	return (
		<div className="relative col-span-full min-h-screen w-full [overflow-x:clip] [overflow-y:visible] bg-page text-primary">
			<SubscriptionBackground />
			<SubscriptionHeader />

			<main
				ref={observePricingPage}
				onClickCapture={trackPricingClick}
				data-billing-cycle={billingCycle}
				className="relative z-10"
			>
				{isSubscriptionError ? (
					<div className="mx-auto max-w-[600px] px-4 pt-10">
						<SubscriptionLoadError isRetrying={isSubscriptionRetrying} onRetry={() => void refetchSubscription()} />
					</div>
				) : null}
				<SubscriptionPricingSection
					pricingCards={PRICING_CARDS_BY_CYCLE[billingCycle]}
					billingCycle={billingCycle}
					onBillingCycleChange={setBillingCycle}
					currentPlan={currentPlan}
					isAuthenticated={isAuthenticated}
					isTrial={isTrial}
					isCancelPending={isCancelPending}
					userBillingCycle={userBillingCycle}
					isManualSubscription={isManualSubscription}
					currentProvider={currentProvider}
					isTeamProvided={isTeamProvided}
					isPageStateLoading={isPageStateLoading || isSubscriptionError}
					onPrimaryCtaClick={handlePrimaryCtaClick}
					onSecondaryCtaClick={(cardKey) =>
						startPlanAction({ method: 'crypto', plan: cardKey, interval: billingInterval })
					}
					onUpgradeToYearly={handleUpgradeToYearly}
					onUpgradeTier={(cardKey) => startPlanAction({ method: 'card', plan: cardKey, interval: billingInterval })}
					onStartTrial={startTrial}
					onEndTrial={() => setShowEndTrialModal(true)}
					// Reverting a scheduled cancellation happens in the Stripe billing portal.
					onRevertCancellation={() => void createPortalSession()}
					isTrialAvailable={isTrialAvailable}
					loading={loading}
					cryptoError={cryptoError}
				/>
				<SubscriptionComparisonSection
					planOrder={PLAN_ORDER}
					comparisonSections={COMPARISON_SECTIONS}
					billingCycle={billingCycle}
					selectedPlan="api"
					currentPlan={currentPlan}
					hidePlanActions={isSubscriptionError || !canSelfServePlanChange}
					onPlanAction={handleComparisonPlanAction}
				/>

				<section className="mx-auto flex max-w-[1440px] flex-col items-center px-4 py-12 md:px-10 md:py-20 2xl:px-32">
					<SubscriptionTrustedBlock trustLogos={TRUST_LOGOS} />
					<SubscriptionFaqBlock faqItems={FAQ_ITEMS} onStartTrial={isTrialAvailable ? startTrial : undefined} />
				</section>
			</main>

			<SubscriptionFooter />

			{/* Sign-in dialog (opened programmatically by CTA buttons) */}
			<SignInModal
				store={signInDialog}
				onAuthenticated={() => {
					if (!planAfterSignIn) return
					// The reader chose a plan here, so the checkout replaces the offer to go back.
					setHandledReturnUrl(returnUrl)
					continueAfterSignIn.mutate(planAfterSignIn)
				}}
			/>

			{/* Stripe checkout modal */}
			{stripeCheckout.isOpen ? (
				<Suspense fallback={null}>
					<StripeCheckoutModal checkout={stripeCheckout} />
				</Suspense>
			) : null}

			{/* End trial confirmation modal */}
			<EndTrialModal isOpen={showEndTrialModal} onClose={() => setShowEndTrialModal(false)} />

			{/* Return modal (post sign-in redirect) */}
			{returnUrl ? (
				<ReturnModal
					isOpen={returnIntent === 'prompt'}
					onClose={() => setHandledReturnUrl(returnUrl)}
					returnUrl={returnUrl}
				/>
			) : null}

			<Toast />
		</div>
	)
}

export default function Subscription() {
	return (
		<>
			<SEO
				title="Subscribe to DefiLlama Pro Analytics - DefiLlama"
				description="Unlock LlamaAI, advanced DeFi analytics, custom dashboards, CSV downloads, and pro-level data with DefiLlama Pro."
				canonicalUrl="/subscription"
			/>
			<ClientOnly>
				<SubscriptionContent />
			</ClientOnly>
		</>
	)
}
