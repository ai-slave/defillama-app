import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { refreshSession } from '~/auth/authStore'
import { Icon } from '~/ui/Icon'
import pb from '~/utils/pocketbase'

interface EmailChangeModalProps {
	isOpen: boolean
	onClose: () => void
}

export function EmailChangeModal({ isOpen, onClose }: EmailChangeModalProps) {
	const [email, setEmail] = useState('')
	const [error, setError] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)

	const handleClose = () => {
		setEmail('')
		setError('')
		setIsSuccess(false)
		onClose()
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!email || isLoading) return

		setError('')
		setIsLoading(true)
		try {
			await pb.collection('users').requestEmailChange(email)
			// Refresh auth to update user state (verified will become false for new email)
			try {
				await refreshSession()
			} catch {}
			setIsSuccess(true)
		} catch {
			setError('This email is already associated with another account.')
		} finally {
			setIsLoading(false)
		}
	}

	const hasError = !!error
	const canSubmit = !!email && !hasError && !isLoading

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
						<h3 className="text-xl leading-7 font-semibold text-sub-text-primary">Change Your Email</h3>
						<Ariakit.DialogDismiss className="rounded-full p-1 text-sub-text-primary transition-colors">
							<Icon name="x" height={24} width={24} />
						</Ariakit.DialogDismiss>
					</div>

					{isSuccess ? (
						<div className="flex flex-col items-center gap-4 text-center">
							<div className="flex items-center rounded-full bg-green-100 p-3 dark:bg-green-900/30">
								<Icon name="mail-rounded" height={24} width={24} className="text-success" />
							</div>
							<p className="text-sm leading-5 text-sub-text-primary">
								A confirmation link has been sent to <strong>{email}</strong>. Please check your inbox to confirm the
								change.
							</p>
							<button
								type="button"
								onClick={handleClose}
								className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand"
							>
								Done
							</button>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="flex flex-col gap-5">
							<label className="text-sm leading-[21px] text-sub-text-primary">Enter your new email:</label>

							<div className="flex flex-col gap-2">
								<input
									type="email"
									required
									value={email}
									onChange={(e) => {
										setEmail(e.target.value)
										if (error) setError('')
									}}
									placeholder="your.new.email@example.com"
									className={`h-10 w-full rounded-lg border bg-sub-surface-panel px-3 text-sm leading-[21px] text-sub-text-primary outline-hidden dark:bg-sub-dark-page ${
										hasError
											? 'border-error'
											: 'border-sub-border-muted focus:border-sub-brand-primary dark:border-sub-border-strong dark:focus:border-sub-brand-primary'
									}`}
								/>
								{hasError && <p className="text-xs leading-4 text-error">{error}</p>}
							</div>

							<button
								type="submit"
								disabled={!canSubmit}
								className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand disabled:opacity-25"
							>
								{isLoading ? 'Sending...' : 'Confirm Email'}
							</button>
						</form>
					)}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
