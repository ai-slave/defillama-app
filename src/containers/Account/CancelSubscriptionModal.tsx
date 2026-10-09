import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { useSubscribe } from '~/auth/useSubscribe'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { Textarea } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'

interface CancelSubscriptionModalProps {
	isOpen: boolean
	onClose: () => void
	variant: 'trial' | 'subscription' | 'pastDue'
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

function CancelSubscriptionDialog({ isOpen, onClose, variant }: CancelSubscriptionModalProps) {
	const isTrial = variant === 'trial'
	// The modal owns the cancellation, and all feedback renders inside the dialog.
	const { cancelSubscriptionMutation } = useSubscribe()
	const isLoading = cancelSubscriptionMutation.isPending
	const cancelled = cancelSubscriptionMutation.isSuccess
	const cancelledImmediately = Boolean(cancelSubscriptionMutation.data?.cancelled_immediately)
	// Not the mutation's own error: that one clears as soon as a retry starts. Success replaces the form.
	const [error, setError] = useState<string | null>(null)

	const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const message = (new FormData(e.currentTarget).get('message') as string).trim()
		cancelSubscriptionMutation.mutate(message || undefined, {
			onError: (failure) => setError(failure.message || 'Failed to cancel subscription. Try again or contact support.')
		})
	}

	// A confirmation: no ×, the choice is the footer, and Cancel stays visible at every width.
	return (
		<Dialog size="sm" role="alertdialog" open={isOpen} onClose={onClose} pending={isLoading} portal unmountOnHide>
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
						<Button type="button" variant="primary" size="md" autoFocus onClick={onClose}>
							Close
						</Button>
					</DialogFooter>
				</>
			) : (
				<form noValidate onSubmit={handleConfirm} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title={isTrial ? 'Cancel free trial' : 'Cancel subscription'} closable={false} />
					<DialogBody>
						<Ariakit.DialogDescription className="body-sm text-secondary">
							{CANCEL_BODY_TEXT[variant]}
						</Ariakit.DialogDescription>
						<Field label="Reason for cancelling (optional)">
							{(control) => (
								<Textarea
									{...control}
									name="message"
									placeholder="Let us know why you're cancelling…"
									rows={3}
									readOnly={isLoading}
									className="w-full resize-none"
								/>
							)}
						</Field>
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
