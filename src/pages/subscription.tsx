import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { SEO } from '~/components/SEO'
import { Toast } from '~/components/Toast'
import { EndTrialModal } from '~/containers/Account/EndTrialModal'
import { ReturnModal } from '~/containers/Subscription/components/ReturnModal'
import {
	COMPARISON_SECTIONS,
	FAQ_ITEMS,
	PLAN_ORDER,
	PRICING_CARDS_BY_CYCLE,
	TRUST_LOGOS
} from '~/containers/Subscription/data'
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
import { SignInModal } from '~/containers/Subscription/SignInModal'
import type { BillingCycle, PlanKey } from '~/containers/Subscription/types'
import { useSubscriptionPageState } from '~/containers/Subscription/usePageState'
import { applySlackAcquisitionFromQuery } from '~/containers/Subscription/utils/slackAcquisition'
import { ClientOnly } from '~/layout/ClientOnly'
import { safeInternalPath } from '~/utils/routerQuery'

const StripeCheckoutModal = lazy(() =>
	import('~/containers/Subscription/shared/StripeCheckoutModal').then((m) => ({ default: m.StripeCheckoutModal }))
)

const planKeyToSubType = (key: PlanKey): 'api' | 'llamafeed' => (key === 'api' ? 'api' : 'llamafeed')

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

	const [stripeCheckout, setStripeCheckout] = useState<{
		isOpen: boolean
		type: 'api' | 'llamafeed'
		billingInterval: 'year' | 'month'
		isTrial: boolean
		isUpgradeFlow: boolean
	} | null>(null)

	/* ── End trial modal ──────────────────────────────────────────────── */
	const [showEndTrialModal, setShowEndTrialModal] = useState(false)

	/* ── Slack acquisition source capture ─────────────────────────────── */
	useEffect(() => {
		if (typeof window === 'undefined' || !router.isReady) return
		applySlackAcquisitionFromQuery(router.query, window.sessionStorage)
	}, [router.isReady, router.query])

	/* ── Return modal (redirect after sign-in) ────────────────────────── */
	const [showReturnModal, setShowReturnModal] = useState(false)
	const handledReturnUrlRef = useRef<string | undefined>(undefined)

	useEffect(() => {
		let cancelled = false
		if (isAuthenticated && returnUrl && handledReturnUrlRef.current !== returnUrl && !loaders.userLoading) {
			if (isNewSignup) {
				handledReturnUrlRef.current = returnUrl
				const { returnUrl: _ignoredReturnUrl, ...nextQuery } = query
				void replace({ pathname, query: nextQuery }, undefined, { shallow: true })
				consumeSignupOutcome()
			} else {
				queueMicrotask(() => {
					if (cancelled) return
					handledReturnUrlRef.current = returnUrl
					setShowReturnModal(true)
				})
			}
		}

		return () => {
			cancelled = true
		}
	}, [isAuthenticated, returnUrl, loaders.userLoading, isNewSignup, consumeSignupOutcome, pathname, query, replace])

	/* ── Helpers ───────────────────────────────────────────────────────── */
	// Reverting a scheduled cancellation happens in the Stripe billing portal.
	const handleRevertCancellation = () => createPortalSession()

	const billingInterval = billingCycle === 'yearly' ? 'year' : 'month'

	const requireAuth = (action: () => void) => {
		if (!isAuthenticated) {
			signInDialog.show()
			return
		}
		action()
	}

	const requireVerified = (action: () => void) => {
		if (!user?.verified && !user?.walletAddress) {
			promptVerifyEmail(user?.id)
			return
		}
		action()
	}

	const openStripeCheckout = (
		type: 'api' | 'llamafeed',
		interval: 'year' | 'month',
		trial = false,
		upgrade = false
	) => {
		requireAuth(() => {
			requireVerified(() => {
				setStripeCheckout({ isOpen: true, type, billingInterval: interval, isTrial: trial, isUpgradeFlow: upgrade })
			})
		})
	}

	/* ── Card handlers ─────────────────────────────────────────────────── */
	const handlePrimaryCtaClick = (cardKey: PlanKey) => {
		if (cardKey === 'free') {
			signInDialog.show()
			return
		}
		if (cardKey === 'enterprise') {
			window.location.href = 'mailto:sales@defillama.com'
			return
		}
		openStripeCheckout(planKeyToSubType(cardKey), billingInterval)
	}

	const handleSecondaryCtaClick = (cardKey: PlanKey) => {
		requireAuth(() => {
			requireVerified(() => {
				void handleSubscribe('llamapay', planKeyToSubType(cardKey), undefined, billingInterval, false)
			})
		})
	}

	const handleUpgradeToYearly = (cardKey: PlanKey) => {
		openStripeCheckout(planKeyToSubType(cardKey), 'year', false, true)
	}

	const handleUpgradeTier = (cardKey: PlanKey) => {
		openStripeCheckout(planKeyToSubType(cardKey), billingInterval)
	}

	const handleStartTrial = () => {
		openStripeCheckout('llamafeed', 'month', true, false)
	}

	const PLAN_TIER: Record<PlanKey, number> = { free: 0, pro: 1, api: 2, enterprise: 3 }

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
			toast.error("Couldn't load your subscription. Retry loading it before changing plans.")
			return
		}

		// Plans not billed through the user's own Stripe account can't be changed
		// via self-serve checkout; say so instead of silently doing nothing.
		if (isManualSubscription || isTeamProvided) {
			toast.error(
				isTeamProvided
					? 'Your plan is provided through your team. Ask your team admin about plan changes.'
					: 'Your plan was provided by the DefiLlama team. Please contact the team to make changes.'
			)
			return
		}
		if (isAuthenticated && currentPlan && currentPlan !== 'free' && currentProvider !== 'stripe') {
			toast.error(
				currentProvider === 'llamapay' || currentProvider === 'legacy'
					? 'Your plan is billed through LlamaPay. Manage it at subscriptions.llamapay.io first.'
					: 'Your plan is billed through the app store. Manage it there first.'
			)
			return
		}

		// Same guards the pricing cards enforce
		if (isAuthenticated && currentPlan) {
			const isCurrentOrTrial = plan === currentPlan || (isTrial && plan === 'pro')
			const isLowerTier = PLAN_TIER[plan] < PLAN_TIER[currentPlan]
			if (isCurrentOrTrial || isLowerTier) return
		}

		if (plan === 'free') {
			if (!isAuthenticated) {
				signInDialog.show()
			}
			return
		}

		openStripeCheckout(planKeyToSubType(plan), billingInterval)
	}

	return (
		<div className="relative col-span-full min-h-screen w-full [overflow-x:clip] [overflow-y:visible] bg-sub-surface-page text-sub-text-primary dark:bg-sub-dark-page">
			<SubscriptionBackground />
			<SubscriptionHeader />

			<main className="relative z-10">
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
					onSecondaryCtaClick={handleSecondaryCtaClick}
					onUpgradeToYearly={handleUpgradeToYearly}
					onUpgradeTier={handleUpgradeTier}
					onStartTrial={handleStartTrial}
					onEndTrial={() => setShowEndTrialModal(true)}
					onRevertCancellation={() => void handleRevertCancellation()}
					isTrialAvailable={isTrialAvailable}
					loading={loading}
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
					<SubscriptionFaqBlock faqItems={FAQ_ITEMS} onStartTrial={isTrialAvailable ? handleStartTrial : undefined} />
				</section>
			</main>

			<SubscriptionFooter />

			{/* Sign-in dialog (opened programmatically by CTA buttons) */}
			<SignInModal store={signInDialog} />

			{/* Stripe checkout modal */}
			{stripeCheckout?.isOpen ? (
				<Suspense fallback={null}>
					<StripeCheckoutModal
						isOpen
						onClose={() => setStripeCheckout(null)}
						paymentMethod="stripe"
						type={stripeCheckout.type}
						billingInterval={stripeCheckout.billingInterval}
						isTrial={stripeCheckout.isTrial}
						isUpgradeFlow={stripeCheckout.isUpgradeFlow}
					/>
				</Suspense>
			) : null}

			{/* End trial confirmation modal */}
			<EndTrialModal isOpen={showEndTrialModal} onClose={() => setShowEndTrialModal(false)} />

			{/* Return modal (post sign-in redirect) */}
			{returnUrl ? (
				<ReturnModal isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} returnUrl={returnUrl} />
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
