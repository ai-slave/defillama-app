import * as Ariakit from '@ariakit/react'
import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
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

	const onConfirm = async () => {
		if (!project || remove.isPending) return
		const contentElement = dialogStore.getState().contentElement
		// Both read through an optional chain, which the compiler cannot lower inside a try or catch, so
		// they are called out to instead. The dialog can close while the request is still running, which
		// is why the check has to happen after the await rather than before the try.
		const isStillOpen = () => contentElement?.isConnected === true
		const notifyDeleted = () => onDeleted?.()
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
				className="fixed top-1/2 left-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ai-line bg-surface p-5 shadow-2xl"
				backdrop={<div className="backdrop fixed inset-0 bg-ai-backdrop backdrop-blur-md" />}
			>
				<header className="flex items-start justify-between">
					<div>
						<Ariakit.DialogHeading className="text-base font-semibold text-primary">
							Delete project?
						</Ariakit.DialogHeading>
						<p className="mt-0.5 text-xs text-ai-tertiary">
							{project?.name ? `“${project.name}” ` : 'This project '}
							will be soft-deleted and permanently removed in 14 days. Attached sessions remain.
						</p>
					</div>
					<Ariakit.DialogDismiss
						disabled={remove.isPending}
						aria-label="Close delete project dialog"
						className="-mr-1.5 rounded-lg p-2 text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-primary"
					>
						<Icon name="x" height={16} width={16} />
					</Ariakit.DialogDismiss>
				</header>

				{remove.error ? (
					<p role="alert" className="mt-3 text-sm text-ai-error">
						{remove.error.message} Try again.
					</p>
				) : null}
				<footer className="mt-5 flex justify-end gap-2">
					<Ariakit.DialogDismiss
						type="button"
						disabled={remove.isPending}
						autoFocus
						className="rounded-md px-3 py-1.5 text-xs text-ai-tertiary hover:bg-ai-surface-muted"
					>
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
						className="flex items-center gap-1.5 rounded-md bg-ai-error-vivid/10 px-3 py-1.5 text-xs font-medium text-ai-error transition-colors hover:bg-ai-error-vivid/20 disabled:opacity-50"
					>
						{remove.isPending ? <LoadingSpinner size={12} /> : null}
						{remove.isPending ? 'Deleting…' : remove.error ? 'Retry deletion' : 'Delete project'}
					</Ariakit.Button>
				</footer>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
