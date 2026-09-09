import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useId } from 'react'
import { refreshSession } from '~/auth/authStore'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import pb from '~/utils/pocketbase'

interface EmailChangeModalProps {
	isOpen: boolean
	onClose: () => void
}

export function EmailChangeModal({ isOpen, onClose }: EmailChangeModalProps) {
	const emailId = useId()
	const requestEmailChange = useMutation({
		mutationFn: async (nextEmail: string) => {
			await pb.collection('users').requestEmailChange(nextEmail)
			// The change request already succeeded; refreshSession only updates the cached user state, so
			// its failure must not fail the change.
			await refreshSession().catch(() => {})
		}
	})

	const handleClose = () => {
		requestEmailChange.reset()
		onClose()
	}

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (requestEmailChange.isPending) return
		requestEmailChange.mutate(new FormData(event.currentTarget).get('email') as string)
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && handleClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className="dialog max-h-[90vh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[331px]"
				portal
				unmountOnHide
			>
				<div className="flex flex-col gap-5 px-5 py-6">
					{/* Header */}
					<div className="flex items-center justify-between">
						<Ariakit.DialogHeading className="text-xl leading-7 font-semibold text-sub-text-primary">
							Change Your Email
						</Ariakit.DialogHeading>
						<Ariakit.DialogDismiss
							aria-label="Close email change"
							className="rounded-full p-1 text-sub-text-primary transition-colors"
						>
							<Icon name="x" height={24} width={24} />
						</Ariakit.DialogDismiss>
					</div>

					{requestEmailChange.isSuccess ? (
						<div className="flex flex-col items-center gap-4 text-center">
							<div className="flex items-center rounded-full bg-green-100 p-3 dark:bg-green-900/30">
								<Icon name="mail-rounded" height={24} width={24} className="text-success" />
							</div>
							<p id={`${emailId}-success`} className="text-sm leading-5 text-sub-text-primary">
								A confirmation link has been sent to <strong>{requestEmailChange.variables}</strong>. Please check your
								inbox to confirm the change.
							</p>
							<Ariakit.Button
								type="button"
								autoFocus
								onClick={handleClose}
								aria-describedby={`${emailId}-success`}
								className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand"
							>
								Done
							</Ariakit.Button>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="flex flex-col gap-5">
							<p role="status" className="sr-only">
								{requestEmailChange.isPending ? 'Sending confirmation email…' : ''}
							</p>
							<label htmlFor={emailId} className="text-sm leading-[21px] text-sub-text-primary">
								Enter your new email:
							</label>

							<div className="flex flex-col gap-2">
								<Ariakit.Focusable
									autoFocus
									render={
										<input
											type="email"
											readOnly={requestEmailChange.isPending}
											id={emailId}
											name="email"
											aria-describedby={requestEmailChange.isError ? `${emailId}-error` : undefined}
											required
											onChange={() => {
												if (requestEmailChange.isError) requestEmailChange.reset()
											}}
											placeholder="your.new.email@example.com"
											className="h-10 w-full rounded-lg border border-sub-border-muted bg-sub-surface-panel px-3 text-sm leading-[21px] text-sub-text-primary outline-hidden user-invalid:border-error focus:border-sub-brand-primary user-invalid:focus:border-error dark:border-sub-border-strong dark:bg-sub-dark-page dark:user-invalid:border-error"
										/>
									}
								/>
								{requestEmailChange.isError && (
									<p id={`${emailId}-error`} role="alert" className="text-xs leading-4 text-error">
										Could not send the confirmation email. Please check the address and try again.
									</p>
								)}
							</div>

							<Ariakit.Button
								accessibleWhenDisabled
								type="submit"
								disabled={requestEmailChange.isPending}
								className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand aria-disabled:opacity-25"
							>
								{requestEmailChange.isPending ? <LoadingSpinner size={14} /> : null}
								{requestEmailChange.isPending ? 'Sending…' : 'Confirm Email'}
							</Ariakit.Button>
						</form>
					)}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
