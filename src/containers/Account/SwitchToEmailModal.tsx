import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { refreshSession } from '~/auth/authStore'
import { AUTH_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import {
	Dialog,
	DialogBody,
	DialogCancelButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	useOpeningKey
} from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import pb from '~/utils/pocketbase'
import { ResendCooldown } from './ResendCooldown'

interface SwitchToEmailModalProps {
	isOpen: boolean
	onClose: () => void
	defaultEmail?: string
}

type Step = 'email' | 'confirm' | 'success'

// A code or password error names its field and shows under it; any other request failure belongs to the whole form.
interface FormError {
	field: 'form' | 'otp' | 'password' | 'passwordConfirm'
	message: string
}

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
		throw new Error(errorData?.error || errorData?.message || 'Failed to add email sign-in')
	}

	return (await response.json()) as SwitchToEmailResponse
}

// Each opening starts fresh, and a closing dialog keeps its last step through the fade-out.
export function SwitchToEmailModal(props: SwitchToEmailModalProps) {
	return <SwitchToEmailDialog key={useOpeningKey(props.isOpen)} {...props} />
}

function SwitchToEmailDialog({ isOpen, onClose, defaultEmail }: SwitchToEmailModalProps) {
	const fieldId = useId()
	const [step, setStep] = useState<Step>('email')
	const [email, setEmail] = useState(defaultEmail ?? '')
	const [otp, setOtp] = useState('')
	const [password, setPassword] = useState('')
	const [passwordConfirm, setPasswordConfirm] = useState('')
	// A failed request's error stays while its retry runs; a sent code or an edit to a field clears it.
	const [error, setError] = useState<FormError | null>(null)
	const [showPassword, setShowPassword] = useState(false)
	const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
	// When the last code went out; the resend countdown runs from it.
	const [codeSentAt, setCodeSentAt] = useState<number | null>(null)
	// The whole flow is pinned to the account it started in: every request uses the token captured at the first code
	// send, and an account change in the meantime discards the result instead of writing into the newer account. A
	// refresh of the same account's token is not a change.
	const [flowSession, setFlowSession] = useState({ token: '', accountId: '' })
	const requestOtpMutation = useMutation({
		mutationFn: requestSwitchToEmailOtp,
		onSuccess: () => {
			setCodeSentAt(Math.floor(Date.now() / 1000))
			setError(null)
		},
		onError: (requestError) =>
			setError({ field: 'form', message: requestError.message || 'Failed to send verification code. Try again.' })
	})
	const confirmMutation = useMutation({
		mutationFn: confirmSwitchToEmail,
		onSuccess: (data) => {
			// The account changed while the confirmation was pending: the switch went through server-side, but this
			// dialog belongs to an account that is no longer signed in, so it closes instead of announcing success.
			if (pb.authStore.record?.id !== flowSession.accountId) {
				onClose()
				return
			}
			// Keep the record with the new token: a token alone reads as signed out until the refresh lands, which
			// swaps the account page for its loader and unmounts this dialog before its success step.
			if (data.token) pb.authStore.save(data.token, pb.authStore.record)
			setStep('success')
		},
		onError: (confirmError) => {
			const message = confirmError.message || 'Failed to add email sign-in. Try again.'
			// The server names the code "OTP" in each of its code rejections: missing, malformed, invalid or expired.
			setError({ field: /\bOTP\b/.test(message) ? 'otp' : 'form', message })
		}
	})
	// Neither request can be cancelled, so the dialog stays open until it settles; a late result
	// therefore always lands in the opening that started it.
	const isLoading = requestOtpMutation.isPending || confirmMutation.isPending
	const confirmIncomplete = otp.length !== 6 || !password || !passwordConfirm

	const handleRequestOtp = (e: React.FormEvent) => {
		e.preventDefault()
		const session = { token: pb.authStore.token, accountId: pb.authStore.record?.id ?? '' }
		setFlowSession(session)
		requestOtpMutation.mutate({ email, sessionToken: session.token }, { onSuccess: () => setStep('confirm') })
	}

	const handleConfirm = (e: React.FormEvent) => {
		e.preventDefault()
		if (password !== passwordConfirm) {
			setError({ field: 'passwordConfirm', message: 'Passwords do not match.' })
			return
		}
		if (password.length < 8) {
			setError({ field: 'password', message: 'Password must be at least 8 characters.' })
			return
		}
		confirmMutation.mutate({ sessionToken: flowSession.token, email, otp, password, passwordConfirm })
	}

	const handleResendOtp = () => {
		requestOtpMutation.mutate({ email, sessionToken: flowSession.token })
	}

	const handleSuccessDone = () => {
		onClose()
		// Refresh auth to pick up the new user state
		refreshSession().catch(() => {})
	}

	const clearError = () => {
		if (error) setError(null)
	}

	return (
		<Dialog
			size="sm"
			open={isOpen}
			// Leaving the success step by any route still picks up the new sign-in method.
			onClose={step === 'success' ? handleSuccessDone : onClose}
			pending={isLoading}
			portal
			unmountOnHide
		>
			<DialogDiscardGuard
				when={step === 'confirm' && Boolean(otp || password || passwordConfirm)}
				title="Discard email sign-in?"
				description="The code and password you entered are lost, and starting again sends a new code."
			/>
			{step === 'email' && (
				<form onSubmit={handleRequestOtp} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title="Add email sign-in" />
					<DialogBody>
						<p className="body-sm text-secondary">
							Enter the email address you'd like to use for signing in. We'll send you a verification code.
						</p>

						<div className="flex flex-col gap-1.5">
							<label htmlFor={`${fieldId}-email`} className="label-sm text-secondary">
								Email
							</label>
							{/* Ariakit's autoFocus, so the step opens on the field instead of the header ×. */}
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										type="email"
										id={`${fieldId}-email`}
										required
										readOnly={isLoading}
										value={email}
										aria-invalid={error ? true : undefined}
										aria-describedby={error ? `${fieldId}-email-error` : undefined}
										onChange={(e) => {
											setEmail(e.target.value)
											clearError()
										}}
										placeholder="your.email@example.com"
										className="w-full"
									/>
								}
							/>
						</div>

						{error ? (
							<div id={`${fieldId}-email-error`}>
								<InlineStatus variant="error">{error.message}</InlineStatus>
							</div>
						) : null}
					</DialogBody>
					<DialogFooter
						leading={!email ? <p className="body-sm text-tertiary">Enter an email address</p> : null}
						dismiss={<DialogCancelButton />}
					>
						<Button
							type="submit"
							variant="primary"
							size="md"
							disabled={!email}
							pendingLabel={requestOtpMutation.isPending ? 'Sending…' : null}
						>
							Send verification code
						</Button>
					</DialogFooter>
				</form>
			)}

			{step === 'confirm' && (
				<form onSubmit={handleConfirm} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title="Verify & set password" />
					<DialogBody>
						<p className="body-sm text-secondary">
							Enter the 6-digit code sent to <span className="font-medium text-primary">{email}</span> and choose a
							password.
						</p>

						<div className="flex flex-col gap-1.5">
							<label htmlFor={`${fieldId}-otp`} className="label-sm text-secondary">
								Verification code
							</label>
							{/* The step replaces the email form and its focused submit, so the code field takes focus. */}
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										type="text"
										inputMode="numeric"
										id={`${fieldId}-otp`}
										maxLength={6}
										required
										readOnly={isLoading}
										value={otp}
										aria-invalid={error?.field === 'otp' || undefined}
										aria-describedby={error?.field === 'otp' ? `${fieldId}-otp-error` : undefined}
										onChange={(e) => {
											setOtp(e.target.value.replace(/\D/g, ''))
											clearError()
										}}
										placeholder="000000"
										className="w-full tracking-widest"
									/>
								}
							/>
							{error?.field === 'otp' ? (
								<p id={`${fieldId}-otp-error`} role="alert" className="body-sm text-data-down">
									{error.message}
								</p>
							) : null}
							<ResendCooldown
								sentAtSeconds={codeSentAt}
								onResend={handleResendOtp}
								disabled={isLoading}
								pending={requestOtpMutation.isPending}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor={`${fieldId}-password`} className="label-sm text-secondary">
								Password
							</label>
							<div className="relative">
								<Input
									type={showPassword ? 'text' : 'password'}
									id={`${fieldId}-password`}
									required
									readOnly={isLoading}
									value={password}
									aria-invalid={error?.field === 'password' || undefined}
									aria-describedby={error?.field === 'password' ? `${fieldId}-password-error` : undefined}
									onChange={(e) => {
										setPassword(e.target.value)
										clearError()
									}}
									placeholder="At least 8 characters"
									className="w-full pr-10"
								/>
								<Tooltip
									content={showPassword ? 'Hide password' : 'Show password'}
									render={
										<Button
											variant="ghost"
											size="sm"
											square
											onClick={() => setShowPassword(!showPassword)}
											aria-label="Show password"
											aria-pressed={showPassword}
											className="absolute top-1/2 right-2 -translate-y-1/2"
										/>
									}
								>
									<Icon name={showPassword ? 'eye-off' : 'eye'} className="size-4" />
								</Tooltip>
							</div>
							{error?.field === 'password' ? (
								<p id={`${fieldId}-password-error`} role="alert" className="body-sm text-data-down">
									{error.message}
								</p>
							) : null}
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor={`${fieldId}-confirm`} className="label-sm text-secondary">
								Confirm password
							</label>
							<div className="relative">
								<Input
									type={showPasswordConfirm ? 'text' : 'password'}
									id={`${fieldId}-confirm`}
									required
									readOnly={isLoading}
									value={passwordConfirm}
									aria-invalid={error?.field === 'passwordConfirm' || undefined}
									aria-describedby={error?.field === 'passwordConfirm' ? `${fieldId}-confirm-error` : undefined}
									onChange={(e) => {
										setPasswordConfirm(e.target.value)
										clearError()
									}}
									placeholder="Re-enter your password"
									className="w-full pr-10"
								/>
								<Tooltip
									content={showPasswordConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
									render={
										<Button
											variant="ghost"
											size="sm"
											square
											onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
											aria-label="Show password confirmation"
											aria-pressed={showPasswordConfirm}
											className="absolute top-1/2 right-2 -translate-y-1/2"
										/>
									}
								>
									<Icon name={showPasswordConfirm ? 'eye-off' : 'eye'} className="size-4" />
								</Tooltip>
							</div>
							{error?.field === 'passwordConfirm' ? (
								<p id={`${fieldId}-confirm-error`} role="alert" className="body-sm text-data-down">
									{error.message}
								</p>
							) : null}
						</div>

						{error?.field === 'form' ? <InlineStatus variant="error">{error.message}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter
						leading={
							confirmIncomplete && !isLoading ? (
								<p className="body-sm text-tertiary">Enter the code and your password twice</p>
							) : null
						}
						dismiss={<DialogCancelButton />}
					>
						<Button
							type="submit"
							variant="primary"
							size="md"
							// A resend in flight also holds the switch; its own control shows "Sending code…".
							disabled={confirmIncomplete || requestOtpMutation.isPending}
							pendingLabel={confirmMutation.isPending ? 'Adding…' : null}
						>
							Add email
						</Button>
					</DialogFooter>
				</form>
			)}

			{step === 'success' && (
				<>
					<DialogHeader title="Email sign-in added" closable={false} />
					<DialogBody>
						<p className="body-sm text-secondary">
							You can now sign in with <span className="font-medium text-primary">{email}</span> and your password, as
							well as with your wallet.
						</p>
					</DialogBody>
					<DialogFooter>
						<Button type="button" variant="primary" size="md" autoFocus onClick={handleSuccessDone}>
							Done
						</Button>
					</DialogFooter>
				</>
			)}
		</Dialog>
	)
}
