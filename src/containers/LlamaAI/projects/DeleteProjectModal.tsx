import * as Ariakit from '@ariakit/react'
import toast from 'react-hot-toast'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { useOpeningKey } from '~/ui/Dialog'
import { useDeleteProject } from './hooks'
import type { Project } from './types'

interface DeleteProjectModalProps {
	dialogStore: Ariakit.DialogStore
	finalFocus?: React.RefObject<HTMLElement | null>
	fallbackFocus?: React.RefObject<HTMLElement | null>
	project: Project | null
	onDeleted?: () => void
}

const DELETE_FAILED = "Couldn't delete this project. Try again."

// Each opening starts without the last opening's error, and a closing dialog keeps it through the fade-out.
export function DeleteProjectModal(props: DeleteProjectModalProps) {
	const open = Ariakit.useStoreState(props.dialogStore, 'open')
	return <DeleteProjectConfirm key={useOpeningKey(open)} {...props} />
}

function DeleteProjectConfirm({ dialogStore, project, onDeleted, finalFocus, fallbackFocus }: DeleteProjectModalProps) {
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
		} catch {
			// The dialog shows the error while it is open; after it closes, only a toast can.
			if (!isStillOpen()) toast.error(DELETE_FAILED)
		}
	}

	return (
		<ConfirmDialog
			store={dialogStore}
			finalFocus={finalFocus}
			autoFocusOnHide={(element) => {
				if (element) return true
				fallbackFocus?.current?.focus()
				return false
			}}
			title="Delete project?"
			description={`${project?.name ? `“${project.name}”` : 'This project'} will be soft-deleted and permanently removed in 14 days. Attached sessions remain.`}
			confirmLabel={remove.error ? 'Retry deletion' : 'Delete project'}
			pendingLabel={remove.isPending ? 'Deleting…' : null}
			error={remove.error ? DELETE_FAILED : null}
			onConfirm={() => void onConfirm()}
		/>
	)
}
