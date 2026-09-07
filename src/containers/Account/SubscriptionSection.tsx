import { lazy, type ReactNode, Suspense, useState } from 'react'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import type { Subscription } from '~/auth/useSubscribe'
import { BasicLink } from '~/components/Link'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { useAiBalance } from '~/containers/Subscription/useTopup'
import { Icon } from '~/ui/Icon'
import { formatDate } from '~/utils/dateFormat'
import { ApiAccessCard } from './ApiAccessCard'
import { CancelSubscriptionModal } from './CancelSubscriptionModal'
import { EndTrialModal } from './EndTrialModal'
import { ExternalDataBalanceCard } from './ExternalDataBalanceCard'
import { SubscriptionCard } from './SubscriptionCard'
import { useTeam } from './Team/useTeam'
import { TrialSubscriptionCard } from './TrialSubscriptionCard'
import { TrialUpgradeBanner } from './TrialUpgradeBanner'

const TopupModal = lazy(() =>
	import('~/containers/Subscription/shared/TopupModal').then((m) => ({ default: m.TopupModal }))
)
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

function getOverageErrorText(error: Error, action: 'enable' | 'disable'): string {
	return error.message || `Failed to ${action} overage. Please try again.`
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
	isTopupLoading?: boolean
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
	const buttonLabel = planType === 'api' ? 'Upgrade API to Yearly' : 'Upgrade Pro to Yearly'

	return (
		<div className="flex items-center rounded-2xl border border-sub-brand-primary bg-sub-brand-primary/20 p-4">
			<div className="flex w-full flex-col gap-8.5 sm:w-[155px]">
				<div className="flex flex-col gap-3">
					<p className="bg-linear-to-r from-sub-brand-primary to-sub-brand-soft bg-clip-text text-lg leading-[22px] font-semibold text-transparent dark:from-sub-brand-secondary dark:to-sub-brand-softest dark:to-[64%]">
						Save {savings} with annual billing
					</p>
					<p className="text-xs leading-4 text-sub-text-primary">
						Switch to yearly and get 12 months of {subscriptionLabel} for the price of 10.
					</p>
				</div>
				<button
					type="button"
					onClick={onUpgrade}
					className="flex h-8 w-full items-center justify-center rounded-lg bg-sub-brand-primary px-3 text-xs font-medium text-on-brand"
				>
					{buttonLabel}
				</button>
			</div>
		</div>
	)
}

function FreeUpgradeBanner() {
	return (
		<div className="relative overflow-hidden rounded-2xl border border-sub-brand-primary bg-sub-brand-primary/20 p-4">
			<div className="relative z-10 flex max-w-[250px] flex-col gap-6.5">
				<div className="flex flex-col gap-3">
					<p className="bg-linear-to-r from-sub-brand-primary to-sub-brand-soft bg-clip-text text-lg leading-[22px] font-semibold text-transparent dark:from-sub-brand-secondary dark:to-sub-brand-softest dark:to-77%">
						Unlock the full power of DefiLlama
					</p>
					<p className="text-xs leading-4 text-sub-text-primary">
						Upgrade to Pro for advanced analytics tools, or get the API plan to power your own applications.
					</p>
				</div>
				<BasicLink
					href="/subscription"
					className="flex h-8 w-fit items-center rounded-lg bg-sub-brand-primary px-3 text-xs leading-4 font-medium text-on-brand"
				>
					View & Compare Plans
				</BasicLink>
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
		</div>
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
		<div className="flex flex-col gap-4 rounded-2xl border border-sub-warning-border-light bg-sub-warning-bg/10 p-4 dark:border-sub-warning-border-dark">
			<div className="flex items-start gap-2">
				<Icon
					name="alert-warning"
					height={20}
					width={20}
					className="mt-0.5 shrink-0 text-sub-warning-text-light dark:text-sub-warning-text-dark"
				/>
				<div className="flex flex-col gap-1">
					<h3 className="text-base font-semibold text-sub-warning-text-light dark:text-sub-warning-text-dark">
						{planName} Subscription Past Due
					</h3>
					<p className="text-sm text-sub-warning-text-light dark:text-sub-warning-text-dark">
						Your most recent payment failed. To keep your subscription active, update your payment method on Stripe.
						{onCancel ? ' Otherwise, you can cancel the overdue subscription below.' : ''}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				{canUpdatePayment && (
					<button
						type="button"
						onClick={onUpdatePayment}
						disabled={isUpdateLoading}
						className="flex h-9 items-center gap-1 rounded-lg bg-sub-brand-primary px-3 text-sm font-medium whitespace-nowrap text-on-brand disabled:opacity-50"
					>
						{isUpdateLoading ? 'Loading...' : 'Update Payment on Stripe'}
						{!isUpdateLoading && <Icon name="circle-external-link" height={16} width={16} className="shrink-0" />}
					</button>
				)}
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						className="flex h-9 items-center rounded-lg border border-sub-border-muted px-3 text-sm font-medium whitespace-nowrap text-sub-text-primary dark:border-sub-border-strong"
					>
						Cancel Subscription
					</button>
				)}
			</div>
		</div>
	)
}

function LegacyWarning() {
	return (
		<div className="flex items-start gap-2 rounded-2xl border border-sub-warning-border-light bg-sub-warning-bg/10 p-4 dark:border-sub-warning-border-dark">
			<Icon
				name="alert-warning"
				height={20}
				width={20}
				className="mt-0.5 shrink-0 text-sub-warning-text-light dark:text-sub-warning-text-dark"
			/>
			<p className="text-sm text-sub-warning-text-light dark:text-sub-warning-text-dark">
				Your current subscription is a legacy plan. You need to unsubscribe via{' '}
				<a href="https://subscriptions.llamapay.io/" target="_blank" rel="noopener noreferrer" className="underline">
					LlamaPay
				</a>{' '}
				and subscribe again after the current subscription expires.
			</p>
		</div>
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
		<div className="flex flex-col gap-3 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex items-center gap-2">
				<Icon name="users" height={20} width={20} className="text-sub-text-primary" />
				<span className="text-sm font-medium text-sub-text-primary">Team Subscription</span>
			</div>
			{hasAssigned ? (
				<p className="text-sm text-sub-text-muted">
					Your <span className="font-medium text-sub-text-primary">{getTeamSubLabel(subscriptionType)}</span>{' '}
					subscription is managed by <span className="font-medium text-sub-text-primary">{teamName}</span>. Billing and
					seat changes are handled by your team admin.
				</p>
			) : (
				<p className="text-sm text-sub-text-muted">
					You're a member of <span className="font-medium text-sub-text-primary">{teamName}</span>. Contact your team
					admin to be assigned a subscription.
				</p>
			)}
		</div>
	)
}

export function SubscriptionSection() {
	const { isTrial: isTrialFromAuth, hasActiveSubscription } = useAuthContext()
	const { team, isTeamError, isTeamRetrying, refetchTeam } = useTeam()

	const { balance, isLoading: isAiBalanceLoading } = useAiBalance()
	const [isTopupModalOpen, setIsTopupModalOpen] = useState(false)
	const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
	const [isCancelSubscriptionModalOpen, setIsCancelSubscriptionModalOpen] = useState(false)
	const [isCancelSubModalOpen, setIsCancelSubModalOpen] = useState(false)
	const [isCancelPastDueModalOpen, setIsCancelPastDueModalOpen] = useState(false)
	const [isYearlyUpgradeModalOpen, setIsYearlyUpgradeModalOpen] = useState(false)
	const [yearlyUpgradeType, setYearlyUpgradeType] = useState<'api' | 'llamafeed' | null>(null)
	const {
		apiSubscription,
		llamafeedSubscription,
		pastDueSubscription,
		isSubscriptionError,
		isSubscriptionRetrying,
		refetchSubscription,
		isPastDueError,
		refetchPastDueSubscription,
		credits,
		usageStats,
		isUsageStatsLoading,
		isUsageStatsError,
		createPortalSession,
		createPortalSessionMutation,
		generateNewKeyMutation,
		apiKey,
		isSubscriptionLoading,
		topupMutation,
		subscription,
		enableOverageMutation,
		disableOverageMutation
	} = useSubscribe()

	// Unknown team means unknown billing ownership: don't render personal billing
	// controls that may belong to a team seat.
	if (isTeamError) {
		return (
			<SubscriptionLoadError
				isRetrying={isTeamRetrying}
				onRetry={() => void refetchTeam()}
				message="Couldn't load your team. Please try again."
			/>
		)
	}

	const isTeamMember = Boolean(team && !team.isAdmin)
	const teamAssignedType = isTeamMember ? (team?.subscriptionType ?? null) : null

	// Members with an assigned seat are billed through the team: hide personal billing
	// controls and render only the feature cards the assigned subscription unlocks.
	// Members WITHOUT a seat fall through — membership alone doesn't cancel a personal
	// subscription, so any still-billed personal plan must stay visible.
	if (isTeamMember && team && teamAssignedType) {
		const teamBanner = <TeamSubscriptionBanner teamName={team.name} subscriptionType={teamAssignedType} />

		if (teamAssignedType === 'api') {
			const memberBalanceCard = balance ? (
				<ExternalDataBalanceCard
					freeRemaining={balance.freeRemaining}
					toppedUpBalance={balance.toppedUpBalance}
					freeLimit={balance.freeLimit}
					freeSpent={balance.freeSpent}
					isLoading={isAiBalanceLoading}
					onTopUp={() => setIsTopupModalOpen(true)}
				/>
			) : isAiBalanceLoading ? (
				<ExternalDataBalanceCard
					freeRemaining="0"
					toppedUpBalance="0"
					freeLimit="0"
					freeSpent="0"
					isLoading
					onTopUp={() => {}}
				/>
			) : null

			return (
				<>
					{teamBanner}
					<ApiAccessCard
						apiKey={apiKey}
						credits={credits}
						usageStats={usageStats}
						isUsageStatsLoading={isUsageStatsLoading}
						isUsageStatsError={isUsageStatsError}
						generateNewKeyMutation={generateNewKeyMutation}
					/>
					{memberBalanceCard}
					{isTopupModalOpen ? (
						<Suspense fallback={null}>
							<TopupModal isOpen={isTopupModalOpen} onClose={() => setIsTopupModalOpen(false)} />
						</Suspense>
					) : null}
				</>
			)
		}

		return teamBanner
	}

	// Unassigned team members still see their own billing below the membership notice.
	const teamBanner =
		isTeamMember && team ? <TeamSubscriptionBanner teamName={team.name} subscriptionType={null} /> : null

	// A failed read is unknown, not Free: show a retry state instead of an upsell
	// banner or a misleading payment warning.
	if (isSubscriptionError) {
		return (
			<>
				{teamBanner}
				<SubscriptionLoadError isRetrying={isSubscriptionRetrying} onRetry={() => void refetchSubscription()} />
			</>
		)
	}

	// The overdue check failing silently would read as "no payment problems".
	const pastDueCheckFailedNotice = isPastDueError ? (
		<p className="text-xs leading-4 text-sub-text-muted">
			Couldn't check payment status.{' '}
			<button
				type="button"
				onClick={() => void refetchPastDueSubscription()}
				className="underline hover:text-sub-brand-primary"
			>
				Retry
			</button>
		</p>
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
			setIsCancelSubModalOpen(true)
		} else if (activeSubscription?.provider === 'llamapay') {
			window.open('https://subscriptions.llamapay.io/', '_blank')
		}
	}

	const handleUpgradeToYearly = (type: 'llamafeed' | 'api') => {
		setYearlyUpgradeType(type)
		setIsYearlyUpgradeModalOpen(true)
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
	const isOverageToggleLoading = enableOverageMutation.isPending || disableOverageMutation.isPending
	const overageError = enableOverageMutation.isError
		? getOverageErrorText(enableOverageMutation.error, 'enable')
		: disableOverageMutation.isError
			? getOverageErrorText(disableOverageMutation.error, 'disable')
			: null

	const handleToggleOverage = () => {
		if (isOverageToggleLoading) return
		if (isOverageEnabled) {
			disableOverageMutation.mutate()
		} else {
			enableOverageMutation.mutate()
		}
	}

	// The cancel endpoint targets the active subscription first, so cancelling from
	// the overdue warning is only offered when the overdue record IS that subscription.
	const pastDueBanner = activePastDueSubscription ? (
		<PastDueSubscriptionCard
			subscription={activePastDueSubscription}
			onUpdatePayment={async () => {
				if (activePastDueSubscription.provider === 'stripe') {
					await createPortalSession()
				}
			}}
			onCancel={
				activePastDueSubscription.id === activeSubscription?.id ? () => setIsCancelPastDueModalOpen(true) : null
			}
			isUpdateLoading={createPortalSessionMutation.isPending}
		/>
	) : null

	const balanceCard =
		(hasProSubscription || hasApiSubscription) && balance ? (
			<ExternalDataBalanceCard
				freeRemaining={balance.freeRemaining}
				toppedUpBalance={balance.toppedUpBalance}
				freeLimit={balance.freeLimit}
				freeSpent={balance.freeSpent}
				isLoading={isAiBalanceLoading}
				onTopUp={() => setIsTopupModalOpen(true)}
			/>
		) : (hasProSubscription || hasApiSubscription) && isAiBalanceLoading ? (
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
			<CancelSubscriptionModal
				isOpen={isCancelSubscriptionModalOpen}
				onClose={() => setIsCancelSubscriptionModalOpen(false)}
			/>
			<CancelSubscriptionModal
				isOpen={isCancelSubModalOpen}
				onClose={() => setIsCancelSubModalOpen(false)}
				variant={isPastDue ? 'pastDue' : 'subscription'}
			/>
			<CancelSubscriptionModal
				isOpen={isCancelPastDueModalOpen}
				onClose={() => setIsCancelPastDueModalOpen(false)}
				variant="pastDue"
			/>
			<EndTrialModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} />
			{isTopupModalOpen ? (
				<Suspense fallback={null}>
					<TopupModal isOpen={isTopupModalOpen} onClose={() => setIsTopupModalOpen(false)} />
				</Suspense>
			) : null}
			{isYearlyUpgradeModalOpen && yearlyUpgradeType ? (
				<Suspense fallback={null}>
					<StripeCheckoutModal
						isOpen={isYearlyUpgradeModalOpen}
						onClose={() => {
							setIsYearlyUpgradeModalOpen(false)
							setYearlyUpgradeType(null)
						}}
						paymentMethod="stripe"
						type={yearlyUpgradeType}
						billingInterval="year"
						isUpgradeFlow
						upgradeReturnPath="/account?success=true"
					/>
				</Suspense>
			) : null}
		</>
	)

	let body: ReactNode = null
	if (isPastDue && pastDueSubscription) {
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
					onCancel={() => setIsCancelSubModalOpen(true)}
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
						onCancel={() => setIsCancelSubscriptionModalOpen(true)}
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
					usageStats={usageStats}
					isUsageStatsLoading={isUsageStatsLoading}
					isUsageStatsError={isUsageStatsError}
					generateNewKeyMutation={generateNewKeyMutation}
					canManageOverage={canManageOverage}
					isOverageEnabled={isOverageEnabled}
					onToggleOverage={handleToggleOverage}
					isOverageToggleLoading={isOverageToggleLoading}
					overageError={overageError}
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
