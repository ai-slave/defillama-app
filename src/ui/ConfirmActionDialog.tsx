import type { UseMutationResult } from '@tanstack/react-query'
import { useRef, useState, type ComponentProps } from 'react'
import toast from 'react-hot-toast'
import { ConfirmDialog } from './ConfirmDialog'

// Mount for one confirmation only. Request callbacks and the error belong to that opening; cache updates belong to
// the caller's mutation and survive closing the page.
export function ConfirmActionDialog<TData, TVariables>({
	pendingLabel,
	mutation,
	variables,
	onClose,
	onSuccess,
	successMessage,
	...props
}: {
	pendingLabel: string
	mutation: UseMutationResult<TData, Error, TVariables>
	variables: TVariables
	onClose: () => void
	/** Runs after the dialog closes on success. Skipped when the dialog left the page first. */
	onSuccess?: () => void
	/** A toast once the action succeeds, also when the dialog left the page before the request settled. */
	successMessage?: string
} & Omit<ComponentProps<typeof ConfirmDialog>, 'open' | 'store' | 'onClose' | 'pendingLabel' | 'error' | 'onConfirm'>) {
	const dialogRef = useRef<HTMLDivElement>(null)
	// Not the mutation's own error: that one clears when a retry starts, and it outlives this opening.
	const [shownError, setShownError] = useState<string | null>(null)
	return (
		<ConfirmDialog
			{...props}
			ref={dialogRef}
			open
			onClose={onClose}
			pendingLabel={mutation.isPending ? pendingLabel : null}
			error={shownError}
			onConfirm={() => {
				void mutation.mutateAsync(variables).then(
					() => {
						if (dialogRef.current?.isConnected) {
							onClose()
							onSuccess?.()
						}
						if (successMessage) toast.success(successMessage)
					},
					(error: Error) => {
						// The dialog shows the error while it is open; after it closes, only a toast can.
						if (dialogRef.current?.isConnected) setShownError(error.message)
						else toast.error(error.message)
					}
				)
			}}
		/>
	)
}
