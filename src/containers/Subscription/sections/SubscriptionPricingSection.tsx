import { PricingCard } from '~/containers/Subscription/components'
import type { BillingCycle, PlanKey, PricingCardCallbacks, PricingCardData } from '~/containers/Subscription/types'

export function SubscriptionPricingSection({
	pricingCards,
	billingCycle,
	onBillingCycleChange,
	currentPlan = null,
	isAuthenticated = false,
	isTrial = false,
	isCancelPending = false,
	userBillingCycle = null,
	isManualSubscription = false,
	currentProvider = null,
	isTeamProvided = false,
	isPageStateLoading = false,
	...callbacks
}: {
	pricingCards: Array<PricingCardData>
	billingCycle: BillingCycle
	onBillingCycleChange: (nextBillingCycle: BillingCycle) => void
	currentPlan?: PlanKey | null
	isAuthenticated?: boolean
	isTrial?: boolean
	isCancelPending?: boolean
	userBillingCycle?: BillingCycle | null
	isManualSubscription?: boolean
	currentProvider?: string | null
	isTeamProvided?: boolean
	isPageStateLoading?: boolean
} & PricingCardCallbacks) {
	const isMonthly = billingCycle === 'monthly'
	const isYearly = billingCycle === 'yearly'

	return (
		<section className="mx-auto flex max-w-[1440px] flex-col items-center px-4 pt-14 md:px-10 md:pt-20 md:pb-32 2xl:px-32">
			<div className="flex w-full flex-col items-center gap-9 text-center md:w-[600px]">
				<div className="flex items-center gap-2">
					<img src="/assets/defillama-dark.webp" alt="DefiLlama" className="h-14 w-auto md:h-10 dark:hidden" />
					<img src="/assets/logo_white.webp" alt="" className="hidden size-14 md:h-10 md:w-10 dark:block" />
					<span className="hidden text-2xl font-bold text-on-brand md:text-xl dark:inline">DefiLlama</span>
				</div>
				<div className="flex w-full flex-col items-center gap-7">
					<h1 className="text-4xl leading-[44px] font-semibold text-sub-text-primary md:text-[40px] md:leading-[50px]">
						The Smartest Way to Navigate <br className="hidden md:inline" />
						Onchain Data
					</h1>
					<p className="text-lg leading-7 text-sub-text-cool md:w-[540px] md:text-base md:leading-6 md:text-sub-text-secondary dark:md:text-sub-text-secondary">
						Analyze 6,000+ protocols across 400+ chains with AI, custom dashboards, live data feeds and premium API
						endpoints.
					</p>
				</div>
			</div>

			<div className="mt-9 flex flex-col items-center gap-3 md:mt-12 md:gap-5">
				<div
					role="group"
					aria-label="Billing cycle"
					className="relative flex w-[268px] rounded-full bg-white p-1 md:w-[236px] dark:bg-sub-surface-dark"
				>
					<div
						className={`absolute top-1 left-1 h-14 w-[calc(50%-4px)] rounded-full bg-sub-brand-primary transition-transform duration-300 ease-in-out md:h-12 ${
							isYearly ? 'translate-x-full' : 'translate-x-0'
						}`}
					/>
					<button
						type="button"
						aria-pressed={isMonthly}
						onClick={() => onBillingCycleChange('monthly')}
						className={`relative z-10 h-14 flex-1 rounded-full text-base leading-5 font-medium transition-colors duration-300 md:h-12 md:text-sm ${
							isMonthly ? 'text-on-brand' : 'text-sub-heading md:text-sub-text-primary dark:text-sub-text-primary'
						}`}
					>
						Monthly
					</button>
					<button
						type="button"
						aria-pressed={isYearly}
						onClick={() => onBillingCycleChange('yearly')}
						className={`relative z-10 flex h-14 flex-1 flex-col items-center justify-center rounded-full text-base leading-5 font-medium transition-colors duration-300 md:h-12 md:text-sm ${
							isYearly ? 'text-on-brand' : 'text-sub-heading md:text-sub-text-primary dark:text-sub-text-primary'
						}`}
					>
						<span>Yearly</span>
						<span
							className={`text-xs leading-4 transition-colors duration-300 md:text-[10px] md:leading-3 ${isYearly ? 'text-sub-brand-softest' : 'text-sub-brand-secondary dark:text-sub-brand-softest'}`}
						>
							Get 2 months free
						</span>
					</button>
				</div>
				<p className="text-xs leading-4 text-sub-text-cool md:text-sub-text-secondary dark:md:text-sub-text-secondary">
					Cancel Anytime, Crypto &amp; Card Payments
				</p>
			</div>

			<div className="mt-9 flex w-full flex-wrap justify-center gap-4">
				{pricingCards.map((card) => (
					<PricingCard
						key={card.key}
						card={card}
						isCurrentPlan={card.key === currentPlan || (isTrial && card.key === 'pro')}
						isTrial={isTrial && card.key === 'pro'}
						isCancelPending={isCancelPending && (card.key === currentPlan || (isTrial && card.key === 'pro'))}
						isAuthenticated={isAuthenticated}
						currentPlan={currentPlan}
						billingCycle={billingCycle}
						userBillingCycle={userBillingCycle}
						isManualSubscription={isManualSubscription}
						currentProvider={currentProvider}
						isTeamProvided={isTeamProvided}
						isPageStateLoading={isPageStateLoading}
						{...callbacks}
					/>
				))}
			</div>
		</section>
	)
}
