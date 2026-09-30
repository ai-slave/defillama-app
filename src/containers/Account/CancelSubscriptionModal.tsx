import * as Ariakit from '@ariakit/react'
import { useSubscribe } from '~/auth/useSubscribe'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { textareaStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'

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

// Each opening starts fresh, and a closing dialog keeps its last step through the fade-out.
export function CancelSubscriptionModal(props: CancelSubscriptionModalProps) {
	return <CancelSubscriptionDialog key={useOpeningKey(props.isOpen)} {...props} />
}

function CancelSubscriptionDialog({ isOpen, onClose, variant = 'trial' }: CancelSubscriptionModalProps) {
	const isTrial = variant === 'trial'
	// The modal owns the cancellation: the mutation is the single source of the
	// pending/success/error state, and all feedback renders inside the dialog.
	const { cancelSubscriptionMutation } = useSubscribe()
	const isLoading = cancelSubscriptionMutation.isPending
	const cancelled = cancelSubscriptionMutation.isSuccess
	const cancelledImmediately = Boolean(cancelSubscriptionMutation.data?.cancelled_immediately)
	const error = cancelSubscriptionMutation.isError
		? cancelSubscriptionMutation.error.message || 'Failed to cancel subscription. Try again or contact support.'
		: null

	const handleClose = () => {
		if (isLoading) return
		onClose()
	}

	const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (isLoading) return
		const formData = new FormData(e.currentTarget)
		const message = ((formData.get('message') as string) ?? '').trim()
		cancelSubscriptionMutation.mutate(message || undefined)
	}

	// A confirmation: no ×, the choice is the footer, and Cancel stays visible at every width.
	return (
		<Dialog size="sm" role="alertdialog" open={isOpen} onClose={handleClose} pending={isLoading} portal unmountOnHide>
			{cancelled ? (
				<>
					<DialogHeader
						title={cancelledImmediately ? 'Subscription cancelled' : 'Cancellation scheduled'}
						closable={false}
					/>
					<DialogBody>
						<Ariakit.DialogDescription className="body-sm text-secondary">
							{cancelledImmediately
								? 'Your subscription has been cancelled and access has ended.'
								: `Your ${isTrial ? 'trial' : 'subscription'} stays active until the end of the current period and will not renew.`}
						</Ariakit.DialogDescription>
					</DialogBody>
					<DialogFooter>
						<Button type="button" variant="primary" size="md" autoFocus onClick={handleClose}>
							Close
						</Button>
					</DialogFooter>
				</>
			) : (
				<form onSubmit={handleConfirm} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title={isTrial ? 'Cancel free trial' : 'Cancel subscription'} closable={false} />
					<DialogBody>
						<Ariakit.DialogDescription className="body-sm text-secondary">
							{CANCEL_BODY_TEXT[variant]}
						</Ariakit.DialogDescription>
						<div className="flex flex-col gap-1.5">
							<label htmlFor="cancel-reason" className="label-sm text-secondary">
								Reason for cancelling (optional)
							</label>
							<textarea
								id="cancel-reason"
								name="message"
								placeholder="Let us know why you're cancelling…"
								rows={3}
								readOnly={isLoading}
								className={`${textareaStyles} w-full resize-none`}
							/>
						</div>
						{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter>
						<Ariakit.DialogDismiss
							type="button"
							autoFocus
							disabled={isLoading}
							accessibleWhenDisabled
							render={<Button size="md" />}
						>
							{isTrial ? 'Keep trial' : 'Keep subscription'}
						</Ariakit.DialogDismiss>
						<Button type="submit" variant="destructive" size="md" pendingLabel={isLoading ? 'Cancelling…' : null}>
							Confirm cancellation
						</Button>
					</DialogFooter>
					<span role="status" className="sr-only">
						{isLoading ? 'Cancelling…' : ''}
					</span>
				</form>
			)}
		</Dialog>
	)
}
