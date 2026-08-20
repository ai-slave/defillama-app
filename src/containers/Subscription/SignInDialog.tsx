import * as Ariakit from '@ariakit/react'
import dynamic from 'next/dynamic'
import { type ReactNode, useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { type PromotionalEmailsValue, useAuthContext } from '~/auth'
import { GoogleLinkForm } from '~/auth/GoogleLinkForm'
import { GoogleSignInButton } from '~/auth/GoogleSignInButton'
import { createSignInFlowStore, type SignInFlowState, type SignInFlowStore } from '~/auth/signInFlowStore'
import { BasicLink } from '~/components/Link'
import { Turnstile } from '~/containers/Subscription/Turnstile'
import type { FormSubmitEvent } from '~/types/forms'
import { Icon } from '~/ui/Icon'
import type { WalletSignInButtonProps } from './WalletSignInButton'

const inputCls =
	'peer h-10 w-full rounded-lg border border-medium bg-signin-input-bg px-3 text-sm text-primary placeholder:text-tertiary focus:border-brand focus:outline-hidden user-invalid:border-error user-invalid:focus:border-error'
const primaryBtnCls =
	'h-10 w-full rounded-lg bg-brand text-sm font-medium text-on-brand disabled:bg-signin-btn-disabled-bg disabled:text-signin-btn-disabled-text'

const WalletSignInButton = dynamic<WalletSignInButtonProps>(
	() => import('./WalletSignInButton').then((module) => module.WalletSignInButton),
	{
		ssr: false,
		loading: () => (
			<button type="button" className="text-link" disabled>
				Loading wallet...
			</button>
		)
	}
)

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
			className="dialog top-1/2 right-auto bottom-auto left-1/2 m-0 max-h-[90dvh] min-h-0 w-[calc(100vw-32px)] max-w-[331px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-signin-bg px-5 pt-6 pb-5 shadow-2xl max-sm:max-h-[calc(100dvh-48px)] max-sm:rounded-[20px] max-sm:px-4 max-sm:pt-5 max-sm:pb-6"
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
	const state = useSyncExternalStore(flowStore.subscribe, flowStore.getSnapshot, flowStore.getServerSnapshot)
	const finishAuthentication = useCallback(() => {
		flowStore.dispatch({ kind: 'authenticated' })
		onAuthenticated?.()
		dialogStore.hide()
	}, [dialogStore, flowStore, onAuthenticated])

	return (
		<>
			<DialogHeader prompt={prompt} />
			{state.kind === 'googleLink' ? (
				<>
					<h2 className="mb-2 text-xl font-semibold text-primary">Confirm your email</h2>
					<GoogleLinkForm
						challenge={state.challenge}
						error={state.error}
						store={flowStore}
						onVerified={finishAuthentication}
					/>
				</>
			) : (
				<div key={state.kind}>
					{state.kind !== 'forgot' ? <AuthTabs state={state} store={flowStore} /> : null}
					{state.kind === 'signin' || state.kind === 'wallet' ? (
						<SignInScreen
							dialogStore={dialogStore}
							state={state}
							store={flowStore}
							onAuthenticated={finishAuthentication}
						/>
					) : state.kind === 'signup' ? (
						<SignUpScreen
							state={state}
							store={flowStore}
							suppressVerifyEmailPrompt={suppressVerifyEmailPrompt}
							onAuthenticated={finishAuthentication}
						/>
					) : (
						<ForgotPasswordScreen state={state} store={flowStore} />
					)}
				</div>
			)}
		</>
	)
}

function DialogHeader({ prompt }: { prompt?: string }) {
	return (
		<div className="mb-5">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<img src="/assets/logo_white.webp" alt="" className="size-7" />
					<span className="text-sm font-semibold text-primary">DefiLlama</span>
				</div>
				<Ariakit.DialogDismiss className="rounded-full p-1 text-tertiary transition-colors hover:text-primary">
					<Icon name="x" height={20} width={20} />
					<span className="sr-only">Close</span>
				</Ariakit.DialogDismiss>
			</div>
			{prompt ? <p className="mt-2.5 text-sm text-secondary">{prompt}</p> : null}
		</div>
	)
}

function AuthTabs({ state, store }: { state: SignInFlowState; store: SignInFlowStore }) {
	const signInSelected = state.kind === 'signin' || state.kind === 'wallet'
	return (
		<div className="mb-6 flex gap-1 rounded-lg bg-signin-tab-bg p-1">
			<button
				type="button"
				className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${signInSelected ? 'bg-signin-bg text-primary shadow-sm' : 'text-tertiary hover:text-primary'}`}
				onClick={() => store.dispatch({ kind: 'navigate', screen: 'signin' })}
			>
				Sign In
			</button>
			<button
				type="button"
				className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${state.kind === 'signup' ? 'bg-signin-bg text-primary shadow-sm' : 'text-tertiary hover:text-primary'}`}
				onClick={() => store.dispatch({ kind: 'navigate', screen: 'signup' })}
			>
				Sign Up
			</button>
		</div>
	)
}

function FieldError({ children }: { children: ReactNode }) {
	return <span className="mt-1 hidden text-xs text-error peer-user-invalid:block">{children}</span>
}

function PasswordField({
	name,
	placeholder,
	error,
	minLength
}: {
	name: string
	placeholder: string
	error: string
	minLength?: number
}) {
	const [visible, setVisible] = useState(false)
	return (
		<div className="relative">
			<label>
				<span className="sr-only">{placeholder}</span>
				<input
					type={visible ? 'text' : 'password'}
					name={name}
					required
					minLength={minLength}
					placeholder={placeholder}
					className={`${inputCls} pr-10`}
				/>
				<FieldError>{error}</FieldError>
			</label>
			<button
				type="button"
				className="absolute top-5 right-3 -translate-y-1/2 text-tertiary hover:text-primary"
				onClick={() => setVisible((value) => !value)}
				aria-label={visible ? 'Hide password' : 'Show password'}
			>
				<Icon name={visible ? 'eye-off' : 'eye'} height={16} width={16} />
			</button>
		</div>
	)
}

function SignInScreen({
	dialogStore,
	state,
	store,
	onAuthenticated
}: {
	dialogStore: Ariakit.DialogStore
	state: Exclude<SignInFlowState, { kind: 'googleLink' }>
	store: SignInFlowStore
	onAuthenticated: () => void
}) {
	const { login, signInWithGithubMutation, signInWithGoogleMutation, loaders } = useAuthContext()

	const handleSignIn = async (event: FormSubmitEvent) => {
		event.preventDefault()
		const data = new FormData(event.currentTarget)
		store.dispatch({ kind: 'requestStarted' })
		try {
			await login(String(data.get('email')), String(data.get('password')))
			onAuthenticated()
		} catch {
			store.dispatch({ error: 'Invalid email or password', kind: 'failed' })
		}
	}

	const handleGithubSignIn = async () => {
		store.dispatch({ kind: 'requestStarted' })
		try {
			await signInWithGithubMutation.mutateAsync()
			onAuthenticated()
		} catch (caughtError) {
			store.dispatch({
				error: caughtError instanceof Error ? caughtError.message : 'Failed to sign in with GitHub',
				kind: 'failed'
			})
		}
	}

	const handleGoogleCredential = useCallback(
		async (identityToken: string) => {
			store.dispatch({ kind: 'requestStarted' })
			try {
				const result = await signInWithGoogleMutation.mutateAsync(identityToken)
				if (result.kind === 'link_verification_required') {
					store.dispatch({ challenge: result, kind: 'googleLinkRequired' })
					return
				}
				onAuthenticated()
			} catch (caughtError) {
				store.dispatch({
					error: caughtError instanceof Error ? caughtError.message : 'Failed to sign in with Google',
					kind: 'failed'
				})
			}
		},
		[onAuthenticated, signInWithGoogleMutation, store]
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
			<form className="flex flex-col gap-4" onSubmit={(event) => void handleSignIn(event)}>
				<label>
					<span className="sr-only">Email</span>
					<input
						type="email"
						name="email"
						required
						placeholder="Enter your email address"
						className={inputCls}
						autoFocus
					/>
					<FieldError>Enter a valid email address.</FieldError>
				</label>
				<PasswordField name="password" placeholder="Enter your password" error="Enter your password." />
				<button type="submit" disabled={loaders.login} className={primaryBtnCls}>
					{loaders.login ? 'Signing in...' : 'Sign In'}
				</button>
				{state.error ? <p className="text-center text-xs text-error">{state.error}</p> : null}
			</form>

			<p className="mt-4 text-center text-sm text-primary">
				Forgot your password?{' '}
				<button
					type="button"
					className="text-link"
					onClick={() => store.dispatch({ kind: 'navigate', screen: 'forgot' })}
				>
					Reset password
				</button>
			</p>

			<div className="my-6 flex items-center gap-5">
				<div className="h-px flex-1 bg-signin-divider" />
				<span className="text-sm text-tertiary">Or</span>
				<div className="h-px flex-1 bg-signin-divider" />
			</div>

			<div className="flex flex-col gap-2">
				<GoogleSignInButton loading={signInWithGoogleMutation.isPending} onCredential={handleGoogleCredential} />
				<button
					type="button"
					className="grid h-10 w-full grid-cols-[40px_1fr_12px] items-center rounded-sm border border-medium text-sm font-normal text-primary transition-colors hover:bg-signin-outline-hover-bg"
					onClick={() => void handleGithubSignIn()}
					disabled={signInWithGithubMutation.isPending}
				>
					<Icon name="github" height={18} width={18} className="justify-self-center" />
					<span>{signInWithGithubMutation.isPending ? 'Connecting...' : 'Continue with GitHub'}</span>
					<span aria-hidden />
				</button>
			</div>

			<p className="mt-6 text-center text-xs text-primary">
				Registered with a wallet before?{' '}
				{state.kind === 'wallet' ? (
					<WalletSignInButton
						dialogStore={dialogStore}
						setError={(error) => store.dispatch({ error, kind: 'failed' })}
						autoStart
						onAuthenticated={onAuthenticated}
					/>
				) : (
					<button
						type="button"
						className="text-link"
						onClick={() => store.dispatch({ kind: 'navigate', screen: 'wallet' })}
					>
						Sign-in here
					</button>
				)}
			</p>
		</>
	)
}

function SignUpScreen({
	state,
	store,
	suppressVerifyEmailPrompt,
	onAuthenticated
}: {
	state: Exclude<SignInFlowState, { kind: 'googleLink' }>
	store: SignInFlowStore
	suppressVerifyEmailPrompt?: boolean
	onAuthenticated: () => void
}) {
	const turnstileToken = useRef('')
	const { signup, loaders } = useAuthContext()

	const handleSignUp = async (event: FormSubmitEvent) => {
		event.preventDefault()
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
		if (!turnstileToken.current) {
			store.dispatch({ error: 'Complete the CAPTCHA verification.', kind: 'failed' })
			return
		}
		const promotionalEmails: PromotionalEmailsValue = data.has('promotionalEmails') ? 'on' : 'off'
		try {
			await signup(
				String(data.get('email')),
				password,
				passwordConfirm,
				turnstileToken.current,
				promotionalEmails,
				undefined,
				{ suppressVerifyEmailPrompt }
			)
			onAuthenticated()
		} catch (caughtError: any) {
			const messages = [
				caughtError?.error?.email?.message,
				caughtError?.error?.password?.message,
				caughtError?.error?.passwordConfirm?.message
			].filter(Boolean)
			store.dispatch({
				error:
					typeof caughtError?.error === 'string'
						? caughtError.error
						: messages.length > 0
							? messages.join('. ')
							: 'Failed to create account',
				kind: 'failed'
			})
		}
	}

	return (
		<>
			<p className="mb-4 text-sm leading-5 text-tertiary">
				Create an account with a password (must have at least 8 characters):
			</p>
			<form className="flex flex-col gap-4" onSubmit={(event) => void handleSignUp(event)}>
				<label>
					<span className="sr-only">Email</span>
					<input
						type="email"
						name="email"
						required
						placeholder="Enter your email address"
						className={inputCls}
						autoFocus
					/>
					<FieldError>Enter a valid email address.</FieldError>
				</label>
				<PasswordField
					name="password"
					placeholder="Create a password"
					error="Password must be at least 8 characters."
					minLength={8}
				/>
				<label>
					<span className="sr-only">Confirm password</span>
					<input
						type="password"
						name="passwordConfirm"
						required
						minLength={8}
						placeholder="Confirm password"
						className={inputCls}
						onInput={(event) => event.currentTarget.setCustomValidity('')}
					/>
					<FieldError>Passwords must match and contain at least 8 characters.</FieldError>
				</label>

				<Turnstile
					onVerify={(token) => {
						turnstileToken.current = token
					}}
					onError={() => {
						turnstileToken.current = ''
					}}
					onExpire={() => {
						turnstileToken.current = ''
					}}
					className="flex justify-center"
				/>

				<label className="flex items-start gap-2">
					<input type="checkbox" required className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand" />
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
						name="promotionalEmails"
						className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
						defaultChecked
					/>
					<span className="text-xs leading-4 text-tertiary">
						Receive emails about upcoming DefiLlama products and new releases
					</span>
				</label>

				<button type="submit" disabled={loaders.signup} className={primaryBtnCls}>
					{loaders.signup ? 'Creating account...' : 'Create Account'}
				</button>
				{state.error ? <p className="text-center text-xs text-error">{state.error}</p> : null}
			</form>
		</>
	)
}

function ForgotPasswordScreen({
	state,
	store
}: {
	state: Exclude<SignInFlowState, { kind: 'googleLink' }>
	store: SignInFlowStore
}) {
	const { resetPasswordMutation } = useAuthContext()
	const handleSubmit = async (event: FormSubmitEvent) => {
		event.preventDefault()
		const data = new FormData(event.currentTarget)
		store.dispatch({ kind: 'requestStarted' })
		try {
			await resetPasswordMutation.mutateAsync(String(data.get('email')))
			store.dispatch({ kind: 'navigate', screen: 'signin' })
		} catch {
			store.dispatch({ error: 'Failed to send reset email', kind: 'failed' })
		}
	}

	return (
		<>
			<h2 className="text-xl font-semibold text-primary">Reset Password</h2>
			<p className="mt-1 mb-6 text-sm text-tertiary">Enter your email and we&apos;ll send you a reset link.</p>
			<form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
				<label>
					<span className="sr-only">Email</span>
					<input
						type="email"
						name="email"
						required
						placeholder="Enter your email address"
						className={inputCls}
						autoFocus
					/>
					<FieldError>Enter a valid email address.</FieldError>
				</label>
				<button type="submit" disabled={resetPasswordMutation.isPending} className={primaryBtnCls}>
					{resetPasswordMutation.isPending ? 'Sending...' : 'Send Reset Link'}
				</button>
				{state.error ? <p className="text-center text-xs text-error">{state.error}</p> : null}
			</form>
			<button
				type="button"
				className="mt-6 w-full text-center text-sm text-link"
				onClick={() => store.dispatch({ kind: 'navigate', screen: 'signin' })}
			>
				Back to sign in
			</button>
		</>
	)
}
