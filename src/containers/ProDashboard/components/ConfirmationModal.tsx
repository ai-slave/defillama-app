import * as Ariakit from '@ariakit/react'
import type { RefObject } from 'react'
import { ProButton, ProDialog } from '../ui'

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
	tone?: 'danger' | 'primary'
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
	tone = 'danger'
}: ConfirmationModalProps) {
	return (
		<Ariakit.DialogProvider
			open={isOpen}
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<ProDialog
				width="sm"
				heading={title}
				finalFocus={finalFocus}
				autoFocusOnHide={(element) => {
					if (element?.isConnected) return true
					fallbackFocus?.current?.focus()
					return false
				}}
				closeButtonProps={{ disabled: pending, ariaLabel: 'Close modal' }}
				hideOnEscape={!pending}
				hideOnInteractOutside={!pending}
				footer={
					<>
						<Ariakit.DialogDismiss
							autoFocus
							disabled={pending}
							render={<ProButton type="button" variant="secondary" size="md" />}
						>
							{cancelText}
						</Ariakit.DialogDismiss>
						<Ariakit.Button
							accessibleWhenDisabled
							disabled={pending}
							render={<ProButton type="button" variant={tone} size="md" {...(pending ? { loading: true } : {})} />}
							onClick={() => {
								onConfirm()
								if (closeOnConfirm) onClose()
							}}
						>
							{pending ? pendingText : confirmText}
						</Ariakit.Button>
					</>
				}
			>
				<Ariakit.DialogDescription className="text-pro-text-secondary">{message}</Ariakit.DialogDescription>
				{error ? (
					<p role="alert" className="mt-4 text-sm text-error">
						{error}
					</p>
				) : null}
				<span role="status" className="sr-only">
					{pending ? pendingText : ''}
				</span>
			</ProDialog>
		</Ariakit.DialogProvider>
	)
}
