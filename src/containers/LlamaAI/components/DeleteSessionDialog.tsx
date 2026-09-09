import * as Ariakit from '@ariakit/react'
import { createContext, useContext, type RefObject } from 'react'
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
			className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ai-line bg-surface p-5 shadow-2xl"
			backdrop={<div className="fixed inset-0 z-50 bg-ai-backdrop backdrop-blur-md" />}
		>
			<Ariakit.DialogHeading className="text-base font-semibold text-primary">{title}</Ariakit.DialogHeading>
			<Ariakit.DialogDescription className="mt-2 text-sm text-ai-secondary">
				This permanently deletes the selected chat history. This cannot be undone.
			</Ariakit.DialogDescription>
			{error ? (
				<p role="alert" className="mt-3 text-sm text-ai-error">
					{error.message} Try again.
				</p>
			) : null}
			<div className="mt-5 flex justify-end gap-2">
				<Ariakit.DialogDismiss
					autoFocus
					disabled={pending}
					className="rounded-md px-3 py-2 text-sm hover:bg-ai-surface-muted"
				>
					Cancel
				</Ariakit.DialogDismiss>
				<Ariakit.Button
					accessibleWhenDisabled
					type="button"
					disabled={pending}
					onClick={onConfirm}
					className="flex items-center gap-2 rounded-md bg-ai-error-vivid/10 px-3 py-2 text-sm font-medium text-ai-error aria-disabled:opacity-50"
				>
					{pending ? <LoadingSpinner size={14} /> : null}
					{pending ? 'Deleting…' : error ? 'Retry deletion' : 'Delete'}
				</Ariakit.Button>
			</div>
			<span role="status" className="sr-only">
				{pending ? 'Deleting selected sessions' : ''}
			</span>
		</Ariakit.Dialog>
	)
}
