import * as Ariakit from '@ariakit/react'
import { useId, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { useTeam } from './useTeam'

export function TeamInfoCard() {
	const { team, isAdmin, updateTeamMutation } = useTeam()
	const [isEditing, setIsEditing] = useState(false)
	const errorId = useId()
	const renameRef = useRef<HTMLButtonElement>(null)
	const closeEditor = () => {
		setIsEditing(false)
		requestAnimationFrame(() => renameRef.current?.focus())
	}

	if (!team) return null

	const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (updateTeamMutation.isPending) return
		const name = (new FormData(event.currentTarget).get('name') as string).trim()
		if (!name) return
		updateTeamMutation.mutate({ name }, { onSuccess: closeEditor })
	}

	const startEditing = () => {
		updateTeamMutation.reset()
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
						<form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={handleSave}>
							<input
								type="text"
								aria-label="Team name"
								readOnly={updateTeamMutation.isPending}
								name="name"
								defaultValue={team.name}
								required
								pattern=".*\S.*"
								title="Enter a team name"
								aria-describedby={updateTeamMutation.isError ? errorId : undefined}
								onKeyDown={(e) => {
									if (e.key === 'Escape' && !updateTeamMutation.isPending) closeEditor()
								}}
								className="h-8 w-40 min-w-0 rounded-sm border border-sub-border-slate-100 bg-white px-2 py-1 text-xs text-sub-text-primary user-invalid:border-error focus:border-sub-brand-primary focus:outline-hidden user-invalid:focus:border-error dark:border-sub-border-strong dark:bg-sub-surface-dark dark:user-invalid:border-error"
								autoFocus
							/>
							<Ariakit.Button
								accessibleWhenDisabled
								type="submit"
								disabled={updateTeamMutation.isPending}
								className="flex min-h-8 items-center gap-1 px-1 text-xs font-medium text-sub-brand-primary aria-disabled:opacity-50"
							>
								{updateTeamMutation.isPending ? <LoadingSpinner size={12} /> : null}
								{updateTeamMutation.isPending ? 'Saving…' : 'Save'}
							</Ariakit.Button>
							<button
								type="button"
								disabled={updateTeamMutation.isPending}
								onClick={closeEditor}
								className="min-h-8 px-1 text-xs text-sub-text-muted"
							>
								Cancel
							</button>
						</form>
					) : (
						<div className="flex min-w-0 items-center gap-2">
							<span className="min-w-0 text-right text-xs leading-4 break-words text-sub-text-primary">
								{team.name}
							</span>
							{isAdmin && (
								<button
									type="button"
									ref={renameRef}
									aria-label="Rename team"
									onClick={startEditing}
									className="flex size-8 shrink-0 items-center justify-center rounded-sm text-sub-text-muted transition-colors hover:text-sub-text-primary"
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
				<p role="status" className="sr-only">
					{updateTeamMutation.isPending ? 'Saving team name…' : ''}
				</p>
				{isEditing && updateTeamMutation.isError ? (
					<p id={errorId} role="alert" className="text-xs text-error">
						{updateTeamMutation.error.message}
					</p>
				) : null}
			</div>
		</div>
	)
}
