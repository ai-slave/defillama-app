import { type FormEvent, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { focusRegionOnLeave, keepFocus, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { EmptyState, InlineStatus } from '~/ui/Status'
import { useTeam } from './useTeam'

export function CreateTeamCard() {
	const [isCreating, setIsCreating] = useState(false)
	const createTeamButtonRef = useRef<HTMLButtonElement>(null)

	return (
		<div className="flex flex-col rounded-2xl border border-subtle bg-surface">
			<EmptyState
				size="md"
				headingAs="h2"
				title="Team management"
				actions={
					isCreating ? (
						<CreateTeamForm
							onCreated={() => setIsCreating(false)}
							onCancel={() =>
								// The form gives way to the Create team button that opened it, which takes focus back.
								keepFocus(
									() => setIsCreating(false),
									() => createTeamButtonRef.current
								)
							}
						/>
					) : (
						<Button
							type="button"
							variant="primary"
							size="sm"
							ref={createTeamButtonRef}
							onClick={() => setIsCreating(true)}
						>
							<Icon name="plus" height={16} width={16} />
							Create team
						</Button>
					)
				}
			>
				Create a team to manage subscriptions for your organization. Purchase seats and invite members.
			</EmptyState>
		</div>
	)
}

// Mounted per opening, so Cancel leaves no draft, error or submitted state behind.
function CreateTeamForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
	const { createTeamMutation } = useTeam()
	const [teamName, setTeamName] = useState('')
	const [submitted, setSubmitted] = useState(false)
	// Not the mutation's own error: that one clears as soon as a retry starts.
	const [error, setError] = useState<string | null>(null)
	const pending = createTeamMutation.isPending
	const nameMessage = teamName.trim() ? null : 'Enter a team name.'

	const handleCreate = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (nameMessage) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		createTeamMutation.mutate(
			{ name: teamName.trim() },
			{ onSuccess: onCreated, onError: (failure) => setError(failure.message) }
		)
	}

	return (
		<form noValidate onSubmit={handleCreate} className="flex w-80 max-w-full flex-col gap-3 text-left">
			<Field label="Team name" error={submitted ? nameMessage : null}>
				{(control) => (
					<Input
						{...control}
						type="text"
						required
						value={teamName}
						readOnly={pending}
						onChange={(e) => setTeamName(e.target.value)}
						className="w-full"
						autoFocus
					/>
				)}
			</Field>
			{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
			<div className="flex gap-2">
				<Button type="button" size="md" className="flex-1" disabled={pending} onClick={onCancel}>
					Cancel
				</Button>
				<Button
					// A created team replaces this card with the team's own, so focus moves to the team region.
					ref={focusRegionOnLeave}
					type="submit"
					variant="primary"
					size="md"
					className="flex-1"
					pendingLabel="Creating…"
					pending={pending}
				>
					Create
				</Button>
			</div>
		</form>
	)
}
