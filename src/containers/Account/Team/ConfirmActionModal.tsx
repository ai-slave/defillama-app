import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'

interface ConfirmActionModalProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: () => void
	isLoading: boolean
	title: string
	description: string
	confirmLabel: string
	confirmVariant?: 'danger' | 'primary'
	// Failure of the confirmed action, shown inside the dialog instead of a toast
	error?: string | null
}

export function ConfirmActionModal({
	isOpen,
	onClose,
	onConfirm,
	isLoading,
	title,
	description,
	confirmLabel,
	confirmVariant = 'primary',
	error
}: ConfirmActionModalProps) {
	const isDanger = confirmVariant === 'danger'

	return (
		// Dismissal is blocked while the action runs: the error renders in here,
		// and a dismissed dialog would leave a failure with no feedback anywhere.
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && !isLoading && onClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className="dialog max-h-[90vh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[380px]"
				portal
				unmountOnHide
			>
				<div className="flex flex-col gap-5 bg-white px-5 py-6 dark:bg-sub-surface-dark">
					<div className="flex items-center justify-between">
						<h2 className="text-base font-semibold text-sub-text-primary">{title}</h2>
						<Ariakit.DialogDismiss
							disabled={isLoading}
							className="rounded-full p-1 text-sub-text-muted transition-colors hover:text-sub-text-primary disabled:opacity-50"
						>
							<Icon name="x" height={18} width={18} />
						</Ariakit.DialogDismiss>
					</div>
					<p className="text-sm text-sub-text-muted">{description}</p>
					{error ? (
						<div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error">
							<Icon name="alert-warning" height={16} width={16} className="shrink-0" />
							<p className="text-sm">{error}</p>
						</div>
					) : null}
					<div className="flex gap-3">
						<button
							onClick={onClose}
							disabled={isLoading}
							className="flex h-9 flex-1 items-center justify-center rounded-lg border border-sub-border-muted text-sm font-medium text-sub-text-primary disabled:opacity-50 dark:border-sub-border-strong"
						>
							Cancel
						</button>
						<button
							onClick={onConfirm}
							disabled={isLoading}
							className={`flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-medium text-on-brand disabled:opacity-50 ${
								isDanger ? 'bg-error' : 'bg-sub-brand-primary'
							}`}
						>
							{isLoading ? 'Loading...' : confirmLabel}
						</button>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
