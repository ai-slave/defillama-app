import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { Turnstile } from '~/containers/Subscription/Turnstile'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { InlineStatus } from '~/ui/Status'

interface PasswordResetModalProps {
	isOpen: boolean
	onClose: () => void
	email: string
	onSend: (turnstileToken: string) => void
	isPending: boolean
	cooldownMessage: string
}

// Each opening starts fresh, and a closing dialog keeps its last step through the fade-out.
export function PasswordResetModal(props: PasswordResetModalProps) {
	return <PasswordResetDialog key={useOpeningKey(props.isOpen)} {...props} />
}

function PasswordResetDialog({ isOpen, onClose, email, onSend, isPending, cooldownMessage }: PasswordResetModalProps) {
	// The caller runs the request and clears its result when it opens the dialog; the result is read from the
	// shared mutation, so each opening starts on the form while the caller's cooldown carries over.
	const { resetPasswordMutation } = useAuthContext()
	// The send button stays disabled until Turnstile hands over a token.
	const [turnstileToken, setTurnstileToken] = useState('')
	// Turnstile tokens are single-use; remount the widget after every send.
	const [captchaRetry, setCaptchaRetry] = useState(0)
	// Set when the user asks for another link from the sent step; it brings the security check back.
	const [resendRequested, setResendRequested] = useState(false)
	const newLinkSent = resendRequested && resetPasswordMutation.isSuccess
	// The sent step is an outcome: no security check or send button until another link is requested.
	const showForm = !resetPasswordMutation.isSuccess

	const handleClose = () => {
		if (isPending) return
		onClose()
	}

	const handleSend = () => {
		if (isPending || !turnstileToken) return
		const token = turnstileToken
		setTurnstileToken('')
		setCaptchaRetry((retry) => retry + 1)
		// Clear the previous result first: a resend the cooldown blocks must not read as sent.
		resetPasswordMutation.reset()
		onSend(token)
	}

	return (
		<Dialog size="sm" open={isOpen} onClose={handleClose} pending={isPending} portal unmountOnHide>
			<DialogHeader title={showForm ? 'Change password' : 'Reset link sent'} />
			<DialogBody>
				<div role="status" className="flex flex-col gap-3 body-sm text-secondary">
					{!showForm ? (
						<>
							<p>
								{newLinkSent ? 'We sent a new password reset link to' : 'We sent a password reset link to'} {email}.
							</p>
							<p>Open it to change your password.</p>
						</>
					) : (
						<p>We&apos;ll send a password reset link to {email}.</p>
					)}
				</div>

				{showForm ? (
					<div className="flex flex-col gap-2">
						<div inert={isPending}>
							<Turnstile
								key={captchaRetry}
								onVerify={setTurnstileToken}
								onError={() => setTurnstileToken('')}
								onExpire={() => setTurnstileToken('')}
							/>
						</div>
						{!turnstileToken && !isPending ? (
							<p className="text-center body-sm text-tertiary">Complete the check above to send the link.</p>
						) : null}
					</div>
				) : null}

				{cooldownMessage ? <InlineStatus variant="warning">{cooldownMessage}</InlineStatus> : null}
				{resetPasswordMutation.isError ? (
					<InlineStatus variant="error">{resetPasswordMutation.error.message}</InlineStatus>
				) : null}
			</DialogBody>
			{!showForm ? (
				<DialogFooter
					leading={
						<Button
							type="button"
							size="md"
							onClick={() => {
								// Clear the first send so the form shows until the new link is actually sent.
								resetPasswordMutation.reset()
								setResendRequested(true)
							}}
						>
							Send another link
						</Button>
					}
				>
					{/* A sent link replaces the form and its focused send button, so the step's action takes the focus. The
					    keys keep Done and Send reset link apart: in one slot, React would reuse the node and skip autoFocus. */}
					<Button key="done" autoFocus type="button" variant="primary" size="md" onClick={handleClose}>
						Done
					</Button>
				</DialogFooter>
			) : (
				<DialogFooter
					dismiss={
						<Button type="button" size="md" disabled={isPending} onClick={handleClose}>
							Cancel
						</Button>
					}
				>
					{/* Focusable while it waits for a token: a send clears the token and keeps focus here. After Send
					    another link it replaces that button, so it takes the focus that button had. */}
					<Button
						key="send"
						autoFocus={resendRequested}
						type="button"
						variant="primary"
						size="md"
						pendingLabel={isPending ? 'Sending…' : null}
						disabled={!turnstileToken}
						accessibleWhenDisabled
						onClick={handleSend}
					>
						Send reset link
					</Button>
				</DialogFooter>
			)}
		</Dialog>
	)
}
