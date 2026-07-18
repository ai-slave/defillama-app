import { lazy, Suspense, useState } from 'react'
import { Icon } from '~/components/Icon'
import { PaymentButton } from '~/containers/Subscription/Crypto'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useSubscribe } from '~/containers/Subscription/useSubscribe'

const StripeCheckoutModal = lazy(() =>
	import('~/components/StripeCheckoutModal').then((m) => ({ default: m.StripeCheckoutModal }))
)

export function SubscribeAPICard({
	context = 'page',
	active = false,
	onCancelSubscription,
	isCancelPending = false,
	isLegacyActive = false,
	billingInterval = 'month',
	currentBillingInterval
}: {
	context?: 'page' | 'account'
	active?: boolean
	onCancelSubscription?: () => void
	isCancelPending?: boolean
	isLegacyActive?: boolean
	billingInterval?: 'year' | 'month'
	currentBillingInterval?: 'year' | 'month'
}) {
	const monthlyPrice = 300
	const yearlyPrice = monthlyPrice * 10
	const displayPrice = billingInterval === 'year' ? yearlyPrice / 12 : monthlyPrice
	const displayPeriod = '/month'
	const { loading } = useSubscribe()
	const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)

	const handleUpgradeToYearly = () => {
		setIsUpgradeModalOpen(true)
	}

	return (
		<>
			<h2 className="relative z-10 text-center text-[2rem] font-extrabold whitespace-nowrap text-sub-purple">API</h2>
			<div className="relative z-10 mt-1 flex flex-col items-center justify-center">
				<div className="flex items-center">
					<span className="bg-linear-to-r from-sub-purple to-sub-purple-soft bg-clip-text text-center text-2xl font-medium text-transparent">
						{displayPrice} USD
					</span>
					<span className="ml-1 text-sub-text-muted">{displayPeriod}</span>
				</div>
				{billingInterval === 'year' ? (
					<span className="text-sm text-sub-text-muted">${yearlyPrice.toLocaleString('en-US')}/year</span>
				) : null}
			</div>
			{billingInterval === 'month' ? (
				<p className="relative z-10 mt-1 text-center font-medium text-sub-text-muted">Multiple payment options</p>
			) : null}
			<ul className="mx-auto mb-auto flex w-full flex-col gap-3 py-6 max-sm:text-sm">
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>All features included in Pro tier</span>
				</li>
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>Access to TVL, revenue/fees and prices API endpoints</span>
				</li>
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>Access to all data (unlocks, active users, token liq...)</span>
				</li>
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>Priority support</span>
				</li>
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>Access to DefiLlama MCP Server for AI agents</span>
				</li>
				<p className="px-6.5 font-medium">
					<a href="https://api-docs.defillama.com/" target="_blank" rel="noreferrer noopener" className="underline">
						Pro API
					</a>{' '}
					limits:
				</p>
				<li className="flex flex-col gap-2 px-6.5">
					<span>1000 requests/minute</span>
				</li>
				<li className="flex flex-col gap-2 px-6.5">
					<span>1M calls/month</span>
				</li>
				<li className="flex flex-col gap-2 px-6.5">
					<span>$0.60 per 1,000 additional calls after 1M limit</span>
				</li>
			</ul>
			<div className="relative z-10 mx-auto flex w-full max-w-[408px] flex-col gap-3">
				{active && !isLegacyActive ? (
					<div className="flex flex-col gap-2">
						<span className="text-center font-bold text-success">Current Plan</span>
						{currentBillingInterval === 'month' || !currentBillingInterval ? (
							<div className="flex flex-col gap-2">
								<button
									className="w-full rounded-lg border border-sub-purple bg-sub-purple px-4 py-3 font-medium text-on-brand shadow-xs transition-all duration-200 hover:bg-sub-purple-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
									onClick={handleUpgradeToYearly}
									disabled={loading === 'stripe'}
								>
									{loading === 'stripe' ? 'Processing...' : 'Upgrade to Yearly'}
								</button>
								<p className="text-center text-xs text-sub-text-muted">
									Switch to annual billing and get 2 months free
								</p>
							</div>
						) : null}
						{isCancelPending ? (
							<p className="mt-2 text-center text-sm text-warning">Cancellation scheduled</p>
						) : onCancelSubscription ? (
							<button
								className="mt-2 w-full rounded-lg bg-sub-dark-card px-4 py-2 text-on-brand transition-colors hover:bg-sub-line"
								onClick={onCancelSubscription}
							>
								Cancel Subscription
							</button>
						) : null}
					</div>
				) : context === 'account' || isLegacyActive ? (
					<div className="mt-2 flex flex-col gap-6">
						<div className="flex flex-col items-center">
							<div className={`grid w-full gap-3 ${billingInterval === 'year' ? 'grid-cols-1' : 'grid-cols-2'}`}>
								{billingInterval === 'month' ? (
									<PaymentButton paymentMethod="llamapay" type="api" billingInterval={billingInterval} />
								) : null}
								<PaymentButton paymentMethod="stripe" type="api" billingInterval={billingInterval} />
							</div>
						</div>
					</div>
				) : (
					<>
						{context === 'page' ? (
							<>
								<SignInModal text="Already a subscriber? Sign In" />
								<div
									className={`grid gap-3 max-sm:w-full max-sm:grid-cols-1 ${billingInterval === 'year' ? 'grid-cols-1' : 'grid-cols-2'}`}
								>
									{billingInterval === 'month' ? (
										<PaymentButton paymentMethod="llamapay" type="api" billingInterval={billingInterval} />
									) : null}
									<PaymentButton paymentMethod="stripe" type="api" billingInterval={billingInterval} />
								</div>
							</>
						) : null}
					</>
				)}
			</div>

			{isUpgradeModalOpen ? (
				<Suspense fallback={<></>}>
					<StripeCheckoutModal
						isOpen={isUpgradeModalOpen}
						onClose={() => setIsUpgradeModalOpen(false)}
						paymentMethod="stripe"
						type="api"
						billingInterval="year"
						isUpgradeFlow
					/>
				</Suspense>
			) : null}
		</>
	)
}
