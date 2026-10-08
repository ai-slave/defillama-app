import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { InvalidCodeError, OtpRequestError } from '~/auth/emailVerification'
import type { GoogleLinkChallenge, SignInFlowStore } from '~/auth/signInFlowStore'
import { refreshNowSeconds, useNowSeconds } from '~/hooks/useNowSeconds'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { oneTimeCodeInputStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'

export function GoogleLinkForm({
	challenge,
	error,
	store,
	onVerified
}: {
	challenge: GoogleLinkChallenge
	error?: string
	store: SignInFlowStore
	onVerified: () => void
}) {
	// The form mounts only after a sign-in answer, never while hydrating.
	const nowMs = useNowSeconds(undefined, 1000) * 1000
	const expired = nowMs >= Date.parse(challenge.expiresAt)
	const canResend = nowMs >= Date.parse(challenge.resendAfter)
	const { confirmGoogleLink, resendGoogleLink } = useAuthContext()
	const confirmGoogleLinkMutation = useMutation({ mutationFn: confirmGoogleLink })
	const resendGoogleLinkMutation = useMutation({ mutationFn: resendGoogleLink })
	const [code, setCode] = useState('')
	const [submitted, setSubmitted] = useState(false)
	// The server refused the last code; the next edit or a new code clears it.
	const [codeRefusal, setCodeRefusal] = useState<string | null>(null)
	const codeError = code.length === 6 ? null : 'Enter the 6-digit code.'
	const pending = confirmGoogleLinkMutation.isPending || resendGoogleLinkMutation.isPending

	if (expired) {
		return (
			<div className="flex flex-col gap-4">
				<p className="body-sm text-secondary">
					This verification code expired. Continue with Google again to request a new code.
				</p>
				<Button
					type="button"
					variant="primary"
					size="md"
					className="w-full"
					onClick={() => store.dispatch({ kind: 'googleLinkExpired' })}
				>
					Back to sign in
				</Button>
			</div>
		)
	}

	const handleSubmit = async (event: FormSubmitEvent) => {
		event.preventDefault()
		const form = event.currentTarget
		if (codeError) return showFieldErrors(form, () => setSubmitted(true))
		store.dispatch({ kind: 'requestStarted' })
		const signal = store.beginAuthRequest()
		await confirmGoogleLinkMutation
			.mutateAsync({
				challengeToken: challenge.challengeToken,
				code,
				signal,
				onAuthenticated: onVerified
			})
			.catch((caughtError) => {
				if (signal.aborted) return null
				if (caughtError instanceof InvalidCodeError) showFieldErrors(form, () => setCodeRefusal(caughtError.message))
				else
					store.dispatch({
						error: caughtError instanceof Error ? caughtError.message : 'Could not verify the code.',
						kind: 'failed'
					})
				return null
			})
	}

	const handleResend = async () => {
		store.dispatch({ kind: 'requestStarted' })
		const signal = store.beginAuthRequest()
		const nextChallenge = await resendGoogleLinkMutation
			.mutateAsync({
				challengeToken: challenge.challengeToken,
				signal
			})
			.catch((caughtError) => {
				if (signal.aborted) return null
				if (caughtError instanceof OtpRequestError && caughtError.retryAt) {
					// The wait was measured from Date.now(), so the clock re-reads the second before the form shows it.
					refreshNowSeconds()
					store.dispatch({
						kind: 'googleLinkUpdated',
						challenge: {
							...challenge,
							resendAfter: new Date(Math.min(caughtError.retryAt, Date.parse(challenge.expiresAt) - 1)).toISOString()
						}
					})
				} else
					store.dispatch({
						error: caughtError instanceof Error ? caughtError.message : 'Could not resend the code.',
						kind: 'failed'
					})
				return null
			})
		if (!nextChallenge || signal.aborted) return
		store.dispatch({ challenge: nextChallenge, kind: 'googleLinkUpdated' })
		setCode('')
		setSubmitted(false)
		setCodeRefusal(null)
	}

	return (
		<form noValidate className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
			<p className="body-sm text-secondary">
				This Google account uses an email managed outside Google. Enter the 6-digit code sent to your email to confirm
				the account link.
			</p>
			<Field label="Verification code" error={(submitted ? codeError : null) ?? codeRefusal}>
				{(control) => (
					<input
						{...control}
						type="text"
						name="code"
						// Read-only rather than disabled while a request runs, so the field keeps focus.
						readOnly={pending}
						aria-busy={pending || undefined}
						inputMode="numeric"
						autoComplete="one-time-code"
						maxLength={6}
						required
						placeholder="000000"
						className={`${oneTimeCodeInputStyles} w-full`}
						value={code}
						onChange={(event) => {
							setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
							setCodeRefusal(null)
						}}
					/>
				)}
			</Field>
			<Button
				type="submit"
				variant="primary"
				size="md"
				className="w-full"
				disabled={resendGoogleLinkMutation.isPending}
				pendingLabel={confirmGoogleLinkMutation.isPending ? 'Verifying…' : null}
			>
				Verify account
			</Button>
			{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
			<div className="flex flex-col items-center gap-3 body-sm">
				{/* Focusable while it waits: a sent code starts the wait while the button still has focus. */}
				<Button
					type="button"
					variant="link"
					pendingLabel={resendGoogleLinkMutation.isPending ? 'Sending code…' : null}
					disabled={!canResend || pending}
					accessibleWhenDisabled
					onClick={() => void handleResend()}
				>
					{canResend ? 'Resend code' : 'Resend available shortly'}
				</Button>
				<Button variant="link" onClick={() => store.dispatch({ kind: 'useAnotherMethod' })}>
					Use another sign-in method
				</Button>
			</div>
		</form>
	)
}
