import type { UseMutationResult } from '@tanstack/react-query'
import { createContext, useContext, type RefObject } from 'react'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'

export const SessionListFocusContext = createContext<RefObject<HTMLElement | null> | null>(null)

// Mount for one confirmation only, like ConfirmActionDialog.
export function DeleteSessionDialog<TVariables>({
	title,
	mutation,
	variables,
	onClose,
	onSuccess,
	finalFocus
}: {
	title: string
	mutation: UseMutationResult<unknown, Error, TVariables>
	variables: TVariables
	onClose: () => void
	onSuccess?: () => void
	finalFocus?: RefObject<HTMLElement | null>
}) {
	const fallbackFocus = useContext(SessionListFocusContext)
	return (
		<ConfirmActionDialog
			finalFocus={finalFocus}
			autoFocusOnHide={(element) => {
				// A successful deletion removes its trigger; return to the surviving list control.
				if (element) return true
				fallbackFocus?.current?.focus()
				return false
			}}
			title={title}
			description="This permanently deletes the selected chat history."
			confirmLabel="Delete"
			pendingLabel="Deleting…"
			mutation={mutation}
			variables={variables}
			onClose={onClose}
			onSuccess={onSuccess}
		/>
	)
}
