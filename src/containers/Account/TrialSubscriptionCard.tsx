import { Icon } from '~/ui/Icon'
import { formatDate } from '~/utils/dateFormat'

interface TrialSubscriptionCardProps {
	trialEndDate: string | null
	isCancelPending: boolean
	onCancel: () => void
	isCancelLoading: boolean
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

function getRemainingDays(iso: string): number {
	const now = new Date()
	const end = new Date(iso)
	const diff = end.getTime() - now.getTime()
	return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function TrialSubscriptionCard({
	trialEndDate,
	isCancelPending,
	onCancel,
	isCancelLoading
}: TrialSubscriptionCardProps) {
	const remainingDays = trialEndDate ? getRemainingDays(trialEndDate) : null
	const formattedDate = trialEndDate ? (formatDate(trialEndDate) ?? 'Unknown') : 'Unknown'

	return (
		<div className="flex min-w-0 flex-1 flex-col justify-between gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex items-center gap-2">
				<Icon name="receipt" height={28} width={28} className="text-sub-text-primary" />
				<span className="text-base leading-5 font-medium text-sub-text-primary">Subscription</span>
			</div>

			<div className="flex flex-col gap-3">
				<InfoRow
					label="Current plan"
					value="Active Free Trial"
					valueClassName="bg-linear-to-r from-sub-brand-primary to-sub-brand-soft dark:from-sub-brand-secondary dark:to-sub-brand-softest bg-clip-text text-transparent"
				/>
				<InfoRow label="Remaining Days" value={remainingDays != null ? `${remainingDays} Days` : 'Unknown'} />
			</div>

			{isCancelPending ? (
				<>
					<p className="text-xs leading-4 text-sub-text-muted">
						Your trial has been cancelled and will end on{' '}
						<span className="font-bold text-sub-text-primary">{formattedDate}</span>. You won't be charged.
					</p>
					<p className="text-xs font-medium text-sub-warning-text-dark">Cancellation scheduled</p>
				</>
			) : (
				<>
					<p className="text-xs leading-4 text-sub-text-muted">
						Your trial ends on <span className="font-bold text-sub-text-primary">{formattedDate}</span>. You will be
						automatically charged <span className="font-bold text-sub-text-primary">$49.00</span> unless you cancel
						before then.
					</p>
					<div className="flex gap-2">
						<button
							onClick={onCancel}
							disabled={isCancelLoading}
							className="flex h-8 items-center rounded-lg border border-sub-border-muted px-3 text-xs font-medium whitespace-nowrap text-sub-text-primary disabled:opacity-50 dark:border-sub-border-strong"
						>
							{isCancelLoading ? 'Cancelling...' : 'Cancel Free Trial'}
						</button>
					</div>
				</>
			)}
		</div>
	)
}
