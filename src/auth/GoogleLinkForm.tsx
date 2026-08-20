import { useCallback, useSyncExternalStore } from 'react'
import { useAuthContext } from '~/auth'
import type { GoogleLinkChallenge, SignInFlowStore } from '~/auth/signInFlowStore'
import type { FormSubmitEvent } from '~/types/forms'

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
	const expired = useDeadlinePassed(challenge.expiresAt)
	const canResend = useDeadlinePassed(challenge.resendAfter)
	const { confirmGoogleLinkMutation, resendGoogleLinkMutation } = useAuthContext()

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
		const form = event.currentTarget
		const code = String(new FormData(form).get('code'))
		store.dispatch({ kind: 'requestStarted' })
		try {
			await confirmGoogleLinkMutation.mutateAsync({ challengeToken: challenge.challengeToken, code })
			onVerified()
		} catch (caughtError) {
			store.dispatch({
				error: caughtError instanceof Error ? caughtError.message : 'Invalid or expired code',
				kind: 'failed'
			})
			form.reset()
		}
	}

	const handleResend = async (form: HTMLFormElement) => {
		store.dispatch({ kind: 'requestStarted' })
		try {
			const nextChallenge = await resendGoogleLinkMutation.mutateAsync(challenge.challengeToken)
			store.dispatch({ challenge: nextChallenge, kind: 'googleLinkUpdated' })
			form.reset()
		} catch (caughtError) {
			store.dispatch({
				error: caughtError instanceof Error ? caughtError.message : 'Failed to resend verification code',
				kind: 'failed'
			})
		}
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
					inputMode="numeric"
					autoComplete="one-time-code"
					pattern="[0-9]{6}"
					maxLength={6}
					required
					placeholder="000000"
					className="peer h-10 w-full rounded-lg border border-medium bg-signin-input-bg px-3 text-center text-base tracking-[0.4em] text-primary placeholder:tracking-normal placeholder:text-tertiary user-invalid:border-error focus:border-brand focus:outline-hidden user-invalid:focus:border-error"
					onInput={(event) => {
						event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6)
					}}
					autoFocus
				/>
				<span className="mt-1 hidden text-xs text-error peer-user-invalid:block">Enter the 6-digit code.</span>
			</label>
			<button
				type="submit"
				disabled={confirmGoogleLinkMutation.isPending || resendGoogleLinkMutation.isPending}
				className="h-10 w-full rounded-lg bg-brand text-sm font-medium text-on-brand disabled:bg-signin-btn-disabled-bg disabled:text-signin-btn-disabled-text"
			>
				{confirmGoogleLinkMutation.isPending ? 'Verifying...' : 'Verify account'}
			</button>
			{error ? <p className="text-center text-xs text-error">{error}</p> : null}
			<button
				type="button"
				className="text-center text-xs text-link disabled:cursor-not-allowed disabled:text-tertiary"
				onClick={(event) => void handleResend(event.currentTarget.form!)}
				disabled={!canResend || resendGoogleLinkMutation.isPending || confirmGoogleLinkMutation.isPending}
			>
				{resendGoogleLinkMutation.isPending ? 'Sending...' : 'Resend code'}
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
