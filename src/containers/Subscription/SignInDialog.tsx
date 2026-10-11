import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import {
	type ComponentPropsWithRef,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore
} from 'react'
import { useAuthContext } from '~/auth'
import {
	AuthDialogHeader,
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
import { WELCOME_WEEK_ALLOWANCE } from '~/containers/LlamaAI/freePlanCopy'
import { Turnstile } from '~/containers/Subscription/Turnstile'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Dialog, DialogBody, DialogFooter } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { readExperimentVariant, trackExperimentAction, trackExperimentExposure } from '~/utils/analytics/experiment'
import { emailError } from '~/utils/email'
import type { WalletSignInProps } from './WalletSignIn'

const OFFER_EXPERIMENT_ID = 'llamaai-signin-offer-v1'

const OFFER_LINE = `New here? ${WELCOME_WEEK_ALLOWANCE}`

const quoteQuestion = (question: string) => `“${question.slice(0, 100)}${question.length > 100 ? '…' : ''}”`

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
	question,
	onAuthenticated
}: {
	store: Ariakit.DialogStore
	initialStep?: 'signin' | 'signup'
	suppressVerifyEmailPrompt?: boolean
	prompt?: string
	/** A LlamaAI question waiting for sign-in. The dialog quotes it in place of `prompt`. */
	question?: string
	onAuthenticated?: () => void
}) {
	return (
		<Dialog size="sm" store={store} getPersistentElements={() => document.querySelectorAll('w3m-modal')} unmountOnHide>
			<SignInFlow
				initialStep={initialStep}
				suppressVerifyEmailPrompt={suppressVerifyEmailPrompt}
				prompt={prompt}
				question={question}
				onAuthenticated={onAuthenticated}
			/>
		</Dialog>
	)
}

/** The sign-in screens. Inside a dialog it hides the dialog once signed in and can be closed; on its own (the
    Sheets sign-in page) nothing can close it. */
export function SignInFlow({
	initialStep = 'signin',
	suppressVerifyEmailPrompt,
	prompt,
	question,
	onAuthenticated
}: {
	initialStep?: 'signin' | 'signup'
	suppressVerifyEmailPrompt?: boolean
	prompt?: string
	question?: string
	onAuthenticated?: () => void
}) {
	const [flowStore] = useState(() => createSignInFlowStore(initialStep))
	useEffect(() => flowStore.cancelAuthRequest, [flowStore])
	const state = useSyncExternalStore(flowStore.subscribe, flowStore.getSnapshot, flowStore.getServerSnapshot)
	const { isAuthenticated } = useAuthContext()
	const [offerVariant] = useState(() => (question ? readExperimentVariant(OFFER_EXPERIMENT_ID) : null))
	useEffect(() => {
		if (offerVariant) trackExperimentExposure(OFFER_EXPERIMENT_ID, offerVariant)
	}, [offerVariant])
	const showOffer = offerVariant === 'b'
	const hostDialog = Ariakit.useDialogContext()
	const closeable = hostDialog !== undefined
	// Follows the host dialog's open state. Hiding aborts the request in flight, so a response that lands later (during
	// the fade too) never signs in. Any close with a session from another tab (×, Escape or Continue) finishes it once.
	const dialog = Ariakit.useDialogStore({
		store: hostDialog,
		setOpen: (open) => {
			if (open) return
			flowStore.cancelAuthRequest()
			if (isAuthenticated && !flowStore.getSnapshot().finished) finishAuthentication()
		}
	})
	const finishAuthentication = () => {
		flowStore.dispatch({ kind: 'authenticated' })
		if (offerVariant) trackExperimentAction(OFFER_EXPERIMENT_ID, offerVariant, 'signin-complete')
		onAuthenticated?.()
		dialog.hide()
	}
	const trackSignupClick = offerVariant
		? () => trackExperimentAction(OFFER_EXPERIMENT_ID, offerVariant, 'signup-click')
		: undefined
	const headerPrompt = !question ? (
		prompt
	) : showOffer && (state.kind === 'signin' || state.kind === 'signup') ? (
		<span className="flex flex-col gap-1">
			<span className="body-md text-primary">{OFFER_LINE}</span>
			<span>{quoteQuestion(question)}</span>
		</span>
	) : (
		`Sign in to ask for free: ${quoteQuestion(question)}`
	)

	// Keyed by title, so each step's title takes focus on mount and a step change is announced.
	const header = (title: string) => (
		<AuthDialogHeader
			key={title}
			title={title}
			prompt={headerPrompt}
			closable={closeable}
			onBack={state.kind !== 'signin' ? () => flowStore.dispatch({ kind: 'navigate', screen: 'signin' }) : undefined}
		/>
	)

	// A session this flow never finished came from another tab. The flow says so and finishes the way a sign-in here
	// does.
	if (isAuthenticated && !state.finished)
		return (
			<>
				<AuthDialogHeader key="signed-in" title="You're signed in" closable={closeable} />
				<DialogBody>
					<p className="body-sm text-secondary">You signed in from another tab.</p>
				</DialogBody>
				<DialogFooter>
					<Button variant="primary" size="md" autoFocus onClick={finishAuthentication}>
						Continue
					</Button>
				</DialogFooter>
			</>
		)

	// The reset screen names its own outcome in the header, so it renders the header itself.
	if (state.kind === 'forgot')
		return <ForgotPasswordScreen store={flowStore} initialEmail={state.email} header={header} />

	return (
		<>
			{header(
				state.kind === 'signup'
					? 'Create an account'
					: state.kind === 'googleLink'
						? 'Confirm your email'
						: state.kind === 'wallet'
							? 'Sign in with a wallet'
							: showOffer
								? 'Get your answer free'
								: 'Sign in'
			)}
			<DialogBody>
				{state.kind === 'googleLink' ? (
					<GoogleLinkForm
						challenge={state.challenge}
						error={state.error?.message}
						store={flowStore}
						onVerified={finishAuthentication}
					/>
				) : state.kind === 'wallet' ? (
					<WalletSignIn store={flowStore} onAuthenticated={finishAuthentication} />
				) : (
					<div key={state.kind}>
						<AuthScreen
							suppressVerifyEmailPrompt={suppressVerifyEmailPrompt}
							state={state}
							store={flowStore}
							onAuthenticated={finishAuthentication}
							signupFirst={showOffer}
							onSignupClick={trackSignupClick}
						/>
					</div>
				)}
			</DialogBody>
		</>
	)
}

/** The Turnstile widget and its failure line. Key it by spent token: a submitted attempt mounts a fresh widget.
    Its own Try again mounts a fresh widget inside the same wrapper and moves focus there, since the button is gone.
    The widget draws its own red failure state, so the line under it explains and offers the retry without a second
    error. The submit it gates is out of the tab order meanwhile, so a status region announces the failure. */
const CAPTCHA_FAILURE =
	"The security check couldn't load. A content blocker or VPN can stop it: pause it for this site, then try again."

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
			{/* Mounted throughout, as a live region must be; the visible line below is its copy for sighted readers. */}
			<span role="status" className="sr-only">
				{failed ? CAPTCHA_FAILURE : ''}
			</span>
			{failed ? (
				<div className="flex flex-wrap items-center gap-2">
					<p aria-hidden className="body-sm text-secondary">
						{CAPTCHA_FAILURE}
					</p>
					<Button
						variant="secondary"
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
			) : null}
		</>
	)
}

/** A password Input with a show/hide toggle; Field's control props spread onto it. */
function PasswordInput(props: Omit<ComponentPropsWithRef<'input'>, 'type' | 'className' | 'prefix'>) {
	const [visible, setVisible] = useState(false)
	return (
		<div className="relative flex">
			<Input {...props} type={visible ? 'text' : 'password'} className="w-full pr-10" />
			{/* sm, centred: an md square is as tall as the field and would sit on its border. touch-target keeps
			    its 44px hit area. */}
			<Tooltip
				content={visible ? 'Hide password' : 'Show password'}
				render={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						square
						className="absolute top-1/2 right-2 -translate-y-1/2"
						onClick={() => setVisible((value) => !value)}
						aria-label={visible ? 'Hide password' : 'Show password'}
					/>
				}
			>
				<Icon name={visible ? 'eye-off' : 'eye'} className="size-4" />
			</Tooltip>
		</div>
	)
}

function AuthScreen({
	state,
	store,
	onAuthenticated,
	suppressVerifyEmailPrompt,
	signupFirst = false,
	onSignupClick
}: {
	state: Extract<SignInFlowState, { kind: 'signin' | 'signup' }>
	store: SignInFlowStore
	suppressVerifyEmailPrompt?: boolean
	onAuthenticated: () => void
	signupFirst?: boolean
	onSignupClick?: () => void
}) {
	const { login, signup, signInWithGithub, signInWithGoogle } = useAuthContext()
	const signInWithGithubMutation = useMutation({ mutationFn: signInWithGithub })
	const signInWithGoogleMutation = useMutation({ mutationFn: signInWithGoogle })
	const errorId = useId()
	const termsErrorId = `${useId()}-error`
	const loginMutation = useMutation({ mutationFn: login })
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [passwordConfirm, setPasswordConfirm] = useState('')
	const [acceptedTerms, setAcceptedTerms] = useState(false)
	const [promotionalEmails, setPromotionalEmails] = useState(true)
	const [submitted, setSubmitted] = useState(false)
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

	const emailMessage = emailError(email)
	const passwordMessage = !password
		? isSignup
			? 'Enter a password.'
			: 'Enter your password.'
		: isSignup && password.length < 8
			? 'Enter at least 8 characters.'
			: null
	const confirmMessage = !passwordConfirm
		? 'Enter your password again.'
		: passwordConfirm !== password
			? "The passwords don't match."
			: null
	const termsMessage = acceptedTerms ? null : 'Accept the Terms of Service and Privacy Policy to continue.'
	const termsError = submitted ? termsMessage : null

	const handleSignUp = async (event: FormSubmitEvent) => {
		event.preventDefault()
		if (isPending || !turnstileToken) return
		if (emailMessage || passwordMessage || confirmMessage || termsMessage)
			return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		store.dispatch({ kind: 'requestStarted' })
		const signal = store.beginAuthRequest()
		// Turnstile tokens are single-use; a failed attempt needs a fresh widget.
		const token = turnstileToken
		setTurnstileToken('')
		await signupMutation
			.mutateAsync({
				email: email.trim(),
				password,
				passwordConfirm,
				turnstileToken: token,
				promotionalEmails: promotionalEmails ? 'on' : 'off',
				suppressVerifyEmailPrompt,
				signal,
				onAuthenticated
			})
			.catch((error: Error) => {
				if (!signal.aborted) {
					setCaptchaRetry((retry) => retry + 1)
					store.dispatch({ error: error.message, kind: 'failed' })
				}
				return null
			})
	}

	const handleSignIn = async (event: FormSubmitEvent) => {
		event.preventDefault()
		if (isPending || !turnstileToken) return
		if (emailMessage || passwordMessage) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		store.dispatch({ kind: 'requestStarted' })
		const signal = store.beginAuthRequest()
		const token = turnstileToken
		setTurnstileToken('')
		await loginMutation
			.mutateAsync({
				email: email.trim(),
				password,
				turnstileToken: token,
				signal,
				suppressVerifyEmailPrompt,
				onAuthenticated
			})
			.catch((error: Error) => {
				if (!signal.aborted) {
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
				popup,
				suppressVerifyEmailPrompt,
				onAuthenticated
			})
			.catch(() => {
				if (!signal.aborted)
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
					onAuthenticated
				})
				// Every failure signInWithGoogle throws is worded for readers (src/auth/index.tsx).
				.catch((caughtError: Error) => {
					if (!signal.aborted)
						store.dispatch({
							error: caughtError.message,
							method: 'google',
							kind: 'failed'
						})
					return null
				})
			if (!result || signal.aborted) return
			if (result.kind === 'link_verification_required')
				store.dispatch({ challenge: result, kind: 'googleLinkRequired' })
		},
		[isPending, onAuthenticated, signInWithGoogleMutation, store]
	)

	const signupLayout = signupFirst && !isSignup
	const navigateToSignup = () => {
		onSignupClick?.()
		store.dispatch({ kind: 'navigate', screen: 'signup' })
	}
	const googleSignIn = (
		<div>
			<GoogleSignInButton
				loading={signInWithGoogleMutation.isPending}
				disabled={isPending}
				lastUsed={lastMethod === 'google'}
				onStart={() => {
					onSignupClick?.()
					store.dispatch({ kind: 'requestStarted' })
				}}
				onCode={handleGoogleCode}
			/>

			{/* GoogleSignInButton places its own load failure the same way. */}
			{state.error?.method === 'google' ? (
				<div className="mt-2">
					<InlineStatus variant="error">{state.error.message}</InlineStatus>
				</div>
			) : null}
		</div>
	)

	return (
		<div className="flex flex-col gap-5">
			{state.pendingGoogleLink ? (
				<p className="text-center body-sm">
					<Button variant="link" onClick={() => store.dispatch({ kind: 'resumeGoogleLink' })}>
						Continue Google email verification
					</Button>
				</p>
			) : null}
			{signupLayout ? (
				<>
					<div className="flex flex-col gap-3">
						{googleSignIn}
						<button type="button" className={authProviderButtonStyles} onClick={navigateToSignup} disabled={isPending}>
							Create an account
						</button>
					</div>
					<div className="border-t border-subtle" aria-hidden />
					<p className="label-md text-primary">Already have an account?</p>
				</>
			) : null}
			{isSignup ? (
				<form
					noValidate
					aria-describedby={state.error?.method === 'email' ? errorId : undefined}
					className="flex flex-col gap-4"
					onSubmit={(event) => void handleSignUp(event)}
				>
					<Field label="Email" error={submitted ? emailMessage : null}>
						{(control) => (
							<Input
								{...control}
								type="email"
								autoComplete="username"
								readOnly={isPending}
								name="email"
								required
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								className="w-full"
							/>
						)}
					</Field>
					<Field label="Password" error={submitted ? passwordMessage : null}>
						{(control) => (
							<PasswordInput
								{...control}
								name="password"
								required
								minLength={8}
								readOnly={isPending}
								autoComplete="new-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						)}
					</Field>
					<Field label="Confirm password" error={submitted ? confirmMessage : null}>
						{(control) => (
							<Input
								{...control}
								type="password"
								name="passwordConfirm"
								required
								readOnly={isPending}
								autoComplete="new-password"
								value={passwordConfirm}
								onChange={(event) => setPasswordConfirm(event.target.value)}
								className="w-full"
							/>
						)}
					</Field>

					<Captcha key={captchaRetry} disabled={isPending} onToken={setTurnstileToken} />

					<div data-invalid={termsError ? '' : undefined} className="flex flex-col gap-1">
						<Checkbox
							variant="consent"
							disabled={isPending}
							required
							checked={acceptedTerms}
							onChange={(event) => setAcceptedTerms(event.target.checked)}
							aria-invalid={termsError ? true : undefined}
							aria-describedby={termsError ? termsErrorId : undefined}
						>
							<span>
								I agree to the{' '}
								<BasicLink href="/terms" target="_blank" className="text-link underline">
									Terms of Service
								</BasicLink>{' '}
								and{' '}
								<BasicLink href="/privacy-policy" target="_blank" className="text-link underline">
									Privacy Policy
								</BasicLink>
							</span>
						</Checkbox>
						{termsError ? (
							<p id={termsErrorId} className="body-sm text-error">
								{termsError}
							</p>
						) : null}
					</div>

					<Checkbox
						variant="consent"
						disabled={isPending}
						name="promotionalEmails"
						checked={promotionalEmails}
						onChange={(event) => setPromotionalEmails(event.target.checked)}
					>
						Receive emails about upcoming DefiLlama products and new releases
					</Checkbox>

					<Button
						type="submit"
						variant="primary"
						size="md"
						className="w-full"
						disabled={isPending || !turnstileToken}
						pendingLabel="Creating account…"
						pending={signupMutation.isPending}
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
					noValidate
					className="flex flex-col gap-4"
					aria-describedby={state.error?.method === 'email' ? errorId : undefined}
					onSubmit={(event) => void handleSignIn(event)}
				>
					<Field
						label={
							<span className="flex items-center gap-2">
								Email
								{lastMethod === 'email' ? <LastUsedChip /> : null}
							</span>
						}
						error={submitted ? emailMessage : null}
					>
						{(control) => (
							<Input
								{...control}
								type="email"
								autoComplete="username"
								readOnly={isPending}
								name="email"
								required
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								className="w-full"
							/>
						)}
					</Field>
					<Field
						label="Password"
						error={submitted ? passwordMessage : null}
						action={
							<Button variant="link" onClick={() => store.dispatch({ kind: 'navigate', screen: 'forgot', email })}>
								Forgot password?
							</Button>
						}
					>
						{(control) => (
							<PasswordInput
								{...control}
								name="password"
								required
								readOnly={isPending}
								autoComplete="current-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						)}
					</Field>

					<Captcha key={captchaRetry} disabled={isPending} onToken={setTurnstileToken} />

					<Button
						type="submit"
						variant="primary"
						size="md"
						className="w-full"
						disabled={isPending || !turnstileToken}
						pendingLabel="Signing in…"
						pending={loginMutation.isPending}
					>
						Sign in
					</Button>
					{state.error?.method === 'email' ? (
						<div id={errorId}>
							<InlineStatus variant="error">{state.error.message}</InlineStatus>
						</div>
					) : null}
				</form>
			)}

			<div className="border-t border-subtle" aria-hidden />

			<div className="flex flex-col gap-3">
				{signupLayout ? null : googleSignIn}
				<div className="flex flex-col gap-2">
					<Ariakit.Button
						type="button"
						className={authProviderButtonStyles}
						onClick={() => void handleGithubSignIn()}
						disabled={isPending}
						// Its own request keeps focus on it; another method's request takes it out of the tab order.
						accessibleWhenDisabled={signInWithGithubMutation.isPending}
						aria-busy={signInWithGithubMutation.isPending || undefined}
					>
						<span className={authProviderIconSlotStyles}>
							{signInWithGithubMutation.isPending ? (
								<LoadingSpinner size={16} />
							) : (
								<Icon name="github" className="size-4.5" />
							)}
						</span>
						<span className="min-w-0 truncate">
							{signInWithGithubMutation.isPending ? 'Waiting for GitHub…' : 'Continue with GitHub'}
						</span>
						{lastMethod === 'github' ? <LastUsedCorner /> : null}
					</Ariakit.Button>

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
			{signupLayout ? null : (
				<p className="text-center body-sm text-secondary">
					{isSignup ? 'Already have an account? ' : 'New to DefiLlama? '}
					<Button
						variant="link"
						onClick={isSignup ? () => store.dispatch({ kind: 'navigate', screen: 'signin' }) : navigateToSignup}
					>
						{isSignup ? 'Sign in' : 'Create an account'}
					</Button>
				</p>
			)}
		</div>
	)
}

function ForgotPasswordScreen({
	store,
	initialEmail,
	header
}: {
	store: SignInFlowStore
	initialEmail: string
	header: (title: string) => ReactNode
}) {
	const errorId = useId()
	const [email, setEmail] = useState(initialEmail)
	const [submitted, setSubmitted] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState('')
	const [captchaRetry, setCaptchaRetry] = useState(0)
	const emailMessage = emailError(email)
	const reset = useMutation({
		mutationFn: async ({ address, signal, token }: { address: string; signal: AbortSignal; token: string }) => {
			await requestPasswordReset(address, token, signal)
			return signal.aborted ? null : address
		},
		// A sent token is spent whatever the outcome, so the widget restarts after every attempt.
		onSettled: () => setCaptchaRetry((retry) => retry + 1)
	})
	const handleSubmit = (event: FormSubmitEvent) => {
		event.preventDefault()
		if (reset.isPending || !turnstileToken) return
		if (emailMessage) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		store.dispatch({ kind: 'requestStarted' })
		const token = turnstileToken
		setTurnstileToken('')
		reset.mutate({ address: email.trim(), signal: store.beginAuthRequest(), token })
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
					<p className="text-center body-sm">
						<Button
							variant="link"
							onClick={() => {
								reset.reset()
								setEmail('')
								setSubmitted(false)
								store.dispatch({ kind: 'navigate', screen: 'forgot', email: '' })
							}}
						>
							Use another email
						</Button>
					</p>
				</DialogBody>
			</>
		)

	return (
		<>
			{header('Reset password')}
			<DialogBody>
				<p className="body-sm text-secondary">Enter your email and we&apos;ll send you a reset link.</p>
				<form
					noValidate
					className="flex flex-col gap-4"
					onSubmit={handleSubmit}
					aria-describedby={reset.error ? errorId : undefined}
				>
					<Field label="Email" error={submitted ? emailMessage : null}>
						{(control) => (
							<Input
								{...control}
								type="email"
								name="email"
								autoComplete="email"
								required
								readOnly={reset.isPending}
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								className="w-full"
							/>
						)}
					</Field>
					<Captcha key={captchaRetry} disabled={reset.isPending} onToken={setTurnstileToken} />
					<Button
						type="submit"
						variant="primary"
						size="md"
						className="w-full"
						disabled={reset.isPending || !turnstileToken}
						pendingLabel="Sending reset link…"
						pending={reset.isPending}
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
