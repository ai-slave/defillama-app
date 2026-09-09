import * as Ariakit from '@ariakit/react'
import type { RefObject } from 'react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'

interface ConfirmationModalProps {
	finalFocus?: RefObject<HTMLElement | null>
	fallbackFocus?: RefObject<HTMLElement | null>
	pending?: boolean
	pendingText?: string
	error?: string | null
	closeOnConfirm?: boolean
	isOpen: boolean
	onClose: () => void
	onConfirm: () => void
	title?: string
	message?: string
	confirmText?: string
	cancelText?: string
	confirmButtonClass?: string
}

export function ConfirmationModal({
	finalFocus,
	fallbackFocus,
	pending = false,
	pendingText = 'Working…',
	error,
	closeOnConfirm = true,
	isOpen,
	onClose,
	onConfirm,
	title = 'Confirm Action',
	message = 'Are you sure you want to proceed with this action?',
	confirmText = 'Confirm',
	cancelText = 'Cancel',
	confirmButtonClass = 'bg-error hover:bg-red-600 text-on-brand'
}: ConfirmationModalProps) {
	return (
		<Ariakit.DialogProvider
			open={isOpen}
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<Ariakit.Dialog
				finalFocus={finalFocus}
				autoFocusOnHide={(element) => {
					if (element) return true
					fallbackFocus?.current?.focus()
					return false
				}}
				className="dialog w-full max-w-sm gap-0 border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-6 shadow-2xl"
				unmountOnHide
				portal
				hideOnEscape={!pending}
				hideOnInteractOutside={!pending}
			>
				<div className="mb-6 flex items-center justify-between">
					<Ariakit.DialogHeading className="text-xl font-semibold text-pro-text-primary">{title}</Ariakit.DialogHeading>
					<Ariakit.DialogDismiss
						disabled={pending}
						className="rounded-md pro-hover-bg p-1 text-pro-text-primary transition-colors"
						aria-label="Close modal"
					>
						<Icon name="x" height={20} width={20} />
					</Ariakit.DialogDismiss>
				</div>

				<Ariakit.DialogDescription className="mb-6 text-pro-text-secondary">{message}</Ariakit.DialogDescription>
				{error ? (
					<p role="alert" className="mb-4 text-sm text-error">
						{error}
					</p>
				) : null}

				<div className="flex justify-end gap-3">
					<Ariakit.DialogDismiss
						autoFocus
						disabled={pending}
						className="rounded-md border pro-border pro-hover-bg px-4 py-2 text-sm text-pro-text-secondary transition-colors hover:text-pro-text-primary"
					>
						{cancelText}
					</Ariakit.DialogDismiss>
					<Ariakit.Button
						accessibleWhenDisabled
						disabled={pending}
						type="button"
						onClick={() => {
							onConfirm()
							if (closeOnConfirm) onClose()
						}}
						className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors aria-disabled:opacity-50 ${confirmButtonClass}`}
					>
						{pending ? <LoadingSpinner size={14} /> : null}
						{pending ? pendingText : confirmText}
					</Ariakit.Button>
				</div>
				<span role="status" className="sr-only">
					{pending ? pendingText : ''}
				</span>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
