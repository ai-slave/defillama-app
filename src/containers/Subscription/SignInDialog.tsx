import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { type ReactNode, useCallback, useEffect, useId, useState, useSyncExternalStore } from 'react'
import { type PromotionalEmailsValue, useAuthContext } from '~/auth'
import {
	AuthDialogHeader,
	authDialogStyles,
	authBodyStyles,
	authInputStyles,
	authPrimaryButtonStyles,
	authProviderButtonStyles,
	authWalletPickerStyles,
	LastUsedChip
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
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import type { WalletSignInProps } from './WalletSignIn'

const inputCls = authInputStyles
const primaryBtnCls = authPrimaryButtonStyles

const WalletSignIn = dynamic<WalletSignInProps>(() => import('./WalletSignIn').then((module) => module.WalletSignIn), {
	ssr: false,
	loading: () => (
		<div
			role="status"
			className={`${authWalletPickerStyles} flex flex-col items-center justify-center gap-3 text-sm text-secondary`}
		>
			<LoadingSpinner size={16} />
			<span>Loading wallets…</span>
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
		<Ariakit.Dialog
			store={store}
			getPersistentElements={() => document.querySelectorAll('w3m-modal')}
			className={authDialogStyles}
			backdrop={<div className="bg-screen-dim" />}
			unmountOnHide
		>
			<SignInFlow
				dialogStore={store}
				initialStep={initialStep}
				suppressVerifyEmailPrompt={suppressVerifyEmailPrompt}
				prompt={prompt}
				onAuthenticated={onAuthenticated}
			/>
		</Ariakit.Dialog>
	)
}

export function SignInFlow({
	dialogStore,
	initialStep = 'signin',
	suppressVerifyEmailPrompt,
	prompt,
	onAuthenticated
}: {
	dialogStore: Ariakit.DialogStore
	initialStep?: 'signin' | 'signup'
	suppressVerifyEmailPrompt?: boolean
	prompt?: string
	onAuthenticated?: () => void
}) {
	const [flowStore] = useState(() => createSignInFlowStore(initialStep))
	useEffect(() => flowStore.cancelAuthRequest, [flowStore])
	const state = useSyncExternalStore(flowStore.subscribe, flowStore.getSnapshot, flowStore.getServerSnapshot)
	const finishAuthentication = useCallback(() => {
		flowStore.dispatch({ kind: 'authenticated' })
		onAuthenticated?.()
		dialogStore.hide()
	}, [dialogStore, flowStore, onAuthenticated])

	return (
		<>
			<AuthDialogHeader
				key={state.kind}
				title={
					state.kind === 'signup'
						? 'Create an account'
						: state.kind === 'forgot'
							? 'Reset password'
							: state.kind === 'googleLink'
								? 'Confirm your email'
								: state.kind === 'wallet'
									? 'Sign in with a wallet'
									: 'Sign in'
				}
				prompt={prompt}
				store={dialogStore}
				showBackLabel={state.kind === 'wallet'}
				onBack={state.kind !== 'signin' ? () => flowStore.dispatch({ kind: 'navigate', screen: 'signin' }) : undefined}
			/>
			<div className={authBodyStyles}>
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
						{state.kind === 'signin' || state.kind === 'signup' ? (
							<AuthScreen
								dialogStore={dialogStore}
								suppressVerifyEmailPrompt={suppressVerifyEmailPrompt}
								state={state}
								store={flowStore}
								onAuthenticated={finishAuthentication}
							/>
						) : (
							<ForgotPasswordScreen dialogStore={dialogStore} store={flowStore} initialEmail={state.email} />
						)}
					</div>
				)}
			</div>
		</>
	)
}

function LastUsedHint({ visible, onPrimary = false }: { visible: boolean; onPrimary?: boolean }) {
	return visible ? (
		<span className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2">
			<LastUsedChip onPrimary={onPrimary} />
		</span>
	) : null
}

function FieldError({ children }: { children: ReactNode }) {
	return <span className="mt-1 hidden text-xs text-error peer-user-invalid:block">{children}</span>
}

function PasswordField({
	name,
	placeholder,
	error,
	minLength,
	disabled,
	autoComplete
}: {
	name: string
	placeholder: string
	error: string
	minLength?: number
	disabled?: boolean
	autoComplete?: string
}) {
	const [visible, setVisible] = useState(false)
	return (
		<div className="relative">
			<label>
				<span className="sr-only">{placeholder}</span>
				<input
					type={visible ? 'text' : 'password'}
					aria-label={placeholder}
					name={name}
					required
					disabled={disabled}
					autoComplete={autoComplete}
					minLength={minLength}
					placeholder={placeholder}
					className={`${inputCls} pr-10`}
				/>
				<FieldError>{error}</FieldError>
			</label>
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
					className="mb-4 w-full text-center text-sm text-link"
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
					<label>
						<span className="sr-only">Email</span>
						<input
							type="email"
							aria-label="Email"
							autoComplete="username"
							disabled={isPending}
							name="email"
							required
							placeholder="Enter your email address"
							className={inputCls}
						/>
						<FieldError>Enter a valid email address.</FieldError>
					</label>
					<PasswordField
						name="password"
						placeholder="Create a password"
						error="Password must be at least 8 characters."
						minLength={8}
						disabled={isPending}
						autoComplete="new-password"
					/>
					<label>
						<span className="sr-only">Confirm password</span>
						<input
							type="password"
							name="passwordConfirm"
							aria-label="Confirm password"
							required
							minLength={8}
							disabled={isPending}
							autoComplete="new-password"
							placeholder="Confirm password"
							className={inputCls}
							onInput={(event) => event.currentTarget.setCustomValidity('')}
						/>
						<FieldError>Passwords must match and contain at least 8 characters.</FieldError>
					</label>

					<div inert={isPending}>
						<Turnstile
							key={captchaRetry}
							onVerify={setTurnstileToken}
							onError={() => setTurnstileToken('')}
							onExpire={() => setTurnstileToken('')}
						/>
					</div>

					<label className="flex items-start gap-2">
						<input
							type="checkbox"
							disabled={isPending}
							required
							className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
						/>
						<span className="text-xs leading-4 text-tertiary">
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
						<span className="text-xs leading-4 text-tertiary">
							Receive emails about upcoming DefiLlama products and new releases
						</span>
					</label>

					<button type="submit" disabled={isPending || !turnstileToken} className={primaryBtnCls}>
						{signupMutation.isPending ? (
							<span className="inline-flex items-center gap-2">
								<span
									aria-hidden
									className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								/>
								Creating account...
							</span>
						) : (
							'Create account'
						)}
					</button>
					{state.error?.method === 'email' ? (
						<p id={errorId} role="alert" className="text-left text-xs text-error">
							{state.error.message}
						</p>
					) : null}
				</form>
			) : (
				<form
					id={formId}
					className="flex flex-col gap-4"
					aria-describedby={state.error?.method === 'email' ? errorId : undefined}
					onSubmit={(event) => void handleSignIn(event)}
				>
					<label>
						<span className="sr-only">Email</span>
						<input
							type="email"
							aria-label="Email"
							autoComplete="username"
							disabled={isPending}
							name="email"
							required
							placeholder="Enter your email address"
							className={inputCls}
						/>
						<FieldError>Enter a valid email address.</FieldError>
					</label>
					<PasswordField
						name="password"
						placeholder="Enter your password"
						error="Enter your password."
						disabled={isPending}
						autoComplete="current-password"
					/>
					<p className="text-right text-sm">
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
					</p>

					<div inert={isPending}>
						<Turnstile
							key={captchaRetry}
							onVerify={setTurnstileToken}
							onError={() => setTurnstileToken('')}
							onExpire={() => setTurnstileToken('')}
						/>
					</div>

					<div>
						<button type="submit" disabled={isPending || !turnstileToken} className={`${primaryBtnCls} relative`}>
							{loginMutation.isPending ? (
								<span className="inline-flex items-center gap-2">
									<span
										aria-hidden
										className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
									/>
									Signing in...
								</span>
							) : (
								'Sign in'
							)}
							<LastUsedHint visible={lastMethod === 'email'} onPrimary />
						</button>
					</div>
					{state.error?.method === 'email' ? (
						<p id={errorId} role="alert" className="text-left text-xs text-error">
							{state.error.message}
						</p>
					) : null}
				</form>
			)}

			<div className="my-5 border-t border-medium" aria-hidden />

			<div className="flex flex-col gap-2">
				<div>
					<GoogleSignInButton
						loading={signInWithGoogleMutation.isPending}
						disabled={isPending}
						lastUsed={lastMethod === 'google'}
						onStart={() => store.dispatch({ kind: 'requestStarted' })}
						onCode={handleGoogleCode}
					/>

					{state.error?.method === 'google' ? (
						<p id={errorId} role="alert" className="mt-2 text-left text-xs text-error">
							{state.error.message}
						</p>
					) : null}
				</div>
				<div>
					<button
						type="button"
						className={`${authProviderButtonStyles} relative ${lastMethod === 'github' ? 'max-[380px]:pr-19' : ''}`}
						onClick={() => void handleGithubSignIn()}
						disabled={isPending}
					>
						{signInWithGithubMutation.isPending ? (
							<span
								aria-hidden
								className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
							/>
						) : (
							<Icon name="github" height={18} width={18} className="shrink-0" />
						)}
						<span>{signInWithGithubMutation.isPending ? 'Waiting for GitHub...' : 'Continue with GitHub'}</span>
						<LastUsedHint visible={lastMethod === 'github'} />
					</button>

					{state.error?.method === 'github' ? (
						<p id={errorId} role="alert" className="mt-2 text-left text-xs text-error">
							{state.error.message}
						</p>
					) : null}
				</div>

				{!isSignup ? (
					<div>
						<button
							type="button"
							className={`${authProviderButtonStyles} relative ${lastMethod === 'wallet' ? 'max-[380px]:pr-19' : ''}`}
							onClick={() => store.dispatch({ kind: 'navigate', screen: 'wallet' })}
						>
							<Icon name="wallet" className="size-4 shrink-0" aria-hidden />
							<span>Sign in with a wallet</span>
							<LastUsedHint visible={lastMethod === 'wallet'} />
						</button>
					</div>
				) : null}
			</div>
			<p className="mt-5 text-center text-sm text-secondary">
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
	initialEmail
}: {
	dialogStore: Ariakit.DialogStore
	store: SignInFlowStore
	initialEmail: string
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

	return (
		<>
			{reset.data ? <h3 className="font-medium text-primary">Check your email</h3> : null}
			{reset.data ? (
				<p role="status" className="mt-2 text-sm text-secondary">
					If an account exists for {reset.data}, we&apos;ve sent a password reset link. Use the link to choose a new
					password, then return here to sign in.
				</p>
			) : (
				<>
					<p className="mb-4 text-sm text-secondary">Enter your email and we&apos;ll send you a reset link.</p>
					<form
						className="flex flex-col gap-4"
						onSubmit={handleSubmit}
						aria-describedby={reset.error ? errorId : undefined}
					>
						<label>
							<span className="sr-only">Email</span>
							<input
								type="email"
								aria-label="Email"
								name="email"
								autoComplete="email"
								defaultValue={initialEmail}
								required
								disabled={reset.isPending}
								placeholder="Enter your email address"
								className={inputCls}
							/>
							<FieldError>Enter a valid email address.</FieldError>
						</label>
						<div inert={reset.isPending}>
							<Turnstile
								key={captchaRetry}
								onVerify={setTurnstileToken}
								onError={() => setTurnstileToken('')}
								onExpire={() => setTurnstileToken('')}
							/>
						</div>
						<button type="submit" disabled={reset.isPending || !turnstileToken} className={primaryBtnCls}>
							{reset.isPending ? (
								<span className="inline-flex items-center gap-2">
									<span
										aria-hidden
										className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
									/>
									Sending reset link...
								</span>
							) : (
								'Send reset link'
							)}
						</button>
						{reset.error ? (
							<p id={errorId} role="alert" className="text-center text-xs text-error">
								{reset.error.message}
							</p>
						) : null}
					</form>
				</>
			)}
			{reset.data ? (
				<button
					type="button"
					className="mt-4 w-full text-center text-sm text-link"
					onClick={() => {
						reset.reset()
						store.dispatch({ kind: 'navigate', screen: 'forgot', email: '' })
					}}
				>
					Use another email
				</button>
			) : null}
		</>
	)
}
