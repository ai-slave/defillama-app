import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { revokeGoogleCredentialSharing } from '~/auth/GoogleSignInButton'
import { AUTH_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import pb from '~/utils/pocketbase'
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

interface DeleteAccountErrorResponse {
	error?: string
	message?: string
}

interface DeleteAccountResult {
	deletedAt: string
	status: 'completed'
}

interface DeletedAccountSession {
	accountId: string
	googleLoginHint: string | null
	shouldRevokeGoogleCredentialSharing: boolean
	sessionToken: string
}

interface DeleteAccountModalProps {
	accountId: string
	isOpen: boolean
	onClose: () => void
	onDeleted: (session: DeletedAccountSession) => Promise<void>
	googleLoginHint: string | null
	shouldRevokeGoogleCredentialSharing: boolean
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
	})

	if (!response.ok) {
		const errorData = (await response.json().catch(() => null)) as DeleteAccountErrorResponse | null
		throw new Error(errorData?.error || errorData?.message || 'Failed to process account deletion')
	}

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
	actionError: string
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
					<Button type="button" variant="destructive" size="md" pendingLabel="Checking…">
						Continue
					</Button>
				) : check.kind === 'failed' ? (
					<Button
						type="button"
						variant="primary"
						size="md"
						onClick={check.onRetry}
						pendingLabel={check.retrying ? 'Checking…' : null}
					>
						Try again
					</Button>
				) : !isBlocked && confirmationType !== 'apple_reauth' ? (
					<Button
						type="button"
						variant="destructive"
						size="md"
						onClick={onContinue}
						pendingLabel={isRequesting ? (confirmationType === 'otp' ? 'Sending code…' : 'Preparing…') : null}
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
	codeResent,
	confirmation,
	isDeleting,
	isRequesting,
	onConfirmationChange,
	onDelete,
	onOtpChange,
	onResendOtp,
	otp,
	requiredConfirmation,
	codeSentAt
}: {
	actionError: string
	cancel: ReactNode
	codeResent: boolean
	confirmation: string
	isDeleting: boolean
	isRequesting: boolean
	onConfirmationChange: (value: string) => void
	onDelete: (event: FormEvent<HTMLFormElement>) => void
	onOtpChange: (value: string) => void
	onResendOtp: () => void
	otp: string
	requiredConfirmation: RequiredConfirmation
	codeSentAt: number | null
}) {
	const needsOtp = requiredConfirmation.type === 'otp'
	const canSubmit = confirmation === requiredConfirmation.text && (!needsOtp || otp.length === 6)

	return (
		<form onSubmit={onDelete} className="flex min-h-0 flex-auto flex-col">
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					{needsOtp
						? 'Enter the verification code sent to your email, then confirm the permanent deletion.'
						: 'Confirm that you want to permanently delete your account.'}
				</Ariakit.DialogDescription>

				{needsOtp ? (
					<div className="flex flex-col gap-1.5">
						<label htmlFor="delete-account-otp" className="label-sm text-secondary">
							Verification code
						</label>
						<Input
							id="delete-account-otp"
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							maxLength={6}
							readOnly={isDeleting}
							value={otp}
							onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, ''))}
							placeholder="000000"
							className="w-full tracking-widest"
						/>
						<ResendCooldown
							sentAtSeconds={codeSentAt}
							onResend={onResendOtp}
							disabled={isDeleting}
							pending={isRequesting}
						/>
						{codeResent ? (
							<p role="status" className="body-sm text-secondary">
								Code sent. Check your inbox.
							</p>
						) : null}
					</div>
				) : null}

				<div className="flex flex-col gap-1.5">
					<label htmlFor="delete-account-confirmation" className="label-sm text-secondary">
						Type <span className="font-semibold text-primary">{requiredConfirmation.text}</span> to confirm
					</label>
					<Input
						id="delete-account-confirmation"
						type="text"
						autoComplete="off"
						readOnly={isDeleting}
						value={confirmation}
						onChange={(event) => onConfirmationChange(event.target.value)}
						placeholder={requiredConfirmation.text}
						className="w-full"
					/>
				</div>

				{actionError ? <InlineStatus variant="error">{actionError}</InlineStatus> : null}
			</DialogBody>
			<DialogFooter>
				{cancel}
				<Button
					type="submit"
					variant="destructive"
					size="md"
					// The field labels above say what unlocks it; a resend in flight shows its own "Sending code…".
					disabled={!canSubmit || isRequesting}
					pendingLabel={isDeleting ? 'Deleting account…' : null}
				>
					Delete account permanently
				</Button>
			</DialogFooter>
		</form>
	)
}

function DeleteAccountModal({
	accountId,
	googleLoginHint,
	isOpen,
	onClose,
	onDeleted,
	shouldRevokeGoogleCredentialSharing,
	sessionToken
}: DeleteAccountModalProps) {
	const [flowSession] = useState<DeletedAccountSession>({
		accountId,
		googleLoginHint,
		shouldRevokeGoogleCredentialSharing,
		sessionToken
	})
	const flowSessionToken = flowSession.sessionToken
	// When the last code went out; the resend countdown runs from it.
	const [codeSentAt, setCodeSentAt] = useState<number | null>(null)
	const deleteSubmissionPendingRef = useRef(false)
	const [step, setStep] = useState<'overview' | 'confirm'>('overview')
	const [requestedConfirmation, setRequestedConfirmation] = useState<RequiredConfirmation | null>(null)
	const [confirmation, setConfirmation] = useState('')
	const [otp, setOtp] = useState('')
	const [localError, setLocalError] = useState('')
	const [codeResent, setCodeResent] = useState(false)

	const isCurrentSession = () => pb.authStore.token === flowSessionToken
	const assertCurrentSession = () => {
		if (!isCurrentSession()) throw new Error('Your session changed. Close this dialog and try again.')
	}

	const eligibilityQuery = useQuery({
		queryKey: ['account-deletion', 'eligibility', flowSessionToken],
		queryFn: async () => {
			const data = await fetchDeleteAccountJson<DeleteAccountEligibility>(
				'/user/delete-account/eligibility',
				flowSessionToken,
				{ cache: 'no-store' }
			)
			assertCurrentSession()
			return data
		},
		enabled: isOpen,
		gcTime: 0,
		retry: false
	})

	const requestMutation = useMutation({
		mutationFn: async (action: 'continue' | 'resend') => {
			assertCurrentSession()
			const data = await fetchDeleteAccountJson<DeleteAccountRequestResponse>(
				'/user/delete-account/request',
				flowSessionToken,
				{ method: 'POST' }
			)
			assertCurrentSession()
			return { action, data }
		},
		onSuccess: ({ action, data }) => {
			setRequestedConfirmation(data.requiredConfirmation)
			if (action === 'resend') {
				if (data.requiredConfirmation.type !== 'otp') {
					setLocalError('Account verification requirements changed. Close this dialog and try again.')
					return
				}
				setCodeSentAt(Math.floor(Date.now() / 1000))
				setCodeResent(true)
				return
			}
			if (data.requiredConfirmation.type !== 'apple_reauth') {
				setStep('confirm')
				if (data.requiredConfirmation.type === 'otp') setCodeSentAt(Math.floor(Date.now() / 1000))
			}
		}
	})

	const deleteMutation = useMutation({
		mutationFn: async ({ needsOtp }: { needsOtp: boolean }) => {
			assertCurrentSession()
			const data = await fetchDeleteAccountJson<unknown>('/user/delete-account', flowSessionToken, {
				method: 'POST',
				body: JSON.stringify({ confirmation, ...(needsOtp ? { otp } : {}) })
			})
			return readDeleteAccountResult(data)
		},
		onSuccess: () => onDeleted(flowSession)
	})

	// Neither request can be cancelled, so the dialog stays open until it settles.
	const pending = requestMutation.isPending || deleteMutation.isPending
	const requiredConfirmation = requestedConfirmation ?? eligibilityQuery.data?.requiredConfirmation
	const actionError =
		localError ||
		(requestMutation.error instanceof Error ? requestMutation.error.message : '') ||
		(deleteMutation.error instanceof Error ? deleteMutation.error.message : '')

	const check: EligibilityState = eligibilityQuery.data
		? {
				kind: 'ready',
				eligibility: eligibilityQuery.data,
				requiredConfirmation: requestedConfirmation ?? eligibilityQuery.data.requiredConfirmation
			}
		: eligibilityQuery.isError
			? {
					kind: 'failed',
					message:
						eligibilityQuery.error instanceof Error
							? eligibilityQuery.error.message
							: 'Failed to load account deletion details',
					retrying: eligibilityQuery.isFetching,
					onRetry: () => void eligibilityQuery.refetch()
				}
			: { kind: 'checking' }

	const requireCurrentSession = () => {
		if (isCurrentSession()) return true
		setLocalError('Your session changed. Close this dialog and try again.')
		return false
	}

	const clearActionError = () => {
		setLocalError('')
		requestMutation.reset()
		deleteMutation.reset()
	}

	const handleDelete = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (deleteSubmissionPendingRef.current || !requiredConfirmation || !requireCurrentSession()) return
		const needsOtp = requiredConfirmation.type === 'otp'
		if (confirmation !== requiredConfirmation.text || (needsOtp && otp.length !== 6)) return
		clearActionError()
		deleteSubmissionPendingRef.current = true
		deleteMutation.mutate(
			{ needsOtp },
			{
				onSettled: () => {
					deleteSubmissionPendingRef.current = false
				}
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
		<Dialog size="sm" role="alertdialog" open={isOpen} onClose={onClose} pending={pending} portal unmountOnHide>
			<DialogHeader title="Delete account" closable={false} />
			{step === 'confirm' && requiredConfirmation ? (
				<DeleteAccountConfirmationForm
					requiredConfirmation={requiredConfirmation}
					cancel={cancel}
					codeResent={codeResent}
					confirmation={confirmation}
					otp={otp}
					actionError={actionError}
					isRequesting={requestMutation.isPending}
					isDeleting={deleteMutation.isPending}
					codeSentAt={codeSentAt}
					onConfirmationChange={(value) => {
						clearActionError()
						setConfirmation(value)
					}}
					onOtpChange={(value) => {
						clearActionError()
						setOtp(value)
					}}
					onResendOtp={() => {
						if (!requireCurrentSession()) return
						clearActionError()
						setCodeResent(false)
						requestMutation.mutate('resend')
					}}
					onDelete={handleDelete}
				/>
			) : (
				<DeleteAccountOverview
					actionError={actionError}
					cancel={cancel}
					check={check}
					isRequesting={requestMutation.isPending}
					onContinue={() => {
						if (!requireCurrentSession()) return
						clearActionError()
						requestMutation.mutate('continue')
					}}
				/>
			)}
		</Dialog>
	)
}

export function DeleteAccountCard() {
	const router = useRouter()
	const { authToken, user, logout } = useAuthContext()
	const [isModalOpen, setIsModalOpen] = useState(false)

	const handleDeleted = async (deletedSession: DeletedAccountSession) => {
		if (pb.authStore.record?.id !== deletedSession.accountId) {
			setIsModalOpen(false)
			return
		}

		const googleRevocation = deletedSession.shouldRevokeGoogleCredentialSharing
			? Promise.resolve().then(() => {
					if (!deletedSession.googleLoginHint) throw new Error('Google account email is unavailable')
					return revokeGoogleCredentialSharing(deletedSession.googleLoginHint)
				})
			: null

		setIsModalOpen(false)
		logout()
		void router.replace('/')
		toast.success('Your account has been deleted')

		if (!googleRevocation) return

		try {
			await googleRevocation
		} catch (error) {
			console.error('Account deleted, but Google credential revocation failed:', error)
		}
	}

	return (
		<>
			<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-surface p-4 dark:border-sub-border-strong">
				<div className="flex items-center gap-2">
					<Icon name="trash-2" height={28} width={28} className="text-error" />
					<span className="label-lg text-sub-text-primary">Delete account</span>
				</div>
				<div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
					<p className="max-w-[440px] body-sm text-sub-text-muted">
						Permanently delete your account data and remove your email from DefiLlama marketing services. This action
						cannot be undone.
					</p>
					<Button
						type="button"
						variant="destructive"
						size="md"
						onClick={() => setIsModalOpen(true)}
						disabled={!authToken || !user?.id}
					>
						Delete account
					</Button>
				</div>
			</div>

			{isModalOpen && authToken && user?.id ? (
				<DeleteAccountModal
					accountId={user.id}
					googleLoginHint={user?.authMethod === 'google' && user.email ? user.email : null}
					isOpen
					sessionToken={authToken}
					onClose={() => setIsModalOpen(false)}
					onDeleted={handleDeleted}
					shouldRevokeGoogleCredentialSharing={user?.authMethod === 'google'}
				/>
			) : null}
		</>
	)
}
