import * as Ariakit from '@ariakit/react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import {
	DialogCloseButton,
	DialogHeading,
	dialogScrollableBodyStyles,
	dialogSurfaceStyles,
	DialogFooter
} from '~/ui/Dialog'
import { LoadingSpinner } from '~/ui/Loaders'
import { getErrorMessage } from '~/utils/error'
import { useDeleteProject } from './hooks'
import type { Project } from './types'

interface DeleteProjectModalProps {
	dialogStore: Ariakit.DialogStore
	finalFocus?: React.RefObject<HTMLElement | null>
	fallbackFocus?: React.RefObject<HTMLElement | null>
	project: Project | null
	onDeleted?: () => void
}

export function DeleteProjectModal({
	dialogStore,
	project,
	onDeleted,
	finalFocus,
	fallbackFocus
}: DeleteProjectModalProps) {
	const remove = useDeleteProject()

	// This and isStillOpen read through an optional chain, which the compiler cannot lower inside a try
	// or catch, so the try calls out to them instead.
	const notifyDeleted = () => onDeleted?.()

	const onConfirm = async () => {
		if (!project || remove.isPending) return
		const contentElement = dialogStore.getState().contentElement
		// The dialog can close while the request is still running, which is why the check has to happen
		// after the await rather than before the try.
		const isStillOpen = () => contentElement?.isConnected === true
		try {
			await remove.mutateAsync(project.id)
			if (isStillOpen()) {
				dialogStore.hide()
				notifyDeleted()
			} else toast.success('Project deleted')
		} catch (error) {
			if (!isStillOpen()) toast.error(getErrorMessage(error))
		}
	}

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				finalFocus={finalFocus}
				autoFocusOnHide={(element) => {
					if (element) return true
					fallbackFocus?.current?.focus()
					return false
				}}
				onClose={() => remove.reset()}
				hideOnEscape={!remove.isPending}
				hideOnInteractOutside={!remove.isPending}
				className={`${dialogSurfaceStyles} [--dialog-width:448px]`}
			>
				<header className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<DialogHeading>Delete project?</DialogHeading>
					<DialogCloseButton disabled={remove.isPending} ariaLabel="Close delete project dialog" />
				</header>
				<div className={`${dialogScrollableBodyStyles} p-4`}>
					<Ariakit.DialogDescription className="body-sm text-secondary">
						{project?.name ? `“${project.name}” ` : 'This project '}
						will be soft-deleted and permanently removed in 14 days. Attached sessions remain.
					</Ariakit.DialogDescription>
					{remove.error ? (
						<p role="alert" className="mt-3 body-sm text-data-down">
							{remove.error.message} Try again.
						</p>
					) : null}
				</div>
				<DialogFooter>
					<Ariakit.DialogDismiss type="button" disabled={remove.isPending} autoFocus render={<Button size="md" />}>
						Cancel
					</Ariakit.DialogDismiss>
					<Ariakit.Button
						accessibleWhenDisabled
						type="button"
						onClick={() => {
							if (!project || remove.isPending) return
							void onConfirm()
						}}
						disabled={remove.isPending || !project}
						render={<Button size="md" variant="destructive" />}
					>
						{remove.isPending ? <LoadingSpinner size={14} /> : null}
						{remove.isPending ? 'Deleting…' : remove.error ? 'Retry deletion' : 'Delete project'}
					</Ariakit.Button>
				</DialogFooter>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
