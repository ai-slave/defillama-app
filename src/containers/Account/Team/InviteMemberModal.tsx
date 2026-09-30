import * as Ariakit from '@ariakit/react'
import { useId, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { useTeam } from './useTeam'

interface InviteMemberModalProps {
	isOpen: boolean
	onClose: () => void
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
	const { inviteMemberMutation } = useTeam()
	const emailId = useId()
	const pending = inviteMemberMutation.isPending

	const handleClose = () => {
		if (pending) return
		inviteMemberMutation.reset()
		onClose()
	}

	const handleInvite = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (pending) return
		const email = String(new FormData(event.currentTarget).get('email')).trim()
		inviteMemberMutation.mutate(
			{ email },
			{
				// Confirm only once the dialog is gone, so the toast never sits over it.
				onSuccess: () => {
					onClose()
					toast.success('Invite sent')
				}
			}
		)
	}

	return (
		<Dialog size="sm" open={isOpen} onClose={handleClose} pending={pending} portal unmountOnHide>
			<form onSubmit={handleInvite} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title="Invite member" />
				<DialogBody>
					<p className="body-sm text-secondary">
						Enter the email address of the person you want to invite. They will receive an email with a link to join
						your team.
					</p>
					<div className="flex flex-col gap-1.5">
						<label htmlFor={emailId} className="label-sm text-secondary">
							Email address
						</label>
						<div className="relative">
							<Icon name="mail" height={16} width={16} className={searchFieldIconStyles} />
							{/* Ariakit's autoFocus, so the dialog starts on the field instead of its first button, the ×. */}
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										id={emailId}
										name="email"
										type="email"
										required
										readOnly={pending}
										placeholder="colleague@example.com"
										className="w-full pl-8"
									/>
								}
							/>
						</div>
					</div>
					{inviteMemberMutation.isError ? (
						<InlineStatus variant="error">{inviteMemberMutation.error.message}</InlineStatus>
					) : null}
				</DialogBody>
				<DialogFooter
					dismiss={
						<Button type="button" size="md" onClick={handleClose} disabled={pending}>
							Cancel
						</Button>
					}
				>
					<Button type="submit" variant="primary" size="md" pendingLabel={pending ? 'Sending…' : null}>
						Send invite
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{pending ? 'Sending invite' : ''}
				</span>
			</form>
		</Dialog>
	)
}
