import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { revokeGoogleCredentialSharing } from '~/auth/GoogleSignInButton'
import { AUTH_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { handleSimpleFetchResponse, httpErrorMessage } from '~/utils/async'
import pb from '~/utils/pocketbase'
import { queryReadFailed } from '~/utils/query'
import { ResendCooldown } from './ResendCooldown'

type ConfirmationType = 'apple_reauth' | 'otp' | 'typed_confirmation'

interface RequiredConfirmation {
	text: string
	type: ConfirmationType
}

interface DeleteAccountEligibility {
	blockers: Array<{ code: 'sole_team_admin'; message: string }>
	canDelete: boolean
	requiredConfirmation: RequiredConfirmation
	warnings: Array<{
		code:
			| 'apple_subscription'
			| 'google_play_subscription'
			| 'llamapay_subscription'
			| 'manual_subscription'
			| 'stripe_subscription'
		message: string
		provider: string
	}>
}

interface DeleteAccountRequestResponse {
	message: string
	requiredConfirmation: RequiredConfirmation
}

interface DeleteAccountResult {
	deletedAt: string
	status: 'completed'
}

/** The session the flow started in, captured when the dialog opens. */
interface DeleteAccountSession {
	accountId: string
	/** The Google account's email for a Google sign-in, whose credential sharing is revoked after deletion. */
	googleLoginHint: string | null
	sessionToken: string
}

function readDeleteAccountResult(value: unknown): DeleteAccountResult {
	if (
		!value ||
		typeof value !== 'object' ||
		!('status' in value) ||
		value.status !== 'completed' ||
		!('deletedAt' in value) ||
		typeof value.deletedAt !== 'string'
	) {
		throw new Error('Account deletion did not complete. Try again.')
	}
	const deletedAt = new Date(value.deletedAt)
	if (Number.isNaN(deletedAt.getTime()) || deletedAt.toISOString() !== value.deletedAt) {
		throw new Error('Account deletion did not complete. Try again.')
	}

	return { deletedAt: value.deletedAt, status: value.status }
}

async function fetchDeleteAccountJson<T>(path: string, sessionToken: string, options: RequestInit = {}): Promise<T> {
	const headers = new Headers(options.headers)
	headers.set('Authorization', `Bearer ${sessionToken}`)
	if (options.body) headers.set('Content-Type', 'application/json')

	const response = await fetch(`${AUTH_SERVER}${path}`, {
		...options,
		headers
	}).catch(() => {
		throw new Error("Couldn't process the account deletion.")
	})

	await handleSimpleFetchResponse(response).catch((error) => {
		throw new Error(httpErrorMessage(error, "Couldn't process the account deletion."))
	})

	const data = (await response.json().catch(() => null)) as T | null
	if (!data) throw new Error('Invalid response from account deletion service')
	return data
}

type EligibilityState =
	| { kind: 'checking' }
	| { kind: 'failed'; message: string; retrying: boolean; onRetry: () => void }
	| { kind: 'ready'; eligibility: DeleteAccountEligibility; requiredConfirmation: RequiredConfirmation }

// One message reads as a sentence; a bullet only helps once there are several.
function StatusMessages({ messages }: { messages: Array<string> }) {
	if (messages.length === 1) return messages[0]
	return (
		<ul className="flex list-disc flex-col gap-1 pl-4">
			{messages.map((message) => (
				<li key={message}>{message}</li>
			))}
		</ul>
	)
}

function DeleteAccountOverview({
	actionError,
	cancel,
	check,
	isRequesting,
	onContinue
}: {
	actionError: string | null
	cancel: ReactNode
	check: EligibilityState
	isRequesting: boolean
	onContinue: () => void
}) {
	const eligibility = check.kind === 'ready' ? check.eligibility : null
	const confirmationType = check.kind === 'ready' ? check.requiredConfirmation.type : null
	const isBlocked = eligibility !== null && (!eligibility.canDelete || eligibility.blockers.length > 0)

	return (
		<>
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					This permanently deletes your DefiLlama account and associated account data. You will be signed out, and this
					cannot be undone.
				</Ariakit.DialogDescription>

				{eligibility && eligibility.warnings.length > 0 ? (
					<InlineStatus variant="warning">
						<StatusMessages messages={eligibility.warnings.map((warning) => warning.message)} />
					</InlineStatus>
				) : null}

				{eligibility && isBlocked ? (
					<InlineStatus variant="error">
						<StatusMessages messages={eligibility.blockers.map((blocker) => blocker.message)} />
					</InlineStatus>
				) : confirmationType === 'apple_reauth' ? (
					<InlineStatus variant="warning">
						Open the DefiLlama mobile app and reauthenticate with Apple to delete this account.
					</InlineStatus>
				) : null}

				{check.kind === 'failed' ? <InlineStatus variant="error">{check.message}</InlineStatus> : null}
				{actionError ? <InlineStatus variant="error">{actionError}</InlineStatus> : null}
			</DialogBody>
			<DialogFooter>
				{cancel}
				{check.kind === 'checking' ? (
					// The eligibility check only gates Continue, so it waits in that button instead of replacing the dialog.
					<Button type="button" variant="destructive" size="md" pendingLabel="Checking…" pending>
						Continue
					</Button>
				) : check.kind === 'failed' ? (
					<Button
						type="button"
						variant="primary"
						size="md"
						onClick={check.onRetry}
						pendingLabel="Checking…"
						pending={check.retrying}
					>
						Try again
					</Button>
				) : !isBlocked && confirmationType !== 'apple_reauth' ? (
					<Button
						type="button"
						variant="destructive"
						size="md"
						onClick={onContinue}
						pendingLabel={confirmationType === 'otp' ? 'Sending code…' : 'Preparing…'}
						pending={isRequesting}
					>
						Continue
					</Button>
				) : null}
			</DialogFooter>
		</>
	)
}

function DeleteAccountConfirmationForm({
	actionError,
	cancel,
	confirmation,
	isDeleting,
	isRequesting,
	onConfirmationChange,
	onDelete,
	onOtpChange,
	onResendOtp,
	otp,
	otpError,
	requiredConfirmation,
	codeSentAt
}: {
	actionError: string | null
	cancel: ReactNode
	confirmation: string
	isDeleting: boolean
	isRequesting: boolean
	onConfirmationChange: (value: string) => void
	onDelete: (event: FormEvent<HTMLFormElement>) => void
	onOtpChange: (value: string) => void
	onResendOtp: () => void
	otp: string
	otpError: string | null
	requiredConfirmation: RequiredConfirmation
	codeSentAt: number | null
}) {
	const needsOtp = requiredConfirmation.type === 'otp'

	return (
		<form noValidate onSubmit={onDelete} className="flex min-h-0 flex-auto flex-col">
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					{needsOtp
						? 'Enter the verification code sent to your email, then confirm the permanent deletion.'
						: 'Confirm that you want to permanently delete your account.'}
				</Ariakit.DialogDescription>

				{needsOtp ? (
					<div className="flex flex-col gap-1">
						<Field label="Verification code" error={otpError}>
							{(control) => (
								<Input
									{...control}
									type="text"
									inputMode="numeric"
									autoComplete="one-time-code"
									maxLength={6}
									required
									readOnly={isDeleting}
									value={otp}
									onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, ''))}
									placeholder="000000"
									className="w-full tracking-widest"
								/>
							)}
						</Field>
						<ResendCooldown
							sentAtSeconds={codeSentAt}
							onResend={onResendOtp}
							disabled={isDeleting}
							pending={isRequesting}
						/>
					</div>
				) : null}

				<Field
					label={
						<>
							Type <span className="font-semibold text-primary">{requiredConfirmation.text}</span> to confirm
						</>
					}
				>
					{(control) => (
						<Input
							{...control}
							type="text"
							autoComplete="off"
							readOnly={isDeleting}
							value={confirmation}
							onChange={(event) => onConfirmationChange(event.target.value)}
							placeholder={requiredConfirmation.text}
							className="w-full"
						/>
					)}
				</Field>

				{actionError ? <InlineStatus variant="error">{actionError}</InlineStatus> : null}
			</DialogBody>
			<DialogFooter>
				{cancel}
				<Button
					type="submit"
					variant="destructive"
					size="md"
					// Typing the phrase unlocks it, as its label says: friction on a destructive action, not validation. A resend
					// in flight shows its own "Sending code…".
					disabled={confirmation !== requiredConfirmation.text || isRequesting}
					pendingLabel="Deleting account…"
					pending={isDeleting}
				>
					Delete account permanently
				</Button>
			</DialogFooter>
		</form>
	)
}

const SESSION_CHANGED = 'Your session changed. Close this dialog and try again.'

function DeleteAccountModal({
	session,
	onClose,
	onDeleted
}: {
	session: DeleteAccountSession
	onClose: () => void
	onDeleted: (session: DeleteAccountSession) => void
}) {
	const { sessionToken } = session
	// When the last code went out; the resend countdown runs from it.
	const [codeSentAt, setCodeSentAt] = useState<number | null>(null)
	const [requestedConfirmation, setRequestedConfirmation] = useState<RequiredConfirmation | null>(null)
	const [confirmation, setConfirmation] = useState('')
	const [otp, setOtp] = useState('')
	const [submitted, setSubmitted] = useState(false)
	// The last failed request or deletion. Not the mutations' own errors: those clear as soon as a retry starts.
	const [actionError, setActionError] = useState<string | null>(null)
	// The server's refusal of the code, shown under the code field until the code is edited.
	const [codeRefusal, setCodeRefusal] = useState<string | null>(null)
	// The mutation reports pending a tick after mutate(), so a second submit in that tick would send again.
	const deleteSubmittedRef = useRef(false)

	const assertCurrentSession = () => {
		if (pb.authStore.token !== sessionToken) throw new Error(SESSION_CHANGED)
	}

	const eligibilityQuery = useQuery({
		queryKey: ['account-deletion', 'eligibility', sessionToken],
		queryFn: async () => {
			const data = await fetchDeleteAccountJson<DeleteAccountEligibility>(
				'/user/delete-account/eligibility',
				sessionToken,
				{ cache: 'no-store' }
			)
			assertCurrentSession()
			return data
		},
		gcTime: 0,
		retry: false
	})

	const requestMutation = useMutation({
		mutationFn: async (action: 'continue' | 'resend') => {
			assertCurrentSession()
			const data = await fetchDeleteAccountJson<DeleteAccountRequestResponse>(
				'/user/delete-account/request',
				sessionToken,
				{ method: 'POST' }
			)
			assertCurrentSession()
			if (action === 'resend' && data.requiredConfirmation.type !== 'otp')
				throw new Error('Account verification requirements changed. Close this dialog and try again.')
			return data
		},
		onSuccess: (data) => {
			setActionError(null)
			setRequestedConfirmation(data.requiredConfirmation)
			if (data.requiredConfirmation.type === 'otp') setCodeSentAt(Math.floor(Date.now() / 1000))
		},
		onError: (error) => setActionError(error.message)
	})

	const deleteMutation = useMutation({
		mutationFn: async ({ needsOtp }: { needsOtp: boolean }) => {
			assertCurrentSession()
			const data = await fetchDeleteAccountJson<unknown>('/user/delete-account', sessionToken, {
				method: 'POST',
				body: JSON.stringify({ confirmation, ...(needsOtp ? { otp } : {}) })
			})
			return readDeleteAccountResult(data)
		},
		onSuccess: () => onDeleted(session)
	})

	// Neither request can be canceled, so the dialog stays open until it settles.
	const pending = requestMutation.isPending || deleteMutation.isPending
	const requiredConfirmation = requestedConfirmation ?? eligibilityQuery.data?.requiredConfirmation
	// Apple accounts confirm in the mobile app, so their request keeps the overview.
	const onConfirmStep = requestedConfirmation !== null && requestedConfirmation.type !== 'apple_reauth'

	const check: EligibilityState = eligibilityQuery.data
		? {
				kind: 'ready',
				eligibility: eligibilityQuery.data,
				requiredConfirmation: requestedConfirmation ?? eligibilityQuery.data.requiredConfirmation
			}
		: queryReadFailed(eligibilityQuery)
			? {
					kind: 'failed',
					// The retry clears the error while it runs; the generic message covers that. fetchDeleteAccountJson
					// words every failure for readers.
					message: eligibilityQuery.error?.message ?? "Couldn't load the account deletion details.",
					retrying: eligibilityQuery.isFetching,
					onRetry: () => void eligibilityQuery.refetch()
				}
			: { kind: 'checking' }

	const otpMessage = !otp ? 'Enter the verification code.' : otp.length !== 6 ? 'Enter a valid 6-digit code.' : null

	const handleDelete = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (deleteSubmittedRef.current || !requiredConfirmation || confirmation !== requiredConfirmation.text) return
		const needsOtp = requiredConfirmation.type === 'otp'
		if (needsOtp && otpMessage) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		const form = event.currentTarget
		deleteSubmittedRef.current = true
		deleteMutation.mutate(
			{ needsOtp },
			{
				onError: (error) => {
					// The server names the code "OTP" when it refuses it as wrong or expired. Focus moves to the code, so a
					// screen reader reads it with the refusal.
					if (needsOtp && /\bOTP\b/.test(error.message)) {
						showFieldErrors(form, () => setCodeRefusal('This code is wrong or has expired.'))
					} else setActionError(error.message)
				},
				onSettled: () => (deleteSubmittedRef.current = false)
			}
		)
	}

	const cancel = (
		<Ariakit.DialogDismiss
			type="button"
			autoFocus
			disabled={pending}
			accessibleWhenDisabled
			render={<Button size="md" />}
		>
			Cancel
		</Ariakit.DialogDismiss>
	)

	// A destructive confirmation on every step: no ×, and Cancel stays in the footer at every width,
	// so the exit never moves between the header and the footer mid-flow.
	return (
		<Dialog size="sm" role="alertdialog" open onClose={onClose} pending={pending} portal unmountOnHide>
			<DialogHeader title="Delete account" closable={false} />
			{onConfirmStep ? (
				<DeleteAccountConfirmationForm
					requiredConfirmation={requestedConfirmation}
					cancel={cancel}
					confirmation={confirmation}
					otp={otp}
					otpError={codeRefusal ?? (submitted ? otpMessage : null)}
					actionError={actionError}
					isRequesting={requestMutation.isPending}
					isDeleting={deleteMutation.isPending}
					codeSentAt={codeSentAt}
					onConfirmationChange={(value) => {
						setActionError(null)
						setConfirmation(value)
					}}
					onOtpChange={(value) => {
						setActionError(null)
						setCodeRefusal(null)
						setOtp(value)
					}}
					onResendOtp={() => requestMutation.mutate('resend')}
					onDelete={handleDelete}
				/>
			) : (
				<DeleteAccountOverview
					actionError={actionError}
					cancel={cancel}
					check={check}
					isRequesting={requestMutation.isPending}
					onContinue={() => requestMutation.mutate('continue')}
				/>
			)}
		</Dialog>
	)
}

export function DeleteAccountCard() {
	const router = useRouter()
	const { authToken, user, logout } = useAuthContext()
	const [openSession, setOpenSession] = useState<DeleteAccountSession | null>(null)

	const handleDeleted = (deletedSession: DeleteAccountSession) => {
		setOpenSession(null)
		if (pb.authStore.record?.id !== deletedSession.accountId) return
		logout()
		void router.replace('/')
		toast.success('Your account has been deleted')
		// The account is gone either way; a failed revocation only leaves Google's credential sharing on.
		if (deletedSession.googleLoginHint) {
			revokeGoogleCredentialSharing(deletedSession.googleLoginHint).catch((error) => {
				console.error('Account deleted, but Google credential revocation failed:', error)
			})
		}
	}

	return (
		<>
			<Card padding="md" className="flex flex-col gap-4">
				<div className="flex items-center gap-2">
					<Icon name="trash-2" className="size-7 text-error" />
					<span className="label-lg text-primary">Delete account</span>
				</div>
				<div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
					<p className="max-w-[440px] body-sm text-tertiary">
						Permanently delete your account data and remove your email from DefiLlama marketing services. This action
						cannot be undone.
					</p>
					<Button
						type="button"
						variant="destructive"
						size="md"
						onClick={() => {
							if (!authToken || !user) return
							setOpenSession({
								accountId: user.id,
								googleLoginHint: user.authMethod === 'google' && user.email ? user.email : null,
								sessionToken: authToken
							})
						}}
						disabled={!authToken || !user?.id}
					>
						Delete account
					</Button>
				</div>
			</Card>

			{openSession ? (
				<DeleteAccountModal session={openSession} onClose={() => setOpenSession(null)} onDeleted={handleDeleted} />
			) : null}
		</>
	)
}
