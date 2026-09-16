import type { DialogStore } from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useId, useSyncExternalStore } from 'react'
import { useAuthContext } from '~/auth'
import { authInputStyles, authPrimaryButtonStyles } from '~/auth/AuthDialog'
import { OtpRequestError } from '~/auth/emailVerification'
import type { GoogleLinkChallenge, SignInFlowStore } from '~/auth/signInFlowStore'
import type { FormSubmitEvent } from '~/types/forms'
import { LoadingSpinner } from '~/ui/Loaders'

function useDeadlinePassed(timestamp: string) {
	const getSnapshot = useCallback(() => Date.now() >= Date.parse(timestamp), [timestamp])
	const subscribe = useCallback(
		(notify: () => void) => {
			const delay = Date.parse(timestamp) - Date.now()
			if (delay <= 0) return () => undefined
			const timer = window.setTimeout(notify, delay)
			return () => window.clearTimeout(timer)
		},
		[timestamp]
	)
	return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function GoogleLinkForm({
	dialogStore,
	challenge,
	error,
	store,
	onVerified
}: {
	dialogStore: DialogStore
	challenge: GoogleLinkChallenge
	error?: string
	store: SignInFlowStore
	onVerified: () => void
}) {
	const expired = useDeadlinePassed(challenge.expiresAt)
	const canResend = useDeadlinePassed(challenge.resendAfter)
	const { confirmGoogleLink, resendGoogleLink } = useAuthContext()
	const confirmGoogleLinkMutation = useMutation({ mutationFn: confirmGoogleLink })
	const resendGoogleLinkMutation = useMutation({ mutationFn: resendGoogleLink })
	const errorId = useId()
	const pending = confirmGoogleLinkMutation.isPending || resendGoogleLinkMutation.isPending

	if (expired) {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-sm leading-5 text-tertiary">
					This verification code expired. Continue with Google again to request a new code.
				</p>
				<button
					type="button"
					className="h-10 w-full rounded-lg bg-brand text-sm font-medium text-on-brand"
					onClick={() => store.dispatch({ kind: 'googleLinkExpired' })}
				>
					Back to sign in
				</button>
			</div>
		)
	}

	const handleSubmit = async (event: FormSubmitEvent) => {
		event.preventDefault()
		if (pending) return
		const form = event.currentTarget
		const code = String(new FormData(form).get('code'))
		store.dispatch({ kind: 'requestStarted' })
		const signal = store.beginAuthRequest()
		await confirmGoogleLinkMutation
			.mutateAsync({
				challengeToken: challenge.challengeToken,
				code,
				signal,
				onAuthenticated: onVerified,
				canAccept: () => dialogStore.getState().open
			})
			.catch((caughtError) => {
				if (!signal.aborted && dialogStore.getState().open)
					store.dispatch({
						error: caughtError instanceof Error ? caughtError.message : 'Invalid or expired code.',
						kind: 'failed'
					})
				return null
			})
	}

	const handleResend = async (form: HTMLFormElement) => {
		if (pending || !canResend) return
		store.dispatch({ kind: 'requestStarted' })
		const signal = store.beginAuthRequest()
		const nextChallenge = await resendGoogleLinkMutation
			.mutateAsync({
				challengeToken: challenge.challengeToken,
				signal,
				canAccept: () => dialogStore.getState().open
			})
			.catch((caughtError) => {
				if (signal.aborted || !dialogStore.getState().open) return null
				if (caughtError instanceof OtpRequestError && caughtError.retryAt) {
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
		if (!nextChallenge || signal.aborted || !dialogStore.getState().open) return
		store.dispatch({ challenge: nextChallenge, kind: 'googleLinkUpdated' })
		form.reset()
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
			<p className="text-sm leading-5 text-tertiary">
				This Google account uses an email managed outside Google. Enter the 6-digit code sent to your email to confirm
				the account link.
			</p>
			<label>
				<span className="sr-only">Verification code</span>
				<input
					type="text"
					name="code"
					aria-label="Verification code"
					disabled={pending}
					aria-describedby={error ? errorId : undefined}
					inputMode="numeric"
					autoComplete="one-time-code"
					pattern="[0-9]{6}"
					maxLength={6}
					required
					placeholder="000000"
					className={`${authInputStyles} text-center text-base tracking-[0.4em] placeholder:tracking-normal`}
					onInput={(event) => {
						event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6)
					}}
				/>
				<span className="mt-1 hidden text-xs text-error peer-user-invalid:block">Enter the 6-digit code.</span>
			</label>
			<button
				type="submit"
				disabled={confirmGoogleLinkMutation.isPending || resendGoogleLinkMutation.isPending}
				className={authPrimaryButtonStyles}
			>
				{confirmGoogleLinkMutation.isPending ? (
					<span className="inline-flex items-center gap-2">
						<LoadingSpinner size={14} />
						Verifying...
					</span>
				) : (
					'Verify account'
				)}
			</button>
			{error ? (
				<p id={errorId} role="alert" className="text-center text-xs text-error">
					{error}
				</p>
			) : null}
			<button
				type="button"
				className="text-center text-xs text-link disabled:cursor-not-allowed disabled:text-tertiary"
				onClick={(event) => void handleResend(event.currentTarget.form!)}
				disabled={!canResend || resendGoogleLinkMutation.isPending || confirmGoogleLinkMutation.isPending}
			>
				{resendGoogleLinkMutation.isPending ? (
					<span className="inline-flex items-center gap-2">
						<LoadingSpinner size={14} />
						Sending...
					</span>
				) : canResend ? (
					'Resend code'
				) : (
					'Resend available shortly'
				)}
			</button>
			<button
				type="button"
				className="text-center text-sm text-link"
				onClick={() => store.dispatch({ kind: 'useAnotherMethod' })}
			>
				Use another sign-in method
			</button>
		</form>
	)
}
