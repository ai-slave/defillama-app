import type * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { type ReactNode, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { type PromotionalEmailsValue, useAuthContext } from '~/auth'
import {
	AuthDialogHeader,
	authInputStyles,
	authProviderButtonStyles,
	authWalletPickerStyles,
	authProviderIconSlotStyles,
	LastUsedChip,
	LastUsedCorner
} from '~/auth/AuthDialog'
import { GoogleLinkForm } from '~/auth/GoogleLinkForm'
import { GoogleSignInButton } from '~/auth/GoogleSignInButton'
import { useLastSignIn } from '~/auth/lastSignIn'
import { requestPasswordReset } from '~/auth/passwordRecovery'
import { createSignInFlowStore, type SignInFlowState, type SignInFlowStore } from '~/auth/signInFlowStore'
import { BasicLink } from '~/components/Link'
import { Turnstile } from '~/containers/Subscription/Turnstile'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import type { WalletSignInProps } from './WalletSignIn'

const inputCls = authInputStyles
const fieldLabelCls = 'mb-1.5 label-sm text-secondary'

const WalletSignIn = dynamic<WalletSignInProps>(() => import('./WalletSignIn').then((module) => module.WalletSignIn), {
	ssr: false,
	loading: () => (
		<div role="status" aria-live="polite" className={`${authWalletPickerStyles} flex items-center justify-center`}>
			<LoadingIndicator label="Loading wallets" />
		</div>
	)
})

export function SignInDialog({
	store,
	initialStep,
	suppressVerifyEmailPrompt,
	prompt,
	onAuthenticated
}: {
	store: Ariakit.DialogStore
	initialStep?: 'signin' | 'signup'
	suppressVerifyEmailPrompt?: boolean
	prompt?: string
	onAuthenticated?: () => void
}) {
	return (
		<Dialog size="sm" store={store} getPersistentElements={() => document.querySelectorAll('w3m-modal')} unmountOnHide>
			<SignInFlow
				dialogStore={store}
				initialStep={initialStep}
				suppressVerifyEmailPrompt={suppressVerifyEmailPrompt}
				prompt={prompt}
				onAuthenticated={onAuthenticated}
			/>
		</Dialog>
	)
}

export function SignInFlow({
	dialogStore,
	initialStep = 'signin',
	suppressVerifyEmailPrompt,
	prompt,
	onAuthenticated,
	closeable = true
}: {
	dialogStore: Ariakit.DialogStore
	initialStep?: 'signin' | 'signup'
	suppressVerifyEmailPrompt?: boolean
	prompt?: string
	onAuthenticated?: () => void
	closeable?: boolean
}) {
	const [flowStore] = useState(() => createSignInFlowStore(initialStep))
	useEffect(() => flowStore.cancelAuthRequest, [flowStore])
	const state = useSyncExternalStore(flowStore.subscribe, flowStore.getSnapshot, flowStore.getServerSnapshot)
	const finishAuthentication = useCallback(() => {
		flowStore.dispatch({ kind: 'authenticated' })
		onAuthenticated?.()
		dialogStore.hide()
	}, [dialogStore, flowStore, onAuthenticated])

	// Keyed by title, so each step's title takes focus on mount and a step change is announced.
	const header = (title: string) => (
		<AuthDialogHeader
			key={title}
			title={title}
			prompt={prompt}
			closable={closeable}
			onBack={state.kind !== 'signin' ? () => flowStore.dispatch({ kind: 'navigate', screen: 'signin' }) : undefined}
		/>
	)

	// The reset screen names its own outcome in the header, so it renders the header itself.
	if (state.kind === 'forgot')
		return (
			<ForgotPasswordScreen dialogStore={dialogStore} store={flowStore} initialEmail={state.email} header={header} />
		)

	return (
		<>
			{header(
				state.kind === 'signup'
					? 'Create an account'
					: state.kind === 'googleLink'
						? 'Confirm your email'
						: state.kind === 'wallet'
							? 'Sign in with a wallet'
							: 'Sign in'
			)}
			<DialogBody>
				{state.kind === 'googleLink' ? (
					<GoogleLinkForm
						dialogStore={dialogStore}
						challenge={state.challenge}
						error={state.error?.message}
						store={flowStore}
						onVerified={finishAuthentication}
					/>
				) : state.kind === 'wallet' ? (
					<WalletSignIn dialogStore={dialogStore} store={flowStore} onAuthenticated={finishAuthentication} />
				) : (
					<div key={state.kind}>
						<AuthScreen
							dialogStore={dialogStore}
							suppressVerifyEmailPrompt={suppressVerifyEmailPrompt}
							state={state}
							store={flowStore}
							onAuthenticated={finishAuthentication}
						/>
					</div>
				)}
			</DialogBody>
		</>
	)
}

function FieldError({ children }: { children: ReactNode }) {
	return <span className="mt-1 hidden body-sm text-data-down peer-user-invalid:block">{children}</span>
}

/** The Turnstile widget and its failure state. Key it by spent token: a submitted attempt mounts a fresh widget.
    Its own Try again mounts a fresh widget inside the same wrapper and moves focus there, since the button is gone. */
function Captcha({ disabled, onToken }: { disabled: boolean; onToken: (token: string) => void }) {
	const [failed, setFailed] = useState(false)
	const [retry, setRetry] = useState(0)
	const wrapperRef = useRef<HTMLDivElement>(null)
	return (
		<>
			<div ref={wrapperRef} role="group" aria-label="Security check" tabIndex={-1} inert={disabled}>
				<Turnstile
					key={retry}
					onVerify={(token) => {
						// Turnstile retries on its own, so a later success clears the failure.
						setFailed(false)
						onToken(token)
					}}
					onError={() => {
						setFailed(true)
						onToken('')
					}}
					onExpire={() => onToken('')}
				/>
			</div>
			{failed ? (
				<InlineStatus variant="error">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span>The security check failed.</span>
						<Button
							type="button"
							size="sm"
							onClick={() => {
								setFailed(false)
								setRetry(retry + 1)
								wrapperRef.current!.focus()
							}}
						>
							Try again
						</Button>
					</div>
				</InlineStatus>
			) : null}
		</>
	)
}

function PasswordField({
	name,
	label,
	action,
	error,
	minLength,
	disabled,
	autoComplete
}: {
	name: string
	label: string
	/** Sits at the right end of the label row, after the field in tab order. */
	action?: ReactNode
	error: string
	minLength?: number
	disabled?: boolean
	autoComplete?: string
}) {
	const [visible, setVisible] = useState(false)
	const id = useId()
	return (
		<div className="grid grid-cols-[1fr_auto] items-center">
			<label htmlFor={id} className={`${fieldLabelCls} col-start-1 row-start-1`}>
				{label}
			</label>
			<div className="relative col-span-2 row-start-2">
				<input
					id={id}
					type={visible ? 'text' : 'password'}
					name={name}
					required
					disabled={disabled}
					autoComplete={autoComplete}
					minLength={minLength}
					className={`${inputCls} pr-10`}
				/>
				<Button
					type="button"
					variant="ghost"
					size="md"
					square
					className="absolute top-1 right-1"
					onClick={() => setVisible((value) => !value)}
					aria-label={visible ? 'Hide password' : 'Show password'}
				>
					<Icon name={visible ? 'eye-off' : 'eye'} height={16} width={16} />
				</Button>
				<FieldError>{error}</FieldError>
			</div>
			{action ? <div className="col-start-2 row-start-1 mb-1.5 body-sm">{action}</div> : null}
		</div>
	)
}

function AuthScreen({
	dialogStore,
	state,
	store,
	onAuthenticated,
	suppressVerifyEmailPrompt
}: {
	dialogStore: Ariakit.DialogStore
	state: Extract<SignInFlowState, { kind: 'signin' | 'signup' }>
	store: SignInFlowStore
	suppressVerifyEmailPrompt?: boolean
	onAuthenticated: () => void
}) {
	const { login, signup, signInWithGithub, signInWithGoogle } = useAuthContext()
	const signInWithGithubMutation = useMutation({ mutationFn: signInWithGithub })
	const signInWithGoogleMutation = useMutation({ mutationFn: signInWithGoogle })
	const errorId = useId()
	const loginMutation = useMutation({ mutationFn: login })
	const formId = useId()
	// Submit stays disabled until Turnstile hands over a token.
	const [turnstileToken, setTurnstileToken] = useState('')
	const [captchaRetry, setCaptchaRetry] = useState(0)
	const signupMutation = useMutation({ mutationFn: signup })
	const isSignup = state.kind === 'signup'
	const lastSignIn = useLastSignIn()
	const lastMethod = isSignup ? null : lastSignIn?.method
	const isPending =
		loginMutation.isPending ||
		signupMutation.isPending ||
		signInWithGithubMutation.isPending ||
		signInWithGoogleMutation.isPending
	const handleSignUp = async (event: FormSubmitEvent) => {
		event.preventDefault()
		if (isPending || !turnstileToken) return
		const form = event.currentTarget
		const data = new FormData(form)
		const password = String(data.get('password'))
		const passwordConfirm = String(data.get('passwordConfirm'))
		const confirmInput = form.elements.namedItem('passwordConfirm') as HTMLInputElement
		store.dispatch({ kind: 'requestStarted' })
		if (password !== passwordConfirm) {
			confirmInput.setCustomValidity('Passwords do not match')
			confirmInput.reportValidity()
			return
		}
		const promotionalEmails: PromotionalEmailsValue = data.has('promotionalEmails') ? 'on' : 'off'
		const signal = store.beginAuthRequest()
		// Turnstile tokens are single-use; a failed attempt needs a fresh widget.
		const token = turnstileToken
		setTurnstileToken('')
		await signupMutation
			.mutateAsync({
				email: String(data.get('email')),
				password,
				passwordConfirm,
				turnstileToken: token,
				promotionalEmails,
				suppressVerifyEmailPrompt,
				signal,
				onAuthenticated,
				canAccept: () => dialogStore.getState().open
			})
			.catch((error: Error) => {
				if (!signal.aborted && dialogStore.getState().open) {
					setCaptchaRetry((retry) => retry + 1)
					store.dispatch({ error: error.message, kind: 'failed' })
				}
				return null
			})
	}

	const handleSignIn = async (event: FormSubmitEvent) => {
		event.preventDefault()
		if (isPending || !turnstileToken) return
		const data = new FormData(event.currentTarget)
		store.dispatch({ kind: 'requestStarted' })
		const signal = store.beginAuthRequest()
		const token = turnstileToken
		setTurnstileToken('')
		await loginMutation
			.mutateAsync({
				email: String(data.get('email')),
				password: String(data.get('password')),
				turnstileToken: token,
				signal,
				suppressVerifyEmailPrompt,
				onAuthenticated,
				canAccept: () => dialogStore.getState().open
			})
			.catch((error: Error) => {
				if (!signal.aborted && dialogStore.getState().open) {
					setCaptchaRetry((retry) => retry + 1)
					store.dispatch({ error: error.message, kind: 'failed' })
				}
				return null
			})
	}

	const handleGithubSignIn = () => {
		if (isPending) return
		// Open synchronously in the click event; Safari blocks a popup opened after awaiting the SDK.
		const popup = window.open('about:blank', '_blank', 'popup,width=600,height=720')
		store.dispatch({ kind: 'requestStarted' })
		if (!popup) {
			store.dispatch({ kind: 'failed', method: 'github', error: 'Allow popups to continue with GitHub.' })
			return
		}
		const signal = store.beginAuthRequest()
		void signInWithGithubMutation
			.mutateAsync({
				signal,
				canAccept: () => dialogStore.getState().open,
				popup,
				suppressVerifyEmailPrompt,
				onAuthenticated
			})
			.catch(() => {
				if (!signal.aborted && dialogStore.getState().open)
					store.dispatch({ kind: 'failed', method: 'github', error: 'GitHub sign-in did not finish.' })
			})
			.finally(() => popup.close())
	}

	const handleGoogleCode = useCallback(
		async (code: string) => {
			if (isPending) return
			store.dispatch({ kind: 'requestStarted' })
			const signal = store.beginAuthRequest()
			const result = await signInWithGoogleMutation
				.mutateAsync({
					code,
					signal,
					onAuthenticated,
					canAccept: () => dialogStore.getState().open
				})
				.catch((caughtError) => {
					if (!signal.aborted && dialogStore.getState().open)
						store.dispatch({
							error: caughtError instanceof Error ? caughtError.message : 'Could not sign in with Google.',
							method: 'google',
							kind: 'failed'
						})
					return null
				})
			if (!result || signal.aborted || !dialogStore.getState().open) return
			if (result.kind === 'link_verification_required')
				store.dispatch({ challenge: result, kind: 'googleLinkRequired' })
		},
		[dialogStore, isPending, onAuthenticated, signInWithGoogleMutation, store]
	)

	return (
		<>
			{state.pendingGoogleLink ? (
				<button
					type="button"
					className="mb-4 w-full text-center body-sm text-link"
					onClick={() => store.dispatch({ kind: 'resumeGoogleLink' })}
				>
					Continue Google email verification
				</button>
			) : null}
			{isSignup ? (
				<form
					aria-describedby={state.error?.method === 'email' ? errorId : undefined}
					className="flex flex-col gap-4"
					onSubmit={(event) => void handleSignUp(event)}
				>
					<label className="flex flex-col">
						<span className={fieldLabelCls}>Email</span>
						<input
							type="email"
							autoComplete="username"
							disabled={isPending}
							name="email"
							required
							className={inputCls}
						/>
						<FieldError>Enter a valid email address.</FieldError>
					</label>
					<PasswordField
						name="password"
						label="Password"
						error="Password must be at least 8 characters."
						minLength={8}
						disabled={isPending}
						autoComplete="new-password"
					/>
					<label className="flex flex-col">
						<span className={fieldLabelCls}>Confirm password</span>
						<input
							type="password"
							name="passwordConfirm"
							required
							minLength={8}
							disabled={isPending}
							autoComplete="new-password"
							className={inputCls}
							onInput={(event) => event.currentTarget.setCustomValidity('')}
						/>
						<FieldError>Passwords must match and contain at least 8 characters.</FieldError>
					</label>

					<Captcha key={captchaRetry} disabled={isPending} onToken={setTurnstileToken} />

					<label className="flex items-start gap-2">
						<input
							type="checkbox"
							disabled={isPending}
							required
							className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
						/>
						<span className="body-sm text-secondary">
							I agree to the{' '}
							<BasicLink href="/terms" target="_blank" className="text-link underline">
								Terms of Service
							</BasicLink>{' '}
							and{' '}
							<BasicLink href="/privacy-policy" target="_blank" className="text-link underline">
								Privacy Policy
							</BasicLink>
						</span>
					</label>

					<label className="flex items-start gap-2">
						<input
							type="checkbox"
							disabled={isPending}
							name="promotionalEmails"
							className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
							defaultChecked
						/>
						<span className="body-sm text-secondary">
							Receive emails about upcoming DefiLlama products and new releases
						</span>
					</label>

					<Button
						type="submit"
						variant="primary"
						size="md"
						className="w-full"
						disabled={isPending || !turnstileToken}
						pendingLabel={signupMutation.isPending ? 'Creating account…' : null}
					>
						Create account
					</Button>
					{state.error?.method === 'email' ? (
						<div id={errorId}>
							<InlineStatus variant="error">{state.error.message}</InlineStatus>
						</div>
					) : null}
				</form>
			) : (
				<form
					id={formId}
					className="flex flex-col gap-4"
					aria-describedby={state.error?.method === 'email' ? errorId : undefined}
					onSubmit={(event) => void handleSignIn(event)}
				>
					<label className="flex flex-col">
						<span className={`${fieldLabelCls} flex items-center gap-2`}>
							Email
							{lastMethod === 'email' ? <LastUsedChip /> : null}
						</span>
						<input
							type="email"
							autoComplete="username"
							disabled={isPending}
							name="email"
							required
							className={inputCls}
						/>
						<FieldError>Enter a valid email address.</FieldError>
					</label>
					<PasswordField
						name="password"
						label="Password"
						error="Enter your password."
						disabled={isPending}
						autoComplete="current-password"
						action={
							<button
								type="button"
								className="text-link"
								form={formId}
								onClick={(event) =>
									store.dispatch({
										kind: 'navigate',
										screen: 'forgot',
										email: (event.currentTarget.form!.elements.namedItem('email') as HTMLInputElement).value
									})
								}
							>
								Forgot password?
							</button>
						}
					/>

					<Captcha key={captchaRetry} disabled={isPending} onToken={setTurnstileToken} />

					<div>
						<Button
							type="submit"
							variant="primary"
							size="md"
							className="w-full"
							disabled={isPending || !turnstileToken}
							pendingLabel={loginMutation.isPending ? 'Signing in…' : null}
						>
							Sign in
						</Button>
					</div>
					{state.error?.method === 'email' ? (
						<div id={errorId}>
							<InlineStatus variant="error">{state.error.message}</InlineStatus>
						</div>
					) : null}
				</form>
			)}

			<div className="my-5 border-t border-subtle" aria-hidden />

			<div className="flex flex-col gap-3">
				<div>
					<GoogleSignInButton
						loading={signInWithGoogleMutation.isPending}
						disabled={isPending}
						lastUsed={lastMethod === 'google'}
						onStart={() => store.dispatch({ kind: 'requestStarted' })}
						onCode={handleGoogleCode}
					/>

					{/* GoogleSignInButton places its own load failure the same way. */}
					{state.error?.method === 'google' ? (
						<div className="mt-2">
							<InlineStatus variant="error">{state.error.message}</InlineStatus>
						</div>
					) : null}
				</div>
				<div className="flex flex-col gap-2">
					<button
						type="button"
						className={authProviderButtonStyles}
						onClick={() => void handleGithubSignIn()}
						disabled={isPending}
					>
						<span className={authProviderIconSlotStyles}>
							{signInWithGithubMutation.isPending ? (
								<LoadingSpinner size={16} />
							) : (
								<Icon name="github" height={18} width={18} />
							)}
						</span>
						<span className="min-w-0 truncate">
							{signInWithGithubMutation.isPending ? 'Waiting for GitHub…' : 'Continue with GitHub'}
						</span>
						{lastMethod === 'github' ? <LastUsedCorner /> : null}
					</button>

					{state.error?.method === 'github' ? <InlineStatus variant="error">{state.error.message}</InlineStatus> : null}
				</div>

				{!isSignup ? (
					<div>
						<button
							type="button"
							className={authProviderButtonStyles}
							onClick={() => store.dispatch({ kind: 'navigate', screen: 'wallet' })}
						>
							<span className={authProviderIconSlotStyles}>
								<Icon name="wallet" className="size-4" aria-hidden />
							</span>
							<span className="min-w-0 truncate">Sign in with a wallet</span>
							{lastMethod === 'wallet' ? <LastUsedCorner /> : null}
						</button>
					</div>
				) : null}
			</div>
			<p className="mt-5 text-center body-sm text-secondary">
				{isSignup ? 'Already have an account? ' : 'New to DefiLlama? '}
				<button
					type="button"
					className="text-link"
					onClick={() => store.dispatch({ kind: 'navigate', screen: isSignup ? 'signin' : 'signup' })}
				>
					{isSignup ? 'Sign in' : 'Create an account'}
				</button>
			</p>
		</>
	)
}

function ForgotPasswordScreen({
	dialogStore,
	store,
	initialEmail,
	header
}: {
	dialogStore: Ariakit.DialogStore
	store: SignInFlowStore
	initialEmail: string
	header: (title: string) => ReactNode
}) {
	const errorId = useId()
	const [turnstileToken, setTurnstileToken] = useState('')
	const [captchaRetry, setCaptchaRetry] = useState(0)
	const reset = useMutation({
		mutationFn: async ({ email, signal, token }: { email: string; signal: AbortSignal; token: string }) => {
			await requestPasswordReset(email, token, signal)
			return !signal.aborted && dialogStore.getState().open ? email : null
		},
		// A sent token is spent whatever the outcome, so the widget restarts after every attempt.
		onSettled: () => setCaptchaRetry((retry) => retry + 1)
	})
	const handleSubmit = (event: FormSubmitEvent) => {
		event.preventDefault()
		if (reset.isPending || !turnstileToken) return
		const data = new FormData(event.currentTarget)
		store.dispatch({ kind: 'requestStarted' })
		const token = turnstileToken
		setTurnstileToken('')
		reset.mutate({ email: String(data.get('email')), signal: store.beginAuthRequest(), token })
	}

	if (reset.data)
		return (
			<>
				{header('Check your email')}
				<DialogBody>
					<p role="status" className="body-sm text-secondary">
						If an account exists for <span className="text-primary">{reset.data}</span>, we&apos;ve sent a password
						reset link. Use the link to choose a new password, then return here to sign in.
					</p>
					<Button
						type="button"
						variant="primary"
						size="md"
						className="w-full"
						onClick={() => store.dispatch({ kind: 'navigate', screen: 'signin' })}
					>
						Back to sign in
					</Button>
					<button
						type="button"
						className="body-sm text-link"
						onClick={() => {
							reset.reset()
							store.dispatch({ kind: 'navigate', screen: 'forgot', email: '' })
						}}
					>
						Use another email
					</button>
				</DialogBody>
			</>
		)

	return (
		<>
			{header('Reset password')}
			<DialogBody>
				<p className="body-sm text-secondary">Enter your email and we&apos;ll send you a reset link.</p>
				<form
					className="flex flex-col gap-4"
					onSubmit={handleSubmit}
					aria-describedby={reset.error ? errorId : undefined}
				>
					<label className="flex flex-col">
						<span className={fieldLabelCls}>Email</span>
						<input
							type="email"
							name="email"
							autoComplete="email"
							defaultValue={initialEmail}
							required
							disabled={reset.isPending}
							className={inputCls}
						/>
						<FieldError>Enter a valid email address.</FieldError>
					</label>
					<Captcha key={captchaRetry} disabled={reset.isPending} onToken={setTurnstileToken} />
					<Button
						type="submit"
						variant="primary"
						size="md"
						className="w-full"
						disabled={reset.isPending || !turnstileToken}
						pendingLabel={reset.isPending ? 'Sending reset link…' : null}
					>
						Send reset link
					</Button>
					{reset.error ? (
						<div id={errorId}>
							<InlineStatus variant="error">{reset.error.message}</InlineStatus>
						</div>
					) : null}
				</form>
			</DialogBody>
		</>
	)
}
