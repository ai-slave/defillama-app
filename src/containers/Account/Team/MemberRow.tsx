import { useRef, useState, type RefObject } from 'react'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { AssignSubscriptionModal } from './AssignSubscriptionModal'
import type { TeamMember } from './types'
import { useTeam } from './useTeam'

function getSubscriptionLabel(type: string | null): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return 'Unassigned'
}

export function MemberRow({ member, finalFocus }: { member: TeamMember; finalFocus: RefObject<HTMLElement | null> }) {
	const subscriptionFocusRef = useRef<HTMLButtonElement>(null)
	const removeFocusRef = useRef<HTMLElement | null>(null)
	const { user } = useAuthContext()
	const { isAdmin, teamSubscriptions, unassignMemberMutation, removeMemberMutation } = useTeam()
	const [openDialog, setOpenDialog] = useState<'assign' | 'unassign' | 'remove' | null>(null)
	const closeDialog = () => setOpenDialog(null)

	const isCurrentUser = user?.id === member.userId
	const isAdminMember = member.isAdmin
	const hasSubscription = member.subscriptionType !== null
	const hasAvailableSeats = teamSubscriptions.some((sub) => sub.seats.availableSeats > 0)

	return (
		<>
			<div className="flex items-center gap-3 rounded-lg border border-subtle p-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate body-md text-primary">{member.email}</span>
						{isAdminMember && (
							<span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 label-xs text-link">Admin</span>
						)}
						{isCurrentUser && <span className="shrink-0 body-xs text-tertiary">(you)</span>}
					</div>
					<div className="mt-1 flex items-center gap-2">
						<span className={`body-sm ${hasSubscription ? 'text-success' : 'text-tertiary'}`}>
							{getSubscriptionLabel(member.subscriptionType)}
						</span>
					</div>
				</div>

				{isAdmin && (
					<div className="flex shrink-0 items-center gap-1">
						{!hasSubscription ? (
							hasAvailableSeats && (
								<Button
									type="button"
									size="md"
									ref={subscriptionFocusRef}
									onClick={() => setOpenDialog('assign')}
									aria-label={`Assign subscription to ${member.email}`}
								>
									<Icon name="plus" className="size-3.5" />
									Assign
								</Button>
							)
						) : (
							<Button
								type="button"
								size="md"
								ref={subscriptionFocusRef}
								onClick={() => setOpenDialog('unassign')}
								aria-label={`Unassign subscription from ${member.email}`}
							>
								<Icon name="x" className="size-3.5" />
								Unassign
							</Button>
						)}
						{!isCurrentUser && !isAdminMember && (
							<Tooltip
								content={`Remove ${member.email}`}
								render={
									<Button
										type="button"
										size="md"
										square
										onClick={(event) => {
											removeFocusRef.current = event.currentTarget
											setOpenDialog('remove')
										}}
										aria-label={`Remove ${member.email}`}
									/>
								}
							>
								<Icon name="trash-2" className="size-4" />
							</Tooltip>
						)}
					</div>
				)}
			</div>

			{openDialog === 'assign' ? (
				<AssignSubscriptionModal
					finalFocus={hasSubscription || hasAvailableSeats ? subscriptionFocusRef : finalFocus}
					onClose={closeDialog}
					member={member}
				/>
			) : null}

			{openDialog === 'unassign' ? (
				<ConfirmActionDialog
					finalFocus={hasSubscription || hasAvailableSeats ? subscriptionFocusRef : finalFocus}
					title="Unassign subscription"
					description={`This will remove the ${getSubscriptionLabel(member.subscriptionType)} subscription from ${member.email}. Their access and credits will be revoked.`}
					confirmLabel="Unassign"
					pendingLabel="Unassigning…"
					errorMessage="Couldn't unassign the subscription."
					mutation={unassignMemberMutation}
					variables={{ userId: member.userId }}
					onClose={closeDialog}
					successMessage="Subscription removed from member"
				/>
			) : null}

			{openDialog === 'remove' ? (
				<ConfirmActionDialog
					finalFocus={removeFocusRef}
					title="Remove member"
					description={`Are you sure you want to remove ${member.email} from the team? Their subscription will be revoked.`}
					confirmLabel="Remove"
					pendingLabel="Removing…"
					errorMessage="Couldn't remove the member."
					mutation={removeMemberMutation}
					variables={{ userId: member.userId }}
					onClose={closeDialog}
					onSuccess={() => {
						// Success removes this row and its Remove button.
						removeFocusRef.current = finalFocus.current
					}}
					successMessage="Member removed from team"
				/>
			) : null}
		</>
	)
}
