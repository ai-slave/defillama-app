import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { refreshSession } from '~/auth/authStore'
import { AUTH_SERVER } from '~/constants'
import { Icon } from '~/ui/Icon'
import pb from '~/utils/pocketbase'
import { ResendCooldown, type ResendCooldownHandle } from './ResendCooldown'

interface SwitchToEmailModalProps {
	isOpen: boolean
	onClose: () => void
	defaultEmail?: string
}

type Step = 'email' | 'confirm' | 'success'

interface SwitchToEmailErrorResponse {
	error?: string
	message?: string
}

interface SwitchToEmailResponse {
	token?: string
}

async function requestSwitchToEmailOtp({ email, sessionToken }: { email: string; sessionToken: string }) {
	const response = await fetch(`${AUTH_SERVER}/switch-to-email/request`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${sessionToken}`
		},
		body: JSON.stringify({ email })
	})

	if (!response.ok) {
		const errorData = (await response.json().catch(() => null)) as SwitchToEmailErrorResponse | null
		throw new Error(errorData?.error || errorData?.message || 'Failed to send verification code')
	}
}

async function confirmSwitchToEmail({
	sessionToken,
	...payload
}: {
	sessionToken: string
	email: string
	otp: string
	password: string
	passwordConfirm: string
}): Promise<SwitchToEmailResponse> {
	const response = await fetch(`${AUTH_SERVER}/switch-to-email/confirm`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${sessionToken}`
		},
		body: JSON.stringify(payload)
	})

	if (!response.ok) {
		const errorData = (await response.json().catch(() => null)) as SwitchToEmailErrorResponse | null
		throw new Error(errorData?.error || errorData?.message || 'Failed to switch to email authentication')
	}

	return (await response.json()) as SwitchToEmailResponse
}

export function SwitchToEmailModal({ isOpen, onClose, defaultEmail }: SwitchToEmailModalProps) {
	const [step, setStep] = useState<Step>('email')
	const [email, setEmail] = useState(defaultEmail ?? '')
	const [otp, setOtp] = useState('')
	const [password, setPassword] = useState('')
	const [passwordConfirm, setPasswordConfirm] = useState('')
	const [error, setError] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
	const resendRef = useRef<ResendCooldownHandle>(null)
	// The whole flow is pinned to the session it started in: every request uses the
	// token captured at the first OTP send, and a session change in the meantime
	// discards the result instead of writing into the newer account.
	const sessionTokenRef = useRef('')
	const requestOtpMutation = useMutation({ mutationFn: requestSwitchToEmailOtp })
	const confirmMutation = useMutation({ mutationFn: confirmSwitchToEmail })
	const isLoading = requestOtpMutation.isPending || confirmMutation.isPending

	const resetState = () => {
		sessionTokenRef.current = ''
		setStep('email')
		setEmail(defaultEmail ?? '')
		setOtp('')
		setPassword('')
		setPasswordConfirm('')
		setError('')
		requestOtpMutation.reset()
		confirmMutation.reset()
		setShowPassword(false)
		setShowPasswordConfirm(false)
	}

	const handleClose = () => {
		resetState()
		onClose()
	}

	const handleRequestOtp = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!email || isLoading) return

		setError('')
		sessionTokenRef.current = pb.authStore.token

		try {
			await requestOtpMutation.mutateAsync({ email, sessionToken: sessionTokenRef.current })
			resendRef.current?.start()
			setStep('confirm')
		} catch (err: any) {
			setError(err.message || 'Failed to send verification code. Please try again.')
		}
	}

	const handleConfirm = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!otp || !password || !passwordConfirm || isLoading) return

		if (password !== passwordConfirm) {
			setError('Passwords do not match.')
			return
		}

		if (password.length < 8) {
			setError('Password must be at least 8 characters.')
			return
		}

		setError('')

		const sessionToken = sessionTokenRef.current

		try {
			const data = await confirmMutation.mutateAsync({ sessionToken, email, otp, password, passwordConfirm })

			// The session changed while the confirmation was pending: the switch went
			// through server-side, but this dialog belongs to a session that no longer
			// exists — close quietly instead of overwriting or announcing success.
			if (pb.authStore.token !== sessionToken) {
				handleClose()
				return
			}

			if (data.token) {
				pb.authStore.save(data.token)
			}

			setStep('success')
		} catch (err: any) {
			setError(err.message || 'Failed to switch to email authentication. Please try again.')
		}
	}

	const handleResendOtp = async () => {
		if (isLoading) return

		setError('')

		try {
			await requestOtpMutation.mutateAsync({ email, sessionToken: sessionTokenRef.current })
			resendRef.current?.start()
			toast.success('Verification code resent!')
		} catch (err: any) {
			setError(err.message || 'Failed to resend verification code.')
		}
	}

	const handleSuccessDone = () => {
		handleClose()
		// Refresh auth to pick up the new user state
		refreshSession().catch(() => {})
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && handleClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className="dialog max-h-[90vh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[380px]"
				portal
				unmountOnHide
			>
				{step === 'email' && (
					<div className="flex flex-col gap-5 px-5 py-6">
						<div className="flex items-center justify-between">
							<h3 className="text-xl leading-7 font-semibold text-sub-text-primary">Switch to Email</h3>
							<Ariakit.DialogDismiss className="rounded-full p-1 text-sub-text-primary transition-colors">
								<Icon name="x" height={24} width={24} />
							</Ariakit.DialogDismiss>
						</div>

						<p className="text-sm leading-5 text-sub-text-muted">
							Enter the email address you'd like to use for signing in. We'll send you a verification code.
						</p>

						{/* Form */}
						<form onSubmit={handleRequestOtp} className="flex flex-col gap-5">
							<div className="flex flex-col gap-2">
								<label className="text-sm leading-[21px] text-sub-text-primary">Email</label>
								<input
									type="email"
									required
									value={email}
									onChange={(e) => {
										setEmail(e.target.value)
										if (error) setError('')
									}}
									placeholder="your.email@example.com"
									className={`h-10 w-full rounded-lg border bg-sub-surface-panel px-3 text-sm leading-[21px] text-sub-text-primary outline-hidden dark:bg-sub-dark-page ${
										error
											? 'border-error'
											: 'border-sub-border-muted focus:border-sub-brand-primary dark:border-sub-border-strong dark:focus:border-sub-brand-primary'
									}`}
								/>
								{error && <p className="text-xs leading-4 text-error">{error}</p>}
							</div>

							<button
								type="submit"
								disabled={!email || isLoading}
								className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand disabled:opacity-25"
							>
								{isLoading ? 'Sending...' : 'Send Verification Code'}
							</button>
						</form>
					</div>
				)}

				{step === 'confirm' && (
					<div className="flex flex-col gap-5 px-5 py-6">
						<div className="flex items-center justify-between">
							<h3 className="text-xl leading-7 font-semibold text-sub-text-primary">Verify & Set Password</h3>
							<Ariakit.DialogDismiss className="rounded-full p-1 text-sub-text-primary transition-colors">
								<Icon name="x" height={24} width={24} />
							</Ariakit.DialogDismiss>
						</div>

						<p className="text-sm leading-5 text-sub-text-muted">
							Enter the 6-digit code sent to <span className="font-medium text-sub-text-primary">{email}</span> and
							choose a password.
						</p>

						<form onSubmit={handleConfirm} className="flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<label className="text-sm leading-[21px] text-sub-text-primary">Verification Code</label>
								<input
									type="text"
									inputMode="numeric"
									maxLength={6}
									required
									value={otp}
									onChange={(e) => {
										const val = e.target.value.replace(/\D/g, '')
										setOtp(val)
										if (error) setError('')
									}}
									placeholder="000000"
									className={`h-10 w-full rounded-lg border bg-sub-surface-panel px-3 text-sm leading-[21px] tracking-widest text-sub-text-primary outline-hidden dark:bg-sub-dark-page ${
										error
											? 'border-error'
											: 'border-sub-border-muted focus:border-sub-brand-primary dark:border-sub-border-strong dark:focus:border-sub-brand-primary'
									}`}
								/>
							</div>

							<div className="flex flex-col gap-2">
								<label className="text-sm leading-[21px] text-sub-text-primary">Password</label>
								<div className="relative">
									<input
										type={showPassword ? 'text' : 'password'}
										required
										value={password}
										onChange={(e) => {
											setPassword(e.target.value)
											if (error) setError('')
										}}
										placeholder="At least 8 characters"
										className={`h-10 w-full rounded-lg border bg-sub-surface-panel pr-10 pl-3 text-sm leading-[21px] text-sub-text-primary outline-hidden dark:bg-sub-dark-page ${
											error
												? 'border-error'
												: 'border-sub-border-muted focus:border-sub-brand-primary dark:border-sub-border-strong dark:focus:border-sub-brand-primary'
										}`}
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute top-1/2 right-3 -translate-y-1/2 text-sub-text-muted"
									>
										<Icon name={showPassword ? 'eye-off' : 'eye'} height={16} width={16} />
									</button>
								</div>
							</div>

							{/* Confirm Password */}
							<div className="flex flex-col gap-2">
								<label className="text-sm leading-[21px] text-sub-text-primary">Confirm Password</label>
								<div className="relative">
									<input
										type={showPasswordConfirm ? 'text' : 'password'}
										required
										value={passwordConfirm}
										onChange={(e) => {
											setPasswordConfirm(e.target.value)
											if (error) setError('')
										}}
										placeholder="Re-enter your password"
										className={`h-10 w-full rounded-lg border bg-sub-surface-panel pr-10 pl-3 text-sm leading-[21px] text-sub-text-primary outline-hidden dark:bg-sub-dark-page ${
											error
												? 'border-error'
												: 'border-sub-border-muted focus:border-sub-brand-primary dark:border-sub-border-strong dark:focus:border-sub-brand-primary'
										}`}
									/>
									<button
										type="button"
										onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
										className="absolute top-1/2 right-3 -translate-y-1/2 text-sub-text-muted"
									>
										<Icon name={showPasswordConfirm ? 'eye-off' : 'eye'} height={16} width={16} />
									</button>
								</div>
							</div>

							{error && <p className="text-xs leading-4 text-error">{error}</p>}

							<button
								type="submit"
								disabled={!otp || otp.length !== 6 || !password || !passwordConfirm || isLoading}
								className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand disabled:opacity-25"
							>
								{isLoading ? 'Switching...' : 'Complete Switch'}
							</button>

							<ResendCooldown ref={resendRef} onResend={handleResendOtp} disabled={isLoading} />
						</form>
					</div>
				)}

				{step === 'success' && (
					<div className="flex flex-col items-center gap-6 px-5 py-8">
						<div className="flex size-16 items-center justify-center rounded-full bg-sub-brand-primary/10">
							<Icon name="check" height={32} width={32} className="text-sub-brand-primary" />
						</div>
						<div className="flex flex-col gap-2 text-center">
							<h2 className="text-xl font-semibold text-sub-text-primary">Switch Successful!</h2>
							<p className="text-sm text-sub-text-muted">
								Your account now uses email authentication. You can sign in with{' '}
								<span className="font-medium text-sub-text-primary">{email}</span> and your password going forward.
							</p>
						</div>
						<button
							onClick={handleSuccessDone}
							className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand"
						>
							Done
						</button>
					</div>
				)}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
