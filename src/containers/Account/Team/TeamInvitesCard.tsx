import { useRef, useState, type RefObject } from 'react'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { focusRegionOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { formatDate, parseDateTimestamp } from '~/utils/dateFormat'
import { InviteMemberModal } from './InviteMemberModal'
import type { TeamInvite } from './types'
import { useTeam } from './useTeam'

const RESEND_COOLDOWN_MS = 60_000

function InviteRow({ invite, finalFocus }: { invite: TeamInvite; finalFocus: RefObject<HTMLElement | null> }) {
	const { revokeInviteMutation, resendInviteMutation } = useTeam()
	const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
	const revokeFocusRef = useRef<HTMLElement | null>(null)
	const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
	// Not the mutation's own error: that one clears as soon as a retry starts.
	const [resendError, setResendError] = useState<string | null>(null)
	const isResending = resendInviteMutation.isPending && resendInviteMutation.variables?.inviteId === invite.id
	// The account page renders on the client only, so no page clock is needed. A resend switches the clock to
	// seconds while it runs, so the cooldown starts against a current second.
	const nowSeconds = useNowSeconds(undefined, isResending || cooldownUntil !== null ? 1000 : 60_000)
	const remainingSeconds = cooldownUntil === null ? 0 : Math.max(0, Math.floor(cooldownUntil / 1000) - nowSeconds)
	const onCooldown = remainingSeconds > 0
	// An elapsed cooldown lets the clock slow down again.
	if (cooldownUntil !== null && !onCooldown) setCooldownUntil(null)

	const handleResend = () => {
		resendInviteMutation.mutate(
			{ inviteId: invite.id },
			{
				onSuccess: () => {
					setResendError(null)
					setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS)
				},
				onError: (error) => setResendError(error.message)
			}
		)
	}

	const expiresAt = parseDateTimestamp(invite.expiresAt)
	const isExpired = expiresAt != null && expiresAt <= nowSeconds * 1000

	return (
		<>
			{/* Phones stack the actions under the invite, so the address, expiry and any error keep the full width. */}
			<div className="flex flex-col gap-3 rounded-lg border border-subtle p-3 sm:flex-row sm:items-center">
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="block truncate body-md text-primary">{invite.email}</span>
					<div className="flex items-center gap-2">
						<span className={`body-sm ${isExpired ? 'text-error' : 'text-tertiary'}`}>
							{/* An expired token can't be resent; the supported flow is revoke, then invite again. */}
							{isExpired
								? 'Expired — revoke this invite and send a new one'
								: `Expires ${formatDate(invite.expiresAt) ?? 'Unknown'}`}
						</span>
					</div>
					{resendError ? <InlineStatus variant="error">{resendError}</InlineStatus> : null}
				</div>
				<div className="flex gap-2 max-sm:*:flex-1">
					{!isExpired && (
						// The cooldown label says why it is disabled. It starts while the button has focus, so the button
						// stays focusable.
						<Button
							// The invite can expire while Resend has focus, and the button leaves with it.
							ref={focusRegionOnLeave}
							type="button"
							size="md"
							pendingLabel="Sending…"
							pending={isResending}
							disabled={onCooldown}
							accessibleWhenDisabled
							onClick={handleResend}
						>
							<Icon name="mail" className="size-3.5" />
							{onCooldown ? `Resend in ${remainingSeconds}s` : 'Resend'}
						</Button>
					)}
					<Button
						type="button"
						size="md"
						onClick={(event) => {
							revokeFocusRef.current = event.currentTarget
							setShowRevokeConfirm(true)
						}}
					>
						<Icon name="x" className="size-3.5" />
						Revoke
					</Button>
				</div>
			</div>

			{showRevokeConfirm ? (
				<ConfirmActionDialog
					finalFocus={revokeFocusRef}
					title="Revoke invite"
					description={`Are you sure you want to revoke the invite for ${invite.email}?`}
					confirmLabel="Revoke"
					pendingLabel="Revoking…"
					errorMessage="Couldn't revoke the invite."
					mutation={revokeInviteMutation}
					variables={{ inviteId: invite.id }}
					onClose={() => setShowRevokeConfirm(false)}
					onSuccess={() => {
						// Success removes this row and its Revoke button.
						revokeFocusRef.current = finalFocus.current
					}}
					successMessage="Invite revoked"
				/>
			) : null}
		</>
	)
}

export function TeamInvitesCard() {
	const { pendingInvites } = useTeam()
	const inviteButtonRef = useRef<HTMLButtonElement>(null)
	const [showInviteModal, setShowInviteModal] = useState(false)

	return (
		<Card padding="md" className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Icon name="mail" className="size-5 text-primary" />
					<span className="label-lg text-primary">Pending invites</span>
				</div>
				<Button
					type="button"
					variant="primary"
					size="md"
					ref={inviteButtonRef}
					onClick={() => setShowInviteModal(true)}
				>
					<Icon name="plus" className="size-3.5" />
					Invite member
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

			{showInviteModal ? <InviteMemberModal onClose={() => setShowInviteModal(false)} /> : null}
		</Card>
	)
}
