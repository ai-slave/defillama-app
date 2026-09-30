import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Icon } from '~/ui/Icon'
import { LoadingIndicator } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import { clearPendingTeamCheckout } from './pendingTeamCheckout'
import { seatPrice } from './seatPricing'
import { getCancelAtDate, isCancelingSub } from './subscriptionCancel'
import type { TeamSubscription } from './types'
import { UnconfirmedTeamWriteError, useTeam } from './useTeam'

const PurchaseSeatsModal = lazy(() => import('./PurchaseSeatsModal').then((m) => ({ default: m.PurchaseSeatsModal })))
const ManageSeatsModal = lazy(() => import('./ManageSeatsModal').then((m) => ({ default: m.ManageSeatsModal })))

function getSubscriptionLabel(type: string): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return type
}

function getIntervalSuffix(interval: 'month' | 'year'): string {
	return interval === 'year' ? '/year' : '/month'
}

function isActiveSub(sub: TeamSubscription): boolean {
	return sub.status === undefined || sub.status === 'active'
}

function isRenewingSub(sub: TeamSubscription): boolean {
	return isActiveSub(sub) && !isCancelingSub(sub)
}

function InfoRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="shrink-0 body-sm text-sub-text-muted">{label}</span>
			<div className="h-0 min-w-0 flex-1 border-b border-dashed border-sub-border" />
			<span className={`shrink-0 body-sm ${valueClassName || 'text-sub-text-primary'}`}>{value}</span>
		</div>
	)
}

function SubscriptionRow({ subscription }: { subscription: TeamSubscription }) {
	const { canChangeTeamBilling, billingWait, billingLockReason, upgradeSeatsMutation } = useTeam()
	const manageButtonRef = useRef<HTMLButtonElement>(null)
	const [showManageModal, setShowManageModal] = useState(false)
	const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false)

	const label = getSubscriptionLabel(subscription.type)
	const unit = seatPrice(subscription.type, subscription.billingInterval)
	const total = unit * subscription.seats.seatCount
	const intervalSuffix = getIntervalSuffix(subscription.billingInterval)
	const active = isActiveSub(subscription)
	const isCanceling = isCancelingSub(subscription)
	const cancelAtDate = getCancelAtDate(subscription)

	const isMonthly = subscription.billingInterval === 'month'
	const yearlyUnit = seatPrice(subscription.type, 'year')

	const handleConfirmUpgrade = () => {
		if (!canChangeTeamBilling) return
		upgradeSeatsMutation.mutate(
			{ subscriptionType: subscription.type },
			{
				onSuccess: () => {
					setShowUpgradeConfirm(false)
					toast.success('Subscription upgraded to yearly billing')
				}
			}
		)
	}

	return (
		<div className="flex flex-col gap-3 rounded-lg border border-sub-border-slate-100 p-3 dark:border-sub-border-strong">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-col">
					<span className="label-md text-sub-text-primary">
						{label} — {subscription.billingInterval === 'year' ? 'Yearly' : 'Monthly'}
					</span>
					<span className="body-sm text-sub-text-muted">
						{subscription.seats.seatCount} seat{subscription.seats.seatCount === 1 ? '' : 's'} × {formatUsd(unit)}
						{intervalSuffix}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-semibold text-sub-text-primary">{`${formatUsd(total)}${intervalSuffix}`}</span>
					{isMonthly && active && !isCanceling && (
						<Button
							type="button"
							size="md"
							onClick={() => setShowUpgradeConfirm(true)}
							disabled={!canChangeTeamBilling}
						>
							<Icon name="sparkles" height={14} width={14} />
							Upgrade to Yearly
						</Button>
					)}
					<Button
						type="button"
						size="md"
						ref={manageButtonRef}
						aria-label={`Manage ${label} seats`}
						onClick={() => setShowManageModal(true)}
						disabled={!canChangeTeamBilling}
					>
						<Icon name="settings" height={14} width={14} />
						Manage
					</Button>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<InfoRow label="Total seats" value={String(subscription.seats.seatCount)} />
				<InfoRow label="Occupied" value={String(subscription.seats.occupiedSeats)} />
				<InfoRow
					label="Available"
					value={String(subscription.seats.availableSeats)}
					valueClassName={subscription.seats.availableSeats > 0 ? 'text-sub-success' : 'text-sub-text-muted'}
				/>
				{isCanceling && cancelAtDate ? (
					<InfoRow label="Cancels on" value={formatDate(cancelAtDate) ?? '-'} valueClassName="text-error" />
				) : active ? (
					// The team response has no billing-period end, and deriving one from the row's
					// creation date goes wrong once an annual upgrade moves Stripe's billing anchor.
					<InfoRow label="Next billing" value="See the Stripe portal" valueClassName="text-sub-text-muted" />
				) : subscription.status ? (
					<InfoRow label="Status" value={subscription.status} valueClassName="capitalize text-sub-text-muted" />
				) : null}
			</div>

			{showManageModal && (
				<Suspense fallback={null}>
					<ManageSeatsModal
						isOpen={showManageModal}
						onClose={() => setShowManageModal(false)}
						subscription={subscription}
					/>
				</Suspense>
			)}

			<ConfirmDialog
				open={showUpgradeConfirm}
				onClose={() => {
					upgradeSeatsMutation.reset()
					setShowUpgradeConfirm(false)
				}}
				portal
				unmountOnHide
				finalFocus={manageButtonRef}
				tone="primary"
				title={`Upgrade ${label} to yearly`}
				// Stripe invoices the yearly price for every seat at once, credited for the unused monthly time.
				description={`Stripe charges your saved card now: up to ${formatUsd(yearlyUnit * subscription.seats.seatCount)} for ${subscription.seats.seatCount} seat${subscription.seats.seatCount === 1 ? '' : 's'} at ${formatUsd(yearlyUnit)}/year, less credit for the unused part of this month. The plan then renews yearly from today.`}
				confirmLabel="Upgrade to yearly"
				confirmDisabled={!upgradeSeatsMutation.isPending && billingLockReason !== null}
				pendingLabel={upgradeSeatsMutation.isPending ? 'Upgrading…' : null}
				waitingLabel={billingWait}
				// A lock blocks the confirm button, so it shows where a failure would.
				error={
					upgradeSeatsMutation.isError
						? upgradeSeatsMutation.error instanceof UnconfirmedTeamWriteError
							? `We couldn't confirm this upgrade. Your ${label} plan currently bills ${isMonthly ? 'monthly' : 'yearly'}.`
							: upgradeSeatsMutation.error.message
						: upgradeSeatsMutation.isPending
							? null
							: billingLockReason
				}
				onConfirm={handleConfirmUpgrade}
			/>
		</div>
	)
}

function BillingTotals({ subscriptions }: { subscriptions: Array<TeamSubscription> }) {
	const totals = { monthly: 0, yearly: 0 }
	for (const sub of subscriptions) {
		if (!isRenewingSub(sub)) continue
		const amount = seatPrice(sub.type, sub.billingInterval) * sub.seats.seatCount
		if (sub.billingInterval === 'year') totals.yearly += amount
		else totals.monthly += amount
	}

	if (totals.monthly === 0 && totals.yearly === 0) return null

	const rows: Array<{ id: string; label: string; value: string }> = []
	if (totals.monthly > 0) rows.push({ id: 'monthly', label: 'Total', value: `${formatUsd(totals.monthly)}/month` })
	if (totals.yearly > 0) rows.push({ id: 'yearly', label: 'Total', value: `${formatUsd(totals.yearly)}/year` })

	return (
		<div className="flex flex-col gap-1.5 rounded-lg bg-sub-brand-primary/5 p-3">
			{rows.map((row) => (
				<div key={row.id} className="flex flex-wrap items-center justify-between gap-2">
					<span className="label-md text-sub-text-primary">{row.label}</span>
					<span className="text-sm font-semibold text-sub-text-primary">{row.value}</span>
				</div>
			))}
		</div>
	)
}

function YearlyTip({ subscriptions }: { subscriptions: Array<TeamSubscription> }) {
	const monthlySubs = subscriptions.filter((sub) => isRenewingSub(sub) && sub.billingInterval === 'month')
	if (monthlySubs.length === 0) return null

	const monthlyTotal = monthlySubs.reduce((acc, sub) => acc + seatPrice(sub.type, 'month') * sub.seats.seatCount, 0)
	const yearlyTotal = monthlySubs.reduce((acc, sub) => acc + seatPrice(sub.type, 'year') * sub.seats.seatCount, 0)
	const savings = monthlyTotal * 12 - yearlyTotal

	return (
		<div className="flex items-start gap-2">
			<Icon name="sparkles" height={12} width={12} className="mt-1 shrink-0 text-sub-text-muted" />
			<p className="text-xs leading-5 text-sub-text-muted">
				Tip: switch to yearly billing and get 2 months free — save {formatUsd(savings)}/year on your current seats.
			</p>
		</div>
	)
}

export function TeamSeatsCard() {
	const { billingWait, canChangeTeamBilling, isTeamRefreshError, isTeamRetrying, refetchTeam, teamSubscriptions } =
		useTeam()
	const { createPortalSession, createPortalSessionMutation } = useSubscribe()
	const [showPurchaseModal, setShowPurchaseModal] = useState(false)
	const userId = useAuthContext().user?.id ?? null

	// A paid checkout's note holds a second checkout only until the team shows that plan.
	useEffect(() => {
		if (!userId) return
		for (const sub of teamSubscriptions) clearPendingTeamCheckout(userId, sub.type)
	}, [teamSubscriptions, userId])

	const hasStripe = teamSubscriptions.some((sub) => sub.provider === undefined || sub.provider === 'stripe')

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Icon name="receipt" height={20} width={20} className="text-sub-text-primary" />
					<span className="label-lg text-sub-text-primary">Subscriptions & Billing</span>
					{/* The one reason the billing buttons are disabled while it runs; a failed refresh's retry shows its own. */}
					<div role="status">
						{billingWait && !isTeamRefreshError ? <LoadingIndicator label={billingWait.replace('…', '')} /> : null}
					</div>
				</div>
				<div className="flex items-center gap-2">
					{teamSubscriptions.length > 0 && hasStripe && (
						<Button
							type="button"
							size="md"
							onClick={() => void createPortalSession()}
							pendingLabel={createPortalSessionMutation.isPending ? 'Opening…' : null}
						>
							<Icon name="external-link" height={14} width={14} />
							Manage in Stripe
						</Button>
					)}
					<Button
						type="button"
						variant="primary"
						size="md"
						disabled={!canChangeTeamBilling}
						onClick={() => setShowPurchaseModal(true)}
					>
						<Icon name="plus" height={14} width={14} />
						Purchase Seats
					</Button>
				</div>
			</div>

			{isTeamRefreshError ? (
				<SubscriptionLoadError
					message="Couldn't refresh team billing. Refresh before making another change."
					isRetrying={isTeamRetrying}
					onRetry={() => void refetchTeam()}
				/>
			) : null}

			{teamSubscriptions.length === 0 ? (
				<p className="body-sm text-tertiary">
					No seats purchased yet. Purchase seats to assign subscriptions to team members.
				</p>
			) : (
				<>
					<div className="flex flex-col gap-3">
						{teamSubscriptions.map((sub) => (
							<SubscriptionRow key={sub.id} subscription={sub} />
						))}
					</div>

					<BillingTotals subscriptions={teamSubscriptions} />

					<YearlyTip subscriptions={teamSubscriptions} />
				</>
			)}

			{showPurchaseModal && (
				<Suspense fallback={null}>
					<PurchaseSeatsModal isOpen={showPurchaseModal} onClose={() => setShowPurchaseModal(false)} />
				</Suspense>
			)}
		</div>
	)
}
