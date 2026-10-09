import { useId, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { Tooltip } from '~/ui/Tooltip'
import { useTeam } from './useTeam'

export function TeamInfoCard() {
	const { team, isAdmin, updateTeamMutation } = useTeam()
	const [isEditing, setIsEditing] = useState(false)
	const errorId = `${useId()}-error`
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
		// A name cleared to blank keeps the current one, as a rename in Finder does.
		if (!name) return closeEditor()
		updateTeamMutation.mutate({ name }, { onSuccess: closeEditor, onError: (failure) => setError(failure.message) })
	}

	const startEditing = () => {
		setError(null)
		setIsEditing(true)
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
			<div className="flex items-center gap-2">
				<Icon name="users" height={28} width={28} className="text-primary" />
				<span className="label-lg text-primary">Team</span>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<span className="shrink-0 body-sm text-tertiary">Name</span>
					{/* On a phone the editor takes the leader line's place, so the field, Save and Cancel stay on one line. */}
					<div
						className={`h-0 min-w-0 flex-1 border-b border-dashed border-medium ${isEditing ? 'max-sm:hidden' : ''}`}
					/>
					{isEditing ? (
						<form
							noValidate
							className="flex min-w-0 items-center justify-end gap-2 max-sm:flex-1"
							onSubmit={handleSave}
						>
							<Input
								type="text"
								aria-label="Team name"
								placeholder="Team name"
								readOnly={updateTeamMutation.isPending}
								name="name"
								defaultValue={team.name}
								aria-describedby={error ? errorId : undefined}
								aria-invalid={error ? true : undefined}
								onKeyDown={(e) => {
									if (e.key === 'Escape' && !updateTeamMutation.isPending) closeEditor()
								}}
								className="w-40 min-w-0 shrink"
								autoFocus
							/>
							<Button
								type="submit"
								variant="primary"
								size="md"
								pendingLabel="Saving…"
								pending={updateTeamMutation.isPending}
							>
								Save
							</Button>
							<Button variant="ghost" size="md" disabled={updateTeamMutation.isPending} onClick={closeEditor}>
								Cancel
							</Button>
						</form>
					) : (
						<div className="flex min-w-0 items-center gap-2">
							<span className="min-w-0 text-right body-sm break-words text-primary">{team.name}</span>
							{isAdmin && (
								<Tooltip
									content="Rename team"
									render={
										<Button
											variant="ghost"
											size="sm"
											square
											ref={renameRef}
											aria-label="Rename team"
											onClick={startEditing}
										/>
									}
								>
									<Icon name="pencil" className="size-4" />
								</Tooltip>
							)}
						</div>
					)}
				</div>

				<div className="flex items-center gap-2">
					<span className="shrink-0 body-sm text-tertiary">Your role</span>
					<div className="h-0 min-w-0 flex-1 border-b border-dashed border-medium" />
					<span className="shrink-0 body-sm text-primary">{team.isAdmin ? 'Admin' : 'Member'}</span>
				</div>
				<p role="status" className="sr-only">
					{updateTeamMutation.isPending ? 'Saving team name…' : ''}
				</p>
				{isEditing && error ? (
					<p id={errorId} role="alert" className="body-sm text-error">
						{error}
					</p>
				) : null}
			</div>
		</div>
	)
}
