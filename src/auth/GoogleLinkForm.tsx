import { useMutation } from '@tanstack/react-query'
import { useId } from 'react'
import { useAuthContext } from '~/auth'
import { OtpRequestError } from '~/auth/emailVerification'
import type { GoogleLinkChallenge, SignInFlowStore } from '~/auth/signInFlowStore'
import { refreshNowSeconds, useNowSeconds } from '~/hooks/useNowSeconds'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
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
	const errorId = useId()
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
		const code = String(new FormData(form).get('code'))
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
				if (!signal.aborted)
					store.dispatch({
						error: caughtError instanceof Error ? caughtError.message : 'Invalid or expired code.',
						kind: 'failed'
					})
				return null
			})
	}

	const handleResend = async (form: HTMLFormElement) => {
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
		form.reset()
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
			<p className="body-sm text-secondary">
				This Google account uses an email managed outside Google. Enter the 6-digit code sent to your email to confirm
				the account link.
			</p>
			<label className="flex flex-col">
				<span className="mb-1.5 label-sm text-secondary">Verification code</span>
				<input
					type="text"
					name="code"
					// Read-only rather than disabled while a request runs, so the field keeps focus.
					readOnly={pending}
					aria-busy={pending || undefined}
					aria-describedby={error ? errorId : undefined}
					inputMode="numeric"
					autoComplete="one-time-code"
					pattern="[0-9]{6}"
					maxLength={6}
					required
					placeholder="000000"
					className={`${oneTimeCodeInputStyles} peer w-full`}
					onInput={(event) => {
						event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6)
					}}
				/>
				<span className="mt-1 hidden body-sm text-error peer-user-invalid:block">Enter the 6-digit code.</span>
			</label>
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
			{error ? (
				<div id={errorId}>
					<InlineStatus variant="error">{error}</InlineStatus>
				</div>
			) : null}
			<div className="flex flex-col items-center gap-3 body-sm">
				{/* Focusable while it waits: a sent code starts the wait while the button still has focus. */}
				<Button
					type="button"
					variant="link"
					pendingLabel={resendGoogleLinkMutation.isPending ? 'Sending code…' : null}
					disabled={!canResend || pending}
					accessibleWhenDisabled
					onClick={(event) => void handleResend(event.currentTarget.form!)}
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
