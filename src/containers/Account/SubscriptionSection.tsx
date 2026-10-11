import { type ComponentProps, lazy, type ReactNode, Suspense, useState } from 'react'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import type { Subscription } from '~/auth/useSubscribe'
import { BasicLink } from '~/components/Link'
import { TopupModal } from '~/containers/Subscription/shared/TopupModal'
import { useStripeCheckout } from '~/containers/Subscription/shared/useStripeCheckout'
import { useAiBalance } from '~/containers/Subscription/useTopup'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { ApiAccessCard } from './ApiAccessCard'
import { CancelSubscriptionModal } from './CancelSubscriptionModal'
import { EndTrialModal } from './EndTrialModal'
import { ExternalDataBalanceCard } from './ExternalDataBalanceCard'
import { SubscriptionCard } from './SubscriptionCard'
import { useTeam } from './Team/useTeam'
import { TrialSubscriptionCard } from './TrialSubscriptionCard'
import { TrialUpgradeBanner } from './TrialUpgradeBanner'

const StripeCheckoutModal = lazy(() =>
	import('~/containers/Subscription/shared/StripeCheckoutModal').then((m) => ({ default: m.StripeCheckoutModal }))
)

function parseExpiryDate(raw: string): string | null {
	const asDate = new Date(isNaN(Number(raw)) ? raw : Number(raw) * 1000)
	if (isNaN(asDate.getTime())) {
		console.error(`[parseExpiryDate] Invalid expiry date: "${raw}"`)
		return null
	}
	return asDate.toISOString()
}

function getSubscriptionTypeLabel(subscription: { billing_interval?: string; type: string }): string {
	const isYearly = subscription.billing_interval === 'year'
	if (subscription.type === 'api') {
		return isYearly ? 'Yearly ($3,000/year)' : 'Monthly ($300/month)'
	}
	return isYearly ? 'Yearly ($490/year)' : 'Monthly ($49/month)'
}

function getPaymentLabel(provider: string): string {
	if (provider === 'stripe') return 'Stripe'
	if (provider === 'llamapay') return 'LlamaPay'
	if (provider === 'legacy') return 'Legacy'
	if (provider === 'manual') return 'Manual'
	return provider
}

function getPlanName(type: string): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return 'Free'
}

function SubscriptionCardWithProps({
	subscription,
	onManage,
	onCancel,
	onTopup,
	isManageLoading,
	isTopupLoading
}: {
	subscription: Subscription
	onManage: () => void
	onCancel: () => void
	onTopup?: () => void
	isManageLoading: boolean
	isTopupLoading: boolean
}) {
	const isCancelPending = subscription.metadata?.isCanceled === 'true'
	const expiryDate = parseExpiryDate(subscription.expires_at)
	return (
		<SubscriptionCard
			planName={getPlanName(subscription.type)}
			renewalDate={expiryDate ? (formatDate(expiryDate) ?? 'Unknown') : 'Unknown'}
			subscriptionType={getSubscriptionTypeLabel(subscription)}
			subscriptionPayment={getPaymentLabel(subscription.provider)}
			provider={subscription.provider}
			isTeamSeat={Boolean(subscription.team_id)}
			isCancelPending={isCancelPending}
			onManage={onManage}
			onCancel={onCancel}
			onTopup={onTopup}
			isManageLoading={isManageLoading}
			isTopupLoading={isTopupLoading}
		/>
	)
}

function YearlyUpgradeBanner({ onUpgrade, planType = 'pro' }: { onUpgrade: () => void; planType?: 'pro' | 'api' }) {
	const savings = planType === 'api' ? '$600/year' : '$98/year'
	const subscriptionLabel = planType === 'api' ? 'API subscription' : 'Pro subscription'
	const buttonLabel = planType === 'api' ? 'Upgrade API to yearly' : 'Upgrade Pro to yearly'

	return (
		<Card padding="md" tone="brand" className="flex items-center">
			<div className="flex w-full flex-col gap-8.5 sm:w-[155px]">
				<div className="flex flex-col gap-3">
					<p className="sub-gradient-text heading-xs">Save {savings} with annual billing</p>
					<p className="body-sm text-primary">
						Switch to yearly and get 12 months of {subscriptionLabel} for the price of 10.
					</p>
				</div>
				<Button variant="primary" size="md" onClick={onUpgrade} className="w-full">
					{buttonLabel}
				</Button>
			</div>
		</Card>
	)
}

function FreeUpgradeBanner() {
	return (
		<Card padding="md" tone="brand" className="relative overflow-hidden">
			<div className="relative z-10 flex max-w-[250px] flex-col gap-6.5">
				<div className="flex flex-col gap-3">
					<p className="sub-gradient-text heading-xs">Unlock the full power of DefiLlama</p>
					<p className="body-sm text-primary">
						Upgrade to Pro for advanced analytics tools, or get the API plan to power your own applications.
					</p>
				</div>
				<Button as={BasicLink} variant="primary" size="md" href="/subscription" className="w-fit">
					View & compare plans
				</Button>
			</div>

			<div
				className="pointer-events-none absolute inset-0"
				style={{
					maskImage: 'linear-gradient(to right, transparent 28%, rgba(0,0,0,0.35) 100%)',
					WebkitMaskImage: 'linear-gradient(to right, transparent 28%, rgba(0,0,0,0.35) 100%)'
				}}
			>
				<img
					src="/assets/sub_plans_bg_light.png"
					alt=""
					loading="lazy"
					className="absolute inset-0 h-full w-full object-fill dark:hidden"
				/>
				<img
					src="/assets/sub_plans_bg_dark.png"
					alt=""
					loading="lazy"
					className="absolute inset-0 hidden h-full w-full object-fill dark:block"
				/>
			</div>
		</Card>
	)
}

function PastDueSubscriptionCard({
	subscription,
	onUpdatePayment,
	onCancel,
	isUpdateLoading
}: {
	subscription: Subscription
	onUpdatePayment: () => void
	// The cancel endpoint targets the user's active subscription first, so the
	// cancel action is only offered when the overdue record is that subscription.
	onCancel: (() => void) | null
	isUpdateLoading: boolean
}) {
	const planName = getPlanName(subscription.type)
	const canUpdatePayment = subscription.provider === 'stripe'
	return (
		<Card padding="md" tone="warning" className="flex flex-col gap-4">
			<div className="flex items-start gap-2">
				{/* Centered on the heading's first line. */}
				<span className="flex h-lh shrink-0 items-center title-lg">
					<Icon name="alert-triangle" className="size-5 text-warning" />
				</span>
				<div className="flex flex-col gap-1">
					<h3 className="title-lg text-warning">{planName} subscription past due</h3>
					<p className="body-md text-warning">
						Your most recent payment failed. To keep your subscription active, update your payment method on Stripe.
						{onCancel ? ' Otherwise, you can cancel the overdue subscription below.' : ''}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				{canUpdatePayment && (
					<Button
						variant="primary"
						size="md"
						onClick={onUpdatePayment}
						pendingLabel="Opening Stripe…"
						pending={isUpdateLoading}
					>
						Update payment on Stripe
						<Icon name="external-link" className="size-3.5 shrink-0" />
					</Button>
				)}
				{onCancel && (
					<Button variant="secondary" size="md" onClick={onCancel}>
						Cancel subscription
					</Button>
				)}
			</div>
		</Card>
	)
}

function LegacyWarning() {
	return (
		<Card padding="md" tone="warning" className="flex items-start gap-2 body-md">
			<span className="flex h-lh shrink-0 items-center">
				<Icon name="alert-triangle" className="size-5 text-warning" />
			</span>
			<p className="text-warning">
				Your current subscription is a legacy plan. You need to unsubscribe via{' '}
				<a href="https://subscriptions.llamapay.io/" target="_blank" rel="noopener noreferrer" className="underline">
					LlamaPay
				</a>{' '}
				and subscribe again after the current subscription expires.
			</p>
		</Card>
	)
}

function getTeamSubLabel(type: string | null): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return ''
}

function TeamSubscriptionBanner({ teamName, subscriptionType }: { teamName: string; subscriptionType: string | null }) {
	const hasAssigned = subscriptionType !== null

	return (
		<Card padding="md" className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<Icon name="users" className="size-5 text-primary" />
				<span className="label-md text-primary">Team subscription</span>
			</div>
			{hasAssigned ? (
				<p className="body-md text-tertiary">
					Your <span className="font-medium text-primary">{getTeamSubLabel(subscriptionType)}</span> subscription is
					managed by <span className="font-medium text-primary">{teamName}</span>. Billing and seat changes are handled
					by your team admin.
				</p>
			) : (
				<p className="body-md text-tertiary">
					You're a member of <span className="font-medium text-primary">{teamName}</span>. Contact your team admin to be
					assigned a subscription.
				</p>
			)}
		</Card>
	)
}

export function SubscriptionSection() {
	const { isTrial: isTrialFromAuth, hasActiveSubscription } = useAuthContext()
	const { team, isTeamLoading, isTeamError, isTeamRetrying, refetchTeam } = useTeam()

	const { balance, isLoading: isAiBalanceLoading } = useAiBalance()
	const [isTopupModalOpen, setIsTopupModalOpen] = useState(false)
	const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
	// The promise the cancel dialog makes is fixed when it opens, so a refetch cannot rewrite it mid-flow.
	const [cancelDialog, setCancelDialog] = useState<{
		open: boolean
		variant: ComponentProps<typeof CancelSubscriptionModal>['variant']
	}>({ open: false, variant: 'subscription' })
	const openCancelDialog = (variant: typeof cancelDialog.variant) => setCancelDialog({ open: true, variant })
	const yearlyUpgrade = useStripeCheckout()
	const {
		apiSubscription,
		llamafeedSubscription,
		pastDueSubscription,
		isSubscriptionError,
		isSubscriptionRetrying,
		refetchSubscription,
		isPastDueError,
		isPastDueRetrying,
		refetchPastDueSubscription,
		credits,
		usageStatsQuery,
		createPortalSession,
		createPortalSessionMutation,
		generateNewKeyMutation,
		apiKey,
		isSubscriptionLoading,
		topupMutation,
		subscription,
		setOverageMutation
	} = useSubscribe()

	const isTeamMember = Boolean(team && !team.isAdmin)
	const teamAssignedType = isTeamMember ? (team?.subscriptionType ?? null) : null
	// Unassigned team members still see their own billing below the membership notice.
	const teamBanner =
		isTeamMember && team ? <TeamSubscriptionBanner teamName={team.name} subscriptionType={teamAssignedType} /> : null

	// The overdue check failing silently would read as "no payment problems".
	const pastDueCheckFailedNotice = isPastDueError ? (
		<InlineStatus variant="error" retry={{ refetch: refetchPastDueSubscription, isFetching: isPastDueRetrying }}>
			Couldn&apos;t check payment status.
		</InlineStatus>
	) : null

	const hasProSubscription = llamafeedSubscription?.status === 'active'
	const hasApiSubscription = apiSubscription?.status === 'active'
	const activeSubscription = hasApiSubscription ? apiSubscription : hasProSubscription ? llamafeedSubscription : null
	const isPastDue = Boolean(pastDueSubscription?.id) && !hasApiSubscription && !hasProSubscription
	// Payment health is separate from access: a subscription can keep access while
	// its latest payment failed. Surface the overdue warning alongside the plan cards.
	const activePastDueSubscription = activeSubscription && pastDueSubscription?.id ? pastDueSubscription : null
	const isProMonthly = hasProSubscription && llamafeedSubscription?.billing_interval === 'month'
	const isApiMonthly = hasApiSubscription && apiSubscription?.billing_interval === 'month'
	const isTrial = hasProSubscription && (isTrialFromAuth || String(llamafeedSubscription?.metadata?.isTrial) === 'true')

	const isLegacy = activeSubscription?.provider === 'legacy'
	const isCancelPending = activeSubscription?.metadata?.isCanceled === 'true'

	const handleManageSubscription = async () => {
		if (activeSubscription?.provider === 'stripe') {
			await createPortalSession()
		} else if (activeSubscription?.provider === 'llamapay') {
			window.open('https://subscriptions.llamapay.io/', '_blank')
		}
	}

	const handleCancelSubscription = () => {
		if (activeSubscription?.provider === 'stripe') {
			openCancelDialog(isActivePastDue ? 'pastDue' : 'subscription')
		} else if (activeSubscription?.provider === 'llamapay') {
			window.open('https://subscriptions.llamapay.io/', '_blank')
		}
	}

	const handleUpgradeToYearly = (type: 'llamafeed' | 'api') => {
		yearlyUpgrade.open({
			type,
			billingInterval: 'year',
			isUpgradeFlow: true,
			upgradeReturnPath: '/account?success=true'
		})
	}

	const handleTopup = () => {
		if (!activeSubscription) return
		topupMutation.mutate({ type: activeSubscription.type === 'api' ? 'api' : 'llamafeed' })
	}

	const isMonthlyLlamapay = subscription?.provider === 'llamapay' && subscription?.billing_interval === 'month'

	const isOverageEnabled = Boolean(apiSubscription?.overage)
	// The overage endpoints only operate on the user's own Stripe API subscription;
	// seat-derived team records look like Stripe but have no Stripe subscription behind them.
	const canManageOverage = hasApiSubscription && apiSubscription?.provider === 'stripe' && !apiSubscription?.team_id
	// The cancel endpoint targets the active subscription first, so canceling from
	// the overdue warning is only offered when the overdue record IS that subscription.
	const isActivePastDue = activePastDueSubscription != null && activePastDueSubscription.id === activeSubscription?.id
	const pastDueBanner = activePastDueSubscription ? (
		<PastDueSubscriptionCard
			subscription={activePastDueSubscription}
			onUpdatePayment={async () => {
				if (activePastDueSubscription.provider === 'stripe') {
					await createPortalSession()
				}
			}}
			onCancel={isActivePastDue ? () => openCancelDialog('pastDue') : null}
			isUpdateLoading={createPortalSessionMutation.isPending}
		/>
	) : null

	const hasBalancePlan = hasProSubscription || hasApiSubscription || teamAssignedType === 'api'
	const balanceCard =
		hasBalancePlan && balance ? (
			<ExternalDataBalanceCard
				freeRemaining={balance.freeRemaining}
				toppedUpBalance={balance.toppedUpBalance}
				freeLimit={balance.freeLimit}
				freeSpent={balance.freeSpent}
				isLoading={isAiBalanceLoading}
				onTopUp={() => setIsTopupModalOpen(true)}
			/>
		) : hasBalancePlan && isAiBalanceLoading ? (
			<ExternalDataBalanceCard
				freeRemaining="0"
				toppedUpBalance="0"
				freeLimit="0"
				freeSpent="0"
				isLoading
				onTopUp={() => {}}
			/>
		) : null

	// Dialogs mount once, outside the entitlement branches: their success actions
	// invalidate the very queries that select a branch, and an exclusive mount
	// would unmount the success pane as soon as the refetch lands.
	const dialogs = (
		<>
			{/* The server cancels a past-due subscription at once and any other at the period's end, so the warning's Cancel
			    and the plan card's Cancel open the same promise. */}
			<CancelSubscriptionModal
				isOpen={cancelDialog.open}
				variant={cancelDialog.variant}
				onClose={() => setCancelDialog((dialog) => ({ ...dialog, open: false }))}
			/>
			<EndTrialModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} />
			{isTopupModalOpen ? <TopupModal isOpen={isTopupModalOpen} onClose={() => setIsTopupModalOpen(false)} /> : null}
			{yearlyUpgrade.isOpen ? (
				<Suspense fallback={null}>
					<StripeCheckoutModal checkout={yearlyUpgrade} />
				</Suspense>
			) : null}
		</>
	)

	let body: ReactNode = null
	// Unknown team means unknown billing ownership: personal billing controls may belong to a team seat, so none render
	// until the team read answers. Every branch keeps the dialogs mounted: a refetch can switch branches while a
	// dialog's result is on screen.
	if (isTeamError) {
		body = (
			<InlineStatus variant="error" retry={{ refetch: refetchTeam, isFetching: isTeamRetrying }}>
				Couldn&apos;t load your team.
			</InlineStatus>
		)
	} else if (isTeamLoading) {
		body = null
	} else if (teamBanner && teamAssignedType) {
		// Members with an assigned seat are billed through the team: no personal billing controls, only the feature
		// cards the assigned subscription unlocks. Members without a seat fall through: membership alone doesn't cancel
		// a personal subscription, so any still-billed personal plan stays visible.
		body =
			teamAssignedType === 'api' ? (
				<>
					{teamBanner}
					<ApiAccessCard
						apiKey={apiKey}
						credits={credits}
						usageStatsQuery={usageStatsQuery}
						generateNewKeyMutation={generateNewKeyMutation}
					/>
					{balanceCard}
				</>
			) : (
				teamBanner
			)
	} else if (isSubscriptionError) {
		// A failed read is unknown, not Free: show a retry state instead of an upsell
		// banner or a misleading payment warning.
		body = (
			<>
				{teamBanner}
				<InlineStatus variant="error" retry={{ refetch: refetchSubscription, isFetching: isSubscriptionRetrying }}>
					Couldn&apos;t load your subscription.
				</InlineStatus>
			</>
		)
	} else if (isPastDue && pastDueSubscription) {
		body = (
			<>
				{teamBanner}
				<PastDueSubscriptionCard
					subscription={pastDueSubscription}
					onUpdatePayment={async () => {
						if (pastDueSubscription.provider === 'stripe') {
							await createPortalSession()
						}
					}}
					onCancel={() => openCancelDialog('pastDue')}
					isUpdateLoading={createPortalSessionMutation.isPending}
				/>
			</>
		)
	} else if (isTrial && llamafeedSubscription) {
		body = (
			<>
				{teamBanner}
				{pastDueBanner}
				{pastDueCheckFailedNotice}
				<div className="flex flex-col items-stretch gap-3 sm:flex-row">
					<TrialSubscriptionCard
						trialEndDate={parseExpiryDate(llamafeedSubscription.expires_at)}
						isCancelPending={llamafeedSubscription.metadata?.isCanceled === 'true'}
						onCancel={() => openCancelDialog('trial')}
					/>
					<TrialUpgradeBanner onUpgrade={() => setIsUpgradeModalOpen(true)} />
				</div>
			</>
		)
	} else if (!activeSubscription) {
		body =
			isSubscriptionLoading || hasActiveSubscription ? (
				teamBanner
			) : (
				<>
					{teamBanner}
					{pastDueCheckFailedNotice}
					<FreeUpgradeBanner />
				</>
			)
	} else if (hasApiSubscription) {
		body = (
			<>
				{teamBanner}
				{pastDueBanner}
				{pastDueCheckFailedNotice}
				{isLegacy && <LegacyWarning />}
				<div className="flex flex-col items-stretch gap-3 sm:flex-row">
					<SubscriptionCardWithProps
						subscription={activeSubscription}
						onManage={handleManageSubscription}
						onCancel={handleCancelSubscription}
						onTopup={isMonthlyLlamapay ? handleTopup : undefined}
						isManageLoading={createPortalSessionMutation.isPending}
						isTopupLoading={topupMutation.isPending}
					/>
					{isApiMonthly && !isCancelPending && apiSubscription?.provider === 'stripe' && !apiSubscription?.team_id && (
						<YearlyUpgradeBanner onUpgrade={() => handleUpgradeToYearly('api')} planType="api" />
					)}
				</div>
				<ApiAccessCard
					apiKey={apiKey}
					credits={credits}
					usageStatsQuery={usageStatsQuery}
					generateNewKeyMutation={generateNewKeyMutation}
					overage={
						canManageOverage
							? {
									enabled: isOverageEnabled,
									onToggle: () => setOverageMutation.mutate(!isOverageEnabled),
									isPending: setOverageMutation.isPending,
									error: setOverageMutation.error?.message ?? null
								}
							: null
					}
				/>
				{balanceCard}
			</>
		)
	} else {
		body = (
			<>
				{teamBanner}
				{pastDueBanner}
				{pastDueCheckFailedNotice}
				<div className="flex flex-col items-stretch gap-3 sm:flex-row">
					<SubscriptionCardWithProps
						subscription={activeSubscription}
						onManage={handleManageSubscription}
						onCancel={handleCancelSubscription}
						onTopup={isMonthlyLlamapay ? handleTopup : undefined}
						isManageLoading={createPortalSessionMutation.isPending}
						isTopupLoading={topupMutation.isPending}
					/>
					{isProMonthly &&
						!isCancelPending &&
						llamafeedSubscription?.provider === 'stripe' &&
						!llamafeedSubscription?.team_id && (
							<YearlyUpgradeBanner onUpgrade={() => handleUpgradeToYearly('llamafeed')} planType="pro" />
						)}
				</div>
				{balanceCard}
			</>
		)
	}

	return (
		<>
			{body}
			{dialogs}
		</>
	)
}
