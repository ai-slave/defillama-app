import { useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Icon } from '~/ui/Icon'
import { AssignSubscriptionModal } from './AssignSubscriptionModal'
import type { TeamMember } from './types'
import { useTeam } from './useTeam'

function getSubscriptionLabel(type: string | null): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return 'Unassigned'
}

export function MemberRow({ member, finalFocus }: { member: TeamMember; finalFocus?: RefObject<HTMLElement | null> }) {
	const subscriptionFocusRef = useRef<HTMLButtonElement>(null)
	const removeFocusRef = useRef<HTMLElement>(null)
	const { user } = useAuthContext()
	const { isAdmin, teamSubscriptions, unassignMemberMutation, removeMemberMutation } = useTeam()
	const [showAssignModal, setShowAssignModal] = useState(false)
	const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
	const [showUnassignConfirm, setShowUnassignConfirm] = useState(false)

	const isCurrentUser = user?.id === member.userId
	const isAdminMember = member.isAdmin
	const hasSubscription = member.subscriptionType !== null
	const hasAvailableSeats = teamSubscriptions.some((sub) => sub.seats.availableSeats > 0)

	return (
		<>
			<div className="flex items-center gap-3 rounded-lg border border-sub-border-slate-100 p-3 dark:border-sub-border-strong">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate body-md text-sub-text-primary">{member.email}</span>
						{isAdminMember && (
							<span className="shrink-0 rounded-full bg-sub-brand-primary/10 px-2 py-0.5 label-xs text-sub-brand-primary">
								Admin
							</span>
						)}
						{isCurrentUser && <span className="shrink-0 body-xs text-sub-text-muted">(you)</span>}
					</div>
					<div className="mt-1 flex items-center gap-2">
						<span className={`body-sm ${hasSubscription ? 'text-sub-success' : 'text-sub-text-muted'}`}>
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
									onClick={() => setShowAssignModal(true)}
									aria-label={`Assign subscription to ${member.email}`}
								>
									<Icon name="plus" height={14} width={14} />
									Assign
								</Button>
							)
						) : (
							<Button
								type="button"
								size="md"
								ref={subscriptionFocusRef}
								onClick={() => setShowUnassignConfirm(true)}
								aria-label={`Unassign subscription from ${member.email}`}
							>
								<Icon name="x" height={14} width={14} />
								Unassign
							</Button>
						)}
						{!isCurrentUser && !isAdminMember && (
							<Button
								type="button"
								size="md"
								square
								onClick={(event) => {
									removeFocusRef.current = event.currentTarget
									setShowRemoveConfirm(true)
								}}
								aria-label={`Remove ${member.email}`}
							>
								<Icon name="trash-2" height={16} width={16} />
							</Button>
						)}
					</div>
				)}
			</div>

			{showAssignModal && (
				<AssignSubscriptionModal
					finalFocus={hasSubscription || hasAvailableSeats ? subscriptionFocusRef : finalFocus}
					isOpen={showAssignModal}
					onClose={() => setShowAssignModal(false)}
					member={member}
				/>
			)}

			<ConfirmDialog
				open={showUnassignConfirm}
				onClose={() => {
					unassignMemberMutation.reset()
					setShowUnassignConfirm(false)
				}}
				portal
				unmountOnHide
				finalFocus={hasSubscription || hasAvailableSeats ? subscriptionFocusRef : finalFocus}
				title="Unassign subscription"
				description={`This will remove the ${getSubscriptionLabel(member.subscriptionType)} subscription from ${member.email}. Their access and credits will be revoked.`}
				confirmLabel="Unassign"
				pendingLabel={unassignMemberMutation.isPending ? 'Unassigning…' : null}
				error={unassignMemberMutation.isError ? unassignMemberMutation.error.message : null}
				onConfirm={() => {
					unassignMemberMutation.mutate(
						{ userId: member.userId },
						{
							onSuccess: () => {
								setShowUnassignConfirm(false)
								toast.success('Subscription removed from member')
							}
						}
					)
				}}
			/>

			<ConfirmDialog
				open={showRemoveConfirm}
				onClose={() => {
					removeMemberMutation.reset()
					setShowRemoveConfirm(false)
				}}
				portal
				unmountOnHide
				finalFocus={removeFocusRef}
				title="Remove member"
				description={`Are you sure you want to remove ${member.email} from the team? Their subscription will be revoked.`}
				confirmLabel="Remove"
				pendingLabel={removeMemberMutation.isPending ? 'Removing…' : null}
				error={removeMemberMutation.isError ? removeMemberMutation.error.message : null}
				onConfirm={() => {
					const trigger = removeFocusRef.current
					// Reconciliation can unmount this row before the success callback runs.
					removeFocusRef.current = finalFocus?.current ?? trigger
					// Success drops this row, and mutate() callbacks with it; the returned promise still settles.
					removeMemberMutation.mutateAsync({ userId: member.userId }).then(
						() => {
							setShowRemoveConfirm(false)
							toast.success('Member removed from team')
						},
						() => {
							removeFocusRef.current = trigger
						}
					)
				}}
			/>
		</>
	)
}
