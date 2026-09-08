import * as Ariakit from '@ariakit/react'
import { useId, type FormEvent } from 'react'
import { DialogHeading } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { useTeam } from './useTeam'

interface InviteMemberModalProps {
	isOpen: boolean
	onClose: () => void
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
	const { inviteMemberMutation } = useTeam()
	const emailId = useId()

	const handleClose = () => {
		if (inviteMemberMutation.isPending) return
		inviteMemberMutation.reset()
		onClose()
	}

	const handleInvite = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (inviteMemberMutation.isPending) return
		const email = String(new FormData(event.currentTarget).get('email')).trim()
		inviteMemberMutation.mutate({ email }, { onSuccess: onClose })
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && handleClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className="dialog h-fit max-h-[90dvh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[380px]"
				hideOnEscape={!inviteMemberMutation.isPending}
				hideOnInteractOutside={!inviteMemberMutation.isPending}
				portal
				unmountOnHide
			>
				<form onSubmit={handleInvite} className="flex flex-col gap-5 bg-white px-5 py-6 dark:bg-sub-surface-dark">
					<div className="flex items-center justify-between">
						<DialogHeading className="text-base font-semibold text-sub-text-primary">Invite Member</DialogHeading>
						<Ariakit.DialogDismiss
							aria-label="Close"
							disabled={inviteMemberMutation.isPending}
							className="flex size-8 shrink-0 items-center justify-center rounded-full text-sub-text-muted transition-colors hover:text-sub-text-primary"
						>
							<Icon name="x" height={18} width={18} />
						</Ariakit.DialogDismiss>
					</div>
					<p className="text-sm text-sub-text-muted">
						Enter the email address of the person you want to invite. They will receive an email with a link to join
						your team.
					</p>
					<div className="flex flex-col gap-1.5">
						<label htmlFor={emailId} className="text-xs font-medium text-sub-text-muted">
							Email address
						</label>
						<div className="relative">
							<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sub-text-muted">
								<Icon name="mail" height={16} width={16} />
							</div>
							<Ariakit.Focusable
								render={
									<input
										id={emailId}
										name="email"
										required
										readOnly={inviteMemberMutation.isPending}
										type="email"
										placeholder="colleague@example.com"
									/>
								}
								className="w-full rounded-lg border border-sub-border-slate-100 bg-white py-2 pr-3 pl-9 text-sm text-sub-text-primary placeholder:text-sub-text-muted user-invalid:border-error focus:border-sub-brand-primary focus:ring-1 focus:ring-sub-brand-primary focus:outline-hidden dark:border-sub-border-strong dark:bg-sub-surface-dark"
								autoFocus
							/>
						</div>
					</div>
					{inviteMemberMutation.isError ? (
						<div
							role="alert"
							className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error"
						>
							<Icon name="alert-warning" height={16} width={16} className="shrink-0" />
							<p className="text-sm">{inviteMemberMutation.error.message}</p>
						</div>
					) : null}
					<div className="flex gap-3">
						<Ariakit.Button
							type="button"
							onClick={handleClose}
							disabled={inviteMemberMutation.isPending}
							className="flex h-9 flex-1 items-center justify-center rounded-lg border border-sub-border-muted text-sm font-medium text-sub-text-primary dark:border-sub-border-strong"
						>
							Cancel
						</Ariakit.Button>
						<Ariakit.Button
							type="submit"
							accessibleWhenDisabled
							disabled={inviteMemberMutation.isPending}
							className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand disabled:opacity-50 aria-disabled:opacity-50"
						>
							{inviteMemberMutation.isPending ? <LoadingSpinner size={14} /> : null}
							{inviteMemberMutation.isPending ? 'Sending...' : 'Send Invite'}
						</Ariakit.Button>
					</div>
					<span role="status" className="sr-only">
						{inviteMemberMutation.isPending ? 'Sending invite' : ''}
					</span>
				</form>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
