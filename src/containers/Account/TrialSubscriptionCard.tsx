import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { formatDate } from '~/utils/dateFormat'

interface TrialSubscriptionCardProps {
	trialEndDate: string | null
	isCancelPending: boolean
	onCancel: () => void
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

function getRemainingDays(iso: string): number {
	const now = new Date()
	const end = new Date(iso)
	const diff = end.getTime() - now.getTime()
	return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function TrialSubscriptionCard({ trialEndDate, isCancelPending, onCancel }: TrialSubscriptionCardProps) {
	const remainingDays = trialEndDate ? getRemainingDays(trialEndDate) : null
	const formattedDate = trialEndDate ? (formatDate(trialEndDate) ?? 'Unknown') : 'Unknown'

	return (
		<div className="flex min-w-0 flex-1 flex-col justify-between gap-4 rounded-2xl border border-subtle bg-surface p-4">
			<div className="flex items-center gap-2">
				<Icon name="receipt" height={28} width={28} className="text-primary" />
				<span className="label-lg text-primary">Subscription</span>
			</div>

			<div className="flex flex-col gap-3">
				<InfoRow label="Current plan" value="Active free trial" valueClassName="sub-gradient-text" />
				<InfoRow label="Remaining days" value={remainingDays != null ? `${remainingDays} days` : 'Unknown'} />
			</div>

			{isCancelPending ? (
				<>
					<p className="body-sm text-tertiary">
						Your trial has been cancelled and will end on{' '}
						<span className="font-bold text-primary">{formattedDate}</span>. You won't be charged.
					</p>
					<p className="label-sm text-warning">Cancellation scheduled</p>
				</>
			) : (
				<>
					<p className="body-sm text-tertiary">
						Your trial ends on <span className="font-bold text-primary">{formattedDate}</span>. You will be
						automatically charged <span className="font-bold text-primary">$49.00</span> unless you cancel before then.
					</p>
					<div className="flex gap-2">
						<Button variant="secondary" size="md" onClick={onCancel}>
							Cancel free trial
						</Button>
					</div>
				</>
			)}
		</div>
	)
}
