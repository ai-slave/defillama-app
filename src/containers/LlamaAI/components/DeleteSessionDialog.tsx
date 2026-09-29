import type * as Ariakit from '@ariakit/react'
import { createContext, useContext, type RefObject } from 'react'
import { ConfirmDialog } from '~/ui/ConfirmDialog'

export const SessionListFocusContext = createContext<RefObject<HTMLElement | null> | null>(null)

export function DeleteSessionDialog({
	store,
	title,
	pending,
	error,
	onConfirm,
	finalFocus
}: {
	store: Ariakit.DialogStore
	title: string
	pending: boolean
	error: Error | null
	onConfirm: () => void
	finalFocus?: React.RefObject<HTMLElement | null>
}) {
	const fallbackFocus = useContext(SessionListFocusContext)
	return (
		<ConfirmDialog
			store={store}
			unmountOnHide
			finalFocus={finalFocus}
			autoFocusOnHide={(element) => {
				// A successful deletion removes its trigger; return to the surviving list control.
				if (element) return true
				fallbackFocus?.current?.focus()
				return false
			}}
			title={title}
			description="This permanently deletes the selected chat history."
			confirmLabel={error ? 'Retry deletion' : 'Delete'}
			pendingLabel={pending ? 'Deleting…' : null}
			// The confirm button already offers the retry, so the message is the error alone.
			error={error?.message}
			onConfirm={onConfirm}
		/>
	)
}
