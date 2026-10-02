import * as Ariakit from '@ariakit/react'
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { AuthDialogHeader, authInputStyles } from '~/auth/AuthDialog'
import { OtpRequestError, verifyEmailCode } from '~/auth/emailVerification'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody } from '~/ui/Dialog'
import { InlineStatus } from '~/ui/Status'

export function VerifyEmailDialog({
	accountId,
	isOpen,
	email,
	send,
	onClose
}: {
	accountId: string
	isOpen: boolean
	email?: string
	/** The provider sends the first code when it opens the sheet for an account; the sheet only resends. */
	send: UseMutationResult<number, Error, string>
	onClose: () => void
}) {
	const [otp, setOtp] = useState('')
	const codeRef = useRef<HTMLInputElement>(null)
	const errorId = useId()
	const verify = useMutation({ mutationFn: (code: string) => verifyEmailCode(accountId, code) })

	const retryAt = send.error instanceof OtpRequestError ? send.error.retryAt : (send.data ?? 0)
	// The sheet only mounts after an opener, never while hydrating. The provider re-reads the clock as each send
	// settles, so a new retryAt is measured against the current second, then counted down every second while open.
	const nowSeconds = useNowSeconds(undefined, isOpen ? 1000 : 30_000)
	const cooldownSeconds = Math.max(0, Math.floor(retryAt / 1000) - nowSeconds)

	const pending = send.isPending || verify.isPending
	// A rate-limit message expires with its cooldown; other request errors do not.
	const sendFailure =
		send.error instanceof OtpRequestError && send.error.retryAt > 0 && cooldownSeconds === 0 ? null : send.error
	const failure = verify.error ?? sendFailure
	// A rate limit waits out its countdown on the resend button; any other delivery failure offers a retry.
	const deliveryFailed = sendFailure !== null && !verify.error && cooldownSeconds === 0
	const resend = () => {
		verify.reset()
		send.mutate(accountId, { onSuccess: () => setOtp('') })
	}
	// Try again replaces itself with the sending state, so focus moves on to the field the new code goes in.
	const retryDelivery = () => {
		resend()
		codeRef.current!.focus()
	}
	const error =
		failure instanceof OtpRequestError
			? failure.message
			: failure
				? 'Could not reach the verification service. Check your connection.'
				: null

	return (
		<Dialog size="sm" open={isOpen} onClose={onClose} portal unmountOnHide>
			<AuthDialogHeader title="Verify your email" />
			<DialogBody>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault()
						if (pending || otp.length !== 6) return
						verify.mutate(otp)
					}}
				>
					<Ariakit.DialogDescription className="body-sm text-secondary">
						You&apos;re signed in. Verify {email ? <span className="text-primary">{email}</span> : 'your email'} to
						continue with features that require verification.
					</Ariakit.DialogDescription>
					<p className="body-sm text-secondary" aria-live="polite">
						{send.isSuccess ? 'Code sent. Check your inbox.' : 'Enter the 6-digit code from your email.'}
					</p>
					<label className="flex flex-col">
						<span className="mb-1.5 label-sm text-secondary">Verification code</span>
						<input
							ref={codeRef}
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							maxLength={6}
							required
							placeholder="000000"
							className={`${authInputStyles} text-center text-base tracking-[0.4em] placeholder:tracking-normal`}
							value={otp}
							// Read-only rather than disabled while a request runs, so the field keeps focus.
							readOnly={pending}
							aria-invalid={verify.isError}
							aria-describedby={error ? errorId : undefined}
							onChange={(event) => {
								setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
								verify.reset()
							}}
						/>
					</label>
					<Button
						type="submit"
						variant="primary"
						size="md"
						className="w-full"
						disabled={pending || otp.length !== 6}
						pendingLabel={verify.isPending ? 'Verifying…' : null}
					>
						Verify email
					</Button>
					{/* One slot for verify and delivery failures: the field describes itself with it either way. */}
					{error ? (
						<div id={errorId}>
							<InlineStatus variant="error">
								{/* A delivery failure offers its retry beside the message; a wrong code is fixed in the field. */}
								{deliveryFailed ? (
									<div className="flex flex-wrap items-center justify-between gap-2">
										<span>{error}</span>
										<Button type="button" size="sm" onClick={retryDelivery}>
											Try again
										</Button>
									</div>
								) : (
									error
								)}
							</InlineStatus>
						</div>
					) : null}
					<div className="flex flex-col items-center gap-3">
						{deliveryFailed ? null : (
							// Focusable through the countdown: a sent code starts it while the button still has focus.
							<Button
								type="button"
								variant="ghost"
								size="sm"
								pendingLabel={send.isPending ? 'Sending code…' : null}
								disabled={pending || cooldownSeconds > 0}
								accessibleWhenDisabled
								onClick={resend}
							>
								{cooldownSeconds > 0 ? `Resend code (${cooldownSeconds}s)` : 'Resend code'}
							</Button>
						)}
						<Ariakit.DialogDismiss className="body-sm text-link">Verify later</Ariakit.DialogDismiss>
					</div>
				</form>
			</DialogBody>
		</Dialog>
	)
}
