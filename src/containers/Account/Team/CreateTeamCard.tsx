import { type FormEvent, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { useTeam } from './useTeam'

export function CreateTeamCard() {
	const { createTeamMutation } = useTeam()
	const [isCreating, setIsCreating] = useState(false)
	const [teamName, setTeamName] = useState('')
	const createTeamButtonRef = useRef<HTMLButtonElement>(null)
	const pending = createTeamMutation.isPending

	const handleCreate = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!teamName.trim() || pending) return
		createTeamMutation.mutate(
			{ name: teamName.trim() },
			{
				onSuccess: () => {
					setTeamName('')
					setIsCreating(false)
				}
			}
		)
	}

	return (
		<div className="flex flex-col items-center gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-8 text-center dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex flex-col gap-2">
				<h2 className="heading-sm text-sub-text-primary">Team management</h2>
				<p className="max-w-sm body-md text-sub-text-muted">
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
							aria-invalid={createTeamMutation.isError}
							aria-describedby={createTeamMutation.isError ? 'create-team-error' : undefined}
							className="w-full"
							autoFocus
						/>
					</div>
					{createTeamMutation.isError ? (
						<p id="create-team-error" role="alert" className="body-sm text-data-down">
							{createTeamMutation.error.message}
						</p>
					) : null}
					<div className="flex gap-2">
						<Button
							type="button"
							size="md"
							className="flex-1"
							disabled={pending}
							onClick={() =>
								// The form gives way to the Create Team button that opened it, which takes focus back.
								keepFocus(
									() => {
										createTeamMutation.reset()
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
