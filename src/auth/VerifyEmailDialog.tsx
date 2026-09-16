import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import {
	AuthDialogHeader,
	authDialogStyles,
	authBodyStyles,
	authInputStyles,
	authPrimaryButtonStyles
} from '~/auth/AuthDialog'
import { OtpRequestError, sendVerificationCode, verifyEmailCode } from '~/auth/emailVerification'

export function VerifyEmailDialog({
	accountId,
	isOpen,
	email,
	onClose
}: {
	accountId: string
	isOpen: boolean
	email?: string
	onClose: () => void
}) {
	// The challenge survives closing the sheet. Reopening must not silently replace
	// the code in the user's inbox or restart the server's resend cooldown.
	const [otp, setOtp] = useState('')
	const [cooldownSeconds, setCooldownSeconds] = useState(0)
	const autoSent = useRef(false)
	const errorId = useId()
	const send = useMutation({
		mutationFn: () => sendVerificationCode(accountId),
		onSuccess: () => setOtp('')
	})
	const verify = useMutation({ mutationFn: (code: string) => verifyEmailCode(accountId, code) })
	const { mutate: sendCode } = send
	useEffect(() => {
		if (!isOpen || autoSent.current) return
		autoSent.current = true
		sendCode()
	}, [isOpen, sendCode])

	const retryAt = send.error instanceof OtpRequestError ? send.error.retryAt : (send.data ?? 0)
	useEffect(() => {
		const update = () => setCooldownSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)))
		update()
		if (!retryAt || !isOpen) return
		const interval = window.setInterval(update, 1000)
		return () => window.clearInterval(interval)
	}, [isOpen, retryAt])

	const pending = send.isPending || verify.isPending
	// A rate-limit message expires with its cooldown; other request errors do not.
	const sendFailure =
		send.error instanceof OtpRequestError && send.error.retryAt > 0 && cooldownSeconds === 0 ? null : send.error
	const failure = verify.error ?? sendFailure
	const error =
		failure instanceof OtpRequestError
			? failure.message
			: failure
				? 'Could not reach the verification service. Check your connection.'
				: null

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && onClose()}>
			<Ariakit.Dialog backdrop={<div className="bg-screen-dim" />} className={authDialogStyles} portal unmountOnHide>
				<AuthDialogHeader title="Verify your email" />
				<form
					className={authBodyStyles}
					onSubmit={(event) => {
						event.preventDefault()
						if (pending || otp.length !== 6) return
						verify.mutate(otp)
					}}
				>
					<p className="text-sm leading-5 text-tertiary">
						You&apos;re signed in. Verify {email ? <span className="text-primary">{email}</span> : 'your email'} to
						continue with features that require verification.
					</p>
					<p className="text-sm text-secondary" aria-live="polite">
						{send.isSuccess ? 'Code sent. Check your inbox.' : 'Enter the 6-digit code from your email.'}
					</p>
					<label>
						<span className="sr-only">Verification code</span>
						<input
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							maxLength={6}
							required
							placeholder="000000"
							className={`${authInputStyles} text-center text-base tracking-[0.4em] placeholder:tracking-normal`}
							value={otp}
							disabled={pending}
							aria-invalid={verify.isError}
							aria-describedby={error ? errorId : undefined}
							onChange={(event) => {
								setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
								verify.reset()
							}}
						/>
					</label>
					<button type="submit" disabled={pending || otp.length !== 6} className={authPrimaryButtonStyles}>
						{verify.isPending ? (
							<span className="inline-flex items-center gap-2">
								<span
									aria-hidden
									className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								/>
								Verifying...
							</span>
						) : (
							'Verify email'
						)}
					</button>
					{verify.error && error ? (
						<p id={errorId} role="alert" className="text-center text-xs text-error">
							{error}
						</p>
					) : null}
					<div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
						{!verify.error && error ? (
							<p id={errorId} role="alert" className="text-center text-xs text-error">
								{error}
							</p>
						) : null}
						<button
							type="button"
							disabled={pending || cooldownSeconds > 0}
							className="text-center text-xs text-link disabled:text-tertiary"
							onClick={() => {
								verify.reset()
								sendCode()
							}}
						>
							{send.isPending
								? 'Sending code...'
								: cooldownSeconds > 0
									? `Resend code (${cooldownSeconds}s)`
									: sendFailure && !verify.error
										? 'Try again'
										: 'Resend code'}
						</button>
					</div>
					<Ariakit.DialogDismiss className="text-center text-sm text-link">Verify later</Ariakit.DialogDismiss>
				</form>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
