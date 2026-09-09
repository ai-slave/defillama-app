import * as Ariakit from '@ariakit/react'
import type { UseMutationResult } from '@tanstack/react-query'
import { useRef, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '~/ui/Loaders'

// The parent mounts this dialog only for the current target and removes it on close.
export function ProjectSourceDeleteDialog({
	target,
	mutation,
	fallbackFocus,
	onClose
}: {
	target: { kind: 'file' | 'source'; id: string; name: string; trigger: HTMLButtonElement }
	mutation: UseMutationResult<void, Error, string>
	fallbackFocus: RefObject<HTMLButtonElement | null>
	onClose: () => void
}) {
	const returnFocus = useRef<HTMLElement | null>(target.trigger)
	const dialogRef = useRef<HTMLDivElement>(null)
	const action = target.kind === 'file' ? 'Delete' : 'Disconnect'
	return (
		<Ariakit.Dialog
			ref={dialogRef}
			open
			onClose={onClose}
			role="alertdialog"
			finalFocus={returnFocus}
			hideOnEscape={!mutation.isPending}
			hideOnInteractOutside={!mutation.isPending}
			className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ai-line bg-surface p-5 shadow-2xl"
			backdrop={<div className="fixed inset-0 z-50 bg-ai-backdrop backdrop-blur-md" />}
		>
			<Ariakit.DialogHeading className="text-base font-semibold break-words text-primary">
				{action} {target.name}?
			</Ariakit.DialogHeading>
			<Ariakit.DialogDescription className="mt-2 text-sm text-ai-secondary">
				{target.kind === 'file'
					? 'This removes the file from this project. Upload it again to restore it.'
					: 'This removes the source and its files from this project. The GitHub repository stays unchanged.'}
			</Ariakit.DialogDescription>
			{mutation.error ? (
				<p role="alert" className="mt-3 text-sm text-ai-error">
					{mutation.error.message}
				</p>
			) : null}
			<div className="mt-5 flex justify-end gap-2">
				<Ariakit.DialogDismiss
					autoFocus
					disabled={mutation.isPending}
					className="rounded-md px-3 py-2 text-sm hover:bg-ai-surface-muted"
				>
					Cancel
				</Ariakit.DialogDismiss>
				<Ariakit.Button
					type="button"
					accessibleWhenDisabled
					disabled={mutation.isPending}
					onClick={() => {
						if (mutation.isPending) return
						void mutation.mutateAsync(target.id).then(
							() => {
								if (!dialogRef.current?.isConnected) return
								returnFocus.current = fallbackFocus.current
								onClose()
							},
							(error: Error) => {
								if (!dialogRef.current?.isConnected) toast.error(error.message)
							}
						)
					}}
					className="flex items-center gap-2 rounded-md bg-ai-error-vivid/10 px-3 py-2 text-sm font-medium text-ai-error aria-disabled:opacity-50"
				>
					{mutation.isPending ? <LoadingSpinner size={14} /> : null}
					{mutation.isPending ? (target.kind === 'file' ? 'Deleting…' : 'Disconnecting…') : action}
				</Ariakit.Button>
			</div>
			<span role="status" className="sr-only">
				{mutation.isPending ? `${action} in progress` : ''}
			</span>
		</Ariakit.Dialog>
	)
}
