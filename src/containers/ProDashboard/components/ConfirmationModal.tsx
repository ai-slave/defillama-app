import type { RefObject } from 'react'
import { ConfirmDialog } from '~/ui/ConfirmDialog'

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
	title: string
	message: string
	confirmText?: string
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
	title,
	message,
	confirmText = 'Confirm',
	tone = 'danger'
}: ConfirmationModalProps) {
	return (
		<ConfirmDialog
			open={isOpen}
			onClose={onClose}
			portal
			unmountOnHide
			scope="pro"
			finalFocus={finalFocus}
			autoFocusOnHide={(element) => {
				if (element?.isConnected) return true
				fallbackFocus?.current?.focus()
				return false
			}}
			title={title}
			description={message}
			confirmLabel={confirmText}
			pendingLabel={pending ? pendingText : null}
			error={error}
			tone={tone === 'danger' ? 'destructive' : 'primary'}
			onConfirm={() => {
				onConfirm()
				if (closeOnConfirm) onClose()
			}}
		/>
	)
}
