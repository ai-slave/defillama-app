import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { type FormEvent, type RefObject, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AUTH_SERVER } from '~/constants'
import { Icon } from '~/ui/Icon'
import pb from '~/utils/pocketbase'
import { ResendCooldown, type ResendCooldownHandle } from './ResendCooldown'

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

interface DeleteAccountModalProps {
	isOpen: boolean
	onClose: () => void
	onDeleted: () => void
	sessionToken: string
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

function DeleteAccountOverview({
	eligibility,
	isRequesting,
	onContinue,
	requiredConfirmation
}: {
	eligibility: DeleteAccountEligibility
	isRequesting: boolean
	onContinue: () => void
	requiredConfirmation: RequiredConfirmation
}) {
	const isBlocked = !eligibility.canDelete || eligibility.blockers.length > 0

	return (
		<>
			<p className="text-sm leading-[21px] text-sub-text-primary">
				This permanently deletes your DefiLlama account and associated account data. You will be signed out, and this
				cannot be undone.
			</p>

			{eligibility.warnings.length > 0 ? (
				<div className="flex items-start gap-2 rounded-lg border border-sub-warning-border-light bg-sub-warning-bg/10 p-3 text-sub-warning-text-light dark:border-sub-warning-border-dark dark:text-sub-warning-text-dark">
					<Icon name="alert-triangle" height={18} width={18} className="mt-0.5 shrink-0" />
					<ul className="flex list-disc flex-col gap-1 pl-4 text-sm">
						{eligibility.warnings.map((warning) => (
							<li key={`${warning.code}:${warning.provider}`}>{warning.message}</li>
						))}
					</ul>
				</div>
			) : null}

			{isBlocked ? (
				<div
					className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error"
					role="alert"
				>
					<Icon name="alert-warning" height={16} width={16} className="mt-0.5 shrink-0" />
					<ul className="flex list-disc flex-col gap-1 pl-4 text-sm">
						{eligibility.blockers.map((blocker) => (
							<li key={blocker.code}>{blocker.message}</li>
						))}
					</ul>
				</div>
			) : requiredConfirmation.type === 'apple_reauth' ? (
				<div className="flex items-start gap-2 rounded-lg border border-sub-warning-border-light bg-sub-warning-bg/10 p-3 text-sub-warning-text-light dark:border-sub-warning-border-dark dark:text-sub-warning-text-dark">
					<Icon name="smartphone" height={18} width={18} className="mt-0.5 shrink-0" />
					<p className="text-sm">Open the DefiLlama mobile app and reauthenticate with Apple to delete this account.</p>
				</div>
			) : (
				<button
					type="button"
					onClick={onContinue}
					disabled={isRequesting}
					className="flex h-10 w-full items-center justify-center rounded-lg bg-error text-sm font-medium text-on-brand disabled:opacity-50"
				>
					{isRequesting ? (requiredConfirmation.type === 'otp' ? 'Sending Code...' : 'Preparing...') : 'Continue'}
				</button>
			)}
		</>
	)
}

function DeleteAccountConfirmationForm({
	actionError,
	confirmation,
	isDeleting,
	isRequesting,
	onConfirmationChange,
	onDelete,
	onOtpChange,
	onResendOtp,
	otp,
	requiredConfirmation,
	resendRef
}: {
	actionError: string
	confirmation: string
	isDeleting: boolean
	isRequesting: boolean
	onConfirmationChange: (value: string) => void
	onDelete: (event: FormEvent<HTMLFormElement>) => void
	onOtpChange: (value: string) => void
	onResendOtp: () => void
	otp: string
	requiredConfirmation: RequiredConfirmation
	resendRef: RefObject<ResendCooldownHandle | null>
}) {
	const needsOtp = requiredConfirmation.type === 'otp'
	const canSubmit = confirmation === requiredConfirmation.text && (!needsOtp || otp.length === 6)

	return (
		<form onSubmit={onDelete} className="flex flex-col gap-4">
			<p className="text-sm leading-[21px] text-sub-text-primary">
				{needsOtp
					? 'Enter the verification code sent to your email, then confirm the permanent deletion.'
					: 'Confirm that you want to permanently delete your account.'}
			</p>

			{needsOtp ? (
				<div className="flex flex-col gap-2">
					<label htmlFor="delete-account-otp" className="text-sm text-sub-text-primary">
						Verification Code
					</label>
					<input
						id="delete-account-otp"
						type="text"
						inputMode="numeric"
						autoComplete="one-time-code"
						maxLength={6}
						value={otp}
						onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, ''))}
						placeholder="000000"
						className="h-10 w-full rounded-lg border border-sub-border-muted bg-sub-surface-panel px-3 text-sm tracking-widest text-sub-text-primary outline-hidden focus:border-sub-brand-primary dark:border-sub-border-strong dark:bg-sub-dark-page"
					/>
					<ResendCooldown ref={resendRef} onResend={onResendOtp} disabled={isRequesting || isDeleting} />
				</div>
			) : null}

			<div className="flex flex-col gap-2">
				<label htmlFor="delete-account-confirmation" className="text-sm text-sub-text-primary">
					Type <span className="font-semibold">{requiredConfirmation.text}</span> to confirm
				</label>
				<input
					id="delete-account-confirmation"
					type="text"
					autoComplete="off"
					value={confirmation}
					onChange={(event) => onConfirmationChange(event.target.value)}
					placeholder={requiredConfirmation.text}
					className="h-10 w-full rounded-lg border border-sub-border-muted bg-sub-surface-panel px-3 text-sm text-sub-text-primary outline-hidden focus:border-sub-brand-primary dark:border-sub-border-strong dark:bg-sub-dark-page"
				/>
			</div>

			<button
				type="submit"
				disabled={!canSubmit || isDeleting || isRequesting}
				className="flex h-10 w-full items-center justify-center rounded-lg bg-error text-sm font-medium text-on-brand disabled:opacity-50"
			>
				{isDeleting ? 'Deleting Account...' : 'Delete Account Permanently'}
			</button>

			{actionError ? (
				<div
					className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error"
					role="alert"
				>
					<Icon name="alert-warning" height={16} width={16} className="mt-0.5 shrink-0" />
					<p className="text-sm">{actionError}</p>
				</div>
			) : null}
		</form>
	)
}

function DeleteAccountModal({ isOpen, onClose, onDeleted, sessionToken }: DeleteAccountModalProps) {
	const [flowSessionToken] = useState(sessionToken)
	const resendRef = useRef<ResendCooldownHandle>(null)
	const [step, setStep] = useState<'overview' | 'confirm'>('overview')
	const [requestedConfirmation, setRequestedConfirmation] = useState<RequiredConfirmation | null>(null)
	const [confirmation, setConfirmation] = useState('')
	const [otp, setOtp] = useState('')
	const [localError, setLocalError] = useState('')

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
				resendRef.current?.start()
				toast.success('Deletion code resent')
				return
			}
			if (data.requiredConfirmation.type !== 'apple_reauth') {
				setStep('confirm')
				if (data.requiredConfirmation.type === 'otp') setTimeout(() => resendRef.current?.start(), 0)
			}
		}
	})

	const deleteMutation = useMutation({
		mutationFn: async ({ needsOtp }: { needsOtp: boolean }) => {
			assertCurrentSession()
			const data = await fetchDeleteAccountJson<{ deletedAt: string; status: 'completed' }>(
				'/user/delete-account',
				flowSessionToken,
				{
					method: 'POST',
					body: JSON.stringify({ confirmation, ...(needsOtp ? { otp } : {}) })
				}
			)
			assertCurrentSession()
			return data
		},
		onSuccess: onDeleted
	})

	const requiredConfirmation = requestedConfirmation ?? eligibilityQuery.data?.requiredConfirmation
	const actionError =
		localError ||
		(requestMutation.error instanceof Error ? requestMutation.error.message : '') ||
		(deleteMutation.error instanceof Error ? deleteMutation.error.message : '')

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
		if (!requiredConfirmation || !requireCurrentSession()) return
		const needsOtp = requiredConfirmation.type === 'otp'
		if (confirmation !== requiredConfirmation.text || (needsOtp && otp.length !== 6)) return
		clearActionError()
		deleteMutation.mutate({ needsOtp })
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && !deleteMutation.isPending && onClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className="dialog max-h-[90vh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[420px]"
				portal
				unmountOnHide
			>
				<div className="flex flex-col gap-5 px-5 py-6">
					<div className="flex items-center justify-between gap-4">
						<Ariakit.DialogHeading className="text-xl leading-7 font-semibold text-sub-text-primary">
							Delete Account
						</Ariakit.DialogHeading>
						<Ariakit.DialogDismiss
							type="button"
							disabled={deleteMutation.isPending}
							aria-label="Close account deletion dialog"
							className="rounded-full p-1 text-sub-text-primary transition-colors disabled:opacity-50"
						>
							<Icon name="x" height={24} width={24} />
						</Ariakit.DialogDismiss>
					</div>

					{eligibilityQuery.isPending ? (
						<div className="flex items-center gap-3 py-6 text-sm text-sub-text-muted" role="status">
							<div className="size-5 animate-spin rounded-full border-2 border-sub-brand-primary border-t-transparent" />
							Checking your account...
						</div>
					) : eligibilityQuery.isError ? (
						<>
							<div
								className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error"
								role="alert"
							>
								<Icon name="alert-warning" height={16} width={16} className="mt-0.5 shrink-0" />
								<p className="text-sm">
									{eligibilityQuery.error instanceof Error
										? eligibilityQuery.error.message
										: 'Failed to load account deletion details'}
								</p>
							</div>
							<button
								type="button"
								onClick={() => void eligibilityQuery.refetch()}
								className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand"
							>
								Try Again
							</button>
						</>
					) : eligibilityQuery.data && requiredConfirmation ? (
						step === 'overview' ? (
							<>
								<DeleteAccountOverview
									eligibility={eligibilityQuery.data}
									requiredConfirmation={requiredConfirmation}
									isRequesting={requestMutation.isPending}
									onContinue={() => {
										if (!requireCurrentSession()) return
										clearActionError()
										requestMutation.mutate('continue')
									}}
								/>
								{actionError ? (
									<div
										className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error"
										role="alert"
									>
										<Icon name="alert-warning" height={16} width={16} className="mt-0.5 shrink-0" />
										<p className="text-sm">{actionError}</p>
									</div>
								) : null}
							</>
						) : (
							<DeleteAccountConfirmationForm
								requiredConfirmation={requiredConfirmation}
								confirmation={confirmation}
								otp={otp}
								actionError={actionError}
								isRequesting={requestMutation.isPending}
								isDeleting={deleteMutation.isPending}
								resendRef={resendRef}
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
									requestMutation.mutate('resend')
								}}
								onDelete={handleDelete}
							/>
						)
					) : null}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

export function DeleteAccountCard() {
	const router = useRouter()
	const { authToken, user, logout } = useAuthContext()
	const [isModalOpen, setIsModalOpen] = useState(false)

	const handleDeleted = () => {
		setIsModalOpen(false)
		logout()
		toast.success('Your account has been deleted')
		void router.replace('/')
	}

	return (
		<>
			<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
				<div className="flex items-center gap-2">
					<Icon name="trash-2" height={28} width={28} className="text-error" />
					<span className="text-base font-medium text-sub-text-primary">Delete Account</span>
				</div>
				<div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
					<p className="max-w-[440px] text-xs leading-4 text-sub-text-muted">
						Permanently delete your account data and remove your email from DefiLlama marketing services. This action
						cannot be undone.
					</p>
					<button
						type="button"
						onClick={() => setIsModalOpen(true)}
						disabled={!authToken || !user?.id}
						className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-error/40 px-3 text-xs font-medium text-error transition-colors hover:bg-error/5 disabled:opacity-50"
					>
						Delete Account
					</button>
				</div>
			</div>

			{isModalOpen && authToken ? (
				<DeleteAccountModal
					isOpen
					sessionToken={authToken}
					onClose={() => setIsModalOpen(false)}
					onDeleted={handleDeleted}
				/>
			) : null}
		</>
	)
}
