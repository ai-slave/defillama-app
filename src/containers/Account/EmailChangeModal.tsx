import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { refreshSession } from '~/auth/authStore'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { Input } from '~/ui/Input'
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
	const emailId = useId()
	// Not the mutation's own error: that one clears as soon as a retry starts. Success replaces the form.
	const [error, setError] = useState<string | null>(null)
	const requestEmailChange = useMutation({
		mutationFn: async (nextEmail: string) => {
			await pb.collection('users').requestEmailChange(nextEmail)
			// The change request already succeeded; refreshSession only updates the cached user state, so
			// its failure must not fail the change.
			await refreshSession().catch(() => {})
		},
		onError: () => setError('Could not send the confirmation email. Check the address and try again.')
	})
	const pending = requestEmailChange.isPending

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		requestEmailChange.mutate(new FormData(event.currentTarget).get('email') as string)
	}

	return (
		<Dialog size="sm" open={isOpen} onClose={onClose} pending={pending} portal unmountOnHide>
			{requestEmailChange.isSuccess ? (
				<>
					<DialogHeader title="Confirmation link sent" />
					<DialogBody>
						<p id={`${emailId}-success`} className="body-sm text-secondary">
							A confirmation link has been sent to{' '}
							<strong className="font-medium text-primary">{requestEmailChange.variables}</strong>. Open it to confirm
							the change.
						</p>
					</DialogBody>
					<DialogFooter>
						<Button
							type="button"
							variant="primary"
							size="md"
							autoFocus
							onClick={onClose}
							aria-describedby={`${emailId}-success`}
						>
							Done
						</Button>
					</DialogFooter>
				</>
			) : (
				<form onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title="Change your email" />
					<DialogBody>
						<div className="flex flex-col gap-1.5">
							<label htmlFor={emailId} className="label-sm text-secondary">
								New email
							</label>
							{/* Ariakit's autoFocus, so the dialog starts on the field instead of its first button, the ×. */}
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										type="email"
										readOnly={pending}
										id={emailId}
										name="email"
										aria-describedby={error ? `${emailId}-error` : undefined}
										aria-invalid={error ? true : undefined}
										required
										onChange={() => setError(null)}
										placeholder="your.new.email@example.com"
										className="w-full"
									/>
								}
							/>
							{error ? (
								<p id={`${emailId}-error`} role="alert" className="body-sm text-data-down">
									{error}
								</p>
							) : null}
						</div>
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
