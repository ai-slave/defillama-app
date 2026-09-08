import * as Ariakit from '@ariakit/react'
import type { FormEvent, RefObject } from 'react'
import { DialogHeading } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import type { TeamMember, TeamSubscription } from './types'
import { useTeam } from './useTeam'

interface AssignSubscriptionModalProps {
	finalFocus?: RefObject<HTMLElement | null>
	isOpen: boolean
	onClose: () => void
	member: TeamMember
}

function getSubscriptionLabel(type: string): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return type
}

export function AssignSubscriptionModal({ isOpen, onClose, member, finalFocus }: AssignSubscriptionModalProps) {
	const { teamSubscriptions, assignMemberMutation } = useTeam()

	const availableSubscriptions = teamSubscriptions.filter((sub: TeamSubscription) => sub.seats.availableSeats > 0)

	const handleClose = () => {
		if (assignMemberMutation.isPending) return
		assignMemberMutation.reset()
		onClose()
	}

	const handleAssign = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (assignMemberMutation.isPending) return
		const subscriptionType = new FormData(event.currentTarget).get('subscriptionType')
		if (!subscriptionType) return
		assignMemberMutation.mutate(
			{ userId: member.userId, subscriptionType: String(subscriptionType) },
			{ onSuccess: onClose }
		)
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && handleClose()}>
			<Ariakit.Dialog
				finalFocus={finalFocus}
				backdrop={<div className="bg-black/80" />}
				className="dialog h-fit max-h-[90dvh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[380px]"
				hideOnEscape={!assignMemberMutation.isPending}
				hideOnInteractOutside={!assignMemberMutation.isPending}
				portal
				unmountOnHide
			>
				<form onSubmit={handleAssign} className="flex flex-col gap-5 bg-white px-5 py-6 dark:bg-sub-surface-dark">
					<div className="flex items-center justify-between">
						<DialogHeading className="text-base font-semibold text-sub-text-primary">Assign Subscription</DialogHeading>
						<Ariakit.DialogDismiss
							aria-label="Close"
							disabled={assignMemberMutation.isPending}
							className="flex size-8 shrink-0 items-center justify-center rounded-full text-sub-text-muted transition-colors hover:text-sub-text-primary"
						>
							<Icon name="x" height={18} width={18} />
						</Ariakit.DialogDismiss>
					</div>
					<p className="text-sm break-words text-sub-text-muted">
						Select a subscription type to assign to{' '}
						<span className="font-medium text-sub-text-primary">{member.email}</span>.
					</p>

					{availableSubscriptions.length === 0 ? (
						<p className="text-sm text-sub-text-muted">
							No available seats. Purchase more seats to assign subscriptions.
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{availableSubscriptions.map((sub: TeamSubscription) => (
								<label
									key={sub.id}
									className="flex cursor-pointer items-center gap-3 rounded-lg border border-sub-border p-3 transition-colors has-checked:border-sub-brand-primary has-checked:bg-sub-brand-primary/5"
								>
									<input
										type="radio"
										name="subscriptionType"
										value={sub.type}
										required
										disabled={assignMemberMutation.isPending}
										className="size-4 accent-sub-brand-primary"
									/>
									<div className="flex flex-col">
										<span className="text-sm font-medium text-sub-text-primary">{getSubscriptionLabel(sub.type)}</span>
										<span className="text-xs text-sub-text-muted">
											{sub.seats.availableSeats} seat{sub.seats.availableSeats !== 1 ? 's' : ''} available
										</span>
									</div>
								</label>
							))}
						</div>
					)}

					{assignMemberMutation.isError ? (
						<div
							role="alert"
							className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error"
						>
							<Icon name="alert-warning" height={16} width={16} className="shrink-0" />
							<p className="text-sm">{assignMemberMutation.error.message}</p>
						</div>
					) : null}
					<div className="flex gap-3">
						<Ariakit.Button
							type="button"
							onClick={handleClose}
							disabled={assignMemberMutation.isPending}
							className="flex h-9 flex-1 items-center justify-center rounded-lg border border-sub-border-muted text-sm font-medium text-sub-text-primary dark:border-sub-border-strong"
						>
							Cancel
						</Ariakit.Button>
						<Ariakit.Button
							type="submit"
							accessibleWhenDisabled
							disabled={availableSubscriptions.length === 0 || assignMemberMutation.isPending}
							className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand disabled:opacity-50 aria-disabled:opacity-50"
						>
							{assignMemberMutation.isPending ? <LoadingSpinner size={14} /> : null}
							{assignMemberMutation.isPending ? 'Assigning...' : 'Assign'}
						</Ariakit.Button>
					</div>
					<span role="status" className="sr-only">
						{assignMemberMutation.isPending ? 'Assigning subscription' : ''}
					</span>
				</form>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
