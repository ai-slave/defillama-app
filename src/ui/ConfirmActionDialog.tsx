import * as Ariakit from '@ariakit/react'
import type { UseMutationResult } from '@tanstack/react-query'
import { useRef, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Button } from './Button'
import { DialogFooter, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from './Dialog'
import { LoadingSpinner } from './Loaders'

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
		<Ariakit.Dialog
			ref={dialogRef}
			open
			onClose={onClose}
			role="alertdialog"
			finalFocus={finalFocus}
			autoFocusOnHide={(element) => {
				if (element) return true
				fallbackFocus?.current?.focus()
				return false
			}}
			hideOnEscape={!mutation.isPending}
			hideOnInteractOutside={!mutation.isPending}
			className={`${dialogSurfaceStyles} [--dialog-width:448px]`}
		>
			<header className="shrink-0 border-b border-subtle px-4 py-3">
				<DialogHeading className="break-words">{title}</DialogHeading>
			</header>
			<div className={`${dialogScrollableBodyStyles} px-4 py-3`}>
				<Ariakit.DialogDescription className="body-sm text-secondary">{description}</Ariakit.DialogDescription>
				{mutation.error ? (
					<p role="alert" className="mt-3 body-sm text-data-down">
						{mutation.error.message}
					</p>
				) : null}
			</div>
			<DialogFooter>
				<Ariakit.DialogDismiss autoFocus disabled={mutation.isPending} render={<Button size="md" />}>
					Cancel
				</Ariakit.DialogDismiss>
				<Ariakit.Button
					accessibleWhenDisabled
					disabled={mutation.isPending}
					render={<Button size="md" variant="destructive" />}
					onClick={() => {
						if (mutation.isPending) return
						void mutation.mutateAsync(variables).then(
							() => {
								if (!dialogRef.current?.isConnected) return
								onClose()
								onSuccess?.()
							},
							(error: Error) => {
								if (!dialogRef.current?.isConnected) toast.error(error.message)
							}
						)
					}}
				>
					{mutation.isPending ? <LoadingSpinner size={14} /> : null}
					{mutation.isPending ? pendingLabel : confirmLabel}
				</Ariakit.Button>
			</DialogFooter>
			<span role="status" className="sr-only">
				{mutation.isPending ? pendingLabel : ''}
			</span>
		</Ariakit.Dialog>
	)
}
