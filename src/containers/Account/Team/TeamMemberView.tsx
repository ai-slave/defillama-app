import { useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
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
		<div className="flex items-center gap-3 rounded-lg border border-sub-border-slate-100 p-3 dark:border-sub-border-strong">
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate body-md text-sub-text-primary">{member.email}</span>
					{member.isAdmin && (
						<span className="shrink-0 rounded-full bg-sub-brand-primary/10 px-2 py-0.5 label-xs text-sub-brand-primary">
							Admin
						</span>
					)}
					{isCurrentUser && <span className="shrink-0 body-xs text-sub-text-muted">(you)</span>}
				</div>
				<div className="mt-1">
					<span className={`body-sm ${hasSubscription ? 'text-sub-success' : 'text-sub-text-muted'}`}>
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

	if (!team) return null

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
				<div className="flex items-center gap-2">
					<Icon name="users" height={28} width={28} className="text-sub-text-primary" />
					<span className="label-lg text-sub-text-primary">Team</span>
				</div>

				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2">
						<span className="shrink-0 body-sm text-sub-text-muted">Team name</span>
						<div className="h-0 min-w-0 flex-1 border-b border-dashed border-sub-border" />
						<span className="shrink-0 body-sm text-sub-text-primary">{team.name}</span>
					</div>

					<div className="flex items-center gap-2">
						<span className="shrink-0 body-sm text-sub-text-muted">Your role</span>
						<div className="h-0 min-w-0 flex-1 border-b border-dashed border-sub-border" />
						<span className="shrink-0 body-sm text-sub-text-primary">{team.isAdmin ? 'Admin' : 'Member'}</span>
					</div>

					<div className="flex items-center gap-2">
						<span className="shrink-0 body-sm text-sub-text-muted">Subscription</span>
						<div className="h-0 min-w-0 flex-1 border-b border-dashed border-sub-border" />
						<span className={`shrink-0 body-sm ${team.subscriptionType ? 'text-sub-success' : 'text-sub-text-muted'}`}>
							{getSubscriptionLabel(team.subscriptionType)}
						</span>
					</div>
				</div>

				<Button
					type="button"
					variant="destructive"
					size="md"
					onClick={() => setShowLeaveConfirm(true)}
					className="w-fit"
				>
					<Icon name="sign-out" height={14} width={14} />
					Leave Team
				</Button>
			</div>

			{members.length > 0 && (
				<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
					<div className="flex items-center gap-2">
						<Icon name="users" height={20} width={20} className="text-sub-text-primary" />
						<span className="label-lg text-sub-text-primary">Members ({members.length})</span>
					</div>
					<div className="flex flex-col gap-2">
						{members.map((member) => (
							<ReadOnlyMemberRow key={member.id} member={member} isCurrentUser={user?.id === member.userId} />
						))}
					</div>
				</div>
			)}

			<ConfirmDialog
				open={showLeaveConfirm}
				onClose={() => {
					leaveTeamMutation.reset()
					setShowLeaveConfirm(false)
				}}
				portal
				unmountOnHide
				finalFocus={finalFocus}
				title="Leave team"
				description="Are you sure you want to leave this team? Your team subscription will be revoked and you will lose access to any team-managed features."
				confirmLabel="Leave team"
				pendingLabel={leaveTeamMutation.isPending ? 'Leaving team…' : null}
				error={leaveTeamMutation.isError ? leaveTeamMutation.error.message : null}
				onConfirm={() => {
					// Success unmounts this view, and mutate() callbacks with it; the returned promise still settles.
					leaveTeamMutation.mutateAsync().then(
						() => {
							setShowLeaveConfirm(false)
							toast.success('You have left the team')
						},
						// The dialog shows the failure from the mutation state.
						() => {}
					)
				}}
			/>
		</div>
	)
}
