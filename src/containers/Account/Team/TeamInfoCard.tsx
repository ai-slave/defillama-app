import { useState } from 'react'
import { Icon } from '~/ui/Icon'
import { useTeam } from './useTeam'

export function TeamInfoCard() {
	const { team, isAdmin, updateTeamMutation } = useTeam()
	const [isEditing, setIsEditing] = useState(false)
	const [editName, setEditName] = useState('')

	if (!team) return null

	const handleSave = () => {
		if (!editName.trim() || updateTeamMutation.isPending) return
		updateTeamMutation.mutate({ name: editName.trim() }, { onSuccess: () => setIsEditing(false) })
	}

	const startEditing = () => {
		updateTeamMutation.reset()
		setEditName(team.name)
		setIsEditing(true)
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex items-center gap-2">
				<Icon name="users" height={28} width={28} className="text-sub-text-primary" />
				<span className="text-base leading-5 font-medium text-sub-text-primary">Team</span>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<span className="shrink-0 text-xs leading-4 text-sub-text-muted">Name</span>
					<div className="h-0 min-w-0 flex-1 border-b border-dashed border-sub-border" />
					{isEditing ? (
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleSave()
									if (e.key === 'Escape') setIsEditing(false)
								}}
								className="w-40 rounded-sm border border-sub-border-slate-100 bg-white px-2 py-1 text-xs text-sub-text-primary focus:border-sub-brand-primary focus:outline-hidden dark:border-sub-border-strong dark:bg-sub-surface-dark"
								autoFocus
							/>
							<button
								type="button"
								onClick={handleSave}
								disabled={!editName.trim() || updateTeamMutation.isPending}
								className="text-xs font-medium text-sub-brand-primary disabled:opacity-50"
							>
								{updateTeamMutation.isPending ? '...' : 'Save'}
							</button>
							<button type="button" onClick={() => setIsEditing(false)} className="text-xs text-sub-text-muted">
								Cancel
							</button>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<span className="shrink-0 text-xs leading-4 text-sub-text-primary">{team.name}</span>
							{isAdmin && (
								<button
									type="button"
									onClick={startEditing}
									className="text-sub-text-muted transition-colors hover:text-sub-text-primary"
								>
									<Icon name="pencil" height={14} width={14} />
								</button>
							)}
						</div>
					)}
				</div>

				<div className="flex items-center gap-2">
					<span className="shrink-0 text-xs leading-4 text-sub-text-muted">Your role</span>
					<div className="h-0 min-w-0 flex-1 border-b border-dashed border-sub-border" />
					<span className="shrink-0 text-xs leading-4 text-sub-text-primary">{team.isAdmin ? 'Admin' : 'Member'}</span>
				</div>
				{isEditing && updateTeamMutation.isError ? (
					<p className="text-xs text-error">{updateTeamMutation.error.message}</p>
				) : null}
			</div>
		</div>
	)
}
