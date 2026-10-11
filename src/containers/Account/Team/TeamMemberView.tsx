import { useRef, useState, type RefObject } from 'react'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Icon } from '~/ui/Icon'
import type { TeamMember } from './types'
import { useTeam } from './useTeam'

function getSubscriptionLabel(type: string | null): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return 'No subscription assigned'
}

function ReadOnlyMemberRow({ member, isCurrentUser }: { member: TeamMember; isCurrentUser: boolean }) {
	const hasSubscription = member.subscriptionType !== null

	return (
		<div className="flex items-center gap-3 rounded-lg border border-subtle p-3">
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate body-md text-primary">{member.email}</span>
					{member.isAdmin && (
						<span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 label-xs text-link">Admin</span>
					)}
					{isCurrentUser && <span className="shrink-0 body-xs text-tertiary">(you)</span>}
				</div>
				<div className="mt-1">
					<span className={`body-sm ${hasSubscription ? 'text-success' : 'text-tertiary'}`}>
						{getSubscriptionLabel(member.subscriptionType)}
					</span>
				</div>
			</div>
		</div>
	)
}

export function TeamMemberView({ finalFocus }: { finalFocus: RefObject<HTMLElement | null> }) {
	const { user } = useAuthContext()
	const { team, members, leaveTeamMutation } = useTeam()
	const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
	const leaveFocusRef = useRef<HTMLElement | null>(null)

	if (!team) return null

	return (
		<div className="flex flex-col gap-3">
			<Card padding="md" className="flex flex-col gap-4">
				<div className="flex items-center gap-2">
					<Icon name="users" className="size-7 text-primary" />
					<span className="label-lg text-primary">Team</span>
				</div>

				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2">
						<span className="shrink-0 body-sm text-tertiary">Team name</span>
						<div className="h-0 min-w-0 flex-1 border-b border-dashed border-medium" />
						<span className="shrink-0 body-sm text-primary">{team.name}</span>
					</div>

					<div className="flex items-center gap-2">
						<span className="shrink-0 body-sm text-tertiary">Your role</span>
						<div className="h-0 min-w-0 flex-1 border-b border-dashed border-medium" />
						<span className="shrink-0 body-sm text-primary">{team.isAdmin ? 'Admin' : 'Member'}</span>
					</div>

					<div className="flex items-center gap-2">
						<span className="shrink-0 body-sm text-tertiary">Subscription</span>
						<div className="h-0 min-w-0 flex-1 border-b border-dashed border-medium" />
						<span className={`shrink-0 body-sm ${team.subscriptionType ? 'text-success' : 'text-tertiary'}`}>
							{getSubscriptionLabel(team.subscriptionType)}
						</span>
					</div>
				</div>

				<Button
					type="button"
					variant="destructive"
					size="md"
					onClick={(event) => {
						leaveFocusRef.current = event.currentTarget
						setShowLeaveConfirm(true)
					}}
					className="w-fit"
				>
					<Icon name="sign-out" className="size-3.5" />
					Leave team
				</Button>
			</Card>

			{members.length > 0 && (
				<Card padding="md" className="flex flex-col gap-4">
					<div className="flex items-center gap-2">
						<Icon name="users" className="size-5 text-primary" />
						<span className="label-lg text-primary">Members ({members.length})</span>
					</div>
					<div className="flex flex-col gap-2">
						{members.map((member) => (
							<ReadOnlyMemberRow key={member.id} member={member} isCurrentUser={user?.id === member.userId} />
						))}
					</div>
				</Card>
			)}

			{showLeaveConfirm ? (
				<ConfirmActionDialog
					finalFocus={leaveFocusRef}
					title="Leave team"
					description="Are you sure you want to leave this team? Your team subscription will be revoked and you will lose access to any team-managed features."
					confirmLabel="Leave team"
					pendingLabel="Leaving team…"
					errorMessage="Couldn't leave the team."
					mutation={leaveTeamMutation}
					variables={undefined}
					onClose={() => setShowLeaveConfirm(false)}
					onSuccess={() => {
						// Leaving unmounts this view and its Leave Team button.
						leaveFocusRef.current = finalFocus.current
					}}
					successMessage="You have left the team"
				/>
			) : null}
		</div>
	)
}
