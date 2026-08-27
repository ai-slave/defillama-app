import * as Ariakit from '@ariakit/react'
import { useSubscribe } from '~/auth/useSubscribe'
import { Icon } from '~/ui/Icon'

interface CancelSubscriptionModalProps {
	isOpen: boolean
	onClose: () => void
	variant?: 'trial' | 'subscription' | 'pastDue'
}

const CANCEL_BODY_TEXT = {
	trial:
		"Your subscription will remain active until the end of your trial period. After that, it will not renew and you won't be charged.",
	subscription:
		'Your subscription will remain active until the end of your current billing period. After that, it will not renew.',
	// Stripe cancels past-due subscriptions immediately instead of at period end.
	pastDue: 'Because the latest payment failed, cancellation takes effect immediately and access ends right away.'
} as const

export function CancelSubscriptionModal({ isOpen, onClose, variant = 'trial' }: CancelSubscriptionModalProps) {
	const isTrial = variant === 'trial'
	// The modal owns the cancellation: the mutation is the single source of the
	// pending/success/error state, and all feedback renders inside the dialog.
	const { cancelSubscriptionMutation } = useSubscribe()
	const isLoading = cancelSubscriptionMutation.isPending
	const cancelled = cancelSubscriptionMutation.isSuccess
	const cancelledImmediately = Boolean(cancelSubscriptionMutation.data?.cancelled_immediately)
	const error = cancelSubscriptionMutation.isError
		? cancelSubscriptionMutation.error.message || 'Failed to cancel subscription. Please try again or contact support.'
		: null

	const handleClose = () => {
		if (isLoading) return
		cancelSubscriptionMutation.reset()
		onClose()
	}

	const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (isLoading) return
		const formData = new FormData(e.currentTarget)
		const message = ((formData.get('message') as string) ?? '').trim()
		cancelSubscriptionMutation.mutate(message || undefined)
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && handleClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className="dialog max-h-[90vh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[380px]"
				portal
				unmountOnHide
			>
				{cancelled ? (
					<div className="flex flex-col gap-5 px-5 py-6">
						<div className="flex items-center justify-between">
							<h3 className="text-xl leading-7 font-semibold text-sub-text-primary">
								{cancelledImmediately ? 'Subscription Cancelled' : 'Cancellation Scheduled'}
							</h3>
							<Ariakit.DialogDismiss className="rounded-full p-1 text-sub-text-primary transition-colors">
								<Icon name="x" height={24} width={24} />
							</Ariakit.DialogDismiss>
						</div>
						<p className="text-sm leading-[21px] text-sub-text-primary">
							{cancelledImmediately
								? 'Your subscription has been cancelled and access has ended.'
								: `Your ${isTrial ? 'trial' : 'subscription'} stays active until the end of the current period and will not renew.`}
						</p>
						<button
							type="button"
							onClick={handleClose}
							className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand"
						>
							Close
						</button>
					</div>
				) : (
					<form onSubmit={handleConfirm} className="flex flex-col gap-5 px-5 py-6">
						{/* Header */}
						<div className="flex items-center justify-between">
							<h3 className="text-xl leading-7 font-semibold text-sub-text-primary">
								{isTrial ? 'Cancel Free Trial' : 'Cancel Subscription'}
							</h3>
							<Ariakit.DialogDismiss
								type="button"
								disabled={isLoading}
								className="rounded-full p-1 text-sub-text-primary transition-colors disabled:opacity-50"
							>
								<Icon name="x" height={24} width={24} />
							</Ariakit.DialogDismiss>
						</div>

						{/* Body */}
						<p className="text-sm leading-[21px] text-sub-text-primary">{CANCEL_BODY_TEXT[variant]}</p>

						{/* Feedback */}
						<div className="flex flex-col gap-2">
							<label htmlFor="cancel-reason" className="text-xs font-medium text-sub-text-muted">
								Reason for cancelling (optional)
							</label>
							<textarea
								id="cancel-reason"
								name="message"
								placeholder="Let us know why you're cancelling..."
								rows={3}
								className="w-full resize-none rounded-lg border border-sub-border-muted bg-transparent p-3 text-sm text-sub-text-primary outline-hidden placeholder:text-sub-text-muted focus:border-sub-brand-primary dark:border-sub-border-strong"
							/>
						</div>

						{error ? (
							<div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error">
								<Icon name="alert-warning" height={16} width={16} className="shrink-0" />
								<p className="text-sm">{error}</p>
							</div>
						) : null}

						{/* Actions */}
						<div className="flex flex-col gap-2">
							<button
								type="submit"
								disabled={isLoading}
								className="flex h-10 w-full items-center justify-center rounded-lg bg-error text-sm font-medium text-on-brand disabled:opacity-50"
							>
								{isLoading ? 'Cancelling...' : 'Confirm Cancellation'}
							</button>
							<Ariakit.DialogDismiss
								type="button"
								disabled={isLoading}
								className="flex h-10 w-full items-center justify-center rounded-lg border border-sub-border-muted text-sm text-sub-text-muted disabled:opacity-50 dark:border-sub-border-strong"
							>
								{isTrial ? 'Keep Trial' : 'Keep Subscription'}
							</Ariakit.DialogDismiss>
						</div>
					</form>
				)}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
