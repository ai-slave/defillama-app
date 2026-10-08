import * as Ariakit from '@ariakit/react'
import { useId } from 'react'
import { PricingCard } from '~/containers/Subscription/components'
import type { BillingCycle, PlanKey, PricingCardCallbacks, PricingCardData } from '~/containers/Subscription/types'
import { SubscriptionCoverage } from './SubscriptionCoverage'

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
	const id = useId()
	const isMonthly = billingCycle === 'monthly'
	const isYearly = billingCycle === 'yearly'

	return (
		<section className="subscription-pricing mx-auto flex max-w-[1440px] flex-col items-center px-4 pt-14 md:px-10 md:pt-20 md:pb-32 2xl:px-32">
			<div className="pricing-original flex w-full flex-col items-center gap-9 text-center md:w-[600px]">
				<div className="flex items-center gap-2">
					<img src="/assets/defillama-dark.webp" alt="DefiLlama" className="h-14 w-auto md:h-10 dark:hidden" />
					<img src="/assets/logo_white.webp" alt="" className="hidden size-14 md:h-10 md:w-10 dark:block" />
					<span className="hidden heading-sm text-primary dark:inline">DefiLlama</span>
				</div>
				<div className="flex w-full flex-col items-center gap-7">
					<h1 className="heading-lg text-primary">
						The Smartest Way to Navigate <br className="hidden md:inline" />
						Onchain Data
					</h1>
					<p className="body-xl text-secondary md:w-[540px] md:body-lg">
						Analyze 6,000+ protocols across 400+ chains with AI, custom dashboards, live data feeds and premium API
						endpoints.
					</p>
				</div>
			</div>
			<SubscriptionCoverage />

			<div className="subscription-billing mt-9 flex flex-col items-center gap-3 md:mt-12 md:gap-5">
				<Ariakit.RadioProvider
					value={billingCycle}
					setValue={(value) => {
						if (value !== billingCycle) onBillingCycleChange(value as BillingCycle)
					}}
				>
					<Ariakit.RadioGroup
						aria-label="Billing cycle"
						className="relative flex w-[268px] rounded-full bg-surface p-1 md:w-[236px]"
					>
						<div
							className={`absolute top-1 left-1 h-14 w-[calc(50%-4px)] rounded-full bg-brand transition-transform duration-300 ease-in-out md:h-12 ${
								isYearly ? 'translate-x-full' : 'translate-x-0'
							}`}
						/>
						<label
							htmlFor={`${id}-monthly`}
							className={`relative z-10 flex h-14 flex-1 cursor-pointer items-center justify-center rounded-full label-lg transition-colors duration-300 has-focus-visible:focus-ring md:h-12 md:label-md ${
								isMonthly ? 'text-on-brand' : 'text-secondary hover:text-primary'
							}`}
						>
							<Ariakit.Radio id={`${id}-monthly`} value="monthly" className="sr-only" />
							Monthly
						</label>
						<label
							htmlFor={`${id}-yearly`}
							className={`relative z-10 flex h-14 flex-1 cursor-pointer flex-col items-center justify-center rounded-full label-lg transition-colors duration-300 has-focus-visible:focus-ring md:h-12 md:label-md ${
								isYearly ? 'text-on-brand' : 'text-secondary hover:text-primary'
							}`}
						>
							<Ariakit.Radio id={`${id}-yearly`} value="yearly" className="sr-only" aria-label="Yearly" />
							<span>Yearly</span>
							<span
								className={`label-sm transition-colors duration-300 md:label-xs ${isYearly ? 'text-on-brand' : 'text-link'}`}
							>
								Get 2 months free
							</span>
						</label>
					</Ariakit.RadioGroup>
				</Ariakit.RadioProvider>
				<p className="body-sm text-secondary">Cancel Anytime, Crypto &amp; Card Payments</p>
			</div>

			<div className="subscription-pricing-cards mt-9 flex w-full flex-wrap justify-center gap-4">
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
