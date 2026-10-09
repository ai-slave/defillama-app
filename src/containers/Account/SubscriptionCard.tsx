import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

interface SubscriptionCardProps {
	planName: string
	renewalDate: string
	subscriptionType: string
	subscriptionPayment: string
	provider: string
	/** A seat on a team's subscription: the record has no Stripe subscription of its own to manage or cancel. */
	isTeamSeat: boolean
	isCancelPending: boolean
	onManage: () => void
	onCancel: () => void
	onTopup?: () => void
	isManageLoading: boolean
	isTopupLoading: boolean
}

function InfoRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="shrink-0 body-sm text-tertiary">{label}</span>
			<div className="h-0 min-w-0 flex-1 border-b border-dashed border-medium" />
			<span className={`shrink-0 body-sm ${valueClassName || 'text-primary'}`}>{value}</span>
		</div>
	)
}

export function SubscriptionCard({
	planName,
	renewalDate,
	subscriptionType,
	subscriptionPayment,
	provider,
	isTeamSeat,
	isCancelPending,
	onManage,
	onCancel,
	onTopup,
	isManageLoading,
	isTopupLoading
}: SubscriptionCardProps) {
	const isManageable = provider === 'stripe' || provider === 'llamapay'
	const manageLabel = provider === 'stripe' ? 'Manage on Stripe' : 'Manage on LlamaPay'
	const isManual = provider === 'manual'

	if (isManual) {
		return (
			<div className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
				<div className="flex items-center gap-2">
					<Icon name="receipt" height={28} width={28} className="text-primary" />
					<span className="label-lg text-primary">Subscription</span>
				</div>

				<div className="flex flex-col gap-3">
					<InfoRow label="Current plan" value={planName} valueClassName="sub-gradient-text" />
				</div>

				<p className="body-sm text-tertiary">
					Your {planName} plan was set up by the DefiLlama team. To change it, email support@defillama.com.
				</p>
			</div>
		)
	}

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
			<div className="flex items-center gap-2">
				<Icon name="receipt" height={28} width={28} className="text-primary" />
				<span className="label-lg text-primary">Subscription</span>
			</div>

			<div className="flex flex-col gap-3">
				<InfoRow label="Current plan" value={planName} valueClassName="sub-gradient-text" />
				<InfoRow
					label={isCancelPending ? 'Cancels on' : 'Renewal date'}
					value={renewalDate}
					valueClassName={isCancelPending ? 'text-warning' : undefined}
				/>
				<InfoRow label="Subscription type" value={subscriptionType} />
				<InfoRow label="Payment provider" value={subscriptionPayment} />
			</div>

			{isCancelPending ? (
				<p className="label-sm text-warning">Cancellation scheduled</p>
			) : isTeamSeat ? (
				<p className="body-sm text-tertiary">
					This plan is a seat on your team's subscription, so it's billed and managed with the team's seats.
				</p>
			) : provider === 'apple' || provider === 'google_play' ? (
				<p className="body-sm text-tertiary">
					This plan is billed through {provider === 'apple' ? 'the App Store' : 'Google Play'}. Manage or cancel it in
					your {provider === 'apple' ? 'Apple' : 'Google Play'} subscription settings.
				</p>
			) : isManageable ? (
				<div className="flex gap-2">
					{onTopup && (
						<Button
							variant="primary"
							size="md"
							onClick={onTopup}
							pendingLabel="Opening LlamaPay…"
							pending={isTopupLoading}
						>
							Top up
							<Icon name="circle-external-link" height={16} width={16} className="shrink-0" />
						</Button>
					)}
					<Button
						size="md"
						onClick={onManage}
						pendingLabel={`Opening ${provider === 'stripe' ? 'Stripe' : 'LlamaPay'}…`}
						pending={isManageLoading}
					>
						{manageLabel}
						<Icon name="circle-external-link" height={16} width={16} className="shrink-0" />
					</Button>
					<Button size="md" onClick={onCancel}>
						Cancel subscription
					</Button>
				</div>
			) : null}
		</div>
	)
}
