import { lazy, Suspense, useRef, useState } from 'react'
import { useSubscribe } from '~/auth/useSubscribe'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { Icon } from '~/ui/Icon'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import { ConfirmActionModal } from './ConfirmActionModal'
import type { TeamSubscription } from './types'
import { useTeam } from './useTeam'

const PurchaseSeatsModal = lazy(() => import('./PurchaseSeatsModal').then((m) => ({ default: m.PurchaseSeatsModal })))
const ManageSeatsModal = lazy(() => import('./ManageSeatsModal').then((m) => ({ default: m.ManageSeatsModal })))

function getSubscriptionLabel(type: string): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return type
}

function getUnitPrice(type: string, billingInterval: 'month' | 'year'): number {
	if (type === 'api') return billingInterval === 'year' ? 3000 : 300
	return billingInterval === 'year' ? 490 : 49
}

function getIntervalSuffix(interval: 'month' | 'year'): string {
	return interval === 'year' ? '/year' : '/month'
}

function parseBackendDate(raw: string): Date | null {
	// Backend returns "2026-05-17 08:24:42.000Z" with a space; normalize to ISO.
	const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T')
	const date = new Date(isoLike)
	return isNaN(date.getTime()) ? null : date
}

function isActiveSub(sub: TeamSubscription): boolean {
	return sub.status === undefined || sub.status === 'active'
}

function getCancelAtDate(sub: TeamSubscription): Date | null {
	if (sub.cancelsAt) {
		const parsed = parseBackendDate(sub.cancelsAt)
		if (parsed) return parsed
	}
	if (sub.canceledAtPeriodEnd && typeof sub.effectiveAt === 'number') {
		const fromSeconds = new Date(sub.effectiveAt * 1000)
		if (!isNaN(fromSeconds.getTime())) return fromSeconds
	}
	return null
}

function isCancelingSub(sub: TeamSubscription): boolean {
	return sub.canceledAtPeriodEnd === true || Boolean(sub.cancelsAt) || getCancelAtDate(sub) !== null
}

function isRenewingSub(sub: TeamSubscription): boolean {
	return isActiveSub(sub) && !isCancelingSub(sub)
}

function InfoRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="shrink-0 text-xs leading-4 text-sub-text-muted">{label}</span>
			<div className="h-0 min-w-0 flex-1 border-b border-dashed border-sub-border" />
			<span className={`shrink-0 text-xs leading-4 ${valueClassName || 'text-sub-text-primary'}`}>{value}</span>
		</div>
	)
}

function SubscriptionRow({ subscription }: { subscription: TeamSubscription }) {
	const { canChangeTeamBilling, upgradeSeatsMutation } = useTeam()
	const manageButtonRef = useRef<HTMLButtonElement>(null)
	const [showManageModal, setShowManageModal] = useState(false)
	const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false)

	const label = getSubscriptionLabel(subscription.type)
	const unit = getUnitPrice(subscription.type, subscription.billingInterval)
	const total = unit * subscription.seats.seatCount
	const intervalSuffix = getIntervalSuffix(subscription.billingInterval)
	const active = isActiveSub(subscription)
	const isCanceling = isCancelingSub(subscription)
	const cancelAtDate = getCancelAtDate(subscription)

	const isMonthly = subscription.billingInterval === 'month'

	const handleConfirmUpgrade = () => {
		if (!canChangeTeamBilling) return
		upgradeSeatsMutation.mutate(
			{ subscriptionType: subscription.type },
			{ onSuccess: () => setShowUpgradeConfirm(false) }
		)
	}

	return (
		<div className="flex flex-col gap-3 rounded-lg border border-sub-border-slate-100 p-3 dark:border-sub-border-strong">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-col">
					<span className="text-sm font-medium text-sub-text-primary">
						{label} — {subscription.billingInterval === 'year' ? 'Yearly' : 'Monthly'}
					</span>
					<span className="text-xs text-sub-text-muted">
						{subscription.seats.seatCount} seat{subscription.seats.seatCount === 1 ? '' : 's'} × {formatUsd(unit)}
						{intervalSuffix}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-semibold text-sub-text-primary">{`${formatUsd(total)}${intervalSuffix}`}</span>
					{isMonthly && active && !isCanceling && (
						<button
							type="button"
							onClick={() => setShowUpgradeConfirm(true)}
							disabled={!canChangeTeamBilling}
							className="flex min-h-8 items-center gap-1.5 rounded-lg border border-sub-border-slate-100 px-2.5 text-xs font-medium whitespace-nowrap text-sub-text-primary hover:bg-sub-brand-primary/5 disabled:opacity-50 dark:border-sub-border-strong"
						>
							<Icon name="sparkles" height={12} width={12} />
							Upgrade to Yearly
						</button>
					)}
					<button
						type="button"
						ref={manageButtonRef}
						aria-label={`Manage ${label} seats`}
						onClick={() => setShowManageModal(true)}
						disabled={!canChangeTeamBilling}
						className="flex min-h-8 items-center gap-1.5 rounded-lg border border-sub-border-slate-100 px-2.5 text-xs font-medium whitespace-nowrap text-sub-text-primary hover:bg-sub-brand-primary/5 disabled:opacity-50 dark:border-sub-border-strong"
					>
						<Icon name="settings" height={12} width={12} />
						Manage
					</button>
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

			<ConfirmActionModal
				confirmDisabled={!canChangeTeamBilling}
				finalFocus={manageButtonRef}
				isOpen={showUpgradeConfirm}
				onClose={() => {
					if (upgradeSeatsMutation.isPending) return
					upgradeSeatsMutation.reset()
					setShowUpgradeConfirm(false)
				}}
				onConfirm={handleConfirmUpgrade}
				isLoading={upgradeSeatsMutation.isPending}
				error={upgradeSeatsMutation.isError ? upgradeSeatsMutation.error.message : null}
				title={`Upgrade ${label} to Yearly`}
				description={`Upgrade your ${label} subscription (${subscription.seats.seatCount} seat${subscription.seats.seatCount === 1 ? '' : 's'}) to yearly billing? Stripe will immediately charge your saved card the prorated yearly amount.`}
				confirmLabel="Upgrade to Yearly"
				pendingLabel="Upgrading..."
			/>
		</div>
	)
}

function BillingTotals({ subscriptions }: { subscriptions: Array<TeamSubscription> }) {
	const totals = { monthly: 0, yearly: 0 }
	for (const sub of subscriptions) {
		if (!isRenewingSub(sub)) continue
		const amount = getUnitPrice(sub.type, sub.billingInterval) * sub.seats.seatCount
		if (sub.billingInterval === 'year') totals.yearly += amount
		else totals.monthly += amount
	}

	if (totals.monthly === 0 && totals.yearly === 0) return null

	const rows: Array<{ label: string; value: string }> = []
	if (totals.monthly > 0) rows.push({ label: 'Total', value: `${formatUsd(totals.monthly)}/month` })
	if (totals.yearly > 0) rows.push({ label: 'Total', value: `${formatUsd(totals.yearly)}/year` })

	return (
		<div className="flex flex-col gap-1.5 rounded-lg bg-sub-brand-primary/5 p-3">
			{rows.map((row, i) => (
				<div key={i} className="flex flex-wrap items-center justify-between gap-2">
					<span className="text-sm font-medium text-sub-text-primary">{row.label}</span>
					<span className="text-sm font-semibold text-sub-text-primary">{row.value}</span>
				</div>
			))}
		</div>
	)
}

function YearlyTip({ subscriptions }: { subscriptions: Array<TeamSubscription> }) {
	const monthlySubs = subscriptions.filter((sub) => isRenewingSub(sub) && sub.billingInterval === 'month')
	if (monthlySubs.length === 0) return null

	const monthlyTotal = monthlySubs.reduce((acc, sub) => acc + getUnitPrice(sub.type, 'month') * sub.seats.seatCount, 0)
	const yearlyTotal = monthlySubs.reduce((acc, sub) => acc + getUnitPrice(sub.type, 'year') * sub.seats.seatCount, 0)
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
	const { canChangeTeamBilling, isTeamRefreshError, isTeamRetrying, refetchTeam, teamSubscriptions } = useTeam()
	const { createPortalSession, createPortalSessionMutation } = useSubscribe()
	const [showPurchaseModal, setShowPurchaseModal] = useState(false)

	const hasStripe = teamSubscriptions.some((sub) => sub.provider === undefined || sub.provider === 'stripe')

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Icon name="receipt" height={20} width={20} className="text-sub-text-primary" />
					<span className="text-base leading-5 font-medium text-sub-text-primary">Subscriptions & Billing</span>
				</div>
				<div className="flex items-center gap-2">
					{teamSubscriptions.length > 0 && hasStripe && (
						<button
							type="button"
							onClick={() => void createPortalSession()}
							disabled={createPortalSessionMutation.isPending}
							className="flex h-8 items-center gap-1.5 rounded-lg border border-sub-border-slate-100 px-3 text-xs font-medium text-sub-text-primary hover:bg-sub-brand-primary/5 disabled:opacity-50 dark:border-sub-border-strong"
						>
							<Icon name="external-link" height={12} width={12} />
							{createPortalSessionMutation.isPending ? 'Opening...' : 'Manage in Stripe'}
						</button>
					)}
					<button
						type="button"
						disabled={!canChangeTeamBilling}
						onClick={() => setShowPurchaseModal(true)}
						className="flex h-8 items-center gap-1.5 rounded-lg bg-sub-brand-primary px-3 text-xs font-medium text-on-brand disabled:opacity-50"
					>
						<Icon name="plus" height={14} width={14} />
						Purchase Seats
					</button>
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
				<p className="text-sm text-sub-text-muted">
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
