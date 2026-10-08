import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useId, useState } from 'react'
import { refreshSession } from '~/auth/authStore'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input } from '~/ui/Input'
import { emailError } from '~/utils/email'
import pb from '~/utils/pocketbase'

interface EmailChangeModalProps {
	isOpen: boolean
	onClose: () => void
}

// Each opening starts fresh, and a closing dialog keeps its last step through the fade-out.
export function EmailChangeModal(props: EmailChangeModalProps) {
	return <EmailChangeDialog key={useOpeningKey(props.isOpen)} {...props} />
}

function EmailChangeDialog({ isOpen, onClose }: EmailChangeModalProps) {
	const successId = useId()
	const [email, setEmail] = useState('')
	const [submitted, setSubmitted] = useState(false)
	// The server's refusal shows as the field's error until the address is edited. Not the mutation's own error: that
	// one clears as soon as a retry starts. Success replaces the form.
	const [error, setError] = useState<string | null>(null)
	const requestEmailChange = useMutation({
		mutationFn: async (nextEmail: string) => {
			await pb.collection('users').requestEmailChange(nextEmail)
			// The change request already succeeded; refreshSession only updates the cached user state, so
			// its failure must not fail the change.
			await refreshSession().catch(() => {})
		}
	})
	const pending = requestEmailChange.isPending
	const emailMessage = emailError(email)

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const form = event.currentTarget
		if (emailMessage) return showFieldErrors(form, () => setSubmitted(true))
		requestEmailChange.mutate(email, {
			// Focus moves to the refused field, so a screen reader reads it with the error.
			onError: () =>
				showFieldErrors(form, () => setError('Could not send the confirmation email. Check the address and try again.'))
		})
	}

	return (
		<Dialog size="sm" open={isOpen} onClose={onClose} pending={pending} portal unmountOnHide>
			{requestEmailChange.isSuccess ? (
				<>
					<DialogHeader title="Confirmation link sent" />
					<DialogBody>
						<p id={successId} className="body-sm text-secondary">
							A confirmation link has been sent to{' '}
							<strong className="font-medium text-primary">{requestEmailChange.variables}</strong>. Open it to confirm
							the change.
						</p>
					</DialogBody>
					<DialogFooter>
						<Button type="button" variant="primary" size="md" autoFocus onClick={onClose} aria-describedby={successId}>
							Done
						</Button>
					</DialogFooter>
				</>
			) : (
				<form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title="Change your email" />
					<DialogBody>
						<Field label="New email" error={(submitted ? emailMessage : null) ?? error}>
							{(control) => (
								// Ariakit's autoFocus, so the dialog starts on the field instead of its first button, the ×.
								<Ariakit.Focusable
									autoFocus
									render={
										<Input
											{...control}
											type="email"
											required
											readOnly={pending}
											value={email}
											onChange={(e) => {
												setEmail(e.target.value)
												setError(null)
											}}
											placeholder="your.new.email@example.com"
											className="w-full"
										/>
									}
								/>
							)}
						</Field>
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button type="submit" variant="primary" size="md" pendingLabel={pending ? 'Sending…' : null}>
							Confirm email
						</Button>
					</DialogFooter>
					<span role="status" className="sr-only">
						{pending ? 'Sending confirmation email…' : ''}
					</span>
				</form>
			)}
		</Dialog>
	)
}
