import * as Ariakit from '@ariakit/react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useRouter } from 'next/router'
import { useId, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { Turnstile } from '~/components/Turnstile'
import { type PromotionalEmailsValue, useAuthContext } from '~/containers/Subscription/auth'
import type { FormSubmitEvent } from '~/types/forms'
import { PROMO_EMAILS_TEXT } from './constants'

export const SignInForm = ({
	text: _text,
	showOnlyAuthDialog = false,
	pendingActionMessage,
	defaultFlow = 'signin',
	dialogStore,
	returnUrl
}: {
	text?: string
	showOnlyAuthDialog?: boolean
	pendingActionMessage?: string
	defaultFlow?: 'signin' | 'signup' | 'forgot'
	dialogStore: Ariakit.DialogStore
	returnUrl?: string
}) => {
	const { openConnectModal } = useConnectModal()
	const { address } = useAccount()
	const router = useRouter()
	const idPrefix = useId()
	const signInEmailInputId = `${idPrefix}-signin-email`
	const signInPasswordInputId = `${idPrefix}-signin-password`
	const forgotEmailInputId = `${idPrefix}-forgot-email`
	const signUpEmailInputId = `${idPrefix}-signup-email`
	const signUpPasswordInputId = `${idPrefix}-signup-password`
	const signUpConfirmInputId = `${idPrefix}-signup-confirm`
	const promotionalEmailsCheckboxId = `${idPrefix}-promotional-emails`

	const [selectedTabId, setSelectedTabId] = useState<'signin' | 'signup'>(
		defaultFlow === 'signup' ? 'signup' : 'signin'
	)
	const tabStore = Ariakit.useTabStore({
		selectedId: selectedTabId,
		setSelectedId: (id: 'signin' | 'signup') => setSelectedTabId(id)
	})

	const [flow, setFlow] = useState<'signin' | 'signup' | 'forgot'>(defaultFlow)
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [passwordError, setPasswordError] = useState('')
	const [confirmPasswordError, setConfirmPasswordError] = useState('')
	const [turnstileToken, setTurnstileToken] = useState('')
	const [emailError, setEmailError] = useState('')
	const [promotionalEmails, setPromotionalEmails] = useState<PromotionalEmailsValue>('on')

	const {
		login,
		signup,
		signInWithEthereumMutation,
		signInWithGithubMutation,
		signInWithGoogleMutation,
		resetPasswordMutation,
		loaders
	} = useAuthContext()
	const { signMessageAsync } = useSignMessage()

	const handleEmailSignIn = async (e: FormSubmitEvent) => {
		e.preventDefault()
		try {
			await login(email, password)
			if (returnUrl) {
				void router.push(returnUrl)
			}
			dialogStore.hide()
		} catch (error) {
			console.log('Error signing in:', error)
		}
	}

	const validatePassword = (pass: string) => {
		if (pass.length < 8) {
			setPasswordError('Password must be at least 8 characters long')
			return false
		}
		setPasswordError('')
		return true
	}

	const validateConfirmPassword = (pass: string, confirm: string) => {
		if (pass !== confirm) {
			setConfirmPasswordError('Passwords do not match')
			return false
		}
		setConfirmPasswordError('')
		return true
	}

	const handleEmailSignUp = async (e: FormSubmitEvent) => {
		e.preventDefault()

		setEmailError('')
		setPasswordError('')
		setConfirmPasswordError('')

		const isPasswordValid = validatePassword(password)
		const isConfirmPasswordValid = validateConfirmPassword(password, confirmPassword)

		if (!isPasswordValid || !isConfirmPasswordValid) {
			return
		}

		if (!turnstileToken) {
			return
		}

		try {
			await signup(email, password, confirmPassword, turnstileToken, promotionalEmails)
			setTurnstileToken('')

			if (returnUrl) {
				void router.push(returnUrl)
			}

			dialogStore.hide()
		} catch (error: any) {
			console.log('Error signing up:', error)

			if (typeof error?.error === 'string') {
				setEmailError(`${error.error}. Please reset your password or use another email.`)
				return
			}

			if (error?.error) {
				if (error.error.email?.message) {
					setEmailError(error.error.email.message)
				}
				if (error.error.password?.message) {
					setPasswordError(error.error.password.message)
				}
				if (error.error.passwordConfirm?.message) {
					setConfirmPasswordError(error.error.passwordConfirm.message)
				}
			}
		}
	}

	const handleForgotPassword = async (e: FormSubmitEvent) => {
		e.preventDefault()
		try {
			await resetPasswordMutation.mutateAsync(email)
			setFlow('signin')
		} catch (error) {
			console.log('Error resetting password:', error)
		}
	}

	const handleWalletSignIn = async () => {
		if (address) {
			try {
				await signInWithEthereumMutation.mutateAsync({ address, signMessageFunction: signMessageAsync })
				if (returnUrl) {
					void router.push(returnUrl)
				}
				dialogStore.hide()
			} catch (error) {
				console.log('Error signing in with wallet:', error)
			}
		} else {
			openConnectModal?.()
			setTimeout(() => {
				dialogStore.show()
			}, 100)
		}
	}

	return (
		<Ariakit.TabProvider store={tabStore}>
			<div className="mb-3 flex items-center justify-between sm:mb-5">
				<Ariakit.TabList className="flex items-center gap-4">
					<Ariakit.Tab
						id="signin"
						className={
							selectedTabId === 'signin'
								? 'border-b-2 border-sub-purple bg-linear-to-r from-sub-purple to-sub-purple-soft bg-clip-text text-xl font-bold text-transparent'
								: 'text-xl font-bold text-sub-text-muted'
						}
					>
						Sign In
					</Ariakit.Tab>
					<Ariakit.Tab
						id="signup"
						className={
							selectedTabId === 'signup'
								? 'border-b-2 border-sub-purple bg-linear-to-r from-sub-purple to-sub-purple-soft bg-clip-text text-xl font-bold text-transparent'
								: 'text-xl font-bold text-sub-text-muted'
						}
					>
						Register
					</Ariakit.Tab>
				</Ariakit.TabList>
				{showOnlyAuthDialog ? null : (
					<Ariakit.DialogDismiss className="rounded-full p-1.5 text-sub-text-muted transition-colors hover:bg-sub-line hover:text-on-brand">
						<Icon name="x" height={18} width={18} />
						<span className="sr-only">Close</span>
					</Ariakit.DialogDismiss>
				)}
			</div>

			<Ariakit.TabPanel tabId="signin">
				{flow !== 'forgot' ? (
					<>
						<form className="flex flex-col gap-3 sm:gap-4" onSubmit={(e) => void handleEmailSignIn(e)}>
							<div className="space-y-1">
								<label htmlFor={signInEmailInputId} className="text-xs font-medium text-sub-text-soft sm:text-sm">
									Email
								</label>
								<div className="relative">
									<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sub-text-muted">
										<Icon name="mail" height={16} width={16} />
									</div>
									<input
										id={signInEmailInputId}
										type="email"
										required
										className="w-full rounded-lg border border-sub-line bg-sub-dark-card py-2 pr-2.5 pl-9 text-on-brand transition-all duration-200 placeholder:text-sub-text-muted focus:border-sub-purple focus:ring-1 focus:ring-sub-purple focus:outline-hidden sm:py-2.5"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
									/>
								</div>
							</div>

							<div className="space-y-1">
								<label htmlFor={signInPasswordInputId} className="text-xs font-medium text-sub-text-soft sm:text-sm">
									Password
								</label>
								<div className="relative">
									<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sub-text-muted">
										<Icon name="key" height={16} width={16} />
									</div>
									<input
										id={signInPasswordInputId}
										type="password"
										required
										className="w-full rounded-lg border border-sub-line bg-sub-dark-card py-2 pr-2.5 pl-9 text-on-brand transition-all duration-200 placeholder:text-sub-text-muted focus:border-sub-purple focus:ring-1 focus:ring-sub-purple focus:outline-hidden sm:py-2.5"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
									/>
								</div>
							</div>

							<div className="-mt-1 flex justify-end">
								<button
									type="button"
									className="text-xs text-sub-purple transition-colors hover:text-sub-purple-soft"
									onClick={() => setFlow('forgot')}
								>
									Forgot password?
								</button>
							</div>

							<button
								className="mt-1 w-full rounded-lg bg-linear-to-r from-sub-purple to-sub-purple-soft py-3 font-medium text-on-brand shadow-lg transition-all duration-200 hover:from-sub-purple-hover hover:to-sub-purple hover:shadow-sub-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={loaders.login}
							>
								{loaders.login ? (
									<span className="flex items-center justify-center gap-2">
										<svg
											className="size-5 animate-spin text-on-brand"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
											></circle>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
										Signing In...
									</span>
								) : (
									'Sign In'
								)}
							</button>
						</form>

						<div className="relative my-2 flex items-center sm:my-3">
							<div className="grow border-t border-sub-line"></div>
							<span className="mx-3 shrink text-xs text-sub-text-muted sm:mx-4 sm:text-sm">or</span>
							<div className="grow border-t border-sub-line"></div>
						</div>

						<div className="flex w-full flex-col gap-2 sm:gap-3">
							<button
								className="relative flex w-full items-center justify-center gap-2 rounded-lg border border-sub-line bg-sub-dark-card py-2.5 text-sm font-medium text-on-brand transition-all duration-200 hover:bg-sub-dark-card-raised disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
								onClick={() => void handleWalletSignIn()}
								disabled={signInWithEthereumMutation.isPending}
							>
								<Icon name="wallet" height={16} width={16} />
								{signInWithEthereumMutation.isPending ? 'Connecting...' : 'Sign in with Wallet'}
							</button>

							{signInWithEthereumMutation.error ? (
								<div className="text-center text-xs text-error">
									{signInWithEthereumMutation.error.message || 'Failed to sign in with Ethereum'}
								</div>
							) : null}

							<button
								className="relative flex w-full items-center justify-center gap-2 rounded-lg border border-sub-line bg-sub-dark-card py-2.5 text-sm font-medium text-on-brand transition-all duration-200 hover:bg-sub-dark-card-raised disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
								onClick={() => {
									void signInWithGoogleMutation.mutateAsync().then(() => dialogStore.hide())
								}}
								disabled={signInWithGoogleMutation.isPending}
							>
								<Icon name="google" height={16} width={16} />
								{signInWithGoogleMutation.isPending ? 'Connecting...' : 'Sign in with Google'}
							</button>

							{signInWithGoogleMutation.error ? (
								<div className="text-center text-xs text-error">
									{signInWithGoogleMutation.error.message?.slice(0, 100)}
								</div>
							) : null}

							<button
								className="relative flex w-full items-center justify-center gap-2 rounded-lg border border-sub-line bg-sub-dark-card py-2.5 text-sm font-medium text-on-brand transition-all duration-200 hover:bg-sub-dark-card-raised disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
								onClick={() => {
									void signInWithGithubMutation.mutateAsync().then(() => dialogStore.hide())
								}}
								disabled={signInWithGithubMutation.isPending}
							>
								<Icon name="github" height={16} width={16} />
								{signInWithGithubMutation.isPending ? 'Connecting...' : 'Sign in with GitHub'}
							</button>

							{signInWithGithubMutation.error ? (
								<div className="text-center text-xs text-error">
									{signInWithGithubMutation.error.message?.slice(0, 100)}
								</div>
							) : null}
						</div>

						{pendingActionMessage ? (
							<div className="mt-3 mb-3 rounded-lg border border-sub-purple/30 bg-sub-purple/10 p-2.5 sm:mt-4 sm:mb-4 sm:p-3">
								<p className="text-center text-xs text-sub-text-soft sm:text-sm">{pendingActionMessage}</p>
							</div>
						) : null}
					</>
				) : (
					<form className="flex flex-col gap-4" onSubmit={(e) => void handleForgotPassword(e)}>
						<div className="mb-1">
							<p className="rounded-lg border border-sub-line bg-sub-dark-card p-3 text-xs text-sub-text-soft">
								Enter your email address and we'll send you a link to reset your password.
							</p>
						</div>

						<div className="space-y-1.5">
							<label htmlFor={forgotEmailInputId} className="text-sm font-medium text-sub-text-soft">
								Email
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sub-text-muted">
									<Icon name="mail" height={16} width={16} />
								</div>
								<input
									id={forgotEmailInputId}
									type="email"
									required
									className="w-full rounded-lg border border-sub-line bg-sub-dark-card p-3 pl-10 text-on-brand transition-all duration-200 placeholder:text-sub-text-muted focus:border-sub-purple focus:ring-1 focus:ring-sub-purple focus:outline-hidden"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
						</div>

						<button
							className="mt-1 w-full rounded-lg bg-linear-to-r from-sub-purple to-sub-purple-soft py-3 font-medium text-on-brand shadow-lg transition-all duration-200 hover:from-sub-purple-hover hover:to-sub-purple hover:shadow-sub-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={resetPasswordMutation.isPending}
						>
							{resetPasswordMutation.isPending ? (
								<span className="flex items-center justify-center gap-2">
									<svg
										className="size-5 animate-spin text-on-brand"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										></circle>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									Sending...
								</span>
							) : (
								'Reset Password'
							)}
						</button>

						{resetPasswordMutation.error ? (
							<div className="text-center text-xs text-error">{resetPasswordMutation.error.message?.slice(0, 100)}</div>
						) : null}

						<button
							type="button"
							className="mt-1 text-center text-xs font-medium text-sub-purple transition-colors hover:text-sub-purple-soft"
							onClick={() => setFlow('signin')}
						>
							Back to sign in
						</button>
					</form>
				)}
			</Ariakit.TabPanel>
			<Ariakit.TabPanel tabId="signup">
				<form className="flex flex-col gap-4" onSubmit={(e) => void handleEmailSignUp(e)}>
					<div className="space-y-1.5">
						<label htmlFor={signUpEmailInputId} className="text-sm font-medium text-sub-text-soft">
							Email
						</label>
						<div className="relative">
							<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sub-text-muted">
								<Icon name="mail" height={16} width={16} />
							</div>
							<input
								id={signUpEmailInputId}
								type="email"
								required
								className={`w-full rounded-lg border bg-sub-dark-card p-3 pl-10 ${
									emailError ? 'border-error' : 'border-sub-line'
								} text-on-brand transition-all duration-200 placeholder:text-sub-text-muted focus:border-sub-purple focus:ring-1 focus:ring-sub-purple focus:outline-hidden`}
								value={email}
								onChange={(e) => {
									setEmail(e.target.value)
									setEmailError('')
								}}
							/>
						</div>
						{emailError ? <p className="mt-1 text-xs text-error">{emailError}</p> : null}
					</div>

					<div className="space-y-1.5">
						<label htmlFor={signUpPasswordInputId} className="text-sm font-medium text-sub-text-soft">
							Password
						</label>
						<div className="relative">
							<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sub-text-muted">
								<Icon name="key" height={16} width={16} />
							</div>
							<input
								id={signUpPasswordInputId}
								type="password"
								required
								className={`w-full rounded-lg border bg-sub-dark-card p-3 pl-10 ${
									passwordError ? 'border-error' : 'border-sub-line'
								} text-on-brand transition-all duration-200 placeholder:text-sub-text-muted focus:border-sub-purple focus:ring-1 focus:ring-sub-purple focus:outline-hidden`}
								value={password}
								onChange={(e) => {
									setPassword(e.target.value)
									// Only validate locally on change, don't clear server errors
									const localValidation = validatePassword(e.target.value)
									if (localValidation) {
										setPasswordError('')
									}
									if (confirmPassword) {
										validateConfirmPassword(e.target.value, confirmPassword)
									}
								}}
							/>
						</div>
						{passwordError ? <p className="mt-1 text-xs text-error">{passwordError}</p> : null}
					</div>

					<div className="space-y-1.5">
						<label htmlFor={signUpConfirmInputId} className="text-sm font-medium text-sub-text-soft">
							Confirm Password
						</label>
						<div className="relative">
							<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sub-text-muted">
								<Icon name="key" height={16} width={16} />
							</div>
							<input
								id={signUpConfirmInputId}
								type="password"
								required
								className={`w-full rounded-lg border bg-sub-dark-card p-3 pl-10 ${
									confirmPasswordError ? 'border-error' : 'border-sub-line'
								} text-on-brand transition-all duration-200 placeholder:text-sub-text-muted focus:border-sub-purple focus:ring-1 focus:ring-sub-purple focus:outline-hidden`}
								value={confirmPassword}
								onChange={(e) => {
									setConfirmPassword(e.target.value)
									validateConfirmPassword(password, e.target.value)
								}}
							/>
						</div>
						{confirmPasswordError ? <p className="mt-1 text-xs text-error">{confirmPasswordError}</p> : null}
					</div>

					<label className="flex items-center gap-2">
						<input type="checkbox" className="size-4" required />
						<span className="text-sm text-sub-text-soft">
							I agree to the{' '}
							<BasicLink
								href="/terms"
								target="_blank"
								className="font-medium text-sub-purple transition-colors hover:text-sub-purple-soft"
							>
								Terms of Service
							</BasicLink>{' '}
							and{' '}
							<BasicLink
								href="/privacy-policy"
								target="_blank"
								className="font-medium text-sub-purple transition-colors hover:text-sub-purple-soft"
							>
								Privacy Policy
							</BasicLink>
						</span>
					</label>

					<div className="flex items-start gap-2">
						<input
							id={promotionalEmailsCheckboxId}
							type="checkbox"
							className="mt-0.5 size-4 shrink-0"
							checked={promotionalEmails !== 'off'}
							onChange={(e) => setPromotionalEmails(e.target.checked ? 'on' : 'off')}
						/>
						<label htmlFor={promotionalEmailsCheckboxId} className="text-sm text-sub-text-soft">
							{PROMO_EMAILS_TEXT}
						</label>
					</div>

					<div className="mt-4">
						<Turnstile
							onVerify={(token) => setTurnstileToken(token)}
							onError={() => {
								setTurnstileToken('')
								console.log('Turnstile verification failed')
							}}
							onExpire={() => setTurnstileToken('')}
							className="flex justify-center"
						/>
					</div>

					<button
						className="mt-4 w-full rounded-lg bg-linear-to-r from-sub-purple to-sub-purple-soft py-3 font-medium text-on-brand shadow-lg transition-all duration-200 hover:from-sub-purple-hover hover:to-sub-purple hover:shadow-sub-purple/20 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={loaders.signup || !turnstileToken}
					>
						{loaders.signup ? (
							<span className="flex items-center justify-center gap-2">
								<svg
									className="size-5 animate-spin text-on-brand"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								Creating Account...
							</span>
						) : (
							'Create Account'
						)}
					</button>
				</form>
			</Ariakit.TabPanel>
		</Ariakit.TabProvider>
	)
}
