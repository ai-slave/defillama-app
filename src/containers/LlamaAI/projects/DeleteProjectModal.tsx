import type { RefObject } from 'react'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { useDeleteProject } from './hooks'
import type { Project } from './types'

// Mount for one confirmation only, like ConfirmActionDialog.
export function DeleteProjectModal({
	project,
	onClose,
	onDeleted,
	finalFocus
}: {
	project: Project
	onClose: () => void
	/** Runs once the dialog closed on success, not when it left the page first. */
	onDeleted?: () => void
	finalFocus?: RefObject<HTMLElement | null>
}) {
	const remove = useDeleteProject()
	return (
		<ConfirmActionDialog
			finalFocus={finalFocus}
			title="Delete project?"
			description={`“${project.name}” will be soft-deleted and permanently removed in 14 days. Attached sessions remain.`}
			confirmLabel="Delete project"
			pendingLabel="Deleting…"
			mutation={remove}
			variables={project.id}
			onClose={onClose}
			onSuccess={onDeleted}
			successMessage="Project deleted"
		/>
	)
}
