import * as Ariakit from '@ariakit/react'
import { useState, type FormEvent, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogCancelButton } from '~/ui/Dialog'
import { InlineStatus } from '~/ui/Status'
import type { TeamMember, TeamSubscription } from './types'
import { useTeam } from './useTeam'

interface AssignSubscriptionModalProps {
	finalFocus: RefObject<HTMLElement | null>
	onClose: () => void
	member: TeamMember
}

function getSubscriptionLabel(type: string): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return type
}

export function AssignSubscriptionModal({ onClose, member, finalFocus }: AssignSubscriptionModalProps) {
	const { teamSubscriptions, assignMemberMutation } = useTeam()
	const pending = assignMemberMutation.isPending
	// Not the mutation's own error: that one clears as soon as a retry starts. Success closes.
	const [error, setError] = useState<string | null>(null)

	const availableSubscriptions = teamSubscriptions.filter((sub: TeamSubscription) => sub.seats.availableSeats > 0)

	const handleAssign = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const subscriptionType = new FormData(event.currentTarget).get('subscriptionType')
		if (!subscriptionType) return
		assignMemberMutation.mutate(
			{ userId: member.userId, subscriptionType: String(subscriptionType) },
			{
				onSuccess: () => {
					onClose()
					toast.success('Subscription assigned')
				},
				onError: (failure) => setError(failure.message)
			}
		)
	}

	return (
		<Dialog size="sm" open onClose={onClose} pending={pending} finalFocus={finalFocus} portal unmountOnHide>
			<form onSubmit={handleAssign} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title="Assign subscription" />
				<DialogBody>
					<Ariakit.DialogDescription className="body-sm break-words text-secondary">
						Select a subscription type to assign to <span className="font-medium text-primary">{member.email}</span>.
					</Ariakit.DialogDescription>

					{availableSubscriptions.length === 0 ? (
						// Assign stays disabled; this says why.
						<InlineStatus variant="error">
							No seats are available. Purchase more seats to assign a subscription.
						</InlineStatus>
					) : (
						<div className="flex flex-col gap-2">
							{availableSubscriptions.map((sub: TeamSubscription, index) => (
								<label
									key={sub.id}
									className="flex cursor-pointer items-center gap-3 rounded-lg border border-medium p-3 transition-colors has-checked:border-brand has-checked:bg-brand-muted"
								>
									{/* Ariakit's autoFocus, so the dialog starts on the first plan instead of the ×. */}
									<Ariakit.Focusable
										autoFocus={index === 0}
										render={
											<input
												type="radio"
												name="subscriptionType"
												value={sub.type}
												required
												disabled={pending}
												className="size-4 accent-brand"
											/>
										}
									/>
									<div className="flex flex-col">
										<span className="label-sm text-primary">{getSubscriptionLabel(sub.type)}</span>
										<span className="body-sm text-secondary">
											{sub.seats.availableSeats} seat{sub.seats.availableSeats !== 1 ? 's' : ''} available
										</span>
									</div>
								</label>
							))}
						</div>
					)}

					{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button
						type="submit"
						variant="primary"
						size="md"
						disabled={availableSubscriptions.length === 0}
						pendingLabel={pending ? 'Assigning…' : null}
					>
						Assign
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{pending ? 'Assigning subscription' : ''}
				</span>
			</form>
		</Dialog>
	)
}
