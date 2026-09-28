import type { UseMutationResult } from '@tanstack/react-query'
import { useRef, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { ConfirmDialog } from './ConfirmDialog'

// Mount for one confirmation only. Request callbacks belong to that opening;
// cache updates belong to the caller's mutation and survive closing the page.
export function ConfirmActionDialog<TData, TVariables>({
	title,
	description,
	confirmLabel,
	pendingLabel,
	mutation,
	variables,
	onClose,
	onSuccess,
	finalFocus,
	fallbackFocus
}: {
	title: string
	description: string
	confirmLabel: string
	pendingLabel: string
	mutation: UseMutationResult<TData, Error, TVariables>
	variables: TVariables
	onClose: () => void
	onSuccess?: () => void
	finalFocus?: RefObject<HTMLElement | null>
	fallbackFocus?: RefObject<HTMLElement | null>
}) {
	const dialogRef = useRef<HTMLDivElement>(null)
	return (
		<ConfirmDialog
			ref={dialogRef}
			open
			onClose={onClose}
			finalFocus={finalFocus}
			autoFocusOnHide={(element) => {
				if (element) return true
				fallbackFocus?.current?.focus()
				return false
			}}
			title={title}
			description={description}
			confirmLabel={confirmLabel}
			pendingLabel={mutation.isPending ? pendingLabel : null}
			error={mutation.error?.message}
			onConfirm={() => {
				if (mutation.isPending) return
				void mutation.mutateAsync(variables).then(
					() => {
						if (!dialogRef.current?.isConnected) return
						onClose()
						onSuccess?.()
					},
					(error: Error) => {
						// The dialog shows the error while it is open; after it closes, only a toast can.
						if (!dialogRef.current?.isConnected) toast.error(error.message)
					}
				)
			}}
		/>
	)
}
