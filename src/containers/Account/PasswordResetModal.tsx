import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { requestPasswordReset } from '~/auth/passwordRecovery'
import { Turnstile } from '~/containers/Subscription/Turnstile'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogCancelButton, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { InlineStatus } from '~/ui/Status'

const COOLDOWN_SECONDS = 60

interface PasswordResetModalProps {
	isOpen: boolean
	onClose: () => void
	email: string
	/** When the last link went out (unix seconds), kept by the caller so the wait carries across openings. */
	sentAtSeconds: number | null
	onSent: (sentAtSeconds: number) => void
}

// Each opening starts fresh, and a closing dialog keeps its last step through the fade-out.
export function PasswordResetModal(props: PasswordResetModalProps) {
	return <PasswordResetDialog key={useOpeningKey(props.isOpen)} {...props} />
}

function PasswordResetDialog({ isOpen, onClose, email, sentAtSeconds, onSent }: PasswordResetModalProps) {
	// Each opening owns its request, so a reopened dialog starts on the form without the last failure. The request
	// cannot be cancelled, so the dialog stays open until it settles.
	// Not the mutation's own error: that one clears as soon as a retry starts.
	const [error, setError] = useState<string | null>(null)
	const sendReset = useMutation({
		mutationFn: (turnstileToken: string) => requestPasswordReset(email, turnstileToken),
		onSuccess: () => {
			setError(null)
			onSent(Math.floor(Date.now() / 1000))
		},
		onError: (err) => setError(err.message)
	})
	const isPending = sendReset.isPending
	const nowSeconds = useNowSeconds(undefined, 1000)
	const waitSeconds = sentAtSeconds === null ? 0 : Math.max(0, COOLDOWN_SECONDS - (nowSeconds - sentAtSeconds))
	// The send button stays disabled until Turnstile hands over a token.
	const [turnstileToken, setTurnstileToken] = useState('')
	// Turnstile tokens are single-use; remount the widget after every send.
	const [captchaRetry, setCaptchaRetry] = useState(0)
	// Set when the user asks for another link from the sent step; it brings the security check back.
	const [resendRequested, setResendRequested] = useState(false)
	// The sent step is an outcome: no security check or send button until another link is requested.
	const showForm = !sendReset.isSuccess

	const handleSend = () => {
		const token = turnstileToken
		setTurnstileToken('')
		setCaptchaRetry((retry) => retry + 1)
		sendReset.mutate(token)
	}

	return (
		<Dialog size="sm" open={isOpen} onClose={onClose} pending={isPending} portal unmountOnHide>
			<DialogHeader title={showForm ? 'Change password' : 'Reset link sent'} />
			<DialogBody>
				<div role="status" className="flex flex-col gap-3 body-sm text-secondary">
					{!showForm ? (
						<>
							<p>
								{resendRequested ? 'We sent a new password reset link to' : 'We sent a password reset link to'} {email}.
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
						{!turnstileToken && !isPending && waitSeconds === 0 ? (
							<p className="text-center body-sm text-tertiary">Complete the check above to send the link.</p>
						) : null}
					</div>
				) : null}

				{/* Shown before the check: the wait, not the check, is what holds the send. */}
				{showForm && waitSeconds > 0 ? (
					<InlineStatus variant="warning">Wait {waitSeconds}s before sending another link.</InlineStatus>
				) : null}
				{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
			</DialogBody>
			{!showForm ? (
				<DialogFooter
					leading={
						<Button
							type="button"
							size="md"
							onClick={() => {
								sendReset.reset()
								setResendRequested(true)
							}}
						>
							Send another link
						</Button>
					}
				>
					{/* A sent link replaces the form and its focused send button, so the step's action takes the focus. The
					    keys keep Done and Send reset link apart: in one slot, React would reuse the node and skip autoFocus. */}
					<Button key="done" autoFocus type="button" variant="primary" size="md" onClick={onClose}>
						Done
					</Button>
				</DialogFooter>
			) : (
				<DialogFooter dismiss={<DialogCancelButton />}>
					{/* Focusable while it waits for a token or the cooldown: a send clears the token and keeps focus here.
					    After Send another link it replaces that button, so it takes the focus that button had. */}
					<Button
						key="send"
						autoFocus={resendRequested}
						type="button"
						variant="primary"
						size="md"
						pendingLabel="Sending…"
						pending={isPending}
						disabled={!turnstileToken || waitSeconds > 0}
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
