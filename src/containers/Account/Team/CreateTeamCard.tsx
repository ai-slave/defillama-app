import { type FormEvent, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave, keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { useTeam } from './useTeam'

export function CreateTeamCard() {
	const { createTeamMutation } = useTeam()
	const [isCreating, setIsCreating] = useState(false)
	const [teamName, setTeamName] = useState('')
	const createTeamButtonRef = useRef<HTMLButtonElement>(null)
	// Not the mutation's own error: that one clears as soon as a retry starts.
	const [error, setError] = useState<string | null>(null)
	const pending = createTeamMutation.isPending

	const handleCreate = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!teamName.trim()) return
		createTeamMutation.mutate(
			{ name: teamName.trim() },
			{
				onSuccess: () => {
					setError(null)
					setTeamName('')
					setIsCreating(false)
				},
				onError: (failure) => setError(failure.message)
			}
		)
	}

	return (
		<div className="flex flex-col items-center gap-4 rounded-2xl border border-subtle bg-surface p-8 text-center">
			<div className="flex flex-col gap-2">
				<h2 className="heading-sm text-primary">Team management</h2>
				<p className="max-w-sm body-md text-tertiary">
					Create a team to manage subscriptions for your organization. Purchase seats and invite members.
				</p>
			</div>

			{isCreating ? (
				<form onSubmit={handleCreate} className="flex w-full max-w-xs flex-col gap-3 text-left">
					<div className="flex flex-col gap-1.5">
						<label htmlFor="create-team-name" className="label-sm text-secondary">
							Team name
						</label>
						<Input
							id="create-team-name"
							type="text"
							value={teamName}
							readOnly={pending}
							onChange={(e) => setTeamName(e.target.value)}
							aria-invalid={error !== null}
							aria-describedby={error ? 'create-team-error' : undefined}
							className="w-full"
							autoFocus
						/>
					</div>
					{error ? (
						<p id="create-team-error" role="alert" className="body-sm text-data-down">
							{error}
						</p>
					) : null}
					<div className="flex gap-2">
						<Button
							type="button"
							size="md"
							className="flex-1"
							disabled={pending}
							onClick={() =>
								// The form gives way to the Create team button that opened it, which takes focus back.
								keepFocus(
									() => {
										setError(null)
										setIsCreating(false)
										setTeamName('')
									},
									() => createTeamButtonRef.current
								)
							}
						>
							Cancel
						</Button>
						<Button
							// A created team replaces this card with the team's own, so focus moves to the team region.
							ref={focusRegionOnLeave}
							type="submit"
							variant="primary"
							size="md"
							className="flex-1"
							disabled={!pending && !teamName.trim()}
							pendingLabel={pending ? 'Creating…' : null}
						>
							Create
						</Button>
					</div>
				</form>
			) : (
				<Button type="button" variant="primary" size="md" ref={createTeamButtonRef} onClick={() => setIsCreating(true)}>
					<Icon name="plus" height={16} width={16} />
					Create team
				</Button>
			)}
		</div>
	)
}
