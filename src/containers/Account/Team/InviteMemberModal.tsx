import * as Ariakit from '@ariakit/react'
import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogCancelButton } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { emailError } from '~/utils/email'
import { useTeam } from './useTeam'

export function InviteMemberModal({ onClose }: { onClose: () => void }) {
	const { inviteMemberMutation } = useTeam()
	const pending = inviteMemberMutation.isPending
	const [email, setEmail] = useState('')
	const [submitted, setSubmitted] = useState(false)
	// Not the mutation's own error: that one clears as soon as a retry starts. Success closes.
	const [error, setError] = useState<string | null>(null)
	const emailMessage = emailError(email)

	const handleInvite = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (emailMessage) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		inviteMemberMutation.mutate(
			{ email: email.trim() },
			{
				// Confirm only once the dialog is gone, so the toast never sits over it.
				onSuccess: () => {
					onClose()
					toast.success('Invite sent')
				},
				onError: (failure) => setError(failure.message)
			}
		)
	}

	return (
		<Dialog size="sm" open onClose={onClose} pending={pending} portal unmountOnHide>
			<form noValidate onSubmit={handleInvite} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title="Invite member" />
				<DialogBody>
					<p className="body-sm text-secondary">
						Enter the email address of the person you want to invite. They will receive an email with a link to join
						your team.
					</p>
					<Field label="Email address" error={submitted ? emailMessage : null}>
						{(control) => (
							// Ariakit's autoFocus, so the dialog starts on the field instead of its first button, the ×.
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										{...control}
										prefix={<Icon name="mail" className="size-4" aria-hidden="true" />}
										type="email"
										required
										readOnly={pending}
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="colleague@example.com"
										className="w-full"
									/>
								}
							/>
						)}
					</Field>
					{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button type="submit" variant="primary" size="md" pendingLabel="Sending…" pending={pending}>
						Send invite
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{pending ? 'Sending invite' : ''}
				</span>
			</form>
		</Dialog>
	)
}
