import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
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
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { emailError } from '~/utils/email'
import pb from '~/utils/pocketbase'
import { ResendCooldown } from './ResendCooldown'

interface SwitchToEmailModalProps {
	isOpen: boolean
	onClose: () => void
	defaultEmail?: string
}

type Step = 'email' | 'confirm' | 'success'

// A rejected code shows under the code field; any other request failure belongs to the whole form.
interface FormError {
	field: 'form' | 'otp'
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
	const [step, setStep] = useState<Step>('email')
	const [email, setEmail] = useState(defaultEmail ?? '')
	const [otp, setOtp] = useState('')
	const [password, setPassword] = useState('')
	const [passwordConfirm, setPasswordConfirm] = useState('')
	// Whether the current step's form was submitted; its field errors show from then on.
	const [submitted, setSubmitted] = useState(false)
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
		}
	})
	// Neither request can be cancelled, so the dialog stays open until it settles; a late result
	// therefore always lands in the opening that started it.
	const isLoading = requestOtpMutation.isPending || confirmMutation.isPending

	const emailMessage = emailError(email)
	const otpMessage = !otp ? 'Enter the verification code.' : otp.length !== 6 ? 'Enter a valid 6-digit code.' : null
	const passwordMessage = !password
		? 'Enter a password.'
		: password.length < 8
			? 'Enter a password of at least 8 characters.'
			: null
	const passwordConfirmMessage = !passwordConfirm
		? 'Enter the password again.'
		: passwordConfirm !== password
			? 'Passwords do not match.'
			: null

	const handleRequestOtp = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (emailMessage) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		const session = { token: pb.authStore.token, accountId: pb.authStore.record?.id ?? '' }
		setFlowSession(session)
		requestOtpMutation.mutate(
			{ email, sessionToken: session.token },
			{
				onSuccess: () => {
					setSubmitted(false)
					setStep('confirm')
				}
			}
		)
	}

	const handleConfirm = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const form = e.currentTarget
		if (otpMessage || passwordMessage || passwordConfirmMessage) return showFieldErrors(form, () => setSubmitted(true))
		confirmMutation.mutate(
			{ sessionToken: flowSession.token, email, otp, password, passwordConfirm },
			{
				onError: (confirmError) => {
					const message = confirmError.message || 'Failed to add email sign-in. Try again.'
					// The server names the code "OTP" in each of its code rejections: missing, malformed, invalid or
					// expired. Focus moves to the code, so a screen reader reads it with the rejection.
					if (/\bOTP\b/.test(message)) showFieldErrors(form, () => setError({ field: 'otp', message }))
					else setError({ field: 'form', message })
				}
			}
		)
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
				<form noValidate onSubmit={handleRequestOtp} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title="Add email sign-in" />
					<DialogBody>
						<p className="body-sm text-secondary">
							Enter the email address you'd like to use for signing in. We'll send you a verification code.
						</p>

						<Field label="Email" error={submitted ? emailMessage : null}>
							{(control) => (
								// Ariakit's autoFocus, so the step opens on the field instead of the header ×.
								<Ariakit.Focusable
									autoFocus
									render={
										<Input
											{...control}
											type="email"
											required
											readOnly={isLoading}
											value={email}
											onChange={(e) => {
												setEmail(e.target.value)
												clearError()
											}}
											placeholder="your.email@example.com"
											className="w-full"
										/>
									}
								/>
							)}
						</Field>

						{error ? <InlineStatus variant="error">{error.message}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button
							type="submit"
							variant="primary"
							size="md"
							pendingLabel={requestOtpMutation.isPending ? 'Sending…' : null}
						>
							Send verification code
						</Button>
					</DialogFooter>
				</form>
			)}

			{step === 'confirm' && (
				<form noValidate onSubmit={handleConfirm} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title="Verify & set password" />
					<DialogBody>
						<p className="body-sm text-secondary">
							Enter the 6-digit code sent to <span className="font-medium text-primary">{email}</span> and choose a
							password.
						</p>

						<div className="flex flex-col gap-1">
							<Field
								label="Verification code"
								error={error?.field === 'otp' ? error.message : submitted ? otpMessage : null}
							>
								{(control) => (
									// The step replaces the email form and its focused submit, so the code field takes focus.
									<Ariakit.Focusable
										autoFocus
										render={
											<Input
												{...control}
												type="text"
												inputMode="numeric"
												maxLength={6}
												required
												readOnly={isLoading}
												value={otp}
												onChange={(e) => {
													setOtp(e.target.value.replace(/\D/g, ''))
													clearError()
												}}
												placeholder="000000"
												className="w-full tracking-widest"
											/>
										}
									/>
								)}
							</Field>
							<ResendCooldown
								sentAtSeconds={codeSentAt}
								onResend={handleResendOtp}
								disabled={isLoading}
								pending={requestOtpMutation.isPending}
							/>
						</div>

						<Field label="Password" error={submitted ? passwordMessage : null}>
							{(control) => (
								<div className="relative">
									<Input
										{...control}
										type={showPassword ? 'text' : 'password'}
										required
										readOnly={isLoading}
										value={password}
										onChange={(e) => {
											setPassword(e.target.value)
											if (error?.field === 'form') setError(null)
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
							)}
						</Field>

						<Field label="Confirm password" error={submitted ? passwordConfirmMessage : null}>
							{(control) => (
								<div className="relative">
									<Input
										{...control}
										type={showPasswordConfirm ? 'text' : 'password'}
										required
										readOnly={isLoading}
										value={passwordConfirm}
										onChange={(e) => {
											setPasswordConfirm(e.target.value)
											if (error?.field === 'form') setError(null)
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
							)}
						</Field>

						{error?.field === 'form' ? <InlineStatus variant="error">{error.message}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button
							type="submit"
							variant="primary"
							size="md"
							// A resend in flight also holds the switch; its own control shows "Sending code…".
							disabled={requestOtpMutation.isPending}
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
