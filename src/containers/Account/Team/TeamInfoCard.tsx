import { useId, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { useTeam } from './useTeam'

export function TeamInfoCard() {
	const { team, isAdmin, updateTeamMutation } = useTeam()
	const [isEditing, setIsEditing] = useState(false)
	const errorId = useId()
	const renameRef = useRef<HTMLButtonElement>(null)
	// Not the mutation's own error: that one clears as soon as a retry starts. Success closes the editor.
	const [error, setError] = useState<string | null>(null)
	// The rename button replaces the editor, so it takes the focus the editor had.
	const closeEditor = () =>
		keepFocus(
			() => setIsEditing(false),
			() => renameRef.current
		)

	if (!team) return null

	const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const name = (new FormData(event.currentTarget).get('name') as string).trim()
		if (!name) return
		updateTeamMutation.mutate({ name }, { onSuccess: closeEditor, onError: (failure) => setError(failure.message) })
	}

	const startEditing = () => {
		setError(null)
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
					{/* On a phone the editor takes the leader line's place, so the field, Save and Cancel stay on one line. */}
					<div
						className={`h-0 min-w-0 flex-1 border-b border-dashed border-sub-border ${isEditing ? 'max-sm:hidden' : ''}`}
					/>
					{isEditing ? (
						<form className="flex min-w-0 items-center justify-end gap-2 max-sm:flex-1" onSubmit={handleSave}>
							<input
								type="text"
								aria-label="Team name"
								readOnly={updateTeamMutation.isPending}
								name="name"
								defaultValue={team.name}
								required
								pattern=".*\S.*"
								title="Enter a team name"
								aria-describedby={error ? errorId : undefined}
								aria-invalid={error ? true : undefined}
								onKeyDown={(e) => {
									if (e.key === 'Escape' && !updateTeamMutation.isPending) closeEditor()
								}}
								className="h-8 w-40 min-w-0 shrink rounded-sm border border-sub-border-slate-100 bg-white px-2 py-1 text-xs text-sub-text-primary user-invalid:border-error focus:border-sub-brand-primary focus:outline-hidden user-invalid:focus:border-error dark:border-sub-border-strong dark:bg-sub-surface-dark dark:user-invalid:border-error"
								autoFocus
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								pendingLabel={updateTeamMutation.isPending ? 'Saving…' : null}
							>
								Save
							</Button>
							<Button variant="ghost" size="sm" disabled={updateTeamMutation.isPending} onClick={closeEditor}>
								Cancel
							</Button>
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
				{isEditing && error ? (
					<p id={errorId} role="alert" className="text-xs text-error">
						{error}
					</p>
				) : null}
			</div>
		</div>
	)
}
