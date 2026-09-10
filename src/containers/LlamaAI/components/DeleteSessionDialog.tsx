import * as Ariakit from '@ariakit/react'
import { createContext, useContext, type RefObject } from 'react'
import { Button } from '~/ui/Button'
import { DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { LoadingSpinner } from '~/ui/Loaders'

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
		<Ariakit.Dialog
			autoFocusOnHide={(element) => {
				// A successful deletion removes its trigger; return to the surviving list control.
				if (element) return true
				fallbackFocus?.current?.focus()
				return false
			}}
			store={store}
			finalFocus={finalFocus}
			hideOnEscape={!pending}
			hideOnInteractOutside={!pending}
			className={`${dialogSurfaceStyles} [--dialog-width:448px] max-sm:h-fit max-sm:min-h-0`}
		>
			<header className="shrink-0 border-b border-subtle p-3">
				<DialogHeading className="break-words">{title}</DialogHeading>
			</header>
			<div className={`${dialogScrollableBodyStyles} p-3`}>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					This permanently deletes the selected chat history. This cannot be undone.
				</Ariakit.DialogDescription>
				{error ? (
					<p role="alert" className="mt-3 body-sm text-data-down">
						{error.message} Try again.
					</p>
				) : null}
			</div>
			<footer className="flex shrink-0 justify-end gap-2 border-t border-subtle p-3">
				<Ariakit.DialogDismiss autoFocus disabled={pending} render={<Button size="md" />}>
					Cancel
				</Ariakit.DialogDismiss>
				<Ariakit.Button
					accessibleWhenDisabled
					type="button"
					disabled={pending}
					onClick={onConfirm}
					render={<Button size="md" variant="destructive" />}
				>
					{pending ? <LoadingSpinner size={14} /> : null}
					{pending ? 'Deleting…' : error ? 'Retry deletion' : 'Delete'}
				</Ariakit.Button>
			</footer>
			<span role="status" className="sr-only">
				{pending ? 'Deleting selected sessions' : ''}
			</span>
		</Ariakit.Dialog>
	)
}
