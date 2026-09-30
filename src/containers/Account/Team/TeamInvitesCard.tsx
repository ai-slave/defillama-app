import { useEffect, useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Icon } from '~/ui/Icon'
import { formatDate, parseDateTimestamp } from '~/utils/dateFormat'
import { InviteMemberModal } from './InviteMemberModal'
import type { TeamInvite } from './types'
import { useTeam } from './useTeam'

const RESEND_COOLDOWN_MS = 60_000

function InviteRow({ invite, finalFocus }: { invite: TeamInvite; finalFocus: RefObject<HTMLElement | null> }) {
	const { revokeInviteMutation, resendInviteMutation } = useTeam()
	const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
	const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
	const [now, setNow] = useState<number | null>(null)

	useEffect(() => {
		const tick = () => {
			const currentTime = Date.now()
			setNow(currentTime)
			if (cooldownUntil && currentTime >= cooldownUntil) setCooldownUntil(null)
		}
		tick()
		const id = window.setInterval(tick, cooldownUntil ? 1000 : 60_000)
		return () => window.clearInterval(id)
	}, [cooldownUntil])

	const remainingMs = cooldownUntil && now != null ? Math.max(0, cooldownUntil - now) : 0
	const remainingSeconds = Math.ceil(remainingMs / 1000)
	const onCooldown = remainingMs > 0
	const isResending = resendInviteMutation.isPending && resendInviteMutation.variables?.inviteId === invite.id

	const handleResend = () => {
		if (onCooldown || isResending) return
		resendInviteMutation.mutate(
			{ inviteId: invite.id },
			{ onSuccess: () => setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS) }
		)
	}

	const expiresAt = parseDateTimestamp(invite.expiresAt)
	const isExpired = now != null && expiresAt != null && expiresAt <= now

	return (
		<>
			{/* Phones stack the actions under the invite, so the address, expiry and any error keep the full width. */}
			<div className="flex flex-col gap-3 rounded-lg border border-sub-border-slate-100 p-3 sm:flex-row sm:items-center dark:border-sub-border-strong">
				<div className="min-w-0 flex-1">
					<span className="block truncate body-md text-sub-text-primary">{invite.email}</span>
					<div className="mt-1 flex items-center gap-2">
						<span className={`body-sm ${isExpired ? 'text-data-down' : 'text-sub-text-muted'}`}>
							{/* An expired token can't be resent; the supported flow is revoke, then invite again. */}
							{isExpired
								? 'Expired — revoke this invite and send a new one'
								: `Expires ${formatDate(invite.expiresAt) ?? 'Unknown'}`}
						</span>
					</div>
					{resendInviteMutation.isError ? (
						<p role="alert" className="mt-1 body-sm text-data-down">
							{resendInviteMutation.error.message}
						</p>
					) : null}
				</div>
				<div className="flex gap-2 max-sm:*:flex-1">
					{!isExpired && (
						<Button
							type="button"
							size="md"
							onClick={handleResend}
							// The cooldown label says why it is disabled.
							disabled={onCooldown}
							pendingLabel={isResending ? 'Sending…' : null}
						>
							<Icon name="mail" height={14} width={14} />
							{onCooldown ? `Resend in ${remainingSeconds}s` : 'Resend'}
						</Button>
					)}
					<Button type="button" size="md" onClick={() => setShowRevokeConfirm(true)}>
						<Icon name="x" height={14} width={14} />
						Revoke
					</Button>
				</div>
			</div>

			<ConfirmDialog
				open={showRevokeConfirm}
				onClose={() => {
					revokeInviteMutation.reset()
					setShowRevokeConfirm(false)
				}}
				portal
				unmountOnHide
				finalFocus={finalFocus}
				title="Revoke invite"
				description={`Are you sure you want to revoke the invite for ${invite.email}?`}
				confirmLabel="Revoke"
				pendingLabel={revokeInviteMutation.isPending ? 'Revoking…' : null}
				error={revokeInviteMutation.isError ? revokeInviteMutation.error.message : null}
				onConfirm={() => {
					// Success drops this row, and mutate() callbacks with it; the returned promise still settles.
					revokeInviteMutation.mutateAsync({ inviteId: invite.id }).then(
						() => {
							setShowRevokeConfirm(false)
							toast.success('Invite revoked')
						},
						// The dialog shows the failure from the mutation state.
						() => {}
					)
				}}
			/>
		</>
	)
}

export function TeamInvitesCard() {
	const { pendingInvites } = useTeam()
	const inviteButtonRef = useRef<HTMLButtonElement>(null)
	const [showInviteModal, setShowInviteModal] = useState(false)

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Icon name="mail" height={20} width={20} className="text-sub-text-primary" />
					<span className="label-lg text-sub-text-primary">Pending Invites</span>
				</div>
				<Button
					type="button"
					variant="primary"
					size="md"
					ref={inviteButtonRef}
					onClick={() => setShowInviteModal(true)}
				>
					<Icon name="plus" height={14} width={14} />
					Invite Member
				</Button>
			</div>

			{pendingInvites.length === 0 ? (
				<p className="body-sm text-tertiary">No pending invites.</p>
			) : (
				<div className="flex flex-col gap-2">
					{pendingInvites.map((invite) => (
						<InviteRow key={invite.id} invite={invite} finalFocus={inviteButtonRef} />
					))}
				</div>
			)}

			{showInviteModal && <InviteMemberModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} />}
		</div>
	)
}
